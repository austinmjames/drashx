// Path: src/app/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../shared/api/supabase';

// Import our core page features
import { HomePage } from '../pages/home/ui/HomePage';
import { ReaderPage } from '../pages/reader/ui/ReaderPage';

// Define the expected structure of the database response to satisfy TypeScript
interface ProfileData {
  last_book?: string;
  last_chapter?: number;
}

export default function RootPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State to hold the user's last visited location
  const [lastBook, setLastBook] = useState('Genesis');
  const [lastChapter, setLastChapter] = useState(1);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Fetch the reading location from the profile table
    // Moved inside the useEffect to resolve the Next.js exhaustive-deps build error
    const fetchLastPosition = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('last_book, last_chapter')
          .eq('id', userId)
          .single();

        if (error) throw error;

        if (data) {
          // Cast the response to our specific interface to prevent TS build errors
          const profile = data as ProfileData;
          if (profile.last_book) setLastBook(profile.last_book);
          if (profile.last_chapter) setLastChapter(profile.last_chapter);
        }
      } catch (e) {
        console.error("Error fetching last reading position:", e);
      } finally {
        setIsLoading(false);
      }
    };

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchLastPosition(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen for Auth State Changes (Login / Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        fetchLastPosition(newSession.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Empty dependency array is now completely safe and strictly valid

  // Show a premium loading state while verifying auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading DrashX...</p>
      </div>
    );
  }

  // Route: Unauthenticated Users -> Marketing Homepage
  if (!session) {
    return <HomePage />;
  }

  // Route: Authenticated Users -> Reader Page (at their last known location)
  return <ReaderPage bookName={lastBook} chapterNumber={lastChapter} />;
}