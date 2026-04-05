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
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {collections.map(col => {
        const isHovered = hovered === col;
        const hasUnread = unreadCollections.has(col);
        return (
          <button 
            key={col} 
            onClick={() => onSelect(col)} 
            onMouseEnter={() => setHovered(col)} 
            onMouseLeave={() => setHovered(null)} 
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden ${isHovered ? 'bg-slate-100 dark:bg-slate-800/80 border-indigo-200 dark:border-indigo-900 shadow-xl' : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900'}`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${isHovered ? 'bg-indigo-600 text-white scale-110' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>
                {col === 'Tanakh' ? <Layers size={20} /> : <BookOpen size={20} />}
              </div>
              <div className="text-left">
                <span className={`flex items-center gap-2 font-black text-sm uppercase tracking-wider transition-colors ${isHovered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  {col}
                  {hasUnread && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                  {books.filter(b => b.collection === col).length} Books Total
                </span>
              </div>
            </div>
            <ChevronRight size={18} className={`transition-all ${isHovered ? 'text-indigo-500 translate-x-1' : 'text-slate-300'}`} />
          </button>
        );
      })}
    </div>
  );
};