// Path: src/widgets/insights-panel/ui/InsightsActivity.tsx
import React, { useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Bell, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '../../../shared/api/supabase';
import { Verse } from '../../../entities/verse/ui/VerseCard';
import { ViewMode } from './InsightsPanel';

const getBookAbbreviation = (name: string): string => {
  const map: Record<string, string> = { 'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu' };
  return map[name] || name.slice(0, 3);
};

interface Notification {
  id: string;
  type: 'reply' | 'like';
  is_read: boolean;
  created_at: string;
  verse_id: string;
  actor: { display_name: string; username: string; };
  verse_context?: { book_id: string; chapter_num: number; verse_num: number; };
}

interface InsightsActivityProps {
  user: SupabaseUser;
  onSelectVerse?: (verse: Verse) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const InsightsActivity = ({ user, onSelectVerse, setViewMode }: InsightsActivityProps) => {
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
          if (!error && data) {
            setNotifications(data as unknown as Notification[]);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadNotifications();

    return () => {
      isMounted = false;
    };
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