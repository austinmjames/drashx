// Path: src/views/reader/ui/ReaderPage.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../../shared/api/supabase';
import { VerseCard, Verse } from '../../../entities/verse/ui/VerseCard';
import { AuthForm } from '../../../features/auth/ui/AuthForm';
import { ProfileSettings } from '../../../features/profile/edit-profile/ui/ProfileSettings';
import { TableOfContents } from '../../../widgets/table-of-contents/ui/TableOfContents';
import { GroupManagementModal } from '../../../features/groups/manage-groups/ui/GroupManagementModal';
import { ReaderHeader } from '../../../widgets/reader-header/ui/ReaderHeader';
import { InsightsPanel } from '../../../widgets/insights-panel/ui/InsightsPanel';
import { AlertCircle, User as UserIcon } from 'lucide-react';

let globalIsSidebarOpen = true;

interface Group { id: string; name: string; icon_url?: string; color_theme?: string; }

interface GroupMemberJoin {
  group_id: string;
  groups: Group | Group[];
}

interface ProfilePreferences {
  last_group_id?: string | null;
  reader_language_mode?: 'both' | 'en' | 'he' | null;
  reader_translation?: 'jps1917' | 'modernized' | null;
  reader_hebrew_style?: 'niqqud' | 'no-niqqud' | null;
  last_book?: string | null;
  last_chapter?: number | null;
}

const VerseSkeleton = () => (
  <div className="p-6 border-b border-slate-100 dark:border-slate-800 animate-pulse space-y-6">
    <div className="flex gap-6 items-start" dir="rtl"><div className="w-8 h-6 bg-slate-100 dark:bg-slate-800 rounded mt-1" /><div className="flex-1 space-y-3"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-full ml-auto" /><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-5/6 ml-auto" /></div></div>
    <div className="flex gap-6 items-start" dir="ltr"><div className="w-8 h-4 bg-slate-50 dark:bg-slate-900 rounded mt-1.5" /><div className="flex-1 space-y-2"><div className="h-5 bg-slate-50 dark:bg-slate-900 rounded w-full" /><div className="h-5 bg-slate-50 dark:bg-slate-900 rounded w-2/3" /></div></div>
  </div>
);

