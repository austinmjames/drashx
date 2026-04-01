// Path: src/features/comments/read-receipts/api/useVerseReadStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/shared/api/supabase';

type ReadStatus = 'unread' | 'read' | 'none';

/**
 * Custom hook to determine if a verse has unread commentary for the current user.
 * Compares the latest comment's timestamp against the user's read receipt.
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
      // 1. Check if there are ANY comments for this verse in the current context
      let commentsQuery = supabase
        .from('comments')
        .select('created_at')
        .eq('verse_id', String(verseId))
        .order('created_at', { ascending: false })
        .limit(1);

      if (groupId) commentsQuery = commentsQuery.eq('group_id', groupId);
      else commentsQuery = commentsQuery.is('group_id', null);

      const { data: comments, error: commentsErr } = await commentsQuery;

      if (commentsErr) throw commentsErr;

      // If no comments exist, there is no dot to show
      if (!comments || comments.length === 0) {
        setStatus('none');
        return;
      }

      const latestCommentDate = new Date(comments[0].created_at);

      // 2. Fetch the user's read receipt for this exact verse and group
      let receiptQuery = supabase
        .from('verse_read_receipts')
        .select('last_read_at')
        .eq('user_id', userId)
        .eq('verse_id', String(verseId));

      if (groupId) receiptQuery = receiptQuery.eq('group_id', groupId);
      else receiptQuery = receiptQuery.is('group_id', null);

      const { data: receipt, error: receiptErr } = await receiptQuery.maybeSingle();

      if (receiptErr) throw receiptErr;

      // 3. Evaluate Unread vs Read
      if (!receipt) {
        // Has comments, but user has never recorded a read receipt
        setStatus('unread');
      } else {
        const lastReadDate = new Date(receipt.last_read_at);
        // If the latest comment is newer than the receipt, it's unread
        setStatus(latestCommentDate > lastReadDate ? 'unread' : 'read');
      }
    } catch (err) {
      console.error('Failed to fetch verse read status:', err);
      setStatus('none');
    }
  }, [verseId, groupId, userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime Listener: Automatically trigger blue dot if someone else comments right now
  useEffect(() => {
    if (!verseId) return;

    const channel = supabase.channel(`verse-comments-${verseId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `verse_id=eq.${verseId}`
      }, (payload) => {
        if (payload.new.user_id !== userId) {
          setStatus('unread');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [verseId, userId]);

  /**
   * Fires when the user clicks the verse card to open the insights panel
   */
  const markAsRead = async () => {
    if (!verseId || !userId) return;
    
    // Optimistic UI update to instantly turn the dot green
    setStatus(prev => prev === 'unread' ? 'read' : prev);

    try {
      // Manual SELECT then UPDATE/INSERT to bypass complex partial unique index conflicts
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