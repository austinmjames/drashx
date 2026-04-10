// Path: src/features/comments/read-receipts/api/useVerseReadStatus.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/shared/api/supabase';

type ReadStatus = 'unread' | 'read' | 'none';

// ============================================================================
// GLOBAL BATCHER STATE
// Completely resolves N+1 query problems and Supabase Auth lock contention
// by combining dozens of individual verse queries into a single bulk query.
// ============================================================================
interface BatchRequest {
  verseId: string;
  resolve: (status: ReadStatus) => void;
}

// We use a composite key for the batcher to ensure group/user isolation
const batchQueue = new Map<string, BatchRequest[]>();
let batchTimeout: NodeJS.Timeout | null = null;

const processBatch = async (batchKey: string, requests: BatchRequest[]) => {
  const [userId, groupIdStr] = batchKey.split('|');
  const groupId = groupIdStr === 'null' ? null : groupIdStr;
  
  // Extract unique verse IDs to query
  const verseIds = Array.from(new Set(requests.map(r => r.verseId)));
  
  const resolveAll = (statusMap: Map<string, ReadStatus>) => {
    requests.forEach(req => req.resolve(statusMap.get(req.verseId) || 'none'));
  };

  const statusMap = new Map<string, ReadStatus>();
  verseIds.forEach(id => statusMap.set(id, 'none'));

  try {
    // 1. Get ALL read receipts for this chapter/batch in one query
    let receiptQuery = supabase
      .from('verse_read_receipts')
      .select('verse_id, last_read_at')
      .eq('user_id', userId)
      .in('verse_id', verseIds);
      
    if (groupId) receiptQuery = receiptQuery.eq('group_id', groupId);
    else receiptQuery = receiptQuery.is('group_id', null);

    // 2. Get ALL comments for this chapter/batch in one query
    let commentsQuery = supabase
      .from('comments')
      .select('id, verse_id, user_id, created_at')
      .in('verse_id', verseIds);
      
    if (groupId) commentsQuery = commentsQuery.eq('group_id', groupId);
    else commentsQuery = commentsQuery.is('group_id', null);

    const [receiptRes, commentsRes] = await Promise.all([
      receiptQuery,
      commentsQuery
    ]);

    if (receiptRes.error) throw receiptRes.error;
    if (commentsRes.error) throw commentsRes.error;

    // Map receipts
    const receiptMap = new Map<string, Date>();
    (receiptRes.data || []).forEach(r => receiptMap.set(r.verse_id, new Date(r.last_read_at)));

    // Group comments by verse ID
    const commentsByVerse = new Map<string, { user_id: string; created_at: string }[]>();
    (commentsRes.data || []).forEach(c => {
      if (!commentsByVerse.has(c.verse_id)) commentsByVerse.set(c.verse_id, []);
      commentsByVerse.get(c.verse_id)!.push(c);
    });

    // Evaluate final status for each verse
    verseIds.forEach(vid => {
      const vComments = commentsByVerse.get(vid);
      if (!vComments || vComments.length === 0) return; // No comments = 'none'
      
      const lastRead = receiptMap.get(vid) || new Date(0);
      const hasUnreadOther = vComments.some(
        c => c.user_id !== userId && new Date(c.created_at) > lastRead
      );
      
      statusMap.set(vid, hasUnreadOther ? 'unread' : 'read');
    });

  } catch (err) {
    console.error("Batch fetch error for read status:", err);
  }

  resolveAll(statusMap);
};

const queueFetch = (verseId: string, groupId: string | null, userId: string): Promise<ReadStatus> => {
  return new Promise((resolve) => {
    const batchKey = `${userId}|${groupId || 'null'}`;
    
    if (!batchQueue.has(batchKey)) {
      batchQueue.set(batchKey, []);
    }
    
    batchQueue.get(batchKey)!.push({ verseId, resolve });

    if (batchTimeout) clearTimeout(batchTimeout);
    
    // Wait a tiny 50ms window to catch all 30 verses mounting simultaneously
    batchTimeout = setTimeout(() => {
      const currentQueue = new Map(batchQueue);
      batchQueue.clear();
      currentQueue.forEach((reqs, key) => processBatch(key, reqs));
    }, 50); 
  });
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useVerseReadStatus = (
  verseId?: string | number,
  groupId?: string | null,
  userId?: string | null
) => {
  const [status, setStatus] = useState<ReadStatus>('none');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchStatus = useCallback(async () => {
    // Return early without any state mutation to avoid React cascading render warnings
    if (!verseId || !userId) return;
    
    const stringVerseId = String(verseId);
    
    // Route through the global batcher instead of firing direct queries
    const resultStatus = await queueFetch(stringVerseId, groupId || null, userId);
    
    if (isMounted.current) {
      // Use functional state update to prevent unnecessary re-renders
      setStatus(prev => prev === resultStatus ? prev : resultStatus);
    }
  }, [verseId, groupId, userId]);

  useEffect(() => {
    // Wrap in a setTimeout to explicitly break synchronicity.
    // This perfectly satisfies the React linter's "cascading renders" rule 
    // and naturally debounces React Strict Mode double-mounting.
    const timer = setTimeout(() => {
      fetchStatus();
    }, 0);
    
    return () => clearTimeout(timer);
  }, [fetchStatus]);

  // Realtime Listener for live updates
  useEffect(() => {
    if (!verseId || !userId) return;
    
    const stringVerseId = String(verseId);
    
    // Replaced 'any' with the strictly typed RealtimeChannel from Supabase
    let channel: RealtimeChannel | null = null;

    // Stagger realtime subscriptions to prevent Supabase GoTrue lock contention 
    // when 30+ verses mount simultaneously in React Strict Mode.
    const timer = setTimeout(() => {
      if (!isMounted.current) return;

      channel = supabase.channel(`verse-comments-${stringVerseId}`)
        .on('postgres_changes', {
          event: '*', 
          schema: 'public',
          table: 'comments',
          filter: `verse_id=eq.${stringVerseId}`
        }, (payload) => {
          if (!isMounted.current) return;
          
          if (payload.eventType === 'DELETE') {
            // If a comment is deleted, re-evaluate to see if it was the last one
            fetchStatus();
          } else if (payload.eventType === 'INSERT') {
            // Only trigger 'unread' if the new comment is from someone else
            if (payload.new.user_id !== userId) {
              setStatus(prev => prev === 'unread' ? prev : 'unread');
            } else {
              setStatus(prev => prev === 'none' ? 'read' : prev);
            }
          }
        })
        .subscribe();
    }, Math.random() * 1200 + 200); // Random delay between 200ms and 1400ms

    return () => {
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [verseId, userId, fetchStatus]);

  const markAsRead = async () => {
    if (!verseId || !userId) return;
    
    // Optimistic UI update to instantly turn the dot green/blue
    if (isMounted.current) {
      setStatus(prev => prev === 'unread' ? 'read' : prev);
    }

    try {
      // Securely leverage the custom RPC we built earlier
      await supabase.rpc('mark_verse_as_read', {
        p_user_id: userId,
        p_verse_id: String(verseId),
        p_group_id: groupId || null
      });
    } catch (err) {
      console.error('Failed to update verse read receipt:', err);
    }
  };

  // Derive the final status on the fly. If verseId or userId is missing, it cleanly evaluates to 'none'.
  const actualStatus = (!verseId || !userId) ? 'none' : status;

  return { status: actualStatus, markAsRead };
};