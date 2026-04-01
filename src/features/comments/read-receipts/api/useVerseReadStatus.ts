// Path: src/features/comments/read-receipts/api/useVerseReadStatus.ts
import { useState, useEffect, useCallback } from 'react';
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

  const fetchStatus = useCallback(async () => {
    if (!verseId || !userId) {
      setStatus('none');
      return;
    }

    try {
      // 1. Fetch the user's read receipt
      let receiptQuery = supabase
        .from('verse_read_receipts')
        .select('last_read_at')
        .eq('user_id', userId)
        .eq('verse_id', String(verseId));

      if (groupId) receiptQuery = receiptQuery.eq('group_id', groupId);
      else receiptQuery = receiptQuery.is('group_id', null);

      const { data: receipt, error: receiptErr } = await receiptQuery.maybeSingle();
      if (receiptErr) throw receiptErr;

      const lastReadDate = receipt ? new Date(receipt.last_read_at) : new Date(0);

      // 2. Check for ANY comments (including the user's own) to show the 'read' dot
      let anyCommentsQuery = supabase
        .from('comments')
        .select('id')
        .eq('verse_id', String(verseId))
        .limit(1);
      
      if (groupId) anyCommentsQuery = anyCommentsQuery.eq('group_id', groupId);
      else anyCommentsQuery = anyCommentsQuery.is('group_id', null);

      const { data: anyComments } = await anyCommentsQuery;
      
      // If no comments at all exist, hide the dot
      if (!anyComments || anyComments.length === 0) {
        setStatus('none');
        return;
      }

      // 3. Check for UNREAD comments specifically by OTHER users
      let unreadQuery = supabase
        .from('comments')
        .select('id')
        .eq('verse_id', String(verseId))
        .neq('user_id', userId) // Prevent the user's own comments from triggering 'unread'
        .gt('created_at', lastReadDate.toISOString())
        .limit(1);
        
      if (groupId) unreadQuery = unreadQuery.eq('group_id', groupId);
      else unreadQuery = unreadQuery.is('group_id', null);

      const { data: unreadComments } = await unreadQuery;

      if (unreadComments && unreadComments.length > 0) {
        setStatus('unread');
      } else {
        setStatus('read');
      }
    } catch (err) {
      console.error('Failed to fetch verse read status:', err);
      setStatus('none');
    }
  }, [verseId, groupId, userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime Listener
  useEffect(() => {
    if (!verseId || !userId) return;

    const channel = supabase.channel(`verse-comments-${verseId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `verse_id=eq.${verseId}`
      }, (payload) => {
        // Only trigger 'unread' if the new comment is from someone else
        if (payload.new.user_id !== userId) {
          setStatus('unread');
        } else {
          // If we wrote a comment, and the status was 'none', it should now be 'read'
          setStatus(prev => prev === 'none' ? 'read' : prev);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [verseId, userId]);

  const markAsRead = async () => {
    if (!verseId || !userId) return;
    
    // Optimistic UI update to instantly turn the dot green/blue
    setStatus(prev => prev === 'unread' ? 'read' : prev);

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