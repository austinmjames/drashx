// Path: src/views/reader/ui/ReaderPage.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { User as SupabaseUser } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { supabase } from '../../../shared/api/supabase';
import { VerseCard, Verse, VerseWord } from '../../../entities/verse/ui/VerseCard';
import { TableOfContents } from '../../../widgets/table-of-contents/ui/TableOfContents';
import { ReaderHeader } from '../../../widgets/reader-header/ui/ReaderHeader';
import { InsightsPanel } from '../../../widgets/insights-panel/ui/InsightsPanel';
import { AlertCircle, User as UserIcon } from 'lucide-react';

// --- Lazy Loaded Components ---
const GroupManagementModal = dynamic(() => 
  import('../../../features/groups/manage-groups/ui/GroupManagementModal').then(mod => mod.GroupManagementModal)
);
const LexiconModal = dynamic(() => 
  import('../../../features/lexicon/ui/LexiconModal').then(mod => mod.LexiconModal)
);
const AuthForm = dynamic(() => 
  import('../../../features/auth/ui/AuthForm').then(mod => mod.AuthForm)
);
const ProfileSettings = dynamic(() => 
  import('../../../features/profile/edit-profile/ui/ProfileSettings').then(mod => mod.ProfileSettings)
);

let globalIsSidebarOpen = true;

const VerseSkeleton = () => (
  <div className="p-6 border-b border-slate-100 dark:border-slate-800 animate-pulse flex flex-col gap-6">
    <div className="flex gap-6 items-start" dir="rtl">
      <div className="w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded shrink-0"></div>
      <div className="flex-1 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
      </div>
    </div>
    <div className="flex gap-6 items-start" dir="ltr">
      <div className="w-8 h-6 bg-slate-200 dark:bg-slate-800 rounded shrink-0"></div>
      <div className="flex-1 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
      </div>
    </div>
  </div>
);

// --- Types ---
interface Group { id: string; name: string; icon_url?: string; color_theme?: string; }
interface GroupMemberJoin { group_id: string; groups: Group | Group[]; }
interface ProfilePreferences {
  last_group_id?: string | null;
  reader_language_mode?: 'both' | 'en' | 'he' | null;
  reader_translation?: string | null; 
  reader_hebrew_style?: 'niqqud' | 'no-niqqud' | null;
  last_book?: string | null;
  last_chapter?: string | number | null;
}
export interface HistoryLocation {
  book: string;
  chapter: string | number;
  verse?: number;
}

interface ReaderPageProps {
  bookName?: string;
  chapterNumber?: string | number;
  initialVerses?: Verse[]; 
  initialHebrewTitle?: string; 
  initialChapterLabel?: string | null;
}

