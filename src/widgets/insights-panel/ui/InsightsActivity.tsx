// Path: src/widgets/insights-panel/ui/InsightsActivity.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Bell, Loader2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../shared/api/supabase';
import { Verse } from '../../../entities/verse/ui/VerseCard';
import { getVersePath } from '../../../shared/lib/reference-navigation';

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

const formatTimestamp = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return '1m ago';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return `1 day ago`;
  if (diffInDays < 365) return `${diffInDays} days ago`;
  
  return `${Math.floor(diffInDays / 365)}yr ago`;
};

const extractSnippet = (htmlStr: string | undefined | null) => {
  if (!htmlStr) return null;
  // Strip HTML tags and collapse whitespace
  const text = htmlStr.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 50 ? text.substring(0, 50) + '...' : text;
};

interface Notification {
  id: string;
  type: 'reply' | 'like';
  is_read: boolean;
  created_at: string;
  verse_id: string;
  content?: string; // Standard fallback column
  actor: { display_name: string; username: string; };
  verse_context?: { book_id: string; chapter_num: number; verse_num: number; };
  comment?: { content: string }; // Optional relation based on schema
}

interface InsightsActivityProps {
  user: SupabaseUser;
  onSelectVerse?: (verse: Verse) => void;
  setViewMode: (mode: 'thread' | 'notifications' | 'chat') => void;
}

export const InsightsActivity = ({ 
  user, 
  onSelectVerse, 
  setViewMode 
}: InsightsActivityProps) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      if (!supabase) return;
      try {
        // First try to fetch with the comment join (in case comment_id exists)
        const response = await supabase
          .from('notifications')
          .select(`
            *, 
            actor:profiles!actor_id ( display_name, username ), 
            verse_context:verses!verse_id ( book_id, chapter_num, verse_num ),
            comment:comments ( content )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        let data = response.data;
        const error = response.error;

        // If the comment join fails (e.g. no FK exists), fallback to standard columns
        if (error) {
          const fallback = await supabase
            .from('notifications')
            .select(`
              *, 
              actor:profiles!actor_id ( display_name, username ), 
              verse_context:verses!verse_id ( book_id, chapter_num, verse_num )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
          data = fallback.data;
        }

        if (isMounted) {
          if (data) setNotifications(data as unknown as Notification[]);
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
    
    // Clear notification optimistically
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }

    if (notif.verse_context) {
      const { book_id, chapter_num, verse_num } = notif.verse_context;
      
      // Update UI state so the thread is open when the reader lands
      if (onSelectVerse) {
        onSelectVerse({
          id: notif.verse_id.toString(),
          verse_id: notif.verse_id,
          verse_num: verse_num,
          verse_number: verse_num,
          text_he: '',
          text_en: '',
          book_id: book_id,
          chapter_num: chapter_num
        } as Verse);
      }
      setViewMode('thread');
      
      // Use standard deep link format to trigger the scroll inside ReaderPage
      router.push(getVersePath(book_id, chapter_num, verse_num));
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
        notifications.map(notif => {
          const rawContent = notif.comment?.content || notif.content;
          const snippet = extractSnippet(rawContent);

          return (
            <button 
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              title={`View notification from ${notif.actor?.display_name || notif.actor?.username || 'user'}`}
              className={`w-full p-5 flex items-start gap-4 transition-all text-left relative group ${!notif.is_read ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
            >
              {/* Left border highlight for unread items */}
              {!notif.is_read && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              )}
              
              <div className={`mt-1 w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${!notif.is_read ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                {notif.type === 'reply' ? <MessageCircle size={16} /> : <Bell size={16} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-[13px] text-slate-900 dark:text-slate-100 leading-snug">
                    <span className="font-bold">@{notif.actor?.username || notif.actor?.display_name || 'Someone'}</span> 
                    {notif.type === 'reply' ? ' replied to your post on ' : ' liked your post on '}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {notif.verse_context ? `${getBookAbbreviation(notif.verse_context.book_id)} ${notif.verse_context.chapter_num}:${notif.verse_context.verse_num}` : 'a verse'}
                    </span>
                  </p>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0 whitespace-nowrap pt-0.5">
                    {formatTimestamp(notif.created_at)}
                  </span>
                </div>
                
                {snippet && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 italic line-clamp-1 border-l-2 border-slate-200 dark:border-slate-700 pl-2.5">
                    &ldquo;{snippet}&rdquo;
                  </p>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};