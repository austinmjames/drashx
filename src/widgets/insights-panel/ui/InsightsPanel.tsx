// Path: src/widgets/insights-panel/ui/InsightsPanel.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User as SupabaseUser, RealtimeChannel } from '@supabase/supabase-js';
import { 
  Users, User as UserIcon, Plus, MessageSquarePlus, 
  Bell, ArrowLeft, X, Mail, ChevronDown, Check
} from 'lucide-react';

import { ICON_OPTIONS, COLOR_OPTIONS } from '../../../features/groups/manage-groups/ui/CreateGroupView';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';
import { CommentThread } from '../../../widgets/comment-threads/ui/CommentThread';
import { Verse } from '../../../entities/verse/ui/VerseCard';
import { InsightsChat } from './InsightsChat';
import { InsightsActivity } from './InsightsActivity';
import { supabase } from '../../../shared/api/supabase';

// --- Types ---

interface GroupData {
  id: string;
  name: string;
  icon_url?: string;
  color_theme?: string;
}

export type ViewMode = 'thread' | 'notifications' | 'chat';

interface MessagePayload {
  new: {
    content: string;
    user_id: string;
    [key: string]: unknown;
  };
}

interface NotificationPayload {
  new: {
    group_id: string | null;
    [key: string]: unknown;
  };
}

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

// --- Helpers ---

const getBookAbbreviation = (name: string): string => {
  const map: Record<string, string> = {
    'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
    'Joshua': 'Jos', 'Judges': 'Jud', 'I Samuel': '1 Sam', 'II Samuel': '2 Sam', 'I Kings': '1 Kin', 'II Kings': '2 Kin',
    'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Ezekiel': 'Eze', 'Hosea': 'Hos', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Oba',
    'Jonah': 'Jon', 'Micah': 'Mic', 'Nahum': 'Hab', 'Habakkuk': 'Hab', 'Zephaniah': 'Zep', 'Haggai': 'Hag', 'Zechariah': 'Zec', 'Malachi': 'Mal',
    'Psalms': 'Psa', 'Proverbs': 'Pro', 'Job': 'Job', 'Song of Songs': 'Song', 'Ruth': 'Rut', 'Lamentations': 'Lam',
    'Ecclesiastes': 'Ecc', 'Esther': 'Est', 'Daniel': 'Dan', 'Ezra': 'Ezr', 'Nehemiah': 'Neh', 'I Chronicles': '1 Chr', 'II Chronicles': '2 Chr'
  };
  return map[name] || name.slice(0, 3);
};

