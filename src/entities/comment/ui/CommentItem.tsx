// Path: src/entities/comment/ui/CommentItem.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Reply, Edit2, Trash2, CheckCircle2, MoreVertical, Heart, MessageCircle, ChevronDown, ChevronUp, User, Bookmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PROFILE_COLORS, ALL_AVATAR_ICONS } from '../../../features/profile/edit-profile/config/avatarOptions';
import { SmartText } from '../../../shared/ui/SmartText';
import { getVersePath } from '@/shared/lib/reference-navigation';
import { UserBadge } from '../../../entities/user/ui/UserBadge';

export interface ProfileData {
  username?: string;
  display_name?: string;
  avatar_url?: string;
  scholarly_score?: number;
}

export interface Comment {
  id: string; // UUID
  verse_id: string; // UUID
  title?: string;
  content: string;
  created_at: string;
  user_id: string;
  group_id?: string | null;
  parent_id?: string | null;
  is_resolved?: boolean;
  likes_count?: number;
  user_has_liked?: boolean;
  user_has_bookmarked?: boolean;
  profiles?: ProfileData | ProfileData[] | null; 
  group?: { name: string } | { name: string }[] | null;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  replyingToName?: string;
  isNested?: boolean;
  isPersonalView?: boolean;
  onReplyClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  onResolveClick?: () => void;
  onLikeClick?: () => void;
  onBookmarkClick?: () => void;
  onRead?: () => void; 
  replyCount?: number;
  onToggleReplies?: () => void;
  isExpanded?: boolean;
  resolvedCount?: number;
  onToggleResolved?: () => void;
  isResolvedExpanded?: boolean;
  isNew?: boolean;
  hasNewReplies?: boolean;
}

