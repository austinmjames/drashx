// Path: src/widgets/table-of-contents/ui/CollectionList.tsx
import React, { useState } from 'react';
import { ChevronRight, Layers, BookOpen } from 'lucide-react';
import { BookType } from './TableOfContents';

interface CollectionListProps {
  collections: string[];
  activeCollection: string;
  unreadCollections: Set<string>;
  books: BookType[];
  onSelect: (col: string) => void;
}

export const CollectionList = ({ collections, unreadCollections, books, onSelect }: CollectionListProps) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {collections.map(col => {
        const isHovered = hovered === col;
        const hasUnread = unreadCollections.has(col);
        
        // Count books in this collection for the metadata subtitle
        const bookCount = books.filter(b => b.collection === col).length;

        return (
          <button 
            key={col} 
            onClick={() => onSelect(col)} 
            onMouseEnter={() => setHovered(col)} 
            onMouseLeave={() => setHovered(null)}
            // Mobile Touch Support: Simulates hover state on tap/long-press
            onTouchStart={() => setHovered(col)}
            onTouchEnd={() => setHovered(null)}
            title={`Open ${col} collection`}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden active:scale-[0.98] ${
              isHovered 
                ? 'bg-slate-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 shadow-lg shadow-indigo-500/5' 
                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              {/* Icon Container with dynamic scaling and coloring */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                isHovered 
                  ? 'bg-indigo-600 text-white scale-105 shadow-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
              }`}>
                {col === 'Tanakh' ? <Layers size={22} /> : <BookOpen size={22} />}
              </div>

              <div className="text-left">
                <span className={`flex items-center gap-2 font-black text-sm uppercase tracking-wider transition-colors ${
                  isHovered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {col}
                  {hasUnread && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-0.5">
                  {bookCount} {bookCount === 1 ? 'Book' : 'Books'} Available
                </span>
              </div>
            </div>

            <div className={`transition-all duration-300 ${isHovered ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
              <ChevronRight size={18} className="text-indigo-500" />
            </div>

            {/* Subtle background decoration for the active item */}
            {isHovered && (
              <div className="absolute -right-4 -bottom-4 opacity-[0.05] dark:opacity-[0.08] text-indigo-500 pointer-events-none rotate-12 transition-all duration-500">
                {col === 'Tanakh' ? <Layers size={80} /> : <BookOpen size={80} />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};