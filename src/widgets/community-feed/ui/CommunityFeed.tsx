"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../shared/api/supabase';
import { UserAvatar } from '../../../entities/user/ui/UserAvatar';
import { Clock, MessageSquare, ChevronRight, Loader2, Quote } from 'lucide-react';

/**
 * Community Feed Widget
 * Path: src/widgets/community-feed/ui/CommunityFeed.tsx
 * Fetches and displays the latest comments across the entire platform.
 */
type FeedItem = {
  id: string;
  content: string;
  created_at: string;
  profiles: { id: string; display_name: string | null; username: string; avatar_url: string | null };
  verses: {
    verse_number: number;
    text_en: string;
    chapters: {
      chapter_number: number;
      books: { name_en: string };
    };
  };
};

export const CommunityFeed = () => {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Capture the current time in state to maintain a pure render cycle
  // We use a callback so it only evaluates once on mount.
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const fetchLatestComments = async () => {
      // Fetch latest top-level comments with all necessary relational data
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id, content, created_at,
          profiles (id, display_name, username, avatar_url),
          verses (
            verse_number, text_en,
            chapters (
              chapter_number,
              books (name_en)
            )
          )
        `)
        .is('parent_id', null) // Only get top-level comments for the feed
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && !error) {
        setFeed(data as unknown as FeedItem[]);
      }
      setLoading(false);
    };

    fetchLatestComments();
    
    // Optional: Update the "current time" every minute so relative dates stay fresh
    // without violating React's pure render rules.
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - currentTime) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No commentary yet</h3>
        <p className="text-slate-500 mt-2">Be the first to share an insight on the text!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feed.map((item) => {
        const bookName = item.verses.chapters.books.name_en;
        const chapterNum = item.verses.chapters.chapter_number;
        const verseNum = item.verses.verse_number;
        
        return (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-shadow hover:shadow-md group">
            
            {/* Context Header (The Verse) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <Quote className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                  {item.verses.text_en}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {bookName} {chapterNum}:{verseNum}
                  </span>
                </div>
              </div>
              
              <Link 
                href={`/read/${encodeURIComponent(bookName)}/${chapterNum}`}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                Read chapter <ChevronRight size={14} />
              </Link>
            </div>

            {/* Commentary Body */}
            <div className="p-5 flex gap-4">
              <UserAvatar 
                profile={{
                  id: item.profiles.id,
                  username: item.profiles.username,
                  display_name: item.profiles.display_name || undefined,
                  avatar_url: item.profiles.avatar_url || undefined
                }} 
                size="md" 
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {item.profiles?.display_name || item.profiles?.username || 'Anonymous'}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(item.created_at)}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
            </div>
            
          </div>
        );
      })}
    </div>
  );
};