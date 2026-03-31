// Path: src/widgets/insights-panel/ui/InsightsChat.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Mail, Send, Loader2, AtSign, Users as UsersIcon, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../shared/api/supabase';
import { splitTextByReferences, ParsedReference } from '../../../shared/lib/ReferenceParser';
import { ReferenceLink } from '../../../shared/ui/ReferenceLink';
import { getVersePath } from '../../../shared/lib/reference-navigation';
import { PROFILE_COLORS, ALL_AVATAR_ICONS } from '../../../features/profile/edit-profile/config/avatarOptions';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  has_mention?: boolean;
}

interface MentionProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  isSystem?: boolean;
}

interface InsightsChatProps {
  groupId: string;
  user: SupabaseUser | null;
  groupName: string;
  groupColor?: string;
  myUsername: string;
  onChatOpened: () => void;
}

const getMentionColorClasses = (theme: string = 'indigo') => {
  const mapping: Record<string, string> = {
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 ring-rose-200/50',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-amber-200/50',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-blue-200/50',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-200/50',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-purple-200/50',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-indigo-200/50',
  };
  return mapping[theme] || mapping.indigo;
};

const getMentionBubbleClasses = (theme: string = 'indigo', isMe: boolean = false) => {
  const tail = isMe ? 'rounded-tr-none' : 'rounded-tl-none';
  const mapping: Record<string, string> = {
    rose: `bg-rose-100 dark:bg-rose-900/40 text-slate-900 dark:text-slate-100 ${tail} border-2 border-rose-400 dark:border-rose-600 shadow-md ring-2 ring-rose-200/50 dark:ring-rose-900/50`,
    amber: `bg-amber-100 dark:bg-amber-900/40 text-slate-900 dark:text-slate-100 ${tail} border-2 border-amber-400 dark:border-amber-600 shadow-md ring-2 ring-amber-200/50 dark:ring-amber-900/50`,
    blue: `bg-blue-100 dark:bg-blue-900/40 text-slate-900 dark:text-slate-100 ${tail} border-2 border-blue-400 dark:border-blue-600 shadow-md ring-2 ring-blue-200/50 dark:ring-blue-900/50`,
    emerald: `bg-emerald-100 dark:bg-emerald-900/40 text-slate-900 dark:text-slate-100 ${tail} border-2 border-emerald-400 dark:border-emerald-600 shadow-md ring-2 ring-emerald-200/50 dark:ring-emerald-900/50`,
    purple: `bg-purple-100 dark:bg-purple-900/40 text-slate-900 dark:text-slate-100 ${tail} border-2 border-purple-400 dark:border-purple-600 shadow-md ring-2 ring-purple-200/50 dark:ring-purple-900/50`,
    indigo: `bg-indigo-100 dark:bg-indigo-900/40 text-slate-900 dark:text-slate-100 ${tail} border-2 border-indigo-400 dark:border-indigo-600 shadow-md ring-2 ring-indigo-200/50 dark:ring-indigo-900/50`,
  };
  return mapping[theme] || mapping.indigo;
};

