// Path: src/entities/comment/ui/CommentItem.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Reply, Edit2, Trash2, CheckCircle2, MoreVertical, Heart, MessageCircle, ChevronDown, ChevronUp, User } from 'lucide-react';
import { PROFILE_COLORS, ALL_AVATAR_ICONS } from '../../../features/profile/edit-profile/config/avatarOptions';

export interface ProfileData {
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  group_id?: string | null;
  parent_id?: string | null;
  is_resolved?: boolean;
  likes_count?: number;
  user_has_liked?: boolean;
  profiles?: ProfileData | ProfileData[] | null; 
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  replyingToName?: string;
  isNested?: boolean;
  onReplyClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onResolveClick?: () => void;
  onLikeClick?: () => void;
  replyCount?: number;
  onToggleReplies?: () => void;
  isExpanded?: boolean;
  resolvedCount?: number;
  onToggleResolved?: () => void;
  isResolvedExpanded?: boolean;
}

export const CommentItem = ({
  comment,
  currentUserId,
  replyingToName,
  onReplyClick,
  onEditClick,
  onDeleteClick,
  onResolveClick,
  onLikeClick,
  replyCount,
  onToggleReplies,
  isExpanded,
  resolvedCount,
  onToggleResolved,
  isResolvedExpanded
}: CommentItemProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isContainerHovered, setIsContainerHovered] = useState(false); 
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isAuthor = currentUserId === comment.user_id;
  const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const initial = displayName.substring(0, 2).toUpperCase();

  // Custom Avatar Parsing
  const avatarUrl = profile?.avatar_url;
  let isCustomAvatar = false;
  
  // Explicitly type CustomIconComp to accept both Lucide icons and our custom functional components
  let CustomIconComp: React.ElementType<{ size?: number; className?: string; strokeWidth?: number }> = User;
  let avatarBgClass = 'bg-indigo-100 dark:bg-indigo-900/50';
  let avatarTextClass = 'text-indigo-600 dark:text-indigo-400 text-[10px] font-black';

  if (avatarUrl) {
    if (avatarUrl.includes(':') && !avatarUrl.startsWith('http')) {
      isCustomAvatar = true;
      const [colorId, iconId] = avatarUrl.split(':');
      const colorObj = PROFILE_COLORS.find(c => c.id === colorId);
      if (colorObj) {
        avatarBgClass = colorObj.hex;
        avatarTextClass = 'text-white';
      }
      const foundIcon = ALL_AVATAR_ICONS.find(i => i.id === iconId)?.icon;
      if (foundIcon) CustomIconComp = foundIcon;
    }
  }

  const textContent = useMemo(() => {
    if (typeof document === 'undefined') return "";
    const tmp = document.createElement('div');
    tmp.innerHTML = comment.content;
    return tmp.textContent || tmp.innerText || "";
  }, [comment.content]);

  const needsTruncation = textContent.length > 200;

  const relativeTimestamp = useMemo(() => {
    const now = new Date();
    const created = new Date(comment.created_at);
    const diffInMs = Math.max(0, now.getTime() - created.getTime());
    
    const mins = Math.floor(diffInMs / (1000 * 60));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30.44);
    const years = Math.floor(days / 365.25);

    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 60) return `${days}d`;
    if (months < 24) return `${months}mo`;
    return `${years}yrs`;
  }, [comment.created_at]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const isResolved = comment.is_resolved && comment.parent_id;
  const resolvedClasses = "bg-blue-800 dark:bg-blue-900 text-white shadow-md p-3 rounded-2xl";
  const nestedClasses = "bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 shadow-sm p-3 rounded-2xl";
  const rootClasses = `py-3 px-3 -mx-1 rounded-2xl transition-colors duration-200 ${isContainerHovered ? 'bg-slate-50 dark:bg-slate-900/40' : ''}`;

  const showActions = isContainerHovered || isMenuOpen;

  return (
    <div 
      onMouseEnter={() => setIsContainerHovered(true)}
      onMouseLeave={() => setIsContainerHovered(false)}
      className={`relative flex flex-col gap-1.5 pointer-events-auto ${
        isResolved ? resolvedClasses : (comment.parent_id ? nestedClasses : rootClasses)
      } ${isMenuOpen ? 'z-50' : 'z-auto'}`}
    >
      
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Avatar Rendering */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white dark:border-slate-800 transition-colors ${avatarBgClass} ${avatarTextClass}`}>
            {avatarUrl && !isCustomAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : isCustomAvatar ? (
              <CustomIconComp size={14} strokeWidth={2.5} />
            ) : (
              initial
            )}
          </div>
          
          <span className={`text-xs font-bold truncate ${isResolved ? 'text-blue-50' : 'text-slate-900 dark:text-slate-100'}`}>
            {displayName}
          </span>
          
          {replyingToName && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 ${
              isResolved ? 'bg-blue-700/50 text-blue-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              <Reply size={8} className="rotate-180" /> {replyingToName}
            </span>
          )}
          
          <span className={`text-[9px] font-medium shrink-0 ${isResolved ? 'text-blue-200/80' : 'text-slate-400'}`}>
            {relativeTimestamp}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isResolved && (
            <span title="Resolved" aria-label="Resolved" className="flex items-center text-blue-300 mr-1">
              <CheckCircle2 size={12} />
            </span>
          )}

          {isAuthor && (
            <div className="relative" ref={menuRef}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }} 
                className={`flex items-center justify-center p-1 transition-all duration-200 outline-none ${
                  showActions ? 'opacity-100' : 'opacity-0'
                } ${
                  isResolved 
                    ? 'text-white' 
                    : isMenuOpen ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
                title="Options"
              >
                <MoreVertical size={16} />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                  <button onClick={(e) => { e.stopPropagation(); onEditClick?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                    <Edit2 size={10} /> Edit
                  </button>
                  {comment.parent_id && (
                    <button onClick={(e) => { e.stopPropagation(); onResolveClick?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                      <CheckCircle2 size={10} className={comment.is_resolved ? "text-blue-500" : ""} /> 
                      {comment.is_resolved ? 'Unresolve' : 'Resolve'}
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onDeleteClick?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                    <Trash2 size={10} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <div 
          className={`text-sm leading-relaxed whitespace-pre-wrap wrap-break-word pr-2 [&_b]:font-bold [&_i]:italic [&_u]:underline transition-all ${
            isResolved ? 'text-white' : 'text-slate-700 dark:text-slate-300'
          } ${!isTextExpanded && needsTruncation ? 'max-h-20 overflow-hidden' : ''}`}
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />
        {needsTruncation && (
          <button 
            onClick={() => setIsTextExpanded(!isTextExpanded)}
            className={`text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-1 ${
              isResolved ? 'text-blue-200 hover:text-white' : 'text-indigo-500 hover:text-indigo-600'
            }`}
          >
            {isTextExpanded ? <><ChevronUp size={12}/> View Less</> : <><ChevronDown size={12}/> View More</>}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 pt-1">
        {onLikeClick && (
          <button 
            onClick={(e) => { e.stopPropagation(); onLikeClick(); }} 
            onMouseEnter={() => setHoveredIcon('like')}
            onMouseLeave={() => setHoveredIcon(null)}
            className={`flex items-center gap-1 text-[10px] font-bold transition-all duration-200 ${
              isResolved 
                ? (comment.user_has_liked || hoveredIcon === 'like' ? 'text-rose-300' : 'text-blue-200')
                : (comment.user_has_liked || hoveredIcon === 'like' ? 'text-rose-500' : 'text-slate-400')
            }`}
          >
            <Heart size={12} className={comment.user_has_liked ? 'fill-current' : ''} />
            {comment.likes_count || 0}
          </button>
        )}

        {onReplyClick && (
          <button 
            onClick={(e) => { e.stopPropagation(); onReplyClick(); }} 
            onMouseEnter={() => setHoveredIcon('reply')}
            onMouseLeave={() => setHoveredIcon(null)}
            className={`transition-all duration-200 ${
              isResolved 
                ? (hoveredIcon === 'reply' ? 'text-emerald-300' : 'text-blue-200')
                : (hoveredIcon === 'reply' ? 'text-emerald-500' : 'text-slate-400')
            }`} 
            title="Reply"
          >
            <Reply size={12} />
          </button>
        )}

        {onToggleReplies && replyCount !== undefined && replyCount > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleReplies(); }} 
            onMouseEnter={() => setHoveredIcon('thread')}
            onMouseLeave={() => setHoveredIcon(null)}
            className={`flex items-center gap-1 text-[10px] font-bold transition-all duration-200 ${
              isResolved 
                ? (isExpanded || hoveredIcon === 'thread' ? 'text-white' : 'text-blue-200')
                : (isExpanded || hoveredIcon === 'thread' ? 'text-blue-500' : 'text-slate-400')
            }`}
          >
            <MessageCircle size={12} className={isExpanded ? "fill-current" : ""} />
            {replyCount}
          </button>
        )}

        {onToggleResolved && resolvedCount !== undefined && resolvedCount > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleResolved(); }} 
            onMouseEnter={() => setHoveredIcon('resolved-list')}
            onMouseLeave={() => setHoveredIcon(null)}
            className={`ml-auto flex items-center gap-1 text-[10px] font-bold transition-all duration-200 px-1.5 py-0.5 rounded ${
              isResolved
                ? (isResolvedExpanded || hoveredIcon === 'resolved-list' ? 'bg-blue-700 text-white' : 'text-blue-200')
                : (isResolvedExpanded || hoveredIcon === 'resolved-list' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-400')
            }`}
          >
            <CheckCircle2 size={12} className={isResolvedExpanded ? "fill-current" : ""} />
            {resolvedCount}
          </button>
        )}
      </div>
    </div>
  );
};