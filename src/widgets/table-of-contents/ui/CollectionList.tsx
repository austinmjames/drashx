// Path: src/widgets/table-of-contents/ui/CollectionList.tsx
import React, { useState } from 'react';
import { ChevronRight, Layers, BookOpen, Lock } from 'lucide-react';
import { BookType, VisibilityStatus } from './TableOfContents';

interface CollectionListProps {
  collections: string[];
  unreadCollections: Set<string>;
  books: BookType[];
  configs: { id: string; visibility_status: VisibilityStatus }[];
  isAdmin: boolean;
  onSelect: (col: string) => void;
}

export const CollectionList = ({ collections, unreadCollections, books, configs, isAdmin, onSelect }: CollectionListProps) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {collections.map(col => {
        const isHovered = hovered === col;
        const hasUnread = unreadCollections.has(col);
        const config = configs.find(c => c.id === col);
        const status = config?.visibility_status || 'default';
        const isSoon = status === 'coming-soon';
        const isLocked = isSoon && !isAdmin;
        
        // Count books in this collection for the metadata subtitle
        const bookCount = books.filter(b => b.collection === col).length;

        return (
          <button 
            key={col} 
            disabled={isLocked}
            onClick={() => onSelect(col)} 
            onMouseEnter={() => setHovered(col)} 
            onMouseLeave={() => setHovered(null)}
            // Restored Mobile Touch Support: Simulates hover state on tap/long-press
            onTouchStart={() => setHovered(col)}
            onTouchEnd={() => setHovered(null)}
            title={isLocked ? `${col} - Coming Soon` : `Open ${col} collection`}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden active:scale-[0.98] ${
              isLocked ? 'opacity-60 cursor-not-allowed grayscale' :
              isHovered 
                ? 'bg-slate-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 shadow-lg shadow-indigo-500/5' 
                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                isHovered && !isLocked
                  ? 'bg-indigo-600 text-white scale-105 shadow-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
              }`}>
                {isLocked ? <Lock size={18} /> : (col === 'Tanakh' ? <Layers size={22} /> : <BookOpen size={22} />)}
              </div>

              <div className="text-left">
                <span className={`flex items-center gap-2 font-black text-sm uppercase tracking-wider transition-colors ${
                  isHovered && !isLocked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {col}
                  
                  {/* Restored Double-Ring Ping Animation */}
                  {hasUnread && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                  
                  {isSoon && <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-md font-black">SOON</span>}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-0.5">
                  {isSoon ? 'Awaiting Scribes' : `${bookCount} ${bookCount === 1 ? 'Book' : 'Books'} Available`}
                </span>
              </div>
            </div>

            {!isLocked && (
              <div className={`relative z-10 transition-all duration-300 ${isHovered ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
                <ChevronRight size={18} className="text-indigo-500" />
              </div>
            )}

            {/* Restored subtle background decoration for the active item */}
            {isHovered && !isLocked && (
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