export const ReaderPage = ({ bookName, chapterNumber, initialVerses, initialHebrewTitle, initialChapterLabel }: ReaderPageProps) => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const inviteParam = searchParams.get('invite');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(globalIsSidebarOpen);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isAuthSettled, setIsAuthSettled] = useState(false);
  
  const [languageMode, setLanguageMode] = useState<'both' | 'en' | 'he'>('both');
  const [hebrewStyle, setHebrewStyle] = useState<'niqqud' | 'no-niqqud'>('niqqud');
  
  const [translation, setTranslation] = useState<string>('default');

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);

  const [availableTranslations, setAvailableTranslations] = useState<{slug: string, name: string}[]>([]);
  const [activeTranslation, setActiveTranslation] = useState<string>('JPS');

  const [prevChapter, setPrevChapter] = useState<string | null>(null);
  const [nextChapter, setNextChapter] = useState<string | null>(null);

  const [navigationHistory, setNavigationHistory] = useState<HistoryLocation[]>([]);

  const activeBook = useMemo(() => {
    const rawName = (params?.book as string) || String(bookName || 'Genesis');
    return decodeURIComponent(rawName)
      .split(' ')
      .map(word => {
        const lower = word.toLowerCase();
        if (['i', 'ii', 'iii'].includes(lower)) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }, [params?.book, bookName]);

  const activeChapter = params?.chapter ? decodeURIComponent(params.chapter as string) : String(chapterNumber || '1');

  const [verses, setVerses] = useState<Verse[]>(initialVerses || []);
  const [hebrewTitle, setHebrewTitle] = useState(initialHebrewTitle || '');
  const [chapterLabel, setChapterLabel] = useState<string | null>(initialChapterLabel || null);
  const [isLoading, setIsLoading] = useState(!initialVerses); 
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [selectedStrongs, setSelectedStrongs] = useState<string | null>(null);
  const [selectedWordContext, setSelectedWordContext] = useState<VerseWord | null>(null);

  const dataRef = useRef({ book: activeBook, chapter: activeChapter, slug: activeTranslation });
  const isAuthLoadingRef = useRef(false);

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
      scrollToVerse(parseInt(vParam, 10));
    }
  }, [searchParams, isLoading, verses, scrollToVerse]);

  useEffect(() => {
    const handleJumpEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ book: string; chapter: string | number; verse: number }>;
      const { book, chapter, verse } = customEvent.detail;
      if (activeBook === book && String(activeChapter) === String(chapter)) {
        scrollToVerse(verse);
      }
    };
    window.addEventListener('reader-jump-to-verse', handleJumpEvent);
    return () => window.removeEventListener('reader-jump-to-verse', handleJumpEvent);
  }, [activeBook, activeChapter, scrollToVerse]);

  useEffect(() => {
    const handleLogHistory = () => {
      setNavigationHistory(prev => {
        const currentLoc: HistoryLocation = {
          book: activeBook,
          chapter: activeChapter,
          verse: selectedVerse?.verse_num || selectedVerse?.verse_number
        };
        const last = prev[prev.length - 1];
        if (last && last.book === currentLoc.book && String(last.chapter) === String(currentLoc.chapter) && last.verse === currentLoc.verse) {
          return prev;
        }
        return [...prev, currentLoc];
      });
    };
    window.addEventListener('reader-log-history', handleLogHistory);
    return () => window.removeEventListener('reader-log-history', handleLogHistory);
  }, [activeBook, activeChapter, selectedVerse]);

  const handleGoBack = useCallback(() => {
    setNavigationHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const lastLoc = newHistory.pop();
      if (lastLoc) {
        const path = `/read/${encodeURIComponent(lastLoc.book)}/${encodeURIComponent(String(lastLoc.chapter))}${lastLoc.verse ? `?v=${lastLoc.verse}` : ''}`;
        router.push(path);
      }
      return newHistory;
    });
  }, [router]);

  useEffect(() => {
    const handleLexiconPivot = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSelectedStrongs(customEvent.detail);
      setSelectedWordContext(null);
    };
    window.addEventListener('lexicon-pivot', handleLexiconPivot);
    return () => window.removeEventListener('lexicon-pivot', handleLexiconPivot);
  }, []);

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
      if (prefs.reader_hebrew_style) setHebrewStyle(prefs.reader_hebrew_style);
      
      if (prefs.reader_translation) {
        const legacyMap: Record<string, string> = {
          'jps1917': 'JPS', 'modernized': 'Modernized', 'web': 'WEB', 'tbv': 'TBV'
        };
        const mappedSlug = legacyMap[prefs.reader_translation] || prefs.reader_translation;
        setTranslation(mappedSlug);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthLoadingRef.current) return;
    isAuthLoadingRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfilePreference(session.user.id);
      setIsAuthSettled(true);
      isAuthLoadingRef.current = false;
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthSettled(true);
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

  useEffect(() => {
    if (isAuthSettled && inviteParam) {
      if (user) {
        setIsManageGroupsOpen(true);
      } else {
        setShowAuth(true);
      }
    }
  }, [isAuthSettled, inviteParam, user]);

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

  const handleSetTranslation = (trans: string) => {
    setTranslation(trans);
    updatePreference({ reader_translation: trans });
  };

  const handleSetHebrewStyle = (style: 'niqqud' | 'no-niqqud') => {
    setHebrewStyle(style);
    updatePreference({ reader_hebrew_style: style });
  };

  useEffect(() => {
    const fetchVersesData = async () => {
      setIsLoading(true); 
      setFetchError(null);
      
      try {
        const { data: bookData } = await supabase.from('books').select('id, name_en, name_he, category, collection').ilike('name_en', activeBook).single();
        if (!bookData) throw new Error(`Book "${activeBook}" not found.`);
        setHebrewTitle(bookData.name_he);

        const { data: currentChap } = await supabase.from('chapters').select('order_id').eq('book_id', bookData.id).eq('chapter_number', activeChapter).single();
        if (currentChap) {
           const { data: prevData } = await supabase.from('chapters').select('chapter_number').eq('book_id', bookData.id).eq('order_id', currentChap.order_id - 1).maybeSingle();
           setPrevChapter(prevData?.chapter_number || null);
           const { data: nextData } = await supabase.from('chapters').select('chapter_number').eq('book_id', bookData.id).eq('order_id', currentChap.order_id + 1).maybeSingle();
           setNextChapter(nextData?.chapter_number || null);
        }
        
        const { data: existingSlugsData } = await supabase
          .from('reader_verses_view')
          .select('translation_slug')
          .eq('book_id', bookData.name_en)
          .eq('chapter_num', activeChapter)
          .not('translation_slug', 'is', null);

        const actualSlugs = new Set(existingSlugsData?.map(row => row.translation_slug) || []);
        const { data: allTranslations } = await supabase.from('translations').select('*').order('name');
        const chapterKey = `${bookData.name_en}.${activeChapter}`;
        
        const availableTrans = (allTranslations || []).filter(t => {
          if (!actualSlugs.has(t.slug)) return false;
          if (t.target_collections?.includes(bookData.collection)) return true;
          if (t.target_categories?.includes(bookData.category)) return true;
          if (t.target_books?.includes(bookData.name_en)) return true;
          if (t.target_chapters?.includes(chapterKey)) return true;
          return false;
        }).map(t => ({ slug: t.slug, name: t.name }));

        setAvailableTranslations(availableTrans);

        let effectiveSlug = translation;
        if (effectiveSlug === 'default') {
          effectiveSlug = (bookData.collection === 'Christianity' || bookData.collection === 'Second Temple') ? 'WEB' : 'JPS';
        }

        if (!availableTrans.some(t => t.slug === effectiveSlug)) {
          effectiveSlug = availableTrans.length > 0 ? availableTrans[0].slug : ((bookData.collection === 'Christianity' || bookData.collection === 'Second Temple') ? 'WEB' : 'JPS');
        }
        
        setActiveTranslation(effectiveSlug);

        if (dataRef.current.book === activeBook && dataRef.current.chapter === activeChapter && dataRef.current.slug === effectiveSlug && verses.length > 0) {
          setIsLoading(false); return;
        }
        
        let versesQuery = supabase
            .from('reader_verses_view')
            .select('*')
            .eq('book_id', bookData.name_en)
            .eq('chapter_num', activeChapter)
            .order('verse_num', { ascending: true });

        if (availableTrans.length > 0) versesQuery = versesQuery.eq('translation_slug', effectiveSlug);
        else versesQuery = versesQuery.is('translation_slug', null);
        
        const { data: versesData } = await versesQuery;
        
        if (versesData && versesData.length > 0) {
          const firstVerse = versesData[0] as Record<string, unknown>;
          setChapterLabel((firstVerse.chapter_label as string) || null);
        }

        setVerses((versesData || []) as Verse[]);
        dataRef.current = { book: activeBook, chapter: activeChapter, slug: effectiveSlug };
      } catch (err: unknown) { 
        setFetchError(err instanceof Error ? err.message : String(err)); 
      } finally { 
        setIsLoading(false); 
      }
    };
    if (activeBook) fetchVersesData();
  }, [activeBook, activeChapter, verses.length, translation]); 

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
        <section className="flex-1 border-r border-slate-100 dark:border-slate-900 flex flex-col relative bg-white dark:bg-slate-950">
          <ReaderHeader 
            isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isInsightsOpen={isInsightsOpen} toggleInsights={() => setIsInsightsOpen(!isInsightsOpen)}
            activeBook={activeBook} activeChapter={activeChapter} chapterLabel={chapterLabel} hebrewTitle={hebrewTitle}
            handlePrevChapter={prevChapter ? () => router.push(`/read/${encodeURIComponent(activeBook)}/${encodeURIComponent(prevChapter)}`) : undefined}
            handleNextChapter={nextChapter ? () => router.push(`/read/${encodeURIComponent(activeBook)}/${encodeURIComponent(nextChapter)}`) : undefined}
            languageMode={languageMode} setLanguageMode={handleSetLanguageMode}
            translation={translation} setTranslation={handleSetTranslation}
            availableTranslations={availableTranslations}
            hebrewStyle={hebrewStyle} setHebrewStyle={handleSetHebrewStyle}
            navigationHistory={navigationHistory}
            handleGoBack={handleGoBack}
          />
          <div className="flex-1 overflow-y-auto scrollbar-hide scroll-smooth w-full">
            <div className="max-w-3xl mx-auto py-6 md:py-8 w-full md:px-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(6)].map((_, i) => <VerseSkeleton key={i} />)}
                </div>
              ) : fetchError ? (
                <div className="flex flex-col items-center justify-center h-64 text-rose-500 gap-4">
                  <AlertCircle size={48}/>
                  <p>{fetchError}</p>
                </div>
              ) : (
                verses.map((v) => (
                  <div key={v.verse_id || v.id} id={`verse-${v.verse_num || v.verse_number}`} className="scroll-mt-24">
                    <VerseCard 
                      verse={v} 
                      active={(selectedVerse?.verse_id || selectedVerse?.id) === (v.verse_id || v.id)} 
                      languageMode={languageMode} 
                      hebrewStyle={hebrewStyle} 
                      onClick={() => { setSelectedVerse(v); setIsInsightsOpen(true); }}
                      onWordClick={(w) => { setSelectedStrongs(w.strongs); setSelectedWordContext(w); }} 
                      groupId={activeGroupId}
                      userId={user?.id || null}
                    />
                  </div>
                ))
              )}
            </div>
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

      {isManageGroupsOpen && user && (
        <GroupManagementModal 
          isOpen={isManageGroupsOpen} 
          onClose={() => setIsManageGroupsOpen(false)} 
          userId={user.id} 
          onGroupsChange={fetchGroups} 
          onGroupCreated={(id) => { fetchGroups(); handleSetActiveGroupId(id); }} 
        />
      )}
      
      {selectedStrongs && (
        <LexiconModal 
          strongsNumber={selectedStrongs} 
          wordContext={selectedWordContext}
          isOpen={!!selectedStrongs} 
          onClose={() => { setSelectedStrongs(null); setSelectedWordContext(null); }} 
          verseTranslation={verses.find(v => (v.words || []).some(w => w.strongs === selectedStrongs))?.text_en || ''}
        />
      )}

      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative">
            <button onClick={() => setShowAuth(false)} className="absolute -top-12 right-0 text-white font-bold hover:text-slate-200 transition-colors">Close</button>
            <AuthForm />
          </div>
        </div>
      )}

      {showProfile && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <ProfileSettings userId={user.id} onClose={() => setShowProfile(false)} />
        </div>
      )}
    </div>
  );
};

export default ReaderPage;