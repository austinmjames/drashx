// Path: src/widgets/insights-panel/ui/InsightsPanel.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { 
  Users, User as UserIcon, Plus, MessageSquarePlus, 
  Bell, ArrowLeft, X, Mail, Send, Loader2, MessageCircle,
  ChevronDown, Check
} from 'lucide-react';

import { ICON_OPTIONS, COLOR_OPTIONS } from '../../../features/groups/manage-groups/ui/CreateGroupView';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';
import { CommentThread } from '../../../widgets/comment-threads/ui/CommentThread';
import { Verse } from '../../../entities/verse/ui/VerseCard';
import { supabase } from '../../../shared/api/supabase';

// --- Types & Helpers ---

const getBookAbbreviation = (name: string): string => {
  const map: Record<string, string> = {
    'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
    'Joshua': 'Jos', 'Judges': 'Jud', 'I Samuel': '1 Sam', 'II Samuel': '2 Sam', 'I Kings': '1 Kin', 'II Kings': '2 Kin',
    'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Ezekiel': 'Eze', 'Hosea': 'Hos', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Oba',
    'Jonah': 'Jon', 'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zep', 'Haggai': 'Hag', 'Zechariah': 'Zec', 'Malachi': 'Mal',
    'Psalms': 'Psa', 'Proverbs': 'Pro', 'Job': 'Job', 'Song of Songs': 'Song', 'Ruth': 'Rut', 'Lamentations': 'Lam',
    'Ecclesiastes': 'Ecc', 'Esther': 'Est', 'Daniel': 'Dan', 'Ezra': 'Ezr', 'Nehemiah': 'Neh', 'I Chronicles': '1 Chr', 'II Chronicles': '2 Chr'
  };
  return map[name] || name.slice(0, 3);
};

interface GroupData {
  id: string;
  name: string;
  icon_url?: string;
  color_theme?: string;
}

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

interface Notification {
  id: string;
  type: 'reply' | 'like';
  is_read: boolean;
  created_at: string;
  verse_id: string;
  actor: { display_name: string; username: string; };
  verse_context?: { book_id: string; chapter_num: number; verse_num: number; };
}

export type ViewMode = 'thread' | 'notifications' | 'chat';

// --- Internal Sub-components ---

