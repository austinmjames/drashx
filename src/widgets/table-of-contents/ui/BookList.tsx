// Path: src/widgets/table-of-contents/ui/BookList.tsx
/**
 * FORCED CACHE INVALIDATION: UUID_TRANSITION_V4
 * Enhanced with mobile touch support and optimized dark mode contrast.
 */
import React, { useState } from 'react';
import { ChevronRight, Book as BookIcon } from 'lucide-react';
import { BookType } from './TableOfContents';

interface BookListProps {
  books: BookType[];
  currentBookName: string;
  unreadBooks: Set<string>;
  onSelect: (book: BookType) => void;
}

export const BookList = ({ books, currentBookName, unreadBooks, onSelect }: BookListProps) => {
  // Support both string (UUID) and number (Legacy) IDs
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);

  return (
    <div className="space-y-2.5 animate-in fade-in slide-in-from-right-4 duration-400">
      {books.map(book => {
        const isActive = currentBookName.toLowerCase() === book.name_en.toLowerCase();
        const isHovered = hoveredId !== null && String(hoveredId) === String(book.id);
        const hasUnread = unreadBooks.has(book.name_en);
        
        return (
          <button 
            key={String(book.id)} 
            onClick={() => onSelect(book)} 
            onMouseEnter={() => setHoveredId(book.id)} 
            onMouseLeave={() => setHoveredId(null)}
            // Mobile Touch Support: Simulates hover state for tactile feedback
            onTouchStart={() => setHoveredId(book.id)}
            onTouchEnd={() => setHoveredId(null)}
            title={`Read ${book.name_en}`}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden active:scale-[0.98] ${
              isActive 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 shadow-sm' 
                : isHovered 
                  ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-md' 
                  : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              {/* Contextual indicator: Bar for active, Icon for others */}
              <div className="flex items-center justify-center w-6 h-6 shrink-0">
                {isActive ? (
                  <div className="w-1.5 h-6 bg-indigo-500 rounded-full animate-in zoom-in duration-300" />
                ) : (
                  <BookIcon size={18} className={`transition-colors ${isHovered ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'}`} />
                )}
              </div>

              <div className="text-left">
                <span className={`flex items-center gap-2 text-sm uppercase tracking-wider transition-colors ${
                  isActive 
                    ? 'font-black text-indigo-700 dark:text-indigo-300' 
                    : isHovered 
                      ? 'font-bold text-slate-900 dark:text-slate-100' 
                      : 'font-bold text-slate-600 dark:text-slate-400'
                }`}>
                  {book.name_en}
                  {hasUnread && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className={`transition-all duration-300 ${isActive || isHovered ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
              <ChevronRight size={18} className="text-indigo-500" />
            </div>

            {/* Subtle background decoration for the hovered item */}
            {isHovered && !isActive && (
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] dark:opacity-[0.05] text-indigo-500 pointer-events-none -rotate-12 transition-all duration-500">
                <BookIcon size={64} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};