const formatTimestamp = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24 && now.getDate() === date.getDate()) return `${diffInHours}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) return 'yesterday';
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 365) return `${diffInDays}d`;
  return `${Math.floor(diffInDays / 365)}yr`;
};

const AvatarCircle = ({ avatarUrl, name, size = "sm" }: { avatarUrl?: string | null, name: string, size?: "sm" | "md" }) => {
  const [imgError, setImgError] = useState(false);
  const safeName = name || '?';
  const initial = safeName.substring(0, 2).toUpperCase();
  
  let isCustomAvatar = false;
  let CustomIconComp: React.ElementType<{ size?: number; className?: string; strokeWidth?: number }> = User;
  let avatarBgClass = ''; // Use class instead of hex
  let avatarTextClass = 'text-slate-500 dark:text-slate-300 font-bold';

  if (avatarUrl && avatarUrl.includes(':') && !avatarUrl.startsWith('http')) {
    isCustomAvatar = true;
    const [colorId, iconId] = avatarUrl.split(':');
    const colorObj = PROFILE_COLORS.find(c => c.id === colorId);
    if (colorObj) {
      avatarBgClass = colorObj.hex; // E.g. 'bg-purple-500'
      avatarTextClass = 'text-white font-bold';
    }
    const foundIcon = ALL_AVATAR_ICONS.find(i => i.id === iconId)?.icon;
    if (foundIcon) CustomIconComp = foundIcon;
  }

  const isExternalImage = avatarUrl && avatarUrl.startsWith('http') && !imgError;
  const dimensions = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  return (
    <div 
      className={`${dimensions} rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white dark:border-slate-800 transition-colors ${avatarBgClass || 'bg-slate-200 dark:bg-slate-700'} ${avatarTextClass}`}
    >
      {isExternalImage ? (
        <Image 
          src={avatarUrl} 
          alt={safeName} 
          width={size === "sm" ? 24 : 32} 
          height={size === "sm" ? 24 : 32} 
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          unoptimized
        />
      ) : isCustomAvatar ? (
        <CustomIconComp size={size === "sm" ? 14 : 18} strokeWidth={2.5} />
      ) : (
        <span className="select-none">{initial}</span>
      )}
    </div>
  );
};

export const InsightsChat = ({ groupId, user, groupName, groupColor = 'indigo', myUsername, onChatOpened }: InsightsChatProps) => {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionProfile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateLastRead = useCallback(async () => {
    if (!user || !groupId) return;
    await supabase.from('group_members').update({ last_read_at: new Date().toISOString() }).eq('user_id', user.id).eq('group_id', groupId);
  }, [user, groupId]);

  const fetchMessages = useCallback(async (isMounted: boolean) => {
    if (!supabase || !groupId) return;
    const { data } = await supabase.from('group_messages').select('*, profiles:user_id(username, display_name, avatar_url)').eq('group_id', groupId).order('created_at', { ascending: true }).limit(50);
    if (isMounted) {
      if (data) setMessages(data as unknown as Message[]);
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => { onChatOpened(); updateLastRead(); await fetchMessages(isMounted); };
    init();
    const channel = supabase?.channel(`chat-view-${groupId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, () => {
      if (isMounted) { fetchMessages(true); updateLastRead(); }
    }).subscribe();
    return () => { isMounted = false; if (channel) supabase?.removeChannel(channel); };
  }, [groupId, onChatOpened, fetchMessages, updateLastRead]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  useEffect(() => {
    const searchMentions = async () => {
      if (!showMentions) return;
      const q = mentionQuery.toLowerCase();
      const staticSuggestions: MentionProfile[] = [];
      if ('here'.startsWith(q)) staticSuggestions.push({ username: 'here', display_name: 'Everyone active', avatar_url: null, isSystem: true });
      if ('everyone'.startsWith(q)) staticSuggestions.push({ username: 'everyone', display_name: 'The whole group', avatar_url: null, isSystem: true });
      const uniqueProfiles = new Map<string, MentionProfile>();
      
      messages.forEach(m => { 
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        if (p && p.username) {
          uniqueProfiles.set(p.username, { 
            username: p.username, 
            display_name: p.display_name || null, 
            avatar_url: p.avatar_url || null 
          }); 
        }
      });
      
      try {
        const { data: memberData } = await supabase.from('group_members').select(`profiles:user_id (username, display_name, avatar_url)`).eq('group_id', groupId);
        if (memberData) {
          memberData.forEach((m: unknown) => { 
            const record = m as { profiles: MentionProfile | MentionProfile[] | null }; 
            const p = Array.isArray(record.profiles) ? record.profiles[0] : record.profiles; 
            if (p && p.username) uniqueProfiles.set(p.username, { username: p.username, display_name: p.display_name || null, avatar_url: p.avatar_url || null }); 
          }); 
        }
      } catch (err) { console.warn("Could not fetch full member list from DB", err); }
      
      const profileSuggestions = Array.from(uniqueProfiles.values()).filter(p => (p.username && p.username.toLowerCase().includes(q)) || (p.display_name && p.display_name.toLowerCase().includes(q)));
      setMentionSuggestions([...staticSuggestions, ...profileSuggestions].slice(0, 4));
    };
    
    const timeoutId = setTimeout(searchMentions, 150);
    return () => clearTimeout(timeoutId);
  }, [mentionQuery, showMentions, groupId, messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    if (lastAtPos !== -1 && (lastAtPos === 0 || textBeforeCursor[lastAtPos - 1] === ' ')) {
      const currentQuery = textBeforeCursor.slice(lastAtPos + 1);
      if (!currentQuery.includes(' ')) { setMentionQuery(currentQuery); setShowMentions(true); return; }
    }
    setShowMentions(false);
  };

  const selectMention = (profile: MentionProfile) => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const textAfterCursor = newMessage.slice(cursorPosition);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    const before = newMessage.slice(0, lastAtPos);
    const completed = `${before}@${profile.username} ${textAfterCursor}`;
    setNewMessage(completed);
    setShowMentions(false);
    setTimeout(() => { if (inputRef.current) { const newPos = before.length + profile.username.length + 2; inputRef.current.focus(); inputRef.current.setSelectionRange(newPos, newPos); } }, 0);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !user || !supabase) return;
    setIsSending(true);
    const { error } = await supabase.from('group_messages').insert({ content: newMessage, group_id: groupId, user_id: user.id, has_mention: newMessage.includes('@') });
    if (!error) { setNewMessage(''); setShowMentions(false); updateLastRead(); }
    setIsSending(false);
  };

  const renderMessageContent = (content: string) => {
    const referenceParts = splitTextByReferences(content);
    const handleRefJump = (b: string, c: number, v: number) => router.push(getVersePath(b, c, v));

    return referenceParts.map((part, partIdx) => {
      if (typeof part !== 'string') {
        const ref = part as ParsedReference;
        return (
          <ReferenceLink
            key={`ref-${partIdx}`}
            book={ref.book}
            chapter={ref.chapter}
            verse={ref.verse}
            label={ref.originalText} // Maintain original text for ranges like Genesis 1:1-3
            onClick={handleRefJump}
            className="mx-0.5"
          />
        );
      }

      const mentionParts = part.split(/(@\w+)/g);
      return mentionParts.map((mPart, mIdx) => {
        if (mPart.startsWith('@')) {
          const username = mPart.slice(1).toLowerCase();
          const isSpecialMention = ['here', 'everyone', myUsername.toLowerCase()].includes(username);
          if (isSpecialMention) {
            return (
              <span key={`mention-${mIdx}`} className={`px-1.5 py-0.5 rounded-md font-bold ring-1 ring-inset transition-colors ${getMentionColorClasses(groupColor)}`}>
                {mPart}
              </span>
            );
          }
          return <span key={`mention-${mIdx}`} className="font-bold opacity-90 underline decoration-dotted underline-offset-2">{mPart}</span>;
        }
        return <span key={`text-${mIdx}`}>{mPart}</span>;
      });
    });
  };

  if (isLoading) return <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3"><Loader2 size={24} className="animate-spin text-indigo-500" /><p className="text-xs font-bold uppercase tracking-widest">Loading Messages...</p></div>;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 animate-in slide-in-from-top-4 duration-300 relative">
      
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-6 scrollbar-hide insights-scroll-container isolate" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-10 gap-3"><Mail size={40} className="opacity-10" /><p className="text-sm font-medium italic">Start a conversation with {groupName}</p></div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            
            const profile = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;
            const displayName = profile?.display_name || profile?.username || 'Unknown';
            const avatarUrl = profile?.avatar_url || null;

            const contentLower = msg.content.toLowerCase();
            const myUserLower = myUsername ? `@${myUsername.toLowerCase()}` : null;
            const isMentioned = !isMe && myUserLower !== null && (contentLower.includes(myUserLower) || contentLower.includes('@here') || contentLower.includes('@everyone'));

            const bubbleBaseClasses = isMentioned 
              ? getMentionBubbleClasses(groupColor, isMe)
              : isMe 
                ? 'bg-indigo-600 text-white rounded-tr-none border border-transparent'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800';

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 relative transition-all duration-200 hover:z-50 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className="shrink-0 mt-1">
                  <AvatarCircle avatarUrl={avatarUrl} name={displayName} size="sm" />
                </div>
                <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{displayName}</span>
                    <span className="text-[9px] text-slate-300 dark:text-slate-600">{formatTimestamp(msg.created_at)}</span>
                  </div>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ring-1 ring-black/5 ${bubbleBaseClasses} group/bubble hover:overflow-visible`}>
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSendMessage} className="shrink-0 p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative z-20">
        {showMentions && mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-10">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2"><AtSign size={12} className="text-indigo-500" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mentions</span></div>
            {mentionSuggestions.map((profile) => (
              <button key={profile.username} type="button" onClick={() => selectMention(profile)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                {profile.isSystem ? <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-indigo-500"><UsersIcon size={14} /></div> : <AvatarCircle avatarUrl={profile.avatar_url} name={profile.display_name || profile.username} size="md" />}
                <div className="flex flex-col min-w-0"><span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{profile.display_name ? `${profile.display_name} (@${profile.username})` : `@${profile.username}`}</span><span className="text-[10px] text-slate-400 truncate italic">{profile.isSystem ? 'System Mention' : 'Group Member'}</span></div>
              </button>
            ))}
          </div>
        )}
        <div className="relative flex items-center">
          <input ref={inputRef} aria-label={`Message ${groupName}`} value={newMessage} onChange={handleInputChange} placeholder={`Message ${groupName}...`} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" />
          <button type="submit" title="Send Message" disabled={!newMessage.trim() || isSending} className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-md shadow-indigo-600/20 active:scale-95">{isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
        </div>
      </form>
    </div>
  );
};