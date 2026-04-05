// Path: src/widgets/table-of-contents/ui/CategoryList.tsx
import React, { useState, useMemo } from 'react';
import { ChevronRight, BookOpen, Compass } from 'lucide-react';
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
    const ordered = CATEGORY_ORDER.filter(c => catSet.has(c));
    const unordered = Array.from(catSet).filter(c => !CATEGORY_ORDER.includes(c));
    return [...ordered, ...unordered];
  }, [collectionBooks]);

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {categories.length === 0 && collectionBooks.length > 0 ? (
         <div className="py-20 text-center text-slate-400 text-xs italic">
           No books found in the {activeCollection} collection.
         </div>
      ) : categories.map(cat => {
        const isHovered = hovered === cat;
        const hasUnread = unreadCategories.has(cat);
        return (
          <button key={cat} onClick={() => onSelect(cat)} onMouseEnter={() => setHovered(cat)} onMouseLeave={() => setHovered(null)} className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all relative overflow-hidden ${isHovered ? 'bg-slate-100 dark:bg-slate-800/80 border-indigo-100 dark:border-indigo-900 shadow-lg shadow-indigo-500/5' : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900'}`}>
            <div className="relative z-10 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm ${isHovered ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>
                {cat === 'Torah' ? <BookOpen size={16} /> : <Compass size={16} />}
              </div>
              <div className="text-left">
                <span className={`flex items-center gap-2 font-bold text-sm transition-colors ${isHovered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}`}>
                  {cat}
                  {hasUnread && <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-sm shadow-blue-500/30">New</span>}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{collectionBooks.filter(b => b.category === cat).length} Books</span>
              </div>
            </div>
            <ChevronRight size={16} className={`transition-all ${isHovered ? 'text-indigo-500 translate-x-1' : 'text-slate-300'}`} />
          </button>
        );
      })}
    </div>
  );
};