// Path: src/widgets/comment-threads/ui/CommentThread.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../shared/api/supabase';
import { CommentItem, Comment } from '../../../entities/comment/ui/CommentItem';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';
import { CommentSortSelect, CommentSortOption } from '../../../features/comments/sort-comments/ui/CommentSortSelect';

interface Profile {
  username: string;
  display_name?: string;
  avatar_url?: string;
}

interface ThreadComment extends Omit<Comment, 'profiles'> {
  profiles: Profile;
  title?: string;
  likes?: { user_id: string }[];
  user_has_liked?: boolean;
  likes_count?: number;
  
  reply_count?: number;
  latest_reply_at?: string | null;
  isNew?: boolean;
  hasNewReplies?: boolean;
}

interface CommentThreadProps {
  verseId: string | number;
  groupId?: string; 
  referenceLabel?: string; 
  currentUserId?: string; 
}

export const CommentThread = ({ verseId, groupId, referenceLabel, currentUserId: propUserId }: CommentThreadProps) => {
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null);
  
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showResolvedFor, setShowResolvedFor] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState<CommentSortOption>('newest');
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);

  // 1. Resolve Session User
  useEffect(() => {
    if (!currentUserId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUserId(session?.user?.id || null);
      });
    }
  }, [currentUserId]);

  // 2. Fetch Read Receipt for Unread Status
  useEffect(() => {
    const fetchReadReceipt = async () => {
      if (!currentUserId) return;
      let query = supabase.from('verse_read_receipts').select('last_read_at').eq('user_id', currentUserId).eq('verse_id', String(verseId));
      if (groupId) query = query.eq('group_id', groupId);
      else query = query.is('group_id', null);

      const { data } = await query.maybeSingle();
      if (data?.last_read_at) setLastReadAt(new Date(data.last_read_at));
      else setLastReadAt(new Date(0));
    };
    fetchReadReceipt();
  }, [verseId, groupId, currentUserId]);

  // 3. Fetch Full Thread Data
  const fetchThread = useCallback(async (showLoading = true) => {
    if (verseId === undefined || verseId === null) return; 
    
    // Instantly wipe old state and show loader if this is a context switch
    if (showLoading) {
      setLoading(true);
      setComments([]); 
    }
    
    const isPersonal = groupId === currentUserId;
    const numericVerseId = typeof verseId === 'string' ? parseInt(verseId, 10) : verseId;

    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles:profiles!user_id ( username, display_name, avatar_url ),
        likes:likes!comment_id ( user_id )
      `)
      .eq('verse_id', numericVerseId)
      .order('created_at', { ascending: true });

    if (isPersonal) query = query.is('group_id', null).eq('user_id', currentUserId);
    else if (groupId) query = query.eq('group_id', groupId);
    else query = query.is('group_id', null);

    const { data, error } = await query;

    if (error) {
      console.error("Fetch failed:", error.message);
      setComments([]);
    } else if (data) {
      const formattedComments = data.map((c) => ({
        ...c,
        profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
        likes_count: c.likes?.length || 0,
        user_has_liked: c.likes?.some((l: { user_id: string }) => l.user_id === currentUserId) || false
      }));
      setComments(formattedComments as unknown as ThreadComment[]);
    }
    
    setLoading(false);
  }, [verseId, groupId, currentUserId]);

  // 4. Initialization & Realtime
  useEffect(() => {
    if (verseId === undefined || verseId === null || !currentUserId) return;
    
    // Force a fresh loading state every time verseId or groupId changes
    // Defer the state update to avoid React synchronous setState warnings
    Promise.resolve().then(() => {
      fetchThread(true);
    });
    
    const numericVerseId = typeof verseId === 'string' ? parseInt(verseId, 10) : verseId;

    const channel = supabase.channel(`verse-${numericVerseId}-${groupId || 'personal'}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'comments', 
        filter: `verse_id=eq.${numericVerseId}` 
      }, () => fetchThread(false)) // Realtime updates shouldn't trigger the skeleton loader
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [verseId, groupId, currentUserId, fetchThread]);

  const handleMarkRead = async () => {
    if (!currentUserId || !verseId) return;
    // Mark the whole verse context as read when a user interacts with a comment
    await supabase.rpc('mark_verse_as_read', {
      p_user_id: currentUserId,
      p_verse_id: String(verseId),
      p_group_id: groupId || null
    });
  };

  // 5. Compute Thread Stats & Sort Top-Level Roots
  const { rootComments, enrichedComments } = useMemo(() => {
    const getDescendants = (parentId: string): ThreadComment[] => {
      const children = comments.filter(c => c.parent_id === parentId);
      let all = [...children];
      children.forEach(c => { all = all.concat(getDescendants(c.id)); });
      return all;
    };

    const enriched = comments.map(c => {
      const descendants = getDescendants(c.id);
      
      // Ensure we don't flag our own comments as "Brand New"
      const isBrandNew = lastReadAt && new Date(c.created_at) > lastReadAt && c.user_id !== currentUserId;
      
      // Only check descendants written by OTHER users to flag "New Replies"
      const otherDescendants = descendants.filter(d => d.user_id !== currentUserId);
      const latest_reply_at = otherDescendants.length > 0 
        ? otherDescendants.reduce((max, desc) => new Date(desc.created_at) > new Date(max) ? desc.created_at : max, new Date(0).toISOString())
        : null;
        
      const hasNewReplies = !isBrandNew && lastReadAt && latest_reply_at && new Date(latest_reply_at) > lastReadAt;

      return {
        ...c,
        reply_count: descendants.length,
        latest_reply_at,
        isNew: !!isBrandNew,
        hasNewReplies: !!hasNewReplies
      };
    });

    const roots = enriched.filter(c => c.parent_id === null).sort((a, b) => {
      const aIsUnread = a.isNew || a.hasNewReplies;
      const bIsUnread = b.isNew || b.hasNewReplies;

      if (aIsUnread && !bIsUnread) return -1;
      if (!aIsUnread && bIsUnread) return 1;

      switch (sortOption) {
        case 'newest': 
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': 
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_liked': 
          return (b.likes_count || 0) - (a.likes_count || 0);
        case 'recent_reply': {
          const aLatest = Math.max(new Date(a.created_at).getTime(), a.latest_reply_at ? new Date(a.latest_reply_at).getTime() : 0);
          const bLatest = Math.max(new Date(b.created_at).getTime(), b.latest_reply_at ? new Date(b.latest_reply_at).getTime() : 0);
          return bLatest - aLatest;
        }
        case 'most_activity': {
          const aActivity = (a.likes_count || 0) + (a.reply_count || 0);
          const bActivity = (b.likes_count || 0) + (b.reply_count || 0);
          return bActivity - aActivity;
        }
        default: 
          return 0;
      }
    });

    return { rootComments: roots, enrichedComments: enriched };
  }, [comments, lastReadAt, sortOption, currentUserId]);

  // 6. Recursive Tree Rendering
  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const children = parentId === null 
      ? rootComments 
      : enrichedComments.filter(c => c.parent_id === parentId);
    
    const visibleChildren = children.filter(c => {
      if (c.is_resolved) return parentId === null ? true : showResolvedFor.has(parentId);
      return parentId === null ? true : expandedThreads.has(parentId);
    });

    if (visibleChildren.length === 0 && parentId !== null) return null;

    const containerClass = parentId ? "mt-3 w-full min-w-0" : "space-y-6 pt-4 w-full min-w-0";

    return (
      <div className={containerClass}>
        {visibleChildren.map((comment) => {
          const isExpanded = expandedThreads.has(comment.id);
          const isShowingResolved = showResolvedFor.has(comment.id);
          const activeChildCount = enrichedComments.filter(c => c.parent_id === comment.id && !c.is_resolved).length;
          const resolvedChildCount = enrichedComments.filter(c => c.parent_id === comment.id && c.is_resolved).length;
          const hasVisibleChildren = (activeChildCount > 0 && isExpanded) || (resolvedChildCount > 0 && isShowingResolved);
          
          if (editingId === comment.id) {
            return (
              <div key={comment.id} className="my-4 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl w-full min-w-0">
                <AddCommentForm 
                  verseId={verseId} 
                  groupId={groupId} 
                  parentId={comment.parent_id} 
                  isEditMode={true} 
                  commentId={comment.id} 
                  initialContent={comment.content} 
                  initialTitle={comment.title} 
                  onCancel={() => setEditingId(null)} 
                  onSuccess={() => { setEditingId(null); fetchThread(false); }} 
                />
              </div>
            );
          }

          let replyingToName;
          if (depth > 0 && comment.parent_id) {
            const parentComment = enrichedComments.find(c => c.id === comment.parent_id);
            replyingToName = parentComment?.profiles?.display_name || parentComment?.profiles?.username;
          }

          return (
            <div key={comment.id} className="flex flex-col mb-4 w-full min-w-0">
              <CommentItem 
                comment={comment as unknown as Comment} 
                currentUserId={currentUserId || undefined} 
                replyingToName={replyingToName} 
                isNew={comment.isNew}
                hasNewReplies={comment.hasNewReplies && depth === 0}
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
                  try {
                    if (!comment.user_has_liked) await supabase.from('likes').insert({ comment_id: comment.id, user_id: currentUserId });
                    else await supabase.from('likes').delete().eq('comment_id', comment.id).eq('user_id', currentUserId);
                    fetchThread(false);
                  } catch { fetchThread(false); }
                }} 
                onRead={handleMarkRead}
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
                <div className={depth < 2 ? "pl-3.5 ml-1 border-l border-slate-300 dark:border-slate-700 w-full min-w-0" : "mt-2 w-full min-w-0"}>
                  {replyTo === comment.id && (
                    <div className="mt-3 mb-4 px-1 w-full min-w-0">
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

  if (loading) {
    return (
      <div className="space-y-6 pt-4 px-2 w-full min-w-0 animate-in fade-in duration-300">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 w-full min-w-0">
            <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0 animate-pulse mt-1" />
            <div className="flex-1 space-y-3 pt-1 min-w-0 w-full">
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3 animate-pulse" />
              <div className="h-16 bg-slate-50 dark:bg-slate-800/40 rounded-2xl w-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-32 w-full min-w-0">
      {referenceLabel && (
        <div className="sticky top-0 z-20 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-4 border-b border-slate-200 dark:border-slate-800 mb-2 px-2 w-full min-w-0">
          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-500 truncate">{referenceLabel}</h2>
        </div>
      )}
      
      {comments.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mt-4 mb-2 mx-2 w-full min-w-0">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
            Discussions ({rootComments.length})
          </h3>
          {rootComments.length > 1 && (
            <div className="shrink-0 max-w-[50%]">
              <CommentSortSelect value={sortOption} onChange={setSortOption} />
            </div>
          )}
        </div>
      )}

      {comments.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 mx-2 mt-4 w-full min-w-0">
          <p className="text-slate-400 text-xs italic">No commentary yet. Be the first to share an insight.</p>
        </div>
      ) : (
        renderTree(null, 0)
      )}
    </div>
  );
};