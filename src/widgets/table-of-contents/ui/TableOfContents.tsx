// Path: src/widgets/table-of-contents/ui/TableOfContents.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../shared/api/supabase';
import { Book, Search, BookOpen, Hash } from 'lucide-react';
import { parseReferences } from '@/shared/lib/ReferenceParser';

// Sub-component Imports
import { ToCHeader } from './ToCHeader';
import { CollectionList } from './CollectionList';
import { CategoryList } from './CategoryList';
import { BookList } from './BookList';
import { ChapterGrid } from './ChapterGrid';

/**
 * Shared Types for the TOC Module
 */
export type VisibilityStatus = 'default' | 'extended' | 'coming-soon';
export type Chapter = { 
  chapter_number: string;
  order_id: number;
  display_label?: string | null; 
};
export type BookType = { 
  id: string; 
  name_en: string; 
  category: string; 
  collection: string; 
  chapters: Chapter[];
  order_id: number;
  visibility_status: VisibilityStatus;
};
export type ViewMode = 'collections' | 'categories' | 'books' | 'chapters';

interface CollectionConfig { id: string; order_id: number; visibility_status: VisibilityStatus; }
interface CategoryConfig { collection_id: string; name_en: string; order_id: number; visibility_status: VisibilityStatus; }

interface TableOfContentsProps {
  userId?: string | null;
  groupId?: string | null;
}

interface RawBookData {
  id: string;
  name_en: string;
  category: string;
  collection: string;
  order_id: number;
  visibility_status: VisibilityStatus;
  chapters: Chapter[];
}

interface Suggestion {
  type: 'book' | 'chapter' | 'verse';
  label: string;
  book: string;
  chapter: string;
  verse?: number;
}

