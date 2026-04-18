// Path: src/widgets/table-of-contents/ui/ChapterGrid.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Check } from 'lucide-react';
import { BookType, Chapter } from './TableOfContents';

interface ChapterGridProps {
  activeBook: BookType;
  currentBookName: string;
  currentChapterNum: string | null;
  unreadChapters: Set<string>;
  onChapterClick: (num: string) => void;
}

export const ChapterGrid = ({ activeBook, currentBookName, currentChapterNum, unreadChapters, onChapterClick }: ChapterGridProps) => {
  const [hoveredNum, setHoveredNum] = useState<string | null>(null);

  const chapters = activeBook.chapters as Chapter[];

  // Determine if we should use a wider grid for text labels (like '122b', 'Preface')
  const hasLongLabels = chapters.some(c => c.chapter_number && c.chapter_number.length > 3);
  const gridCols = hasLongLabels ? "grid-cols-2 md:grid-cols-3" : "grid-cols-4 md:grid-cols-5";

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-indigo-500" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            {activeBook.collection === 'Talmud' ? 'Folios' : 'Chapters'}
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">{activeBook.chapters.length} Total</span>
      </div>
      
      <div className={`grid ${gridCols} gap-2`}>
        {chapters.map((chapter) => {
          // Precise match between the link and the current reading context
          const isActive = activeBook.name_en.toLowerCase() === currentBookName.toLowerCase() && String(chapter.chapter_number) === String(currentChapterNum);
          const isHovered = hoveredNum === chapter.chapter_number;
          const isUnread = unreadChapters.has(`${activeBook.name_en}-${chapter.chapter_number}`);
          
          const cleanLabel = String(chapter.chapter_number).trim();
          const truncatedLabel = cleanLabel.length > 25 ? cleanLabel.substring(0, 22) + '...' : cleanLabel;
          
          const isTextLabel = isNaN(Number(cleanLabel));

          return (
            <Link
              key={chapter.chapter_number}
              href={`/read/${encodeURIComponent(activeBook.name_en)}/${encodeURIComponent(chapter.chapter_number)}`}
              onClick={() => onChapterClick(chapter.chapter_number)}
              onMouseEnter={() => setHoveredNum(chapter.chapter_number)}
              onMouseLeave={() => setHoveredNum(null)}
              title={cleanLabel}
              className={`relative flex flex-col items-center justify-center rounded-xl text-xs font-bold transition-all border text-center p-2 min-h-12 group/chip ${
                isTextLabel ? 'aspect-auto' : 'aspect-square'
              } ${
                isActive 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 scale-105 z-10' 
                  : isHovered 
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 scale-105 shadow-sm' 
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {/* Now Reading Visual Indicator */}
              {isActive && (
                <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white p-0.5 rounded-full shadow-md animate-in zoom-in duration-300">
                  <Check size={8} strokeWidth={4} />
                </div>
              )}

              <span className="truncate w-full">{truncatedLabel}</span>
              
              {isUnread && !isActive && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};