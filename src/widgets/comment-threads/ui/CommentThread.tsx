// Path: src/widgets/comment-threads/ui/CommentThread.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../shared/api/supabase';
import { CommentItem, Comment } from '../../../entities/comment/ui/CommentItem';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';

interface CommentThreadProps {
  verseId: string | number;
  groupId?: string; 
  referenceLabel?: string; 
  currentUserId?: string; 
}

interface Profile {
  username: string;
  display_name?: string;
  avatar_url?: string;
}

// Extend the base Comment type to include the joined profiles and likes
interface ThreadComment extends Omit<Comment, 'profiles'> {
  profiles: Profile;
  likes?: { user_id: string }[];
  user_has_liked?: boolean;
  likes_count?: number;
}

export const CommentThread = ({ verseId, groupId, referenceLabel, currentUserId: propUserId }: CommentThreadProps) => {
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null);
  
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showResolvedFor, setShowResolvedFor] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!currentUserId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUserId(session?.user?.id || null);
      });
    }
  }, [currentUserId]);

  const fetchThread = useCallback(async (showLoading = true) => {
    if (verseId === undefined || verseId === null) return; 
    if (showLoading) setIsLoading(true);
    
    // Determine context: Personal mode (groupId === currentUserId) or Group mode
    const isPersonal = groupId === currentUserId;

    // FIX: Strictly parse the verseId to an integer to match your database schema
    const numericVerseId = typeof verseId === 'string' ? parseInt(verseId, 10) : verseId;

    /**
     * CRITICAL FIX: DISAMBIGUATION
     * ---------------------------
     * 1. profiles:profiles!user_id resolves ambiguity between comments and profiles.
     * 2. likes:likes!comment_id (assuming comment_id is the FK) prevents ambiguity in the likes table.
     */
    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles:profiles!user_id ( 
          username, 
          display_name, 
          avatar_url 
        ),
        likes:likes!comment_id ( user_id )
      `)
      .eq('verse_id', numericVerseId)
      .order('created_at', { ascending: true });

    if (isPersonal) {
      query = query.is('group_id', null).eq('user_id', currentUserId);
    } else if (groupId) {
      query = query.eq('group_id', groupId);
    } else {
      query = query.is('group_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Fetch failed:", error.message);
      // FIX: Clear the old comments out if the fetch fails (or if the group has an error)
      // This prevents the "stuck on last populated group" bug.
      setComments([]);
    } else if (data) {
      const formattedComments = data.map((c) => ({
        ...c,
        // FIX: Ensure profiles array is normalized so it never causes [object Object] bugs
        profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
        likes_count: c.likes?.length || 0,
        user_has_liked: c.likes?.some((l: { user_id: string }) => l.user_id === currentUserId) || false
      }));
      setComments(formattedComments as unknown as ThreadComment[]);
    }
    
    setIsLoading(false);
  }, [verseId, groupId, currentUserId]);

  useEffect(() => {
    if (verseId === undefined || verseId === null || !currentUserId) return;
    fetchThread(isInitialMount.current);
    isInitialMount.current = false;
    
    // FIX: Cast verseId to integer here as well so the Realtime filter successfully matches the DB column
    const numericVerseId = typeof verseId === 'string' ? parseInt(verseId, 10) : verseId;

    const channel = supabase.channel(`verse-${numericVerseId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'comments', 
        filter: `verse_id=eq.${numericVerseId}` 
      }, () => fetchThread(false))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [verseId, groupId, currentUserId, fetchThread]);

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const allChildren = comments.filter(c => c.parent_id === parentId);
    const visibleChildren = allChildren.filter(c => {
      if (c.is_resolved) return parentId === null ? true : showResolvedFor.has(parentId);
      return parentId === null ? true : expandedThreads.has(parentId);
    });

    if (visibleChildren.length === 0 && parentId !== null) return null;

    const containerClass = parentId ? "mt-3" : "space-y-12 pt-6";

    return (
      <div className={containerClass}>
        {visibleChildren.map((comment) => {
          const isExpanded = expandedThreads.has(comment.id);
          const isShowingResolved = showResolvedFor.has(comment.id);
          const activeChildCount = comments.filter(c => c.parent_id === comment.id && !c.is_resolved).length;
          const resolvedChildCount = comments.filter(c => c.parent_id === comment.id && c.is_resolved).length;
          const hasVisibleChildren = (activeChildCount > 0 && isExpanded) || (resolvedChildCount > 0 && isShowingResolved);
          
          if (editingId === comment.id) {
            return (
              <div key={comment.id} className="my-4 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <AddCommentForm 
                  verseId={verseId} 
                  groupId={groupId} 
                  parentId={comment.parent_id} 
                  isEditMode={true} 
                  commentId={comment.id} 
                  initialContent={comment.content} 
                  onCancel={() => setEditingId(null)} 
                  onSuccess={() => { setEditingId(null); fetchThread(false); }} 
                />
              </div>
            );
          }

          let replyingToName;
          if (depth > 0 && comment.parent_id) {
            const parentComment = comments.find(c => c.id === comment.parent_id);
            if (parentComment?.profiles) {
              replyingToName = parentComment.profiles.display_name || parentComment.profiles.username;
            }
          }

          return (
            <div key={comment.id} className="flex flex-col mb-4">
              <CommentItem 
                comment={comment as unknown as Comment} 
                currentUserId={currentUserId || undefined} 
                replyingToName={replyingToName} 
                onReplyClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} 
                onEditClick={() => setEditingId(comment.id)} 
                onDeleteClick={async () => {
                  if (confirm('Delete this insight?')) {
                    await supabase.from('comments').delete().eq('id', comment.id);
                    fetchThread(false);
                  }
                }} 
                onResolveClick={async () => {
                  await supabase.from('comments').update({ is_resolved: !comment.is_resolved }).eq('id', comment.id);
                  fetchThread(false);
                }} 
                onLikeClick={async () => {
                  if (!currentUserId) return; 
                  const isLiking = !comment.user_has_liked;
                  try {
                    if (isLiking) await supabase.from('likes').insert({ comment_id: comment.id, user_id: currentUserId });
                    else await supabase.from('likes').delete().eq('comment_id', comment.id).eq('user_id', currentUserId);
                    fetchThread(false);
                  } catch { fetchThread(false); }
                }} 
                replyCount={activeChildCount} 
                isExpanded={isExpanded} 
                onToggleReplies={() => setExpandedThreads(prev => { 
                  const n = new Set(prev); 
                  if (n.has(comment.id)) n.delete(comment.id); 
                  else n.add(comment.id); 
                  return n; 
                })} 
                resolvedCount={resolvedChildCount} 
                onToggleResolved={() => setShowResolvedFor(prev => { 
                  const n = new Set(prev); 
                  if (n.has(comment.id)) n.delete(comment.id); 
                  else n.add(comment.id); 
                  return n; 
                })} 
                isResolvedExpanded={isShowingResolved} 
              />
              
              {(replyTo === comment.id || hasVisibleChildren) && (
                <div className={depth < 2 ? "pl-3.5 ml-1 border-l border-slate-300 dark:border-slate-700" : "mt-2"}>
                  {replyTo === comment.id && (
                    <div className="mt-3 mb-4 px-1">
                      <AddCommentForm 
                        verseId={verseId} 
                        groupId={groupId} 
                        parentId={comment.id} 
                        onCancel={() => setReplyTo(null)} 
                        onSuccess={() => { setReplyTo(null); fetchThread(false); }} 
                      />
                    </div>
                  )}
                  {hasVisibleChildren && renderTree(comment.id, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (verseId === undefined || verseId === null) return null;

  if (isLoading) {
    return (
      <div className="space-y-6 pt-4 px-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-5 h-5 bg-slate-100 dark:bg-slate-800 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
              <div className="h-12 bg-slate-50 dark:bg-slate-800/40 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-32">
      {referenceLabel && (
        <div className="sticky top-0 z-20 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-4 border-b border-slate-200 dark:border-slate-800 mb-2 px-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-500">{referenceLabel}</h2>
        </div>
      )}
      {comments.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 mx-2 mt-4">
          <p className="text-slate-400 text-xs italic">No commentary yet. Be the first to share an insight.</p>
        </div>
      ) : (
        renderTree(null, 0)
      )}
    </div>
  );
};