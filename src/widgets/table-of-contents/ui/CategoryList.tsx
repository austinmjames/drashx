// Path: src/widgets/table-of-contents/ui/CategoryList.tsx
import React, { useState, useMemo } from 'react';
import { ChevronRight, BookOpen, Compass, Quote, MessageSquare } from 'lucide-react';
import { BookType, CATEGORY_ORDER } from './TableOfContents';

interface CategoryListProps {
  activeCollection: string;
  collectionBooks: BookType[];
  unreadCategories: Set<string>;
  onSelect: (cat: string) => void;
}

export const CategoryList = ({ activeCollection, collectionBooks, unreadCategories, onSelect }: CategoryListProps) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const categories = useMemo(() => {
    const catSet = new Set(collectionBooks.map(b => b.category));
    const ordered = CATEGORY_ORDER.filter((c: string) => catSet.has(c));
    const unordered = Array.from(catSet).filter((c: string) => !CATEGORY_ORDER.includes(c));
    return [...ordered, ...unordered];
  }, [collectionBooks]);

  return (
    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {categories.length === 0 && collectionBooks.length > 0 ? (
         <div className="py-20 text-center text-slate-400 dark:text-slate-600 text-xs italic">
           No categories found in the {activeCollection} collection.
         </div>
      ) : categories.map(cat => {
        const isHovered = hovered === cat;
        const hasUnread = unreadCategories.has(cat);
        const bookCount = collectionBooks.filter(b => b.category === cat).length;

        // Context-aware icon selection
        const getIcon = () => {
          if (cat === 'Torah' || cat === 'Gospels') return <BookOpen size={22} />;
          if (cat === 'Pauline Epistles' || cat === 'General Epistles') return <MessageSquare size={20} />;
          if (cat === 'Prophecy') return <Quote size={20} />;
          return <Compass size={22} />;
        };

        const CategoryIcon = getIcon();

        return (
          <button 
            key={cat} 
            onClick={() => onSelect(cat)} 
            onMouseEnter={() => setHovered(cat)} 
            onMouseLeave={() => setHovered(null)}
            // Mobile Touch Support: Simulates hover state on tap/long-press
            onTouchStart={() => setHovered(cat)}
            onTouchEnd={() => setHovered(null)}
            title={`Open ${cat} category`}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden active:scale-[0.98] ${
              isHovered 
                ? 'bg-slate-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 shadow-lg shadow-indigo-500/5' 
                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              {/* Icon Container with dynamic scaling */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                isHovered 
                  ? 'bg-indigo-600 text-white scale-105 shadow-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
              }`}>
                {CategoryIcon}
              </div>

              <div className="text-left">
                <span className={`flex items-center gap-2 font-black text-sm uppercase tracking-wider transition-colors ${
                  isHovered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {cat}
                  {hasUnread && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-0.5">
                  {bookCount} {bookCount === 1 ? 'Book' : 'Books'}
                </span>
              </div>
            </div>

            <div className={`transition-all duration-300 ${isHovered ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
              <ChevronRight size={18} className="text-indigo-500" />
            </div>

            {/* Subtle background decoration for the active item */}
            {isHovered && (
              <div className="absolute -right-4 -bottom-4 opacity-[0.05] dark:opacity-[0.08] text-indigo-500 pointer-events-none rotate-12 transition-all duration-500">
                {CategoryIcon}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};