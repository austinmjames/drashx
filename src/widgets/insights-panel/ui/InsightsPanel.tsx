// Path: src/widgets/insights-panel/ui/InsightsPanel.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
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

// --- Helpers ---

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

export type ViewMode = 'thread' | 'notifications' | 'chat';

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
  
  // Notification States
  const [unreadMentions, setUnreadMentions] = useState(0);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const activeVerseId = selectedVerse?.verse_id || selectedVerse?.id;

  /**
   * Fetches the persistent unread message/mention status from the database.
   * This is used to hydrate the red/blue notification dots on load.
   */
  const fetchUnreadStatus = useCallback(async (isMounted: boolean) => {
    if (!user || !activeGroupId || activeGroupId === user.id) return;
    
    const { data, error } = await supabase.rpc('get_group_unread_status', {
      p_user_id: user.id,
      p_group_id: activeGroupId
    });

    if (isMounted && !error && data?.[0]) {
      setHasUnreadMessages(data[0].has_unread);
      setUnreadMentions(data[0].mention_count);
    }
  }, [user, activeGroupId]);

  // 1. Initial Load & Realtime Listener
  useEffect(() => {
    let isMounted = true;
    if (!supabase || !activeGroupId || activeGroupId === user?.id) return;

    // Trigger initial hydration asynchronously to avoid cascading synchronous render warnings
    const initialize = async () => {
      await fetchUnreadStatus(isMounted);
    };
    initialize();

    const channel = supabase.channel(`notifications-${activeGroupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${activeGroupId}`
      }, (payload) => {
        // Only track if user is not currently looking at the chat tab
        if (viewMode !== 'chat' && isMounted) {
          const msg = payload.new;
          const myUsername = user?.user_metadata?.username;
          
          const isMention = msg.content.includes('@here') || 
                            msg.content.includes('@everyone') || 
                            (myUsername && msg.content.includes(`@${myUsername}`));

          if (isMention) {
            setUnreadMentions(prev => prev + 1);
          } else {
            setHasUnreadMessages(true);
          }
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeGroupId, viewMode, user, fetchUnreadStatus]);

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
  const displayGroupName = currentGroupName.length > 15 ? `${currentGroupName.substring(0, 15)}...` : currentGroupName;

  const getGroupBranding = (iconId: string | undefined | null, colorId: string | undefined | null, isSelf: boolean) => {
    if (isSelf) return { Icon: UserIcon, color: COLOR_OPTIONS[0] };
    const icon = ICON_OPTIONS.find(opt => opt.id === iconId)?.icon || Users;
    const color = COLOR_OPTIONS.find(opt => opt.id === colorId) || COLOR_OPTIONS[0];
    return { Icon: icon, color };
  };

  const { Icon: ActiveIcon, color: ActiveColor } = getGroupBranding(activeGroup?.icon_url, activeGroup?.color_theme, isPersonal);

  const handleOpenChat = () => {
    if (!user) return setShowAuth(true);
    setViewMode('chat');
    setUnreadMentions(0);
    setHasUnreadMessages(false);
  };

  return (
    <section className="w-full md:w-112.5 flex-none bg-slate-50 dark:bg-slate-950/40 flex flex-col relative overflow-hidden md:border-l border-slate-200 dark:border-slate-800 pointer-events-auto h-full">
      
      {/* 1. Header Navigation */}
      <div className="flex-none px-4 md:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {viewMode !== 'thread' && (
            <button 
              onClick={() => setViewMode('thread')} 
              title="Back to insights"
              className="p-1.5 -ml-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          
          {selectedVerse && viewMode === 'thread' ? (
            <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {getBookAbbreviation(decodeURIComponent(activeBook))} {activeChapter}:{selectedVerse.verse_number || selectedVerse.verse_num}
            </h3>
          ) : viewMode === 'thread' ? (
            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Insights
            </h3>
          ) : null}

          <div className="relative ml-2" ref={groupMenuRef}>
            <button 
              onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
              title="Switch Study Group"
              className="flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm"
            >
              <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white ${ActiveColor.hex}`}>
                <ActiveIcon size={12} strokeWidth={2.5} />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={currentGroupName}>
                {displayGroupName}
              </span>
              <ChevronDown size={14} className={`text-slate-500 transition-transform ${isGroupMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isGroupMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3 border-b text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">Study Context</div>
                <div className="max-h-72 overflow-y-auto scrollbar-hide py-1">
                  <button 
                    onClick={() => { setActiveGroupId(user?.id || null); setIsGroupMenuOpen(false); }} 
                    className={`w-full flex justify-between items-center px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${activeGroupId === user?.id ? 'text-indigo-600 font-bold bg-indigo-50/30' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    <div className="flex gap-3 items-center"><UserIcon size={16} /> Personal</div>
                    {activeGroupId === user?.id && <Check size={14} />}
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
                            className={`w-full flex justify-between items-center px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${isActive ? 'text-indigo-600 font-bold bg-indigo-50/30' : 'text-slate-600 dark:text-slate-400'}`}
                          >
                            <div className="flex gap-3 items-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${branding.color.hex}`}>
                                <branding.Icon size={12} strokeWidth={2.5} />
                              </div>
                              <span className="truncate max-w-40">{group.name}</span>
                            </div>
                            {isActive && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <button 
                    onClick={() => { setIsManageGroupsOpen(true); setIsGroupMenuOpen(false); }} 
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    <Plus size={16} /> Manage groups
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isPersonal && (
            <button 
              onClick={handleOpenChat}
              className={`p-2.5 rounded-full transition-all relative ${viewMode === 'chat' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Group Messages"
            >
              <Mail size={22} />
              
              {/* Mentions Priority: Red Dot/Badge */}
              {unreadMentions > 0 ? (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              ) : hasUnreadMessages ? (
                /* Unread General Priority: Blue Dot */
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
              ) : null}
            </button>
          )}

          <button 
            onClick={() => {
              if (!user) return setShowAuth(true);
              setViewMode(viewMode === 'notifications' ? 'thread' : 'notifications');
            }}
            className={`p-2.5 rounded-full transition-all ${viewMode === 'notifications' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Activity"
          >
            <Bell size={22} />
          </button>

          {onCloseMobile && (
            <button 
              onClick={onCloseMobile} 
              title="Close Panel" 
              className="md:hidden p-2.5 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
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
            onChatOpened={() => {
              setUnreadMentions(0);
              setHasUnreadMessages(false);
            }}
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
                  <CommentThread verseId={activeVerseId} groupId={activeGroupId || undefined} />
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
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-all hover:border-indigo-300 shadow-sm"
                 >
                    <Plus size={16} className="text-indigo-500" /> Add Commentary
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