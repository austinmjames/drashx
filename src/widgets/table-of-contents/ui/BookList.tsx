// Path: src/widgets/table-of-contents/ui/BookList.tsx
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BookType } from './TableOfContents';

interface BookListProps {
  books: BookType[];
  currentBookName: string;
  unreadBooks: Set<string>;
  onSelect: (book: BookType) => void;
}

export const BookList = ({ books, currentBookName, unreadBooks, onSelect }: BookListProps) => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <div className="space-y-1 animate-in fade-in slide-in-from-right-4 duration-400">
      {books.map(book => {
        const isActive = currentBookName.toLowerCase() === book.name_en.toLowerCase();
        const isHovered = hoveredId === book.id;
        const hasUnread = unreadBooks.has(book.name_en);
        return (
          <button key={book.id} onClick={() => onSelect(book)} onMouseEnter={() => setHoveredId(book.id)} onMouseLeave={() => setHoveredId(null)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all relative ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : isHovered ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
            <div className="flex items-center gap-3">
              {isActive && <div className="w-1 h-4 bg-indigo-500 rounded-full animate-in zoom-in duration-300" />}
              <span className={`text-sm tracking-tight transition-transform flex items-center gap-2 ${isActive ? 'font-bold' : isHovered ? 'font-medium translate-x-1' : 'font-medium'}`}>
                {book.name_en}
                {hasUnread && <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-sm shadow-blue-500/30">New</span>}
              </span>
            </div>
            <ChevronRight size={16} className={`transition-all ${isActive ? 'opacity-100' : isHovered ? 'opacity-100 translate-x-1' : 'opacity-0'}`} />
          </button>
        );
      })}
    </div>
  );
};