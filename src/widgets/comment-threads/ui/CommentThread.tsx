// Path: src/widgets/comment-threads/ui/CommentThread.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../shared/api/supabase';
import { CommentItem, Comment } from '../../../entities/comment/ui/CommentItem';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';

interface CommentThreadProps {
  verseId: string | number;
  groupId?: string; 
  referenceLabel?: string; 
}

type RawComment = {
  likes?: { user_id: string }[];
  [key: string]: unknown;
};

export const CommentThread = ({ verseId, groupId, referenceLabel }: CommentThreadProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [showResolvedFor, setShowResolvedFor] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const isInitialMount = useRef(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchThread = useCallback(async (showLoading = true) => {
    if (!verseId) return; 
    if (showLoading) setIsLoading(true);
    
    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id ( username, display_name, avatar_url ),
        likes ( user_id )
      `)
      .eq('verse_id', verseId)
      .order('created_at', { ascending: true });

    if (groupId) query = query.eq('group_id', groupId);
    else query = query.is('group_id', null);

    const { data, error } = await query;

    if (!error && data) {
      const formattedComments = data.map((c: RawComment) => ({
        ...c,
        likes_count: c.likes?.length || 0,
        user_has_liked: c.likes?.some(l => l.user_id === currentUserId) || false
      }));
      setComments(formattedComments as unknown as Comment[]);
    }
    setIsLoading(false);
  }, [verseId, groupId, currentUserId]);

  useEffect(() => {
    if (!verseId) return;
    fetchThread(isInitialMount.current);
    isInitialMount.current = false;
    const channel = supabase.channel(`verse-${verseId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `verse_id=eq.${verseId}` }, () => fetchThread(false)).on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => fetchThread(false)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [verseId, groupId, fetchThread]);

  const toggleThread = (commentId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const toggleResolvedView = (parentId: string) => {
    setShowResolvedFor(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const handleDelete = async (commentId: string) => {
    if (confirm('Delete this insight?')) {
      await supabase.from('comments').delete().eq('id', commentId);
      fetchThread(false);
    }
  };

  const handleResolve = async (commentId: string, currentStatus: boolean) => {
    await supabase.from('comments').update({ is_resolved: !currentStatus }).eq('id', commentId);
    fetchThread(false);
  };

  const handleLike = async (comment: Comment) => {
    if (!currentUserId) return; 
    const isLiking = !comment.user_has_liked;
    setComments(prev => prev.map(c => c.id === comment.id ? { ...c, user_has_liked: isLiking, likes_count: (c.likes_count || 0) + (isLiking ? 1 : -1) } : c));
    try {
      if (isLiking) await supabase.from('likes').insert({ comment_id: comment.id, user_id: currentUserId });
      else await supabase.from('likes').delete().eq('comment_id', comment.id).eq('user_id', currentUserId);
    } catch { fetchThread(false); }
  };

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const allChildren = comments.filter(c => c.parent_id === parentId);
    const visibleChildren = allChildren.filter(c => {
      if (c.is_resolved) return parentId === null ? true : showResolvedFor.has(parentId);
      return parentId === null ? true : expandedThreads.has(parentId);
    });

    if (visibleChildren.length === 0 && parentId !== null) return null;

    const containerClass = parentId 
      ? "mt-3" 
      : "space-y-12 pt-6"; // Generous space between root commentary threads

    return (
      <div className={containerClass}>
        {visibleChildren.map((comment, index) => {
          const isExpanded = expandedThreads.has(comment.id);
          const isShowingResolved = showResolvedFor.has(comment.id);
          const activeChildCount = comments.filter(c => c.parent_id === comment.id && !c.is_resolved).length;
          const resolvedChildCount = comments.filter(c => c.parent_id === comment.id && c.is_resolved).length;
          const hasVisibleChildren = (activeChildCount > 0 && isExpanded) || (resolvedChildCount > 0 && isShowingResolved);
          
          const isLastSibling = index === visibleChildren.length - 1;

          if (editingId === comment.id) {
            return (
              <div key={comment.id} className="my-4 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <AddCommentForm verseId={verseId} groupId={groupId} parentId={comment.parent_id} isEditMode={true} commentId={comment.id} initialContent={comment.content} onCancel={() => setEditingId(null)} onSuccess={() => { setEditingId(null); fetchThread(false); }} />
              </div>
            );
          }

          let replyingToName;
          if (depth > 0 && comment.parent_id) {
            const parent = comments.find(c => c.id === comment.parent_id);
            const p = Array.isArray(parent?.profiles) ? parent.profiles[0] : parent?.profiles;
            replyingToName = p?.display_name || p?.username;
          }

          return (
            <div 
              key={comment.id} 
              className={`flex flex-col ${
                !isLastSibling 
                  ? (hasVisibleChildren ? 'mb-10' : 'mb-4') 
                  : ''
              }`}
            >
              <CommentItem 
                comment={comment} 
                currentUserId={currentUserId || undefined} 
                replyingToName={replyingToName} 
                onReplyClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} 
                onEditClick={() => setEditingId(comment.id)} 
                onDeleteClick={() => handleDelete(comment.id)} 
                onResolveClick={() => handleResolve(comment.id, !!comment.is_resolved)} 
                onLikeClick={() => handleLike(comment)} 
                replyCount={activeChildCount} 
                isExpanded={isExpanded} 
                onToggleReplies={() => toggleThread(comment.id)} 
                resolvedCount={resolvedChildCount} 
                onToggleResolved={() => toggleResolvedView(comment.id)} 
                isResolvedExpanded={isShowingResolved} 
              />
              
              {(replyTo === comment.id || hasVisibleChildren) && (
                <div className={depth < 2 ? "pl-3.5 ml-1 border-l border-slate-300 dark:border-slate-700" : "mt-2"}>
                  {replyTo === comment.id && (
                    <div className="mt-3 mb-4 px-1">
                      <AddCommentForm verseId={verseId} groupId={groupId} parentId={comment.id} onCancel={() => setReplyTo(null)} onSuccess={() => { setReplyTo(null); if (!isExpanded) toggleThread(comment.id); fetchThread(false); }} />
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

  if (isLoading) {
    return (
      <div className="space-y-6 pt-4 px-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-5 h-5 bg-slate-100 dark:bg-slate-800 rounded-full" />
            <div className="flex-1 space-y-2 pt-1"><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" /><div className="h-12 bg-slate-50 dark:bg-slate-800/40 rounded w-full" /></div>
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