export const TableOfContents = ({ userId, groupId }: TableOfContentsProps) => {
  const params = useParams();
  const router = useRouter();
  const currentBookName = params?.book ? decodeURIComponent(params.book as string) : '';
  const currentChapterNum = params?.chapter ? decodeURIComponent(params.chapter as string) : null;

  // --- State ---
  const [books, setBooks] = useState<BookType[]>([]);
  const [colConfigs, setColConfigs] = useState<CollectionConfig[]>([]);
  const [catConfigs, setCatConfigs] = useState<CategoryConfig[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Persisted Library Toggle State
  const [showExtended, setShowExtended] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('collections');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<BookType | null>(null);
  const [activeCollection, setActiveCollection] = useState<string>('Tanakh');
  
  const lastSyncedBookRef = useRef<string | null>(null);

  const [unreadChapters, setUnreadChapters] = useState<Set<string>>(new Set());
  const [unreadBooks, setUnreadBooks] = useState<Set<string>>(new Set());
  const [unreadCategories, setUnreadCategories] = useState<Set<string>>(new Set());
  const [unreadCollections, setUnreadCollections] = useState<Set<string>>(new Set());

  // --- 1. Persistence Logic ---
  const handleToggleExtended = useCallback(async (enabled: boolean) => {
    setShowExtended(enabled);
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({ 
            extended_library_enabled: enabled,
            updated_at: new Date().toISOString() 
          })
          .eq('id', userId);
      } catch (err) {
        console.error("Failed to persist library preference:", err);
      }
    }
  }, [userId]);

  // --- 2. Fetch Metadata ---
  const fetchLibrary = useCallback(async (retryCount = 0) => {
    try {
      const [bookRes, colRes, catRes, profRes] = await Promise.all([
        supabase.from('books').select('id, name_en, category, collection, order_id, visibility_status, chapters(chapter_number, order_id, display_label)').order('order_id'),
        supabase.from('collection_configs').select('*').order('order_id'),
        supabase.from('category_configs').select('*').order('order_id'),
        userId ? supabase.from('profiles').select('is_admin, extended_library_enabled').eq('id', userId).single() : Promise.resolve({ data: null })
      ]);

      if (bookRes.error) throw bookRes.error;
      
      const profData = profRes?.data;
      setIsAdmin(!!profData?.is_admin);
      if (profData && profData.extended_library_enabled !== undefined) {
        setShowExtended(profData.extended_library_enabled);
      }
      
      const collections = colRes.data || [];
      setColConfigs(collections);
      setCatConfigs(catRes.data || []);

      if (bookRes.data) {
        const sortedBooks = (bookRes.data as unknown as RawBookData[]).map(b => ({
          ...b,
          chapters: b.chapters.sort((x: Chapter, y: Chapter) => (x.order_id || 0) - (y.order_id || 0))
        })) as BookType[];
        
        setBooks(sortedBooks);

        if (currentBookName && lastSyncedBookRef.current !== currentBookName) {
          const foundBook = sortedBooks.find(b => b.name_en.toLowerCase() === currentBookName.toLowerCase());
          if (foundBook) {
            setActiveBook(foundBook);
            setActiveCategory(foundBook.category);
            setActiveCollection(foundBook.collection);
            
            const foundColConfig = collections.find(c => c.id === foundBook.collection);
            if (foundColConfig && (foundColConfig.visibility_status === 'extended' || foundColConfig.visibility_status === 'coming-soon')) {
              handleToggleExtended(true);
            }

            lastSyncedBookRef.current = currentBookName;
            setViewMode('chapters');
          }
        }
      }
    } catch {
      if (retryCount < 3) {
        setTimeout(() => fetchLibrary(retryCount + 1), 500);
      }
    }
  }, [userId, currentBookName, handleToggleExtended]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // --- 3. Autocomplete Logic ---
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const newSuggestions: Suggestion[] = [];
    
    // Check if we have a coordinate-style query (Genesis 1:1)
    const refs = parseReferences(query);
    if (refs.length > 0) {
      const ref = refs[0];
      newSuggestions.push({
        type: 'verse',
        label: `${ref.book} ${ref.chapter}:${ref.verse}`,
        book: ref.book,
        chapter: String(ref.chapter),
        verse: ref.verse
      });
    }

    // Book matches
    const bookMatches = books.filter(b => 
      b.name_en.toLowerCase().includes(query) || 
      query.startsWith(b.name_en.toLowerCase())
    ).slice(0, 3);

    bookMatches.forEach(b => {
      // 1. Suggest the book itself
      newSuggestions.push({
        type: 'book',
        label: b.name_en,
        book: b.name_en,
        chapter: b.chapters[0]?.chapter_number || '1'
      });

      // 2. If the user typed "Book " (with space), suggest chapters
      if (query.startsWith(b.name_en.toLowerCase() + ' ')) {
        const remaining = query.replace(b.name_en.toLowerCase(), '').trim();
        const chapterMatches = b.chapters.filter(c => 
          c.chapter_number.toLowerCase().startsWith(remaining)
        ).slice(0, 3);

        chapterMatches.forEach(c => {
          newSuggestions.push({
            type: 'chapter',
            label: `${b.name_en} ${c.chapter_number}`,
            book: b.name_en,
            chapter: c.chapter_number
          });
        });
      }
    });

    // Deduplicate and limit
    const unique = Array.from(new Map(newSuggestions.map(s => [s.label, s])).values()).slice(0, 5);
    setSuggestions(unique);
    setSelectedIndex(0);
    setShowSuggestions(unique.length > 0);
  }, [searchQuery, books]);

  const handleNavigate = (s: Suggestion) => {
    router.push(`/read/${encodeURIComponent(s.book)}/${encodeURIComponent(s.chapter)}${s.verse ? `?v=${s.verse}` : ''}`);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && suggestions[selectedIndex]) {
      e.preventDefault();
      handleNavigate(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // --- 4. Hierarchical Filter Logic ---
  const visibleCollections = useMemo(() => {
    return colConfigs.filter(c => {
      if (c.visibility_status === 'coming-soon' && !isAdmin) return false;
      if (!showExtended) {
        return c.visibility_status === 'default';
      }
      return c.visibility_status === 'default' || c.visibility_status === 'extended' || c.visibility_status === 'coming-soon';
    }).map(c => c.id);
  }, [colConfigs, isAdmin, showExtended]);

  // --- 5. Unread Notifications ---
  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc('get_unread_chapters', { p_user_id: userId, p_group_id: groupId || null });
    if (data) {
      const chapSet = new Set<string>();
      const bookSet = new Set<string>();
      data.forEach((row: { book_name: string; chapter_number: string }) => {
        chapSet.add(`${row.book_name}-${row.chapter_number}`);
        bookSet.add(row.book_name);
      });
      setUnreadChapters(chapSet);
      setUnreadBooks(bookSet);
      
      const catSet = new Set<string>();
      const colSet = new Set<string>();
      books.forEach(b => { 
        if (bookSet.has(b.name_en)) {
          catSet.add(b.category); 
          colSet.add(b.collection);
        }
      });
      setUnreadCategories(catSet);
      setUnreadCollections(colSet);
    }
  }, [userId, groupId, books]);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  const handleClearNotification = async (type: 'category' | 'book' | 'chapter', value: string | number) => {
    if (!userId) return;
    if (type === 'category') setUnreadCategories(prev => { const n = new Set(prev); n.delete(value as string); return n; });
    else if (type === 'book') setUnreadBooks(prev => { const n = new Set(prev); n.delete(value as string); return n; });
    else if (type === 'chapter' && activeBook) setUnreadChapters(prev => { const n = new Set(prev); n.delete(`${activeBook.name_en}-${value}`); return n; });

    await supabase.rpc('mark_navigation_container_as_read', {
      p_user_id: userId,
      p_group_id: groupId || null,
      p_category: type === 'category' ? value : null,
      p_book_name: type === 'book' ? value : (type === 'chapter' ? (activeBook?.name_en || null) : null),
      p_chapter_number: type === 'chapter' ? value : null
    });
  };

  const handleBack = () => {
    if (viewMode === 'chapters') setViewMode('books');
    else if (viewMode === 'books') setViewMode('categories');
    else if (viewMode === 'categories') setViewMode('collections');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 select-none relative">
      <ToCHeader 
        viewMode={viewMode} 
        activeCollection={activeCollection}
        activeCategory={activeCategory}
        activeBook={activeBook}
        onBack={handleBack}
      />

      {/* Reference Search Bar */}
      <div className="px-4 pt-4 pb-2 shrink-0 relative z-50">
        <div className="relative group">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text"
            value={searchQuery}
            autoComplete="off"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search"
            title="Search for a book or chapter"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-400"
          />
          
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-100">
              <div className="py-1">
                {suggestions.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => handleNavigate(s)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${i === selectedIndex ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                       {s.type === 'book' ? <Book size={14} /> : s.type === 'chapter' ? <Hash size={14} /> : <BookOpen size={14} />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${i === selectedIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {s.label}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {s.type}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'collections' && (
        <div className="px-4 pt-2 pb-2 shrink-0">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Extended Library
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Include community texts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Toggle Extended Library">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={showExtended}
                onChange={(e) => handleToggleExtended(e.target.checked)}
                aria-label="Toggle Extended Library"
              />
              <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 shadow-inner"></div>
            </label>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide overscroll-contain">
        {viewMode === 'collections' && (
          <CollectionList 
            collections={visibleCollections} 
            unreadCollections={unreadCollections} 
            books={books}
            configs={colConfigs}
            isAdmin={isAdmin}
            onSelect={(col) => { setActiveCollection(col); setViewMode('categories'); }}
          />
        )}

        {viewMode === 'categories' && (
          <CategoryList 
            activeCollection={activeCollection}
            collectionBooks={books.filter(b => b.collection === activeCollection)}
            unreadCategories={unreadCategories}
            configs={catConfigs}
            isAdmin={isAdmin}
            onSelect={(cat) => { 
              if (unreadCategories.has(cat)) handleClearNotification('category', cat);
              setActiveCategory(cat); 
              setViewMode('books'); 
            }}
          />
        )}

        {viewMode === 'books' && activeCategory && (
          <BookList 
            books={books.filter(b => b.collection === activeCollection && b.category === activeCategory)}
            currentBookName={currentBookName}
            unreadBooks={unreadBooks}
            isAdmin={isAdmin}
            onSelect={(book) => { 
              if (unreadBooks.has(book.name_en)) handleClearNotification('book', book.name_en);
              setActiveBook(book); 
              setViewMode('chapters'); 
            }}
          />
        )}

        {viewMode === 'chapters' && activeBook && (
          <ChapterGrid 
            activeBook={activeBook}
            currentBookName={currentBookName}
            currentChapterNum={currentChapterNum}
            unreadChapters={unreadChapters}
            onChapterClick={(num) => {
              if (unreadChapters.has(`${activeBook.name_en}-${num}`)) handleClearNotification('chapter', num);
            }}
          />
        )}
      </div>

      <footer className="flex-none p-6 text-center opacity-30 bg-white/50 dark:bg-slate-950/50">
         <Book className="mx-auto mb-2 text-slate-400" size={16} />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">DrashX Library</p>
      </footer>
    </div>
  );
};