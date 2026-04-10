// Path: src/widgets/table-of-contents/ui/BookList.tsx
import React, { useState } from 'react';
import { ChevronRight, Book as BookIcon, Lock } from 'lucide-react';
import { BookType } from './TableOfContents';

interface BookListProps {
  books: BookType[];
  currentBookName: string;
  unreadBooks: Set<string>;
  isAdmin: boolean;
  onSelect: (book: BookType) => void;
}

export const BookList = ({ books, currentBookName, unreadBooks, isAdmin, onSelect }: BookListProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="space-y-2.5 animate-in fade-in slide-in-from-right-4 duration-400">
      {books.map(book => {
        const isActive = currentBookName.toLowerCase() === book.name_en.toLowerCase();
        const isHovered = hoveredId === book.id;
        const hasUnread = unreadBooks.has(book.name_en);
        const isSoon = book.visibility_status === 'coming-soon';
        const isLocked = isSoon && !isAdmin;
        
        return (
          <button 
            key={book.id} 
            disabled={isLocked}
            onClick={() => onSelect(book)} 
            onMouseEnter={() => setHoveredId(book.id)} 
            onMouseLeave={() => setHoveredId(null)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden active:scale-[0.98] ${
              isLocked ? 'opacity-60 cursor-not-allowed grayscale' :
              isActive 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 shadow-sm' 
                : isHovered 
                  ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 shadow-md' 
                  : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex items-center justify-center w-6 h-6 shrink-0">
                {isLocked ? <Lock size={14} className="text-slate-400" /> : 
                 isActive ? <div className="w-1.5 h-6 bg-indigo-500 rounded-full animate-in zoom-in" /> :
                 <BookIcon size={18} className={`transition-colors ${isHovered ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'}`} />}
              </div>

              <div className="text-left">
                <span className={`flex items-center gap-2 text-sm uppercase tracking-wider transition-colors ${
                  isActive ? 'font-black text-indigo-700 dark:text-indigo-300' : 
                  isHovered ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-bold text-slate-600 dark:text-slate-400'
                }`}>
                  {book.name_en}
                  {hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  {isSoon && <span className="text-[8px] px-1 bg-amber-100 text-amber-700 rounded-sm font-black">SOON</span>}
                </span>
              </div>
            </div>

            {!isLocked && (
              <div className={`transition-all duration-300 ${isActive || isHovered ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
                <ChevronRight size={18} className="text-indigo-500" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};