export const ReaderPage = ({ bookName, chapterNumber }: { bookName?: string; chapterNumber?: number }) => {
  const router = useRouter();
  const params = useParams();
  
  // Mobile & Layout States
  const [isSidebarOpen, setIsSidebarOpen] = useState(globalIsSidebarOpen);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // Settings States
  const [languageMode, setLanguageMode] = useState<'both' | 'en' | 'he'>('both');
  const [translation, setTranslation] = useState<'jps1917' | 'modernized'>('jps1917');
  const [hebrewStyle, setHebrewStyle] = useState<'niqqud' | 'no-niqqud'>('niqqud');

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);

  const activeBook = (params?.book as string) || String(bookName || 'Genesis');
  const activeChapter = Number(params?.chapter ?? chapterNumber ?? 1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [hebrewTitle, setHebrewTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Auto-close sidebar on mobile initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
      globalIsSidebarOpen = false;
    }
  }, []);

  const fetchUserProfilePreference = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('last_group_id, reader_language_mode, reader_translation, reader_hebrew_style')
      .eq('id', userId)
      .single();
    
    if (data) {
      const prefs = data as ProfilePreferences;
      if (prefs.last_group_id) setActiveGroupId(prefs.last_group_id);
      else setActiveGroupId(userId);

      if (prefs.reader_language_mode) setLanguageMode(prefs.reader_language_mode);
      if (prefs.reader_translation) setTranslation(prefs.reader_translation);
      if (prefs.reader_hebrew_style) setHebrewStyle(prefs.reader_hebrew_style);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfilePreference(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (session) { 
        setShowAuth(false); 
        fetchUserProfilePreference(session.user.id);
      } else { 
        setShowProfile(false); 
        setActiveGroupId(null); 
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchUserProfilePreference]);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups (id, name, icon_url, color_theme)')
      .eq('user_id', user.id);
      
    if (data) {
      setMyGroups((data as unknown as GroupMemberJoin[]).map((m) => {
        const groupObj = Array.isArray(m.groups) ? m.groups[0] : m.groups;
        return groupObj;
      }));
    }
  }, [user]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Persistent Setters wrapped in useCallback to satisfy linter dependencies
  const updatePreference = useCallback(async (updates: Partial<ProfilePreferences>) => {
    if (user) {
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }
  }, [user]);

  const handleSetActiveGroupId = async (id: string | null) => {
    setActiveGroupId(id);
    if (user) {
      const saveId = id === user.id ? null : id;
      updatePreference({ last_group_id: saveId });
    }
  };

  const handleSetLanguageMode = (mode: 'both' | 'en' | 'he') => {
    setLanguageMode(mode);
    updatePreference({ reader_language_mode: mode });
  };

  const handleSetTranslation = (trans: 'jps1917' | 'modernized') => {
    if (trans === 'modernized') return;
    setTranslation(trans);
    updatePreference({ reader_translation: trans });
  };

  const handleSetHebrewStyle = (style: 'niqqud' | 'no-niqqud') => {
    setHebrewStyle(style);
    updatePreference({ reader_hebrew_style: style });
  };

  // Tracking reading position
  useEffect(() => {
    if (user && activeBook) {
      updatePreference({ 
        last_book: decodeURIComponent(activeBook).trim(), 
        last_chapter: activeChapter 
      });
    }
  }, [user, activeBook, activeChapter, updatePreference]);

  // Handle Fetching Verses
  useEffect(() => {
    const fetchVerses = async () => {
      setIsLoading(true); setFetchError(null);
      const cleanBookName = activeBook && activeBook !== 'undefined' ? decodeURIComponent(activeBook).trim() : '';
      try {
        const { data: bookData } = await supabase.from('books').select('id, name_en, name_he').ilike('name_en', cleanBookName).single();
        if (!bookData) throw new Error(`Book "${cleanBookName}" not found.`);
        setHebrewTitle(bookData.name_he);
        
        const { data: versesData } = await supabase
          .from('reader_verses_view')
          .select('*')
          .eq('book_id', bookData.name_en)
          .eq('chapter_num', activeChapter)
          .order('verse_num', { ascending: true });
          
        setVerses((versesData || []) as Verse[]);
      } catch (err: unknown) { 
        setFetchError(err instanceof Error ? err.message : String(err)); 
      } finally { setIsLoading(false); }
    };
    if (activeBook) fetchVerses();
  }, [activeBook, activeChapter]); 

  // Sync selection separately when verse list changes (e.g. chapter navigation)
  // This satisfies the linter without triggering re-fetches on simple verse selection clicks.
  useEffect(() => {
    if (verses.length > 0) {
      const currentId = selectedVerse?.verse_id || selectedVerse?.id;
      const isStillInList = verses.some(v => (v.verse_id || v.id) === currentId);
      if (!isStillInList) {
        setSelectedVerse(verses[0]);
      }
    }
  }, [verses, selectedVerse?.id, selectedVerse?.verse_id]);

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 relative">
      
      {/* Mobile Overlay: Left Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
          onClick={() => { setIsSidebarOpen(false); globalIsSidebarOpen = false; }}
        />
      )}

      {/* Left Navigation Pane */}
      <aside className={`
        absolute md:relative z-40 h-full flex flex-col bg-slate-50 dark:bg-slate-900/30 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0 w-72 shadow-2xl md:shadow-none opacity-100' : '-translate-x-full md:translate-x-0 w-72 md:w-0 md:opacity-0 md:pointer-events-none'}
      `}>
        <div className="flex-1 overflow-y-auto w-72"><TableOfContents /></div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 w-72 bg-slate-50 dark:bg-slate-900/30">
          <button onClick={() => user ? setShowProfile(true) : setShowAuth(true)} title={user ? "Profile" : "Sign In"} className="w-full flex items-center justify-center gap-2 py-3 md:py-2 bg-slate-200 dark:bg-slate-800 rounded-xl md:rounded-lg text-sm font-bold md:font-medium active:scale-95 transition-transform"><UserIcon size={16} /> {user ? 'My Profile' : 'Sign In'}</button>
        </div>
      </aside>

      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Center Reader Pane */}
        <section className="flex-1 overflow-y-auto border-r border-slate-100 dark:border-slate-900 scrollbar-hide flex flex-col relative">
          <ReaderHeader 
            isSidebarOpen={isSidebarOpen} 
            toggleSidebar={() => { setIsSidebarOpen(!isSidebarOpen); globalIsSidebarOpen = !isSidebarOpen; }}
            isInsightsOpen={isInsightsOpen}
            toggleInsights={() => setIsInsightsOpen(!isInsightsOpen)}
            activeBook={decodeURIComponent(activeBook)} activeChapter={activeChapter} hebrewTitle={hebrewTitle}
            handlePrevChapter={() => activeChapter > 1 && router.push(`/read/${encodeURIComponent(activeBook)}/${activeChapter - 1}`)}
            handleNextChapter={() => router.push(`/read/${encodeURIComponent(activeBook)}/${activeChapter + 1}`)}
            languageMode={languageMode} setLanguageMode={handleSetLanguageMode}
            translation={translation} setTranslation={handleSetTranslation}
            hebrewStyle={hebrewStyle} setHebrewStyle={handleSetHebrewStyle}
          />
          
          <div className="max-w-3xl mx-auto py-6 md:py-8 w-full flex-1 md:px-6">
            {isLoading ? <div className="space-y-4">{[...Array(6)].map((_, i) => <VerseSkeleton key={i} />)}</div> : fetchError ? <div className="flex flex-col items-center justify-center h-64 text-rose-500 gap-4"><AlertCircle size={48}/><p>{fetchError}</p></div> : 
              verses.map((v) => (
                <VerseCard 
                  key={v.verse_id || v.id} 
                  verse={v} 
                  active={(selectedVerse?.verse_id || selectedVerse?.id) === (v.verse_id || v.id)} 
                  languageMode={languageMode} 
                  hebrewStyle={hebrewStyle} 
                  translation={translation} 
                  onClick={() => {
                    setSelectedVerse(v);
                    setIsInsightsOpen(true); // Auto-open insights on mobile tap
                  }} 
                />
              ))
            }
          </div>
        </section>

        {/* Mobile Overlay: Insights Panel */}
        {isInsightsOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
            onClick={() => setIsInsightsOpen(false)}
          />
        )}

        {/* Right Commentary/Insights Pane Wrapper */}
        <div className={`
          absolute md:relative z-40 inset-y-0 right-0 h-full bg-white dark:bg-slate-950 md:bg-transparent transition-transform duration-300 ease-in-out
          w-[85vw] sm:w-96 md:w-auto
          ${isInsightsOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : 'translate-x-full md:translate-x-0'}
          md:flex
        `}>
          <InsightsPanel 
            user={user} 
            activeBook={activeBook} 
            activeChapter={activeChapter} 
            selectedVerse={selectedVerse} 
            isLoading={isLoading} 
            onSelectVerse={setSelectedVerse} 
            activeGroupId={activeGroupId} 
            setActiveGroupId={handleSetActiveGroupId} 
            myGroups={myGroups} 
            setIsManageGroupsOpen={setIsManageGroupsOpen} 
            setShowAuth={setShowAuth}
            onCloseMobile={() => setIsInsightsOpen(false)} 
          />
        </div>

      </main>

      {isManageGroupsOpen && user && (
        <GroupManagementModal 
          isOpen={isManageGroupsOpen} 
          onClose={() => setIsManageGroupsOpen(false)} 
          userId={user.id} 
          onGroupsChange={fetchGroups}
          onGroupCreated={(newId) => { fetchGroups(); handleSetActiveGroupId(newId); }}
        />
      )}
      
      {showAuth && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"><div className="relative"><button onClick={() => setShowAuth(false)} className="absolute -top-12 right-0 text-white font-bold">Close</button><AuthForm /></div></div>}
      {showProfile && user && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"><ProfileSettings userId={user.id} onClose={() => setShowProfile(false)} /></div>}
    </div>
  );
};