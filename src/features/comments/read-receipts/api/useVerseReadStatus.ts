// Path: src/features/comments/read-receipts/api/useVerseReadStatus.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/shared/api/supabase';

type ReadStatus = 'unread' | 'read' | 'none';

/**
 * Custom hook to determine if a verse has unread commentary for the current user.
 * Explicitly filters out comments authored by the current user to prevent false positives.
 */
export const useVerseReadStatus = (
  verseId?: string | number,
  groupId?: string | null,
  userId?: string | null
) => {
  const [status, setStatus] = useState<ReadStatus>('none');
  const isMounted = useRef(true);

  // Track mounting status to prevent state updates on unmounted components
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchStatus = useCallback(async (retryCount = 0) => {
    if (!verseId || !userId) {
      if (isMounted.current) setStatus('none');
      return;
    }

    try {
      const stringVerseId = String(verseId);

      // 1. Prepare queries for the read receipt AND comment existence
      let receiptQuery = supabase
        .from('verse_read_receipts')
        .select('last_read_at')
        .eq('user_id', userId)
        .eq('verse_id', stringVerseId);

      if (groupId) receiptQuery = receiptQuery.eq('group_id', groupId);
      else receiptQuery = receiptQuery.is('group_id', null);

      let anyCommentsQuery = supabase
        .from('comments')
        .select('id')
        .eq('verse_id', stringVerseId)
        .limit(1);
      
      if (groupId) anyCommentsQuery = anyCommentsQuery.eq('group_id', groupId);
      else anyCommentsQuery = anyCommentsQuery.is('group_id', null);

      // PERFORMANCE BOOST: Run receipt fetch and existence check concurrently
      const [receiptRes, anyCommentsRes] = await Promise.all([
        receiptQuery.maybeSingle(),
        anyCommentsQuery
      ]);

      if (receiptRes.error) throw receiptRes.error;
      if (anyCommentsRes.error) throw anyCommentsRes.error;
      if (!isMounted.current) return;

      // 2. If no comments at all exist, hide the dot entirely and skip step 3
      if (!anyCommentsRes.data || anyCommentsRes.data.length === 0) {
        setStatus('none');
        return;
      }

      const lastReadDate = receiptRes.data ? new Date(receiptRes.data.last_read_at) : new Date(0);

      // 3. Check for UNREAD comments specifically by OTHER users
      let unreadQuery = supabase
        .from('comments')
        .select('id')
        .eq('verse_id', stringVerseId)
        .neq('user_id', userId) // Prevent the user's own comments from triggering 'unread'
        .gt('created_at', lastReadDate.toISOString())
        .limit(1);
        
      if (groupId) unreadQuery = unreadQuery.eq('group_id', groupId);
      else unreadQuery = unreadQuery.is('group_id', null);

      const { data: unreadComments, error: unreadErr } = await unreadQuery;
      if (unreadErr) throw unreadErr;
      if (!isMounted.current) return;

      if (unreadComments && unreadComments.length > 0) {
        setStatus('unread');
      } else {
        setStatus('read');
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      const errorMsg = err instanceof Error ? err.message : String(errorObj?.message || err);
      
      // Catch Supabase Auth GoTrue lock contention errors caused by massive concurrent fetching
      if ((errorMsg.includes('AbortError') || errorMsg.includes('Lock broken') || errorMsg.includes('fetch')) && retryCount < 3) {
        if (isMounted.current) {
          // Exponential backoff with jitter
          const delay = Math.pow(2, retryCount) * 500 + Math.random() * 1000;
          setTimeout(() => {
            if (isMounted.current) fetchStatus(retryCount + 1);
          }, delay);
          return;
        }
      }
      
      console.error('Failed to fetch verse read status:', err);
      if (isMounted.current) setStatus('none');
    }
  }, [verseId, groupId, userId]);

  useEffect(() => {
    // Initial tiny stagger to prevent all 30+ verses from hitting the auth lock at the exact same millisecond
    const timer = setTimeout(() => {
      if (isMounted.current) fetchStatus(0);
    }, Math.random() * 400);
    
    return () => clearTimeout(timer);
  }, [fetchStatus]);

  // Realtime Listener
  useEffect(() => {
    if (!verseId || !userId) return;

    const channel = supabase.channel(`verse-comments-${verseId}`)
      .on('postgres_changes', {
        event: '*', // FIX: Listen to all events to catch DELETE operations
        schema: 'public',
        table: 'comments',
        filter: `verse_id=eq.${verseId}`
      }, (payload) => {
        if (!isMounted.current) return;
        
        if (payload.eventType === 'DELETE') {
          // If a comment is deleted, re-evaluate to see if it was the last one
          fetchStatus(0);
        } else if (payload.eventType === 'INSERT') {
          // Only trigger 'unread' if the new comment is from someone else
          if (payload.new.user_id !== userId) {
            setStatus('unread');
          } else {
            // If we wrote a comment, and the status was 'none', it should now be 'read'
            setStatus(prev => prev === 'none' ? 'read' : prev);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [verseId, userId, fetchStatus]);

  const markAsRead = async () => {
    if (!verseId || !userId) return;
    
    // Optimistic UI update to instantly turn the dot green/blue
    if (isMounted.current) {
      setStatus(prev => prev === 'unread' ? 'read' : prev);
    }

    try {
      let query = supabase
        .from('verse_read_receipts')
        .select('id')
        .eq('user_id', userId)
        .eq('verse_id', String(verseId));

      if (groupId) query = query.eq('group_id', groupId);
      else query = query.is('group_id', null);

      const { data: existing } = await query.maybeSingle();

      if (existing?.id) {
        await supabase.from('verse_read_receipts')
          .update({ last_read_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('verse_read_receipts')
          .insert({
            user_id: userId,
            group_id: groupId || null,
            verse_id: String(verseId),
            last_read_at: new Date().toISOString()
          });
      }
    } catch (err) {
      console.error('Failed to update verse read receipt:', err);
    }
  };

  return { status, markAsRead };
};