const processScaledText = (text: string | undefined) => {
  if (!text) return null;
  let cleanText = text;
  if (typeof document !== 'undefined') {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    cleanText = doc.documentElement.textContent || text;
  }
  cleanText = cleanText.trim();
  const parts = cleanText.split(/([\u0590-\u05FF]+)/g);
  return parts.map((part, i) => {
    if (/[\u0590-\u05FF]/.test(part)) {
      return <span key={i} className="inline-block scale-[1.5] origin-bottom px-0.5 font-serif leading-none mx-0.5">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};

export const CommentItem = ({
  comment,
  currentUserId,
  replyingToName,
  isPersonalView,
  onReplyClick,
  onEditClick,
  onDeleteClick,
  onResolveClick,
  onLikeClick,
  onBookmarkClick,
  onRead,
  replyCount,
  onToggleReplies,
  isExpanded,
  resolvedCount,
  onToggleResolved,
  isResolvedExpanded,
  isNew,
  hasNewReplies
}: CommentItemProps) => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isContainerHovered, setIsContainerHovered] = useState(false); 
  const [isOptimisticallyRead, setIsOptimisticallyRead] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const isAuthor = currentUserId === comment.user_id;
  const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const initial = displayName.substring(0, 2).toUpperCase();

  const groupData = Array.isArray(comment.group) ? comment.group[0] : comment.group;

  // --- Avatar Logic ---
  const avatarUrl = profile?.avatar_url;
  let isSystemAvatar = false;
  let CustomIconComp: React.ElementType = User;
  let avatarBgClass = ''; 
  let avatarTextClass = 'text-indigo-600 dark:text-indigo-400 font-black';

  if (avatarUrl && avatarUrl.includes(':') && !avatarUrl.startsWith('http')) {
    isSystemAvatar = true;
    const [colorId, iconId] = avatarUrl.split(':');
    const colorObj = PROFILE_COLORS.find(c => c.id === colorId);
    if (colorObj) {
      avatarBgClass = colorObj.hex; 
      avatarTextClass = 'text-white';
    }
    const foundIcon = ALL_AVATAR_ICONS.find(i => i.id === iconId)?.icon;
    if (foundIcon) CustomIconComp = foundIcon;
  }

  const isExternalImage = avatarUrl && avatarUrl.startsWith('http') && !imgError;

  // --- Read Status Logic ---
  const handleInteraction = () => {
    if ((isNew || hasNewReplies) && !isOptimisticallyRead) {
      setIsOptimisticallyRead(true);
      onRead?.();
    }
  };

  const showNewBadge = isNew && !isOptimisticallyRead;
  const showNewRepliesBadge = hasNewReplies && !isOptimisticallyRead;

  // --- Safe HTML Character Truncation Logic ---
  const MAX_CHARS_THRESHOLD = 499;
  const TRUNCATED_LENGTH = 325;
  
  const strippedContent = useMemo(() => comment.content.replace(/<[^>]*>?/gm, ''), [comment.content]);
  const needsTruncation = strippedContent.length > MAX_CHARS_THRESHOLD;

  const contentToRender = useMemo(() => {
    if (!needsTruncation || isTextExpanded) return comment.content;

    const truncateHtmlSafe = (html: string, limit: number) => {
      let currentLength = 0;
      let result = '';
      let i = 0;
      const openTags: string[] = [];

      while (i < html.length) {
        if (currentLength >= limit) {
          result += '...';
          break;
        }

        if (html[i] === '<') {
          let tag = '';
          const isClosing = html[i + 1] === '/';
          
          while (i < html.length && html[i] !== '>') {
            tag += html[i];
            i++;
          }
          if (i < html.length) {
            tag += html[i];
          }
          result += tag;

          const tagMatch = tag.match(/<\/?([a-zA-Z0-9]+)/);
          if (tagMatch) {
            const tagName = tagMatch[1].toLowerCase();
            if (!isClosing && !['br', 'hr', 'img', 'input'].includes(tagName)) {
              openTags.push(tagName);
            } else if (isClosing) {
              if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
                openTags.pop();
              }
            }
          }
        } else if (html[i] === '&') {
          let entity = '';
          let j = i;
          while (j < html.length && html[j] !== ';' && (j - i) < 10) {
            entity += html[j];
            j++;
          }
          if (html[j] === ';') {
            entity += ';';
            result += entity;
            currentLength += 1;
            i = j;
          } else {
            result += html[i];
            currentLength += 1;
          }
        } else {
          result += html[i];
          currentLength++;
        }
        i++;
      }

      while (openTags.length > 0) {
        const tag = openTags.pop();
        result += `</${tag}>`;
      }

      return result;
    };

    return truncateHtmlSafe(comment.content, TRUNCATED_LENGTH);
  }, [comment.content, isTextExpanded, needsTruncation]);

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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const isResolved = comment.is_resolved && comment.parent_id;
  const resolvedClasses = "bg-blue-800 dark:bg-blue-900 text-white shadow-md p-3 rounded-2xl";
  const nestedClasses = "bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 shadow-sm p-3 rounded-2xl";
  const rootClasses = `py-3 px-3 -mx-1 rounded-2xl transition-colors duration-200 ${isContainerHovered ? 'bg-slate-50 dark:bg-slate-900/40' : ''}`;

  const baseSmartTextClasses = "[&_b]:font-bold [&_i]:italic [&_u]:underline [&_.hebrew-scale]:text-[1.4em]";
  const currentSmartTextClasses = isResolved ? `${baseSmartTextClasses} text-white` : baseSmartTextClasses;

  return (
    <div 
      onMouseEnter={() => setIsContainerHovered(true)} 
      onMouseLeave={() => setIsContainerHovered(false)} 
      onClick={handleInteraction}
      className={`group/item relative flex flex-col gap-1.5 transition-all duration-200 cursor-default ${isResolved ? resolvedClasses : (comment.parent_id ? nestedClasses : rootClasses)} ${isContainerHovered || isMenuOpen ? 'z-50' : 'z-auto'}`}
    >
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white dark:border-slate-800 transition-colors ${avatarBgClass || 'bg-indigo-100 dark:bg-indigo-900/50'} ${avatarTextClass}`}>
            {isExternalImage ? (
              <Image src={avatarUrl as string} alt={displayName} width={24} height={24} className="w-full h-full object-cover" onError={() => setImgError(true)} />
            ) : isSystemAvatar ? (
              <CustomIconComp size={14} strokeWidth={2.5} />
            ) : (
              <span className="text-[10px] font-black select-none">{initial}</span>
            )}
          </div>
          <span className={`text-xs font-bold truncate ${isResolved ? 'text-blue-50' : 'text-slate-900 dark:text-slate-100'}`}>{displayName}</span>
          
          {profile?.scholarly_score !== undefined && (
            <UserBadge score={profile.scholarly_score} />
          )}

          {replyingToName && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 ${isResolved ? 'bg-blue-700/50 text-blue-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              <Reply size={8} className="rotate-180" /> {replyingToName}
            </span>
          )}
          
          {isPersonalView && groupData?.name && (
             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${isResolved ? 'bg-blue-700/50 text-blue-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
               via {groupData.name}
             </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {showNewBadge && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mr-1 animate-in fade-in zoom-in-75">New</span>}
          {showNewRepliesBadge && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mr-1 animate-in fade-in zoom-in-75">New Replies</span>}
          {isResolved && <span className="flex items-center text-blue-300 mr-1"><CheckCircle2 size={16} /></span>}
          
          <span className={`text-[9px] font-medium shrink-0 mr-1 ${isResolved ? 'text-blue-200/80' : 'text-slate-400'}`}>
            {relativeTimestamp}
          </span>

          {currentUserId && comment.group_id !== null && !comment.parent_id && (
            <button
              onClick={(e) => { e.stopPropagation(); onBookmarkClick?.(); }}
              className={`flex items-center justify-center p-1 transition-all duration-200 outline-none z-10 ${
                comment.user_has_bookmarked 
                  ? (isResolved ? 'text-blue-200 opacity-100' : 'text-indigo-500 opacity-100') 
                  : (isResolved ? 'text-blue-400 opacity-0 group-hover/item:opacity-100 hover:text-white' : 'text-slate-400 opacity-0 group-hover/item:opacity-100 hover:text-indigo-400')
              }`}
              title={comment.user_has_bookmarked ? "Remove from Personal Commentary" : "Save to Personal Commentary"}
            >
              <Bookmark size={16} className={comment.user_has_bookmarked ? "fill-current" : ""} />
            </button>
          )}

          {isAuthor && (
            <div className="relative" ref={menuRef}>
              <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className={`flex items-center justify-center p-1 transition-all duration-200 outline-none ${isContainerHovered || isMenuOpen ? 'opacity-100' : 'opacity-0'} ${isResolved ? 'text-white' : isMenuOpen ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`} aria-label="Comment options"><MoreVertical size={18} /></button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                  <button onClick={(e) => { e.stopPropagation(); onEditClick?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"><Edit2 size={14} /> Edit</button>
                  {comment.parent_id && <button onClick={(e) => { e.stopPropagation(); onResolveClick?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"><CheckCircle2 size={14} className={comment.is_resolved ? "text-blue-500" : ""} /> {comment.is_resolved ? 'Unresolve' : 'Resolve'}</button>}
                  <button onClick={(e) => { e.stopPropagation(); onDeleteClick?.(); setIsMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-left transition-colors"><Trash2 size={14} /> Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        {comment.title && (
          <h4 className={`text-base font-black mb-1.5 leading-tight tracking-tight ${isResolved ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            {processScaledText(comment.title)}
          </h4>
        )}
        <div className={`text-sm leading-relaxed pr-2 ${isResolved ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
          <div className={!isTextExpanded && needsTruncation ? "line-clamp-4" : ""}>
            <SmartText 
              text={contentToRender} 
              isHtml={true} 
              onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))} 
              className={currentSmartTextClasses}
              referenceVariant={isResolved ? "resolved" : "subtle"}
              hideReferenceIcon={true}
            />
          </div>
        </div>
        {needsTruncation && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsTextExpanded(!isTextExpanded); }} 
            className={`text-[10px] font-medium uppercase tracking-widest mt-1 flex items-center gap-1 ${isResolved ? 'text-blue-300 hover:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            {isTextExpanded ? <><ChevronUp size={16}/> View Less</> : <><ChevronDown size={16}/> View More</>}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button onClick={(e) => { e.stopPropagation(); onLikeClick?.(); }} className={`flex items-center gap-1.5 text-xs font-bold transition-all duration-200 ${isResolved ? (comment.user_has_liked ? 'text-rose-300' : 'text-blue-200') : (comment.user_has_liked ? 'text-rose-500' : 'text-slate-400')}`} aria-label="Like"><Heart size={16} className={comment.user_has_liked ? 'fill-current' : ''} /> {comment.likes_count || 0}</button>
        <button onClick={(e) => { e.stopPropagation(); onReplyClick?.(); }} className={`transition-all duration-200 ${isResolved ? 'text-blue-200 hover:text-emerald-300' : 'text-slate-400 hover:text-emerald-500'}`} aria-label="Reply"><Reply size={16} /></button>
        {replyCount !== undefined && replyCount > 0 && <button onClick={(e) => { e.stopPropagation(); onToggleReplies?.(); }} className={`flex items-center gap-1.5 text-xs font-bold transition-all duration-200 ${isResolved ? (isExpanded ? 'text-white' : 'text-blue-200') : (isExpanded ? 'text-blue-500' : 'text-slate-400')}`}><MessageCircle size={16} className={isExpanded ? "fill-current" : ""} /> {replyCount}</button>}
        {resolvedCount !== undefined && resolvedCount > 0 && <button onClick={(e) => { e.stopPropagation(); onToggleResolved?.(); }} className={`ml-auto flex items-center gap-1.5 text-xs font-bold transition-all duration-200 px-2 py-1 rounded ${isResolved ? (isResolvedExpanded ? 'bg-blue-700 text-white' : 'text-blue-200') : (isResolvedExpanded ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-400')}`}><CheckCircle2 size={16} className={isResolvedExpanded ? "fill-current" : ""} /> {resolvedCount}</button>}
      </div>
    </div>
  );
};