"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../shared/api/supabase';
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  Library, 
  BookOpen,
  Compass,
  Book
} from 'lucide-react';

/**
 * TableOfContents Widget
 * Path: src/widgets/table-of-contents/ui/TableOfContents.tsx
 * An elegant, hierarchical drill-down navigation for the Tanakh.
 * Updated to use React-managed hover states to bypass CSS build issues.
 */

type Chapter = { chapter_number: number };
type BookType = { id: number; name_en: string; category: string; chapters: Chapter[] };

interface RawBookResponse {
  id: number;
  name_en: string;
  category: string;
  chapters: Chapter[];
}

let cachedBooks: BookType[] | null = null;

const CATEGORY_ORDER = ['Torah', "Nevi'im", 'Ketuvim'];

export const TableOfContents = () => {
  const params = useParams();
  const currentBookName = params?.book ? decodeURIComponent(params.book as string) : '';
  const currentChapterNum = params?.chapter ? parseInt(params.chapter as string, 10) : null;

  const [books, setBooks] = useState<BookType[]>(cachedBooks || []);
  const [viewMode, setViewMode] = useState<'categories' | 'books' | 'chapters'>('categories');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<BookType | null>(null);

  // React Hover States
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredBookId, setHoveredBookId] = useState<number | null>(null);
  const [hoveredChapter, setHoveredChapter] = useState<number | null>(null);
  const [isBackBtnHovered, setIsBackBtnHovered] = useState(false);

  // Initial Data Fetch & URL Sync
  useEffect(() => {
    const fetchAndSync = async () => {
      let dataToSync = cachedBooks;

      if (!cachedBooks) {
        const { data } = await supabase
          .from('books')
          .select(`id, name_en, category, chapters ( chapter_number )`)
          .order('id', { ascending: true });

        if (data) {
          dataToSync = (data as unknown as RawBookResponse[]).map((b) => ({
            ...b,
            chapters: b.chapters.sort((a, c) => a.chapter_number - c.chapter_number)
          }));
          cachedBooks = dataToSync;
          setBooks(dataToSync);
        }
      }

      // Automatically drill down based on URL context (without full refresh)
      if (dataToSync && currentBookName) {
        const foundBook = dataToSync.find(b => b.name_en.toLowerCase() === currentBookName.toLowerCase());
        if (foundBook) {
          setActiveBook(foundBook);
          setActiveCategory(foundBook.category);
          // Only switch to chapters if we aren't already there to prevent UI jumps
          setViewMode(prev => prev === 'categories' ? 'chapters' : prev);
        }
      }
    };

    fetchAndSync();
  }, [currentBookName]);

  // Derived Data
  const categories = useMemo(() => CATEGORY_ORDER.filter(cat => books.some(b => b.category === cat)), [books]);
  const booksInActiveCategory = useMemo(() => books.filter(b => b.category === activeCategory), [books, activeCategory]);

  // Navigation Handlers
  const handleSelectCategory = (cat: string) => {
    setActiveCategory(cat);
    setViewMode('books');
  };

  const handleSelectBook = (book: BookType) => {
    setActiveBook(book);
    setViewMode('chapters');
  };

  const goBackToCategories = () => {
    setViewMode('categories');
    setActiveCategory(null);
  };

  const goBackToBooks = () => {
    setViewMode('books');
    setActiveBook(null);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      
      {/* Navigation Header / Breadcrumbs */}
      <header className="flex-none px-4 py-5 border-b border-slate-100 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
        {viewMode === 'categories' ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Library size={16} />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Library</h2>
              <p className="text-[10px] text-slate-400 font-medium">Browse the Canon</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={viewMode === 'chapters' ? goBackToBooks : goBackToCategories}
              onMouseEnter={() => setIsBackBtnHovered(true)}
              onMouseLeave={() => setIsBackBtnHovered(false)}
              className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                isBackBtnHovered ? 'bg-slate-100 dark:bg-slate-900 text-indigo-600' : 'text-slate-400'
              }`}
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="ml-1">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {viewMode === 'chapters' ? activeCategory : 'Tanakh'}
              </h2>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {viewMode === 'chapters' ? activeBook?.name_en : activeCategory}
              </p>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        
        {/* VIEW 1: Categories (Slimmer Layer) */}
        {viewMode === 'categories' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {categories.map(cat => {
              const isHovered = hoveredCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCategory(cat)}
                  onMouseEnter={() => setHoveredCategory(cat)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all relative overflow-hidden ${
                    isHovered 
                      ? 'bg-slate-100 dark:bg-slate-800/80 border-indigo-100 dark:border-indigo-900 shadow-lg shadow-indigo-500/5' 
                      : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900'
                  }`}
                >
                  <div className="relative z-10 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm ${
                      isHovered ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400'
                    }`}>
                      {cat === 'Torah' ? <BookOpen size={16} /> : <Compass size={16} />}
                    </div>
                    <div className="text-left">
                      <span className={`block font-bold text-sm transition-colors ${
                        isHovered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                      }`}>{cat}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {books.filter(b => b.category === cat).length} Books
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`transition-all ${
                    isHovered ? 'text-indigo-500 translate-x-1' : 'text-slate-300'
                  }`} />
                  
                  {/* Subtle Decorative Background Element */}
                  <div className={`absolute -right-2 -bottom-2 transition-opacity duration-300 ${
                    isHovered ? 'opacity-5' : 'opacity-0'
                  }`}>
                     <Library size={64} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* VIEW 2: Books Selection */}
        {viewMode === 'books' && (
          <div className="space-y-1 animate-in fade-in slide-in-from-right-4 duration-400">
            {booksInActiveCategory.map(book => {
              const isActive = currentBookName.toLowerCase() === book.name_en.toLowerCase();
              const isHovered = hoveredBookId === book.id;
              
              return (
                <button
                  key={book.id}
                  onClick={() => handleSelectBook(book)}
                  onMouseEnter={() => setHoveredBookId(book.id)}
                  onMouseLeave={() => setHoveredBookId(null)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all relative ${
                    isActive 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                      : isHovered 
                        ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white' 
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isActive && <div className="w-1 h-4 bg-indigo-500 rounded-full animate-in zoom-in duration-300" />}
                    <span className={`text-sm tracking-tight transition-transform ${
                      isActive ? 'font-bold' : isHovered ? 'font-medium translate-x-1' : 'font-medium'
                    }`}>
                      {book.name_en}
                    </span>
                  </div>
                  <ChevronRight size={16} className={`transition-all ${
                    isActive ? 'opacity-100' : isHovered ? 'opacity-100 translate-x-1' : 'opacity-0'
                  }`} />
                </button>
              );
            })}
          </div>
        )}

        {/* VIEW 3: Chapters Grid (No borders by default) */}
        {viewMode === 'chapters' && activeBook && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-indigo-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Chapters</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                {activeBook.chapters.length} Total
              </span>
            </div>
            
            <div className="grid grid-cols-5 gap-1">
              {activeBook.chapters.map(chapter => {
                const isActive = activeBook.name_en.toLowerCase() === currentBookName.toLowerCase() && 
                               chapter.chapter_number === currentChapterNum;
                const isHovered = hoveredChapter === chapter.chapter_number;
                
                return (
                  <Link
                    key={chapter.chapter_number}
                    href={`/read/${encodeURIComponent(activeBook.name_en)}/${chapter.chapter_number}`}
                    onMouseEnter={() => setHoveredChapter(chapter.chapter_number)}
                    onMouseLeave={() => setHoveredChapter(null)}
                    className={`aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all border ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20 z-10'
                        : isHovered
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 scale-105'
                          : 'bg-transparent border-transparent text-slate-400'
                    }`}
                  >
                    {chapter.chapter_number}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="flex-none p-6 text-center opacity-30">
         <Book className="mx-auto mb-2 text-slate-400" size={16} />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">DrashX</p>
      </footer>
    </div>
  );
};