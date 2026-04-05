// Path: src/widgets/table-of-contents/ui/TableOfContents.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
export type Chapter = { chapter_number: number };
// FIX: Changed id type from number to string to support the new UUID primary keys
export type BookType = { id: string; name_en: string; category: string; collection: string; chapters: Chapter[] };
export type ViewMode = 'collections' | 'categories' | 'books' | 'chapters';

interface RawBookResponse {
  id: string; // FIX: UUID support
  name_en: string;
  category: string;
  collection?: string | null; 
  chapters: Chapter[];
}

interface TableOfContentsProps {
  userId?: string | null;
  groupId?: string | null;
}

let cachedBooks: BookType[] | null = null;

// The UI category order logic remains the same
export const CATEGORY_ORDER = [
  'Torah', "Nevi'im", 'Ketuvim', 
  'Gospels', 'History', 'Pauline Epistles', 'General Epistles', 'Prophecy', 'Apocalyptic'
];

export const TableOfContents = ({ userId, groupId }: TableOfContentsProps) => {
  const params = useParams();
  const currentBookName = params?.book ? decodeURIComponent(params.book as string) : '';
  const currentChapterNum = params?.chapter ? parseInt(params.chapter as string, 10) : null;

  // --- State ---
  const [books, setBooks] = useState<BookType[]>(cachedBooks || []);
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<BookType | null>(null);
  
  const [extendedLibraryEnabled, setExtendedLibraryEnabled] = useState(false);
  const [enabledCollections, setEnabledCollections] = useState<string[]>(['Tanakh']);
  const [activeCollection, setActiveCollection] = useState<string>('Tanakh');

  const [unreadChapters, setUnreadChapters] = useState<Set<string>>(new Set());
  const [unreadBooks, setUnreadBooks] = useState<Set<string>>(new Set());
  const [unreadCategories, setUnreadCategories] = useState<Set<string>>(new Set());
  const [unreadCollections, setUnreadCollections] = useState<Set<string>>(new Set());

  // --- Initial Data Fetch & URL Sync ---
  useEffect(() => {
    const fetchAndSync = async () => {
      let dataToSync = cachedBooks;
      if (!cachedBooks) {
        // FIX: Replaced .order('id') with .order('order_id') to utilize our new canonical sorting
        const { data, error: fetchErr } = await supabase
          .from('books')
          .select(`id, name_en, category, chapters ( chapter_number )`)
          .order('order_id', { ascending: true });
        
        if (fetchErr) {
          console.error("Failed to load library structure:", fetchErr);
          return;
        }

        // Fetch collection info separately to avoid heavy join on initial list
        const { data: collectionData } = await supabase.from('books').select('id, collection');

        if (data) {
          dataToSync = (data as unknown as RawBookResponse[]).map((b) => {
            const colInfo = collectionData?.find(c => c.id === b.id);
            return {
              ...b,
              collection: colInfo?.collection || 'Tanakh',
              // Ensure chapters within the book are sorted numerically for the grid
              chapters: b.chapters.sort((a, c) => a.chapter_number - c.chapter_number)
            };
          }) as BookType[];
          
          cachedBooks = dataToSync;
          setBooks(dataToSync);
        }
      }

      // Handle direct URL navigation (e.g. landing on /read/Genesis/1)
      if (dataToSync && currentBookName) {
        const foundBook = dataToSync.find(b => b.name_en.toLowerCase() === currentBookName.toLowerCase());
        if (foundBook) {
          setActiveBook(foundBook);
          setActiveCategory(foundBook.category);
          setActiveCollection(foundBook.collection || 'Tanakh');
          setViewMode('chapters');
        }
      }
    };
    fetchAndSync();
  }, [currentBookName]);

  // --- Fetch User Preferences ---
  const fetchPrefs = useCallback(async (retryCount = 0) => {
    if (!userId) {
      setEnabledCollections(['Tanakh']);
      setExtendedLibraryEnabled(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('enabled_collections, extended_library_enabled')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const isEnabled = data?.extended_library_enabled || false;
      const collections = (data?.enabled_collections && data.enabled_collections.length > 0) 
        ? data.enabled_collections 
        : ['Tanakh'];

      setExtendedLibraryEnabled(isEnabled);
      
      if (!isEnabled) {
        setEnabledCollections(['Tanakh']);
        if (viewMode === 'collections') setViewMode('categories');
      } else {
        setEnabledCollections(collections);
        if (collections.length > 1 && !currentBookName && viewMode === 'categories') {
          setViewMode('collections');
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      const isLockError = errorMsg.includes('lock') || errorMsg.includes('stole') || errorMsg === '{}';

      if (isLockError && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 400 + Math.random() * 400;
        setTimeout(() => fetchPrefs(retryCount + 1), delay);
        return;
      }
      
      console.error("Error fetching ToC preferences:", err);
    }
  }, [userId, currentBookName, viewMode]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  // --- Unread Notification Logic ---
  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    const { data, error: rpcErr } = await supabase.rpc('get_unread_chapters', { 
      p_user_id: userId, 
      p_group_id: groupId || null 
    });
    
    if (data && !rpcErr) {
      const chapSet = new Set<string>();
      const bookSet = new Set<string>();
      
      data.forEach((row: { book_name: string, chapter_number: number }) => {
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
          colSet.add(b.collection || 'Tanakh');
        }
      });
      
      setUnreadCategories(catSet);
      setUnreadCollections(colSet);
    }
  }, [userId, groupId, books]);

  useEffect(() => {
    fetchUnread();
    
    if (!userId) return;
    const receiptChannel = supabase.channel(`toc-receipts-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'verse_read_receipts', filter: `user_id=eq.${userId}` }, fetchUnread).subscribe();
    const commentsChannel = supabase.channel(`toc-comments-${groupId || 'personal'}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: groupId ? `group_id=eq.${groupId}` : 'group_id=is.null' }, fetchUnread).subscribe();
    
    return () => { 
      supabase.removeChannel(receiptChannel); 
      supabase.removeChannel(commentsChannel); 
    };
  }, [userId, groupId, fetchUnread]);

  // --- Handlers ---
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
    else if (viewMode === 'categories' && extendedLibraryEnabled && enabledCollections.length > 1) setViewMode('collections');
  };

  // --- Derived ---
  const collectionBooks = useMemo(() => 
    books.filter(b => (b.collection || 'Tanakh') === activeCollection), 
    [books, activeCollection]
  );
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <ToCHeader 
        viewMode={viewMode} 
        activeCollection={activeCollection}
        activeCategory={activeCategory}
        activeBook={activeBook}
        enabledCollections={enabledCollections}
        extendedLibraryEnabled={extendedLibraryEnabled}
        onBack={handleBack}
      />

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {viewMode === 'collections' && (
          <CollectionList 
            collections={enabledCollections} 
            activeCollection={activeCollection} 
            unreadCollections={unreadCollections} 
            books={books}
            onSelect={(col) => { setActiveCollection(col); setViewMode('categories'); }}
          />
        )}

        {viewMode === 'categories' && (
          <CategoryList 
            activeCollection={activeCollection}
            collectionBooks={collectionBooks}
            unreadCategories={unreadCategories}
            onSelect={(cat) => {
              if (unreadCategories.has(cat)) handleClearNotification('category', cat);
              setActiveCategory(cat); setViewMode('books');
            }}
          />
        )}

        {viewMode === 'books' && activeCategory && (
          <BookList 
            books={collectionBooks.filter(b => b.category === activeCategory)}
            currentBookName={currentBookName}
            unreadBooks={unreadBooks}
            onSelect={(book) => {
              if (unreadBooks.has(book.name_en)) handleClearNotification('book', book.name_en);
              setActiveBook(book); setViewMode('chapters');
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

      <footer className="flex-none p-6 text-center opacity-30">
         <Book className="mx-auto mb-2 text-slate-400" size={16} />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">DrashX</p>
      </footer>
    </div>
  );
};