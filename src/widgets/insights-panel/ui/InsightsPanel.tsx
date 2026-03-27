// Path: src/widgets/insights-panel/ui/InsightsPanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Users, User as UserIcon, Check, Plus, MessageSquarePlus, Bell, MessageCircle, ArrowLeft, Loader2, ChevronDown } from 'lucide-react';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';
import { CommentThread } from '../../../widgets/comment-threads/ui/CommentThread';
import { Verse } from '../../../entities/verse/ui/VerseCard';
import { supabase } from '../../../shared/api/supabase';
import { ICON_OPTIONS, COLOR_OPTIONS } from '../../../features/groups/manage-groups/ui/CreateGroupView';

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

interface Notification {
  id: string;
  type: 'reply' | 'like';
  is_read: boolean;
  created_at: string;
  verse_id: string;
  actor: {
    display_name: string;
    username: string;
  };
  verse_context?: {
    book_id: string;
    chapter_num: number;
    verse_num: number;
  };
}

interface GroupData {
  id: string;
  name: string;
  icon_url?: string;
  color_theme?: string;
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
}

export const InsightsPanel = ({
  user, activeBook, activeChapter, selectedVerse, isLoading, onSelectVerse,
  activeGroupId, setActiveGroupId, myGroups,
  setIsManageGroupsOpen, setShowAuth
}: InsightsPanelProps) => {
  const [viewMode, setViewMode] = useState<'thread' | 'notifications'>('thread');
  const [isAddingInsight, setIsAddingInsight] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifLoading, setIsNotifLoading] = useState(false);

  // React-managed hover states
  const [isBellHovered, setIsBellHovered] = useState(false);
  const [isGroupBtnHovered, setIsGroupBtnHovered] = useState(false);
  const [isAddBtnHovered, setIsAddBtnHovered] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const groupMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setIsNotifLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id ( display_name, username ),
          verse_context:verse_id ( book_id, chapter_num, verse_num )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data as unknown as Notification[]);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsNotifLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const channel = supabase
        .channel(`notifs-${user.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${user.id}` 
        }, () => {
          fetchNotifications();
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(event.target as Node)) {
        setIsGroupMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const activeGroup = myGroups.find(g => g.id === activeGroupId);
  const isPersonal = activeGroupId === user?.id;
  const currentGroupName = isPersonal ? "Personal" : activeGroup?.name || "Select Group";

  // Robust icon and color resolver with defensive string cleanup
  const getGroupBranding = (iconId: string | undefined | null, colorId: string | undefined | null, isSelf: boolean) => {
    if (isSelf) return { Icon: UserIcon, color: COLOR_OPTIONS[0] };
    
    const cleanIconId = (iconId || '').trim().toLowerCase();
    const cleanColorId = (colorId || '').trim().toLowerCase();

    const icon = ICON_OPTIONS.find(opt => opt.id.toLowerCase() === cleanIconId)?.icon || Users;
    const color = COLOR_OPTIONS.find(opt => opt.id.toLowerCase() === cleanColorId) || COLOR_OPTIONS[0];
    
    return { Icon: icon, color };
  };

  const { Icon: ActiveIcon, color: ActiveColor } = getGroupBranding(activeGroup?.icon_url, activeGroup?.color_theme, isPersonal);

  const handleNotificationClick = async (notif: Notification) => {
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

  const activeVerseId = selectedVerse?.verse_id || selectedVerse?.id;

  return (
    <section className="w-112.5 flex-none bg-slate-50 dark:bg-slate-900/40 flex flex-col relative overflow-hidden border-l border-slate-200 dark:border-slate-800 pointer-events-auto">
      
      {selectedVerse && isAddingInsight && activeVerseId !== undefined && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom-8 duration-300">
          <AddCommentForm 
            verseId={activeVerseId as string} 
            groupId={activeGroupId || undefined}
            onSuccess={() => setIsAddingInsight(false)} 
            onCancel={() => setIsAddingInsight(false)}
            fullHeight
            referenceLabel={`${getBookAbbreviation(decodeURIComponent(activeBook))} ${activeChapter}:${selectedVerse.verse_number || selectedVerse.verse_num || ''}`}
          />
        </div>
      )}

      <div className="flex-none px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-30 flex items-center justify-between">
        {viewMode === 'notifications' ? (
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setViewMode('thread')} 
               title="Back to insights"
               aria-label="Back to insights"
               className="p-1 -ml-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
             >
               <ArrowLeft size={18} />
             </button>
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Activity</h3>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {selectedVerse ? (
              <>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 whitespace-nowrap">
                  {getBookAbbreviation(decodeURIComponent(activeBook))} {activeChapter}:{selectedVerse.verse_number || selectedVerse.verse_num}
                </h3>
                <span className="text-slate-200 dark:text-slate-800">|</span>
                <div className="relative" ref={groupMenuRef}>
                  {/* Enhanced "Selectable" Pill Trigger with White-on-Color Icon */}
                  <button 
                    onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)} 
                    onMouseEnter={() => setIsGroupBtnHovered(true)}
                    onMouseLeave={() => setIsGroupBtnHovered(false)}
                    title="Change viewing group"
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-all border shadow-sm ${
                      isGroupBtnHovered 
                        ? 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-900 scale-[1.02]' 
                        : 'bg-slate-100/50 dark:bg-slate-900/50 border-transparent'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-xs transition-colors ${ActiveColor.hex}`}>
                      <ActiveIcon size={10} strokeWidth={3} />
                    </div>
                    <span className={`text-[11px] font-bold transition-colors ${isGroupBtnHovered ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                      {currentGroupName}
                    </span>
                    <ChevronDown size={10} className={`ml-0.5 transition-transform ${isGroupMenuOpen ? 'rotate-180' : ''} ${isGroupBtnHovered ? 'text-indigo-400' : 'text-slate-300'}`} />
                  </button>

                  {isGroupMenuOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="max-h-80 overflow-y-auto py-2">
                        {/* Personal Entry */}
                        <button 
                          onClick={() => { setActiveGroupId(user?.id || null); setIsGroupMenuOpen(false); }} 
                          onMouseEnter={() => setHoveredItemId('personal')}
                          onMouseLeave={() => setHoveredItemId(null)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                            activeGroupId === user?.id 
                              ? 'text-indigo-600 bg-indigo-50/30 font-bold' 
                              : hoveredItemId === 'personal' ? 'bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${COLOR_OPTIONS[0].hex}`}>
                              <UserIcon size={12} strokeWidth={3} />
                            </div>
                            <span>Personal</span>
                          </div>
                          {activeGroupId === user?.id && <Check size={14} />}
                        </button>
                        
                        {/* My Groups List - Now with themed circles */}
                        {myGroups.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {myGroups.map(group => {
                              const { Icon: GroupIcon, color: GroupColor } = getGroupBranding(group.icon_url, group.color_theme, false);
                              const isActive = activeGroupId === group.id;
                              const isHovered = hoveredItemId === group.id;
                              return (
                                <button 
                                  key={group.id} 
                                  onClick={() => { setActiveGroupId(group.id); setIsGroupMenuOpen(false); }} 
                                  onMouseEnter={() => setHoveredItemId(group.id)}
                                  onMouseLeave={() => setHoveredItemId(null)}
                                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                                    isActive 
                                      ? 'text-indigo-600 bg-indigo-50/30 font-bold' 
                                      : isHovered ? 'bg-slate-50 dark:bg-slate-900' : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white shadow-xs ${GroupColor.hex}`}>
                                      <GroupIcon size={12} strokeWidth={3} />
                                    </div>
                                    <span className="truncate max-w-35">{group.name}</span>
                                  </div>
                                  {isActive && <Check size={14} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <button 
                          onClick={() => { setIsGroupMenuOpen(false); setIsManageGroupsOpen(true); }} 
                          onMouseEnter={() => setHoveredItemId('manage')}
                          onMouseLeave={() => setHoveredItemId(null)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-colors rounded-xl ${
                            hoveredItemId === 'manage' ? 'bg-white dark:bg-slate-800 text-indigo-700' : 'text-indigo-600'
                          }`}
                        >
                          <Plus size={14} /> Manage Groups
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Insights</h3>
            )}
          </div>
        )}

        <button 
          onClick={() => {
            if (!user) return setShowAuth(true);
            setViewMode(viewMode === 'notifications' ? 'thread' : 'notifications');
          }}
          onMouseEnter={() => setIsBellHovered(true)}
          onMouseLeave={() => setIsBellHovered(false)}
          className={`p-2 rounded-full transition-all relative ${
            viewMode === 'notifications' 
              ? 'bg-indigo-100 text-indigo-600' 
              : isBellHovered 
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' 
                : 'text-slate-400'
          }`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pointer-events-auto">
        {viewMode === 'notifications' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {isNotifLoading && notifications.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                 <Loader2 size={24} className="animate-spin text-indigo-500 mb-2" />
                 <p className="text-xs font-medium">Checking activity...</p>
               </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-10 text-center text-slate-400 gap-3">
                <Bell size={32} className="opacity-10" />
                <p className="text-sm font-medium">Your activity is quiet for now.</p>
                <p className="text-xs opacity-60">Replies to your insights will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map(notif => (
                  <button 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full p-6 flex items-start gap-4 hover:bg-white dark:hover:bg-slate-800/40 transition-colors text-left border-b border-transparent ${!notif.is_read ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}
                  >
                    <div className={`mt-1 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      {notif.type === 'reply' ? <MessageCircle size={16} /> : <Check size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-900 dark:text-slate-100 leading-snug">
                        <span className="font-bold">{notif.actor?.display_name || notif.actor?.username || 'Someone'}</span> 
                        {notif.type === 'reply' ? ' replied to your insight.' : ' liked your insight.'}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {notif.verse_context && (
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded uppercase tracking-wider">
                            {getBookAbbreviation(notif.verse_context.book_id)} {notif.verse_context.chapter_num}:{notif.verse_context.verse_num}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    {!notif.is_read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-2">
            {selectedVerse && activeVerseId !== undefined ? (
              <CommentThread verseId={activeVerseId as string} groupId={activeGroupId || undefined} />
            ) : !isLoading && (
              <div className="h-full py-32 flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center">
                 <MessageSquarePlus size={40} className="opacity-20" />
                 <p className="text-sm font-medium">Select a verse to view and contribute insights.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === 'thread' && selectedVerse && (
        <div className="flex-none p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 z-10 relative">
          <button 
            onClick={() => user ? setIsAddingInsight(true) : setShowAuth(true)}
            onMouseEnter={() => setIsAddBtnHovered(true)}
            onMouseLeave={() => setIsAddBtnHovered(false)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 border transition-all rounded-xl text-xs font-bold active:scale-95 group ${
              isAddBtnHovered 
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-600 shadow-sm' 
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className={`p-1 rounded-lg transition-transform ${isAddBtnHovered ? 'rotate-90 text-blue-600' : 'text-indigo-500'}`}>
              <Plus size={14} />
            </div>
            Add Commentary
          </button>
        </div>
      )}
    </section>
  );
};