export const InsightsPanel = (props: InsightsPanelProps) => {
  const {
    user, activeBook, activeChapter, selectedVerse, isLoading, onSelectVerse,
    activeGroupId, setActiveGroupId, myGroups, onCloseMobile, setShowAuth, setIsManageGroupsOpen
  } = props;

  const [viewMode, setViewMode] = useState<ViewMode>('thread');
  const viewModeRef = useRef<ViewMode>(viewMode);

  const [isAddingInsight, setIsAddingInsight] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [myUsername, setMyUsername] = useState<string>('');
  
  // Notification States
  const [unreadMentions, setUnreadMentions] = useState(0);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  
  const groupMenuRef = useRef<HTMLDivElement>(null);
  
  const activeVerseId = selectedVerse 
    ? String(selectedVerse.verse_id || selectedVerse.id) 
    : undefined;

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('username').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setMyUsername(data.username);
        });
    }
  }, [user]);

  const fetchUnreadStatus = useCallback(async (isMounted: boolean) => {
    if (!user || !activeGroupId || activeGroupId === user.id) return;
    
    if (viewModeRef.current === 'chat') {
      if (isMounted) {
        setHasUnreadMessages(false);
        setUnreadMentions(0);
      }
      return;
    }

    const { data, error } = await supabase.rpc('get_group_unread_status', {
      p_user_id: user.id,
      p_group_id: activeGroupId
    });

    if (isMounted && !error && data?.[0] && (viewModeRef.current as ViewMode) !== 'chat') {
      setHasUnreadMessages(data[0].has_unread);
      setUnreadMentions(data[0].mention_count);
    }
  }, [user, activeGroupId]);

  const checkUnreadActivity = useCallback(async (isMounted: boolean) => {
    if (!user) return;
    
    if (viewModeRef.current === 'notifications') {
      if (isMounted) setHasUnreadActivity(false);
      return;
    }

    const currentGroupId = activeGroupId === user.id ? null : activeGroupId;

    try {
      let query = supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .limit(1);

      if (currentGroupId) {
        query = query.eq('group_id', currentGroupId);
      } else {
        query = query.is('group_id', null);
      }

      const { data, error } = await query;
      if (isMounted) {
        setHasUnreadActivity(!error && data !== null && data.length > 0);
      }
    } catch (err) {
      console.error("Failed to check unread activity:", err);
      if (isMounted) setHasUnreadActivity(false);
    }
  }, [user, activeGroupId]);

  useEffect(() => {
    let isMounted = true;
    if (!supabase || !user) return;

    if (!activeGroupId || activeGroupId === user.id) {
      Promise.resolve().then(() => { if (isMounted) checkUnreadActivity(isMounted); });
    } else {
      const initialize = async () => {
        await Promise.all([fetchUnreadStatus(isMounted), checkUnreadActivity(isMounted)]);
      };
      initialize();
    }

    let msgChannel: RealtimeChannel | undefined;
    if (activeGroupId && activeGroupId !== user.id) {
      msgChannel = supabase.channel(`group-msgs-${activeGroupId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${activeGroupId}`
        }, (payload) => {
          const p = payload as unknown as MessagePayload;
          if (viewModeRef.current !== 'chat' && isMounted) {
            const contentLower = p.new.content.toLowerCase();
            const myUserLower = myUsername ? `@${myUsername.toLowerCase()}` : null;
            const isMention = contentLower.includes('@here') || contentLower.includes('@everyone') || (myUserLower && contentLower.includes(myUserLower));
            if (isMention) setUnreadMentions(prev => prev + 1);
            else if (p.new.user_id !== user.id) setHasUnreadMessages(true);
          }
        })
        .subscribe();
    }

    const activityChannel = supabase.channel(`activity-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const p = payload as unknown as NotificationPayload;
        const currentGroupId = activeGroupId === user.id ? null : activeGroupId;
        if (p.new.group_id === currentGroupId && viewModeRef.current !== 'notifications' && isMounted) {
          setHasUnreadActivity(true);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (msgChannel) supabase.removeChannel(msgChannel);
      supabase.removeChannel(activityChannel);
    };
  }, [activeGroupId, user, fetchUnreadStatus, checkUnreadActivity, myUsername]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setIsGroupMenuOpen(false);
      }
    };
    if (isGroupMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupMenuOpen]);

  const activeGroup = myGroups.find(g => g.id === activeGroupId);
  const isPersonal = activeGroupId === user?.id;
  const currentGroupName = isPersonal ? "Personal" : activeGroup?.name || "Select Group";
  
  // Branding Resolver
  const getGroupBranding = (iconId: string | undefined | null, colorId: string | undefined | null, isSelf: boolean) => {
    if (isSelf) return { Icon: UserIcon, color: COLOR_OPTIONS[0] };
    const icon = ICON_OPTIONS.find(opt => opt.id === iconId)?.icon || Users;
    const color = COLOR_OPTIONS.find(opt => opt.id === colorId) || COLOR_OPTIONS[0];
    return { Icon: icon, color };
  };

  const { Icon: ActiveIcon, color: ActiveColor } = getGroupBranding(activeGroup?.icon_url, activeGroup?.color_theme, isPersonal);

  const handleOpenChat = () => {
    if (!user) return setShowAuth(true);
    
    if (viewMode === 'chat') {
      setViewMode('thread');
    } else {
      setViewMode('chat');
      setUnreadMentions(0);
      setHasUnreadMessages(false);
    }
  };

  return (
    <section className="w-full md:w-112.5 flex-none bg-slate-50 dark:bg-slate-950 flex flex-col relative overflow-hidden md:border-l border-slate-200 dark:border-slate-800 pointer-events-auto h-full">
      
      {/* 1. Header Navigation */}
      <div className="flex-none px-3 md:px-6 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-30 flex items-center justify-between gap-2">
        
        {/* Left: Back / Group Selector Pill */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button 
            onClick={() => {
              if (viewMode !== 'thread') {
                setViewMode('thread');
              } else if (onCloseMobile) {
                onCloseMobile();
              }
            }} 
            title={viewMode === 'thread' ? "Back to reader" : "Back to insights"}
            className={`p-1.5 md:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all active:scale-90 shrink-0 ${viewMode === 'thread' ? 'md:hidden' : ''}`}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative min-w-0 z-40" ref={groupMenuRef}>
            <button 
              onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
              title="Switch Study Group"
              className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 md:px-4 md:py-2 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm min-w-0 max-w-45 sm:max-w-62.5 md:max-w-75"
            >
              <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white ${ActiveColor.hex} shrink-0`}>
                <ActiveIcon size={12} strokeWidth={2.5} />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                {currentGroupName}
              </span>
              <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ${isGroupMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isGroupMenuOpen && (
              <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 text-left">
                <div className="p-3 border-b text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-950/50">Study Context</div>
                <div className="max-h-72 overflow-y-auto scrollbar-hide py-1">
                  <button 
                    onClick={() => { setActiveGroupId(user?.id || null); setIsGroupMenuOpen(false); }} 
                    className={`w-full flex justify-between items-center px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${activeGroupId === user?.id ? 'text-indigo-600 font-bold bg-indigo-50/30' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    <div className="flex gap-3 items-center min-w-0"><UserIcon size={16} className="shrink-0" /> <span className="truncate">Personal</span></div>
                    {activeGroupId === user?.id && <Check size={14} className="shrink-0" />}
                  </button>

                  {myGroups.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      {myGroups.map(group => {
                        const branding = getGroupBranding(group.icon_url, group.color_theme, false);
                        const isActive = activeGroupId === group.id;
                        return (
                          <button 
                            key={group.id} 
                            onClick={() => { setActiveGroupId(group.id); setIsGroupMenuOpen(false); }} 
                            className={`w-full flex justify-between items-center px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isActive ? 'text-indigo-600 font-bold bg-indigo-50/30' : 'text-slate-600 dark:text-slate-400'}`}
                          >
                            <div className="flex gap-3 items-center min-w-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${branding.color.hex}`}>
                                <branding.Icon size={12} strokeWidth={2.5} />
                              </div>
                              <span className="truncate max-w-36">{group.name}</span>
                            </div>
                            {isActive && <Check size={14} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                  <button onClick={() => { setIsManageGroupsOpen(true); setIsGroupMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"><Plus size={14} /> Manage groups</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 justify-end shrink-0 min-w-0">
          {!isPersonal && (
            <button 
              onClick={handleOpenChat}
              className={`p-2 md:p-2.5 rounded-xl transition-all relative ${viewMode === 'chat' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Group Messages"
            >
              <Mail size={22} />
              {unreadMentions > 0 ? (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
              ) : hasUnreadMessages ? (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-950" />
              ) : null}
            </button>
          )}

          <button 
            onClick={() => {
              if (!user) return setShowAuth(true);
              if (viewMode === 'notifications') {
                setViewMode('thread');
              } else {
                setViewMode('notifications');
                setHasUnreadActivity(false);
              }
            }}
            className={`p-2 md:p-2.5 rounded-xl transition-all relative ${viewMode === 'notifications' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Activity"
          >
            <Bell size={22} />
            {hasUnreadActivity && viewMode !== 'notifications' && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse" />
            )}
          </button>

          {onCloseMobile && (
            <button 
              onClick={onCloseMobile} 
              title="Close Panel" 
              className="md:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={24} />
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
            groupColor={activeGroup?.color_theme}
            myUsername={myUsername}
            onChatOpened={() => { setUnreadMentions(0); setHasUnreadMessages(false); }}
          />
        ) : viewMode === 'notifications' && user ? (
          <InsightsActivity user={user} activeGroupId={isPersonal ? null : activeGroupId} onSelectVerse={onSelectVerse} setViewMode={setViewMode} />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
             <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-2 w-full">
                {selectedVerse && activeVerseId ? (
                  <CommentThread verseId={activeVerseId} groupId={isPersonal ? undefined : (activeGroupId || undefined)} />
                ) : !isLoading && (
                  <div className="h-full py-32 flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center w-full">
                    <MessageSquarePlus size={40} className="opacity-20" />
                    <p className="text-sm font-medium italic">Select a verse to view insights or open group chat.</p>
                  </div>
                )}
             </div>
             {selectedVerse && (
               <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                 <button 
                  onClick={() => user ? setIsAddingInsight(true) : setShowAuth(true)} 
                  title="Add your commentary"
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                 >
                    <Plus size={16} /> Add Commentary
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
             verseId={activeVerseId} 
             groupId={isPersonal ? undefined : (activeGroupId || undefined)}
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