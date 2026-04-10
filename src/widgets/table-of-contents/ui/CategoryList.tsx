// Path: src/widgets/table-of-contents/ui/CategoryList.tsx
import React, { useState } from 'react';
import { ChevronRight, Compass, Lock } from 'lucide-react';
import { BookType, VisibilityStatus } from './TableOfContents';

interface CategoryListProps {
  activeCollection: string;
  collectionBooks: BookType[];
  unreadCategories: Set<string>;
  configs: { collection_id: string; name_en: string; visibility_status: VisibilityStatus }[];
  isAdmin: boolean;
  onSelect: (cat: string) => void;
}

export const CategoryList = ({ activeCollection, collectionBooks, unreadCategories, configs, isAdmin, onSelect }: CategoryListProps) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const categories = Array.from(new Set(collectionBooks.map(b => b.category)));

  return (
    <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {categories.map(cat => {
        const isHovered = hovered === cat;
        const hasUnread = unreadCategories.has(cat);
        const config = configs.find(c => c.collection_id === activeCollection && c.name_en === cat);
        const status = config?.visibility_status || 'default';
        const isSoon = status === 'coming-soon';
        const isLocked = isSoon && !isAdmin;

        return (
          <button 
            key={cat} 
            disabled={isLocked}
            onClick={() => onSelect(cat)} 
            onMouseEnter={() => setHovered(cat)} 
            onMouseLeave={() => setHovered(null)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all relative overflow-hidden active:scale-[0.98] ${
              isLocked ? 'opacity-60 cursor-not-allowed grayscale' :
              isHovered 
                ? 'bg-slate-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50 shadow-lg' 
                : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm ${
                isHovered ? 'bg-indigo-600 text-white scale-105' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
              }`}>
                {isLocked ? <Lock size={18} /> : <Compass size={22} />}
              </div>

              <div className="text-left">
                <span className={`flex items-center gap-2 font-black text-sm uppercase tracking-wider transition-colors ${
                  isHovered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {cat}
                  {hasUnread && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
                  {isSoon && <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-black">SOON</span>}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-0.5">
                   {isSoon ? 'Coming Soon' : 'Browse Category'}
                </span>
              </div>
            </div>

            {!isLocked && (
              <div className={`transition-all duration-300 ${isHovered ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
                <ChevronRight size={18} className="text-indigo-500" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};