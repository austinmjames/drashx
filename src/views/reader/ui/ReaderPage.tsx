// Path: src/views/reader/ui/ReaderPage.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../../shared/api/supabase';
import { VerseCard, Verse } from '../../../entities/verse/ui/VerseCard';
import { AuthForm } from '../../../features/auth/ui/AuthForm';
import { ProfileSettings } from '../../../features/profile/edit-profile/ui/ProfileSettings';
import { TableOfContents } from '../../../widgets/table-of-contents/ui/TableOfContents';
import { GroupManagementModal } from '../../../features/groups/manage-groups/ui/GroupManagementModal';
import { ReaderHeader } from '../../../widgets/reader-header/ui/ReaderHeader';
import { InsightsPanel } from '../../../widgets/insights-panel/ui/InsightsPanel';
import { LexiconModal } from '../../../features/lexicon/ui/LexiconModal';
import { AlertCircle, User as UserIcon } from 'lucide-react';

let globalIsSidebarOpen = true;

interface Group { id: string; name: string; icon_url?: string; color_theme?: string; }
interface GroupMemberJoin { group_id: string; groups: Group | Group[]; }
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
  const searchParams = useSearchParams();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(globalIsSidebarOpen);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
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
  const [selectedStrongs, setSelectedStrongs] = useState<string | null>(null);

  // --- Navigation Support: Scrolling Logic ---
  const scrollToVerse = useCallback((vNum: number) => {
    setTimeout(() => {
      const element = document.getElementById(`verse-${vNum}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const verseObj = verses.find(v => (v.verse_num || v.verse_number) === vNum);
        if (verseObj) setSelectedVerse(verseObj);
      }
    }, 150);
  }, [verses]);

  useEffect(() => {
    const vParam = searchParams.get('v');
    if (vParam && !isLoading && verses.length > 0) {
      scrollToVerse(parseInt(vParam));
    }
  }, [searchParams, isLoading, verses, scrollToVerse]);

  useEffect(() => {
    const handleJumpEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ book: string; chapter: number; verse: number }>;
      const { book, chapter, verse } = customEvent.detail;
      const currentBook = decodeURIComponent(activeBook);
      if (currentBook === book && activeChapter === chapter) {
        scrollToVerse(verse);
      }
    };
    window.addEventListener('reader-jump-to-verse', handleJumpEvent);
    return () => window.removeEventListener('reader-jump-to-verse', handleJumpEvent);
  }, [activeBook, activeChapter, scrollToVerse]);

  // --- Existing Logic ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
      globalIsSidebarOpen = false;
    }
  }, []);

  const fetchUserProfilePreference = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
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
    const { data } = await supabase.from('group_members').select('group_id, groups (*)').eq('user_id', user.id);
    if (data) {
      const joinedData = data as unknown as GroupMemberJoin[];
      setMyGroups(joinedData.map((m) => Array.isArray(m.groups) ? m.groups[0] : m.groups));
    }
  }, [user]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const updatePreference = useCallback(async (updates: Partial<ProfilePreferences>) => {
    if (user) await supabase.from('profiles').update(updates).eq('id', user.id);
  }, [user]);

  const handleSetActiveGroupId = async (id: string | null) => {
    setActiveGroupId(id);
    if (user) updatePreference({ last_group_id: id === user.id ? null : id });
  };

  const handleSetLanguageMode = (mode: 'both' | 'en' | 'he') => {
    setLanguageMode(mode);
    updatePreference({ reader_language_mode: mode });
  };

  const handleSetTranslation = (trans: 'jps1917' | 'modernized') => {
    setTranslation(trans);
    updatePreference({ reader_translation: trans });
  };

  const handleSetHebrewStyle = (style: 'niqqud' | 'no-niqqud') => {
    setHebrewStyle(style);
    updatePreference({ reader_hebrew_style: style });
  };

  useEffect(() => {
    const fetchVerses = async () => {
      setIsLoading(true); setFetchError(null);
      const cleanBookName = activeBook && activeBook !== 'undefined' ? decodeURIComponent(activeBook).trim() : '';
      try {
        const { data: bookData } = await supabase.from('books').select('*').ilike('name_en', cleanBookName).single();
        if (!bookData) throw new Error(`Book "${cleanBookName}" not found.`);
        setHebrewTitle(bookData.name_he);
        
        // Fetch from reader_verses_view (which should now include latest_comment_at)
        const { data: versesData } = await supabase.from('reader_verses_view').select('*').eq('book_id', bookData.name_en).eq('chapter_num', activeChapter).order('verse_num', { ascending: true });
        setVerses((versesData || []) as Verse[]);
      } catch (err: unknown) { 
        const errorMessage = err instanceof Error ? err.message : String(err);
        setFetchError(errorMessage); 
      } finally { 
        setIsLoading(false); 
      }
    };
    if (activeBook) fetchVerses();
  }, [activeBook, activeChapter]); 

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 relative">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden animate-in fade-in" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`absolute md:relative z-40 h-full flex flex-col bg-slate-50 dark:bg-slate-900/30 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 w-72 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0 w-72 md:w-0 md:opacity-0 md:pointer-events-none'}`}>
        <div className="flex-1 overflow-y-auto w-72">
          <TableOfContents userId={user?.id} groupId={activeGroupId} />
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 w-72">
          <button onClick={() => user ? setShowProfile(true) : setShowAuth(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-200 dark:bg-slate-800 rounded-xl text-sm font-bold transition-transform active:scale-95"><UserIcon size={16} /> {user ? 'My Profile' : 'Sign In'}</button>
        </div>
      </aside>

      <main className="flex-1 flex overflow-hidden relative">
        <section className="flex-1 overflow-y-auto border-r border-slate-100 dark:border-slate-900 scrollbar-hide flex flex-col relative scroll-smooth">
          <ReaderHeader 
            isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isInsightsOpen={isInsightsOpen} toggleInsights={() => setIsInsightsOpen(!isInsightsOpen)}
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
                <div key={v.verse_id || v.id} id={`verse-${v.verse_num || v.verse_number}`} className="scroll-mt-24">
                  <VerseCard 
                    verse={v} 
                    active={(selectedVerse?.verse_id || selectedVerse?.id) === (v.verse_id || v.id)} 
                    languageMode={languageMode} hebrewStyle={hebrewStyle} translation={translation} 
                    onClick={() => { setSelectedVerse(v); setIsInsightsOpen(true); }}
                    onWordClick={setSelectedStrongs} 
                    groupId={activeGroupId}
                    userId={user?.id || null}
                  />
                </div>
              ))
            }
          </div>
        </section>
        <div className={`${isInsightsOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} absolute md:relative z-40 inset-y-0 right-0 h-full bg-white dark:bg-slate-950 md:bg-transparent transition-transform duration-300 w-full md:w-auto md:flex`}>
          <InsightsPanel 
            user={user} activeBook={activeBook} activeChapter={activeChapter} selectedVerse={selectedVerse} 
            isLoading={isLoading} onSelectVerse={setSelectedVerse} activeGroupId={activeGroupId} 
            setActiveGroupId={handleSetActiveGroupId} myGroups={myGroups} setIsManageGroupsOpen={setIsManageGroupsOpen} 
            setShowAuth={setShowAuth} onCloseMobile={() => setIsInsightsOpen(false)} 
          />
        </div>
      </main>

      {isManageGroupsOpen && user && <GroupManagementModal isOpen={isManageGroupsOpen} onClose={() => setIsManageGroupsOpen(false)} userId={user.id} onGroupsChange={fetchGroups} onGroupCreated={(id) => { fetchGroups(); handleSetActiveGroupId(id); }} />}
      <LexiconModal strongsNumber={selectedStrongs} isOpen={!!selectedStrongs} onClose={() => setSelectedStrongs(null)} />
      {showAuth && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"><div className="relative"><button onClick={() => setShowAuth(false)} className="absolute -top-12 right-0 text-white font-bold">Close</button><AuthForm /></div></div>}
      {showProfile && user && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"><ProfileSettings userId={user.id} onClose={() => setShowProfile(false)} /></div>}
    </div>
  );
};