const InsightsChat = ({ 
  groupId, 
  user, 
  groupName, 
  onMentionReceived, 
  onChatOpened 
}: { 
  groupId: string; 
  user: SupabaseUser | null; 
  groupName: string; 
  onMentionReceived: () => void; 
  onChatOpened: () => void; 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    onChatOpened();

    const fetchMessages = async () => {
      if (!supabase || !groupId) return;
      const { data } = await supabase
        .from('group_messages')
        .select('*, profiles:user_id(username, display_name, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (isMounted) {
        if (data) setMessages(data as unknown as Message[]);
        setIsLoading(false);
      }
    };

    fetchMessages();
    
    const channel = supabase?.channel(`chat-${groupId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'group_messages', 
        filter: `group_id=eq.${groupId}` 
      }, (payload) => {
        if (payload.new.has_mention) onMentionReceived();
        fetchMessages();
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (channel) supabase?.removeChannel(channel);
    };
  }, [groupId, onMentionReceived, onChatOpened]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !user || !supabase) return;
    
    setIsSending(true);
    const hasMention = newMessage.includes('@everyone') || newMessage.includes('@here') || newMessage.includes('@');
    
    const { error } = await supabase.from('group_messages').insert({
      content: newMessage,
      group_id: groupId,
      user_id: user.id,
      has_mention: hasMention
    });

    if (!error) {
      setNewMessage('');
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
        <p className="text-xs font-bold uppercase tracking-widest">Loading Messages...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 animate-in slide-in-from-top-4 duration-300 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-10 gap-3">
            <Mail size={40} className="opacity-10" />
            <p className="text-sm font-medium italic">Start a conversation with {groupName}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[10px] font-bold text-slate-400">{msg.profiles.display_name || msg.profiles.username}</span>
                <span className="text-[9px] text-slate-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.user_id === user?.id 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
      
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="relative flex items-center">
          <input 
            aria-label={`Message ${groupName}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${groupName}...`}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
          <button 
            type="submit"
            title="Send Message"
            disabled={!newMessage.trim() || isSending}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-md shadow-indigo-600/20"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
};

const InsightsActivity = ({ 
  user, 
  onSelectVerse, 
  setViewMode 
}: { 
  user: SupabaseUser; 
  onSelectVerse?: (verse: Verse) => void; 
  setViewMode: (mode: ViewMode) => void; 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, actor:actor_id ( display_name, username ), verse_context:verse_id ( book_id, chapter_num, verse_num )')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (isMounted) {
          if (!error && data) setNotifications(data as unknown as Notification[]);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadNotifications();
    return () => { isMounted = false; };
  }, [user.id]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!supabase) return;
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (onSelectVerse && notif.verse_context) {
      const targetVerse: Verse = {
        id: notif.verse_id,
        verse_id: notif.verse_id,
        verse_num: notif.verse_context.verse_num,
        verse_number: notif.verse_context.verse_num,
      };
      onSelectVerse(targetVerse);
      setViewMode('thread');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={24} />
        <p className="text-xs font-bold uppercase tracking-widest">Checking activity...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-right-4 duration-300">
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center text-slate-400 gap-3">
          <Bell size={32} className="opacity-10" />
          <p className="text-sm font-medium">Your activity is quiet for now.</p>
        </div>
      ) : (
        notifications.map(notif => (
          <button 
            key={notif.id}
            onClick={() => handleNotificationClick(notif)}
            title={`View notification from ${notif.actor?.display_name || 'user'}`}
            className={`w-full p-6 flex items-start gap-4 hover:bg-white dark:hover:bg-slate-800/40 transition-colors text-left ${!notif.is_read ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}
          >
            <div className={`mt-1 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              {notif.type === 'reply' ? <MessageCircle size={16} /> : <Bell size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-slate-900 dark:text-slate-100 leading-snug">
                <span className="font-bold">{notif.actor?.display_name || notif.actor?.username || 'Someone'}</span> 
                {notif.type === 'reply' ? ' replied to your insight.' : ' liked your insight.'}
              </p>
              {notif.verse_context && (
                <div className="mt-2">
                  <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded uppercase tracking-wider">
                    {getBookAbbreviation(notif.verse_context.book_id)} {notif.verse_context.chapter_num}:{notif.verse_context.verse_num}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
};

// --- Main Panel Widget ---

interface InsightsPanelProps {
  user: SupabaseUser | null;
  activeBook: string;
  activeChapter: number;
  selectedVerse: Verse | null;
  isLoading: boolean;
  onSelectVerse?: (verse: Verse) => void;
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  myGroups: GroupData[];
  setIsManageGroupsOpen: (isOpen: boolean) => void;
  setShowAuth: (show: boolean) => void;
  onCloseMobile?: () => void;
}

export const InsightsPanel = (props: InsightsPanelProps) => {
  const {
    user, activeBook, activeChapter, selectedVerse, isLoading, onSelectVerse,
    activeGroupId, setActiveGroupId, myGroups, onCloseMobile, setShowAuth, setIsManageGroupsOpen
  } = props;

  const [viewMode, setViewMode] = useState<ViewMode>('thread');
  const [isAddingInsight, setIsAddingInsight] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const activeVerseId = selectedVerse?.verse_id || selectedVerse?.id;

  // Handle Click Outside for Group Menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setIsGroupMenuOpen(false);
      }
    };
    if (isGroupMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupMenuOpen]);

  // Resolve Branding
  const activeGroup = myGroups.find(g => g.id === activeGroupId);
  const isPersonal = activeGroupId === user?.id;
  const currentGroupName = isPersonal ? "Personal" : activeGroup?.name || "Select Group";

  const getGroupBranding = (iconId: string | undefined | null, colorId: string | undefined | null, isSelf: boolean) => {
    if (isSelf) return { Icon: UserIcon, color: COLOR_OPTIONS[0] };
    const icon = ICON_OPTIONS.find(opt => opt.id === iconId)?.icon || Users;
    const color = COLOR_OPTIONS.find(opt => opt.id === colorId) || COLOR_OPTIONS[0];
    return { Icon: icon, color };
  };

  const { Icon: ActiveIcon, color: ActiveColor } = getGroupBranding(activeGroup?.icon_url, activeGroup?.color_theme, isPersonal);

  return (
    <section className="w-full md:w-112.5 flex-none bg-slate-50 dark:bg-slate-950/40 flex flex-col relative overflow-hidden md:border-l border-slate-200 dark:border-slate-800 pointer-events-auto h-full">
      
      {/* 1. Header Navigation */}
      <div className="flex-none px-4 md:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {viewMode !== 'thread' && (
            <button 
              onClick={() => setViewMode('thread')} 
              title="Back to insights"
              className="p-1 -ml-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          
          {selectedVerse && viewMode === 'thread' ? (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 whitespace-nowrap">
              {getBookAbbreviation(decodeURIComponent(activeBook))} {activeChapter}:{selectedVerse.verse_number || selectedVerse.verse_num}
            </h3>
          ) : (
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {viewMode === 'chat' ? 'Messages' : viewMode === 'notifications' ? 'Activity' : 'Insights'}
            </h3>
          )}

          {/* Group Selector Dropdown Trigger */}
          <div className="relative ml-2" ref={groupMenuRef}>
            <button 
              onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
              title="Switch Study Group"
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100/50 dark:bg-slate-900/50 border border-transparent hover:border-indigo-200 transition-all"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white ${ActiveColor.hex}`}>
                <ActiveIcon size={8} strokeWidth={3} />
              </div>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-20">{currentGroupName}</span>
              <ChevronDown size={10} className={`text-slate-400 transition-transform ${isGroupMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Selection Menu */}
            {isGroupMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">Study Context</div>
                
                <div className="max-h-64 overflow-y-auto scrollbar-hide py-1">
                  {/* Personal Option */}
                  <button 
                    onClick={() => { setActiveGroupId(user?.id || null); setIsGroupMenuOpen(false); }} 
                    className={`w-full flex justify-between items-center px-4 py-2.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${activeGroupId === user?.id ? 'text-indigo-600 font-bold bg-indigo-50/30' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    <div className="flex gap-3 items-center"><UserIcon size={14} /> Personal</div>
                    {activeGroupId === user?.id && <Check size={12} />}
                  </button>

                  {/* My Groups List */}
                  {myGroups.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {myGroups.map(group => {
                        const branding = getGroupBranding(group.icon_url, group.color_theme, false);
                        const isActive = activeGroupId === group.id;
                        return (
                          <button 
                            key={group.id} 
                            onClick={() => { setActiveGroupId(group.id); setIsGroupMenuOpen(false); }} 
                            className={`w-full flex justify-between items-center px-4 py-2.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${isActive ? 'text-indigo-600 font-bold bg-indigo-50/30' : 'text-slate-600 dark:text-slate-400'}`}
                          >
                            <div className="flex gap-3 items-center">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${branding.color.hex}`}>
                                <branding.Icon size={10} strokeWidth={3} />
                              </div>
                              <span className="truncate max-w-[120px]">{group.name}</span>
                            </div>
                            {isActive && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <button 
                    onClick={() => { setIsManageGroupsOpen(true); setIsGroupMenuOpen(false); }} 
                    className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    <Plus size={14} /> Manage groups
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isPersonal && (
            <button 
              onClick={() => {
                if (!user) return setShowAuth(true);
                setViewMode(viewMode === 'chat' ? 'thread' : 'chat');
              }}
              className={`p-2 rounded-full transition-all relative ${viewMode === 'chat' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Group Messages"
            >
              <Mail size={18} />
              {unreadMentions > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-indigo-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-bounce">
                  {unreadMentions}
                </span>
              )}
            </button>
          )}

          <button 
            onClick={() => {
              if (!user) return setShowAuth(true);
              setViewMode(viewMode === 'notifications' ? 'thread' : 'notifications');
            }}
            className={`p-2 rounded-full transition-all ${viewMode === 'notifications' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Activity"
          >
            <Bell size={18} />
          </button>

          {onCloseMobile && (
            <button 
              onClick={onCloseMobile} 
              title="Close Panel"
              className="md:hidden p-2 rounded-full text-slate-400 hover:bg-slate-200"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Content Views */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'chat' && activeGroupId ? (
          <InsightsChat 
            groupId={activeGroupId} 
            user={user} 
            groupName={currentGroupName}
            onMentionReceived={() => viewMode !== 'chat' && setUnreadMentions(prev => prev + 1)}
            onChatOpened={() => setUnreadMentions(0)}
          />
        ) : viewMode === 'notifications' && user ? (
          <InsightsActivity 
            user={user} 
            onSelectVerse={onSelectVerse} 
            setViewMode={setViewMode} 
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-2">
                {selectedVerse && activeVerseId !== undefined ? (
                  <CommentThread verseId={activeVerseId as string} groupId={activeGroupId || undefined} />
                ) : !isLoading && (
                  <div className="h-full py-32 flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center">
                    <MessageSquarePlus size={40} className="opacity-20" />
                    <p className="text-sm font-medium">Select a verse to view insights or open messages.</p>
                  </div>
                )}
             </div>
             {selectedVerse && (
               <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50">
                 <button 
                  onClick={() => user ? setIsAddingInsight(true) : setShowAuth(true)} 
                  title="Add your commentary"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:border-indigo-300"
                 >
                    <Plus size={14} className="text-indigo-500" /> Add Commentary
                 </button>
               </div>
             )}
          </div>
        )}
      </div>

      {/* 3. Global Overlays */}
      {selectedVerse && isAddingInsight && activeVerseId && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom-8 duration-300">
           <AddCommentForm 
             verseId={activeVerseId as string} 
             groupId={activeGroupId || undefined}
             onSuccess={() => setIsAddingInsight(false)} 
             onCancel={() => setIsAddingInsight(false)}
             fullHeight
             referenceLabel={`${getBookAbbreviation(decodeURIComponent(activeBook))} ${activeChapter}:${selectedVerse.verse_number || selectedVerse.verse_num}`}
           />
        </div>
      )}
    </section>
  );
};