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
  scholarly_score?: number;
}

interface ThreadComment extends Omit<Comment, 'profiles'> {
  profiles: Profile;
  title?: string;
  likes?: { user_id: string }[];
  bookmarks?: { user_id: string }[];
  group?: { name: string } | null;
  user_has_liked?: boolean;
  user_has_bookmarked?: boolean;
  likes_count?: number;
  
  reply_count?: number;
  latest_reply_at?: string | null;
  isNew?: boolean;
  hasNewReplies?: boolean;
}

type FetchedComment = Comment & {
  likes?: { user_id: string }[];
  bookmarks?: { user_id: string }[];
};

interface CommentThreadProps {
  verseId: string; 
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

  const isPersonal = !groupId || groupId === currentUserId;

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
      if (!currentUserId || !verseId) return;
      
      let query = supabase
        .from('verse_read_receipts')
        .select('last_read_at')
        .eq('user_id', currentUserId)
        .eq('verse_id', verseId);

      if (groupId) query = query.eq('group_id', groupId);
      else query = query.is('group_id', null);

      const { data } = await query.maybeSingle();
      if (data?.last_read_at) setLastReadAt(new Date(data.last_read_at));
      else setLastReadAt(new Date(0));
    };
    fetchReadReceipt();
  }, [verseId, groupId, currentUserId]);

  // 3. Fetch Full Thread Data (Restored explicit query variables for clarity)
  const fetchThread = useCallback(async (showLoading = true) => {
    if (!verseId || !currentUserId) return; 
    
    if (showLoading) {
      setLoading(true);
      setComments([]); 
    }
    
    let fetchedComments: FetchedComment[] = [];

    const selectQuery = `
      *,
      profiles:profiles!user_id ( username, display_name, avatar_url, scholarly_score ),
      likes ( user_id ),
      bookmarks ( user_id ),
      group:groups ( name )
    `;

    const bookmarkedQuery = `
      *,
      profiles:profiles!user_id ( username, display_name, avatar_url, scholarly_score ),
      likes ( user_id ),
      bookmarks!inner ( user_id ),
      group:groups ( name )
    `;

    try {
      if (isPersonal) {
        // Fetch User's personal comments + any comments they bookmarked from other groups for this verse
        const [personalRes, bookmarkedRes] = await Promise.all([
          supabase.from('comments')
            .select(selectQuery)
            .eq('verse_id', verseId)
            .is('group_id', null)
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: true }),
          supabase.from('comments')
            .select(bookmarkedQuery)
            .eq('verse_id', verseId)
            .eq('bookmarks.user_id', currentUserId)
            .order('created_at', { ascending: true })
        ]);

        if (personalRes.data) fetchedComments.push(...(personalRes.data as unknown as FetchedComment[]));
        if (bookmarkedRes.data) fetchedComments.push(...(bookmarkedRes.data as unknown as FetchedComment[]));

        const seen = new Set();
        fetchedComments = fetchedComments.filter(c => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });

      } else {
        // Group view: Fetch group comments
        const { data, error } = await supabase.from('comments')
          .select(selectQuery)
          .eq('verse_id', verseId)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        if (data) fetchedComments = data as unknown as FetchedComment[];
      }

      const formattedComments = fetchedComments.map((c) => ({
        ...c,
        profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
        group: Array.isArray(c.group) ? c.group[0] : c.group,
        likes_count: c.likes?.length || 0,
        user_has_liked: c.likes?.some((l: { user_id: string }) => l.user_id === currentUserId) || false,
        user_has_bookmarked: c.bookmarks?.some((b: { user_id: string }) => b.user_id === currentUserId) || false
      }));
      
      setComments(formattedComments as unknown as ThreadComment[]);
    } catch (err) {
      console.error("Comment fetch failed:", err);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [verseId, groupId, currentUserId, isPersonal]);

  // 4. Realtime Subscription
  useEffect(() => {
    if (!verseId || !currentUserId) return;
    
    fetchThread(true);
    
    const channel = supabase.channel(`verse-${verseId}-${groupId || 'personal'}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'comments', 
        filter: `verse_id=eq.${verseId}` 
      }, () => fetchThread(false)) 
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [verseId, groupId, currentUserId, fetchThread]);

  const handleMarkRead = async () => {
    if (!currentUserId || !verseId) return;
    await supabase.rpc('mark_verse_as_read', {
      p_user_id: currentUserId,
      p_verse_id: verseId,
      p_group_id: groupId || null
    });
  };

  const handleBookmarkToggle = async (comment: ThreadComment) => {
    if (!currentUserId) return;
    try {
      if (!comment.user_has_bookmarked) {
        await supabase.from('bookmarks').insert({ comment_id: comment.id, user_id: currentUserId });
      } else {
        await supabase.from('bookmarks').delete().eq('comment_id', comment.id).eq('user_id', currentUserId);
      }
      fetchThread(false);
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  };

  // 5. Threading & Sorting Logic
  const { rootComments, enrichedComments } = useMemo(() => {
    const getDescendants = (parentId: string): ThreadComment[] => {
      const children = comments.filter(c => c.parent_id === parentId);
      let all = [...children];
      children.forEach(c => { all = all.concat(getDescendants(c.id)); });
      return all;
    };

    const enriched = comments.map(c => {
      const descendants = getDescendants(c.id);
      const isBrandNew = lastReadAt && new Date(c.created_at) > lastReadAt && c.user_id !== currentUserId;
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

    const roots = enriched.filter(c => c.parent_id === null || !enriched.some(p => p.id === c.parent_id)).sort((a, b) => {
      const aIsUnread = a.isNew || a.hasNewReplies;
      const bIsUnread = b.isNew || b.hasNewReplies;

      if (aIsUnread && !bIsUnread) return -1;
      if (!aIsUnread && bIsUnread) return 1;

      switch (sortOption) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_liked': return (b.likes_count || 0) - (a.likes_count || 0);
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
        default: return 0;
      }
    });

    return { rootComments: roots, enrichedComments: enriched };
  }, [comments, lastReadAt, sortOption, currentUserId]);

  // 6. Tree Rendering Function
  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const children = parentId === null 
      ? rootComments 
      : enrichedComments.filter(c => c.parent_id === parentId);
    
    const visibleChildren = children.filter(c => {
      if (c.is_resolved) return parentId === null ? true : showResolvedFor.has(parentId);
      return parentId === null ? true : expandedThreads.has(parentId);
    });

    if (visibleChildren.length === 0 && parentId !== null) return null;

    const containerClass = parentId ? "mt-4 w-full min-w-0" : "space-y-8 pt-4 w-full min-w-0";

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
              <div key={comment.id} className="my-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                <AddCommentForm 
                  verseId={verseId} 
                  groupId={comment.group_id} 
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
            <div key={comment.id} className="flex flex-col mb-2 w-full min-w-0">
              <CommentItem 
                comment={comment as unknown as Comment} 
                currentUserId={currentUserId || undefined} 
                replyingToName={replyingToName} 
                isPersonalView={isPersonal}
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
                onBookmarkClick={() => handleBookmarkToggle(comment)}
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
                <div className={`${depth < 3 ? "pl-4 ml-2 border-l-2 border-slate-100 dark:border-slate-800/60" : "mt-2"} w-full min-w-0 transition-all duration-300`}>
                  {replyTo === comment.id && (
                    <div className="mt-4 mb-4 px-1 w-full min-w-0 animate-in slide-in-from-top-2 duration-300">
                      <AddCommentForm 
                        verseId={verseId} 
                        groupId={comment.group_id} 
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

  if (!verseId) return null;

  if (loading) {
    return (
      <div className="space-y-8 pt-6 px-4 w-full min-w-0 animate-in fade-in duration-300">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 w-full min-w-0">
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0 animate-pulse mt-1" />
            <div className="flex-1 space-y-4 pt-1 min-w-0 w-full">
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4 animate-pulse" />
              <div className="h-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl w-full animate-pulse border border-slate-100 dark:border-slate-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-36 w-full min-w-0 select-none overflow-x-hidden">
      {referenceLabel && (
        <div className="sticky top-0 z-40 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl py-4 border-b border-slate-200/60 dark:border-slate-800/60 mb-2 px-6 w-full min-w-0 shadow-sm transition-all duration-300">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 truncate drop-shadow-sm">
            {referenceLabel}
          </h2>
        </div>
      )}
      
      <div className="px-6">
        {comments.length > 0 && (
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5 mt-6 mb-4 w-full min-w-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 shrink-0">
              Discussions ({rootComments.length})
            </h3>
            {rootComments.length > 1 && (
              <div className="shrink-0">
                <CommentSortSelect value={sortOption} onChange={setSortOption} />
              </div>
            )}
          </div>
        )}

        {comments.length === 0 ? (
          <div className="text-center py-20 px-8 bg-white dark:bg-slate-900/10 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 mt-6 w-full min-w-0 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-700">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium italic">No commentary yet. Be the first to share an insight.</p>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {renderTree(null, 0)}
          </div>
        )}
      </div>
    </div>
  );
};