// Path: src/widgets/table-of-contents/ui/TableOfContents.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../shared/api/supabase';
import { Book } from 'lucide-react';

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
export type Chapter = { chapter_number: number };
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

export const TableOfContents = ({ userId, groupId }: TableOfContentsProps) => {
  const params = useParams();
  const currentBookName = params?.book ? decodeURIComponent(params.book as string) : '';
  const currentChapterNum = params?.chapter ? parseInt(params.chapter as string, 10) : null;

  // --- State ---
  const [books, setBooks] = useState<BookType[]>([]);
  const [colConfigs, setColConfigs] = useState<CollectionConfig[]>([]);
  const [catConfigs, setCatConfigs] = useState<CategoryConfig[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  
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

  // --- 1. Persistence Logic (Memoized) ---
  const handleToggleExtended = useCallback(async (enabled: boolean) => {
    setShowExtended(enabled);
    
    // Persist to DB if user is logged in
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

  // --- 2. Fetch Metadata & Library Structure ---
  const fetchLibrary = useCallback(async (retryCount = 0) => {
    try {
      const [bookRes, colRes, catRes, profRes] = await Promise.all([
        supabase.from('books').select('id, name_en, category, collection, order_id, visibility_status, chapters(chapter_number)').order('order_id'),
        supabase.from('collection_configs').select('*').order('order_id'),
        supabase.from('category_configs').select('*').order('order_id'),
        userId ? supabase.from('profiles').select('is_admin, extended_library_enabled').eq('id', userId).single() : Promise.resolve({ data: null })
      ]);

      if (bookRes.error) throw bookRes.error;
      
      const profData = profRes?.data;
      setIsAdmin(!!profData?.is_admin);
      
      // Initialize the toggle state from user preferences
      if (profData && profData.extended_library_enabled !== undefined) {
        setShowExtended(profData.extended_library_enabled);
      }
      
      const collections = colRes.data || [];
      setColConfigs(collections);
      setCatConfigs(catRes.data || []);

      if (bookRes.data) {
        const sortedBooks = (bookRes.data as unknown as RawBookData[]).map(b => ({
          ...b,
          chapters: b.chapters.sort((x: Chapter, y: Chapter) => x.chapter_number - y.chapter_number)
        })) as BookType[];
        
        setBooks(sortedBooks);

        if (currentBookName && lastSyncedBookRef.current !== currentBookName) {
          const foundBook = sortedBooks.find(b => b.name_en.toLowerCase() === currentBookName.toLowerCase());
          if (foundBook) {
            setActiveBook(foundBook);
            setActiveCategory(foundBook.category);
            setActiveCollection(foundBook.collection);
            
            // Auto-enable extended view if user navigates to an extended book directly
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

  // --- 3. Hierarchical Filter Logic ---
  const visibleCollections = useMemo(() => {
    return colConfigs.filter(c => {
      if (c.visibility_status === 'coming-soon' && !isAdmin) return false;
      if (!showExtended) {
        return c.visibility_status === 'default';
      }
      return c.visibility_status === 'default' || c.visibility_status === 'extended' || c.visibility_status === 'coming-soon';
    }).map(c => c.id);
  }, [colConfigs, isAdmin, showExtended]);

  // --- 4. Unread Notifications ---
  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc('get_unread_chapters', { p_user_id: userId, p_group_id: groupId || null });
    if (data) {
      const chapSet = new Set<string>();
      const bookSet = new Set<string>();
      data.forEach((row: { book_name: string; chapter_number: number }) => {
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
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 select-none">
      <ToCHeader 
        viewMode={viewMode} 
        activeCollection={activeCollection}
        activeCategory={activeCategory}
        activeBook={activeBook}
        onBack={handleBack}
      />

      {viewMode === 'collections' && (
        <div className="px-4 pt-4 pb-2 shrink-0">
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