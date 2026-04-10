// Path: src/widgets/table-of-contents/ui/ChapterGrid.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { BookType } from './TableOfContents';

/**
 * Local interface to refine the Chapter type with the display_label 
 * property used for Talmudic folios and complex hierarchies.
 */
interface TOCChapter {
  chapter_number: number;
  display_label?: string | null;
}

interface ChapterGridProps {
  activeBook: BookType;
  currentBookName: string;
  currentChapterNum: number | null;
  unreadChapters: Set<string>;
  onChapterClick: (num: number) => void;
}

export const ChapterGrid = ({ activeBook, currentBookName, currentChapterNum, unreadChapters, onChapterClick }: ChapterGridProps) => {
  const [hoveredNum, setHoveredNum] = useState<number | null>(null);

  // Cast chapters to TOCChapter to access display_label safely without 'any'
  const chapters = activeBook.chapters as TOCChapter[];

  // Determine if we should use a wider grid for folio labels (like '122b')
  const hasLabels = chapters.some(c => c.display_label);
  const gridCols = hasLabels ? "grid-cols-4" : "grid-cols-5";

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
      <div className={`grid ${gridCols} gap-1.5`}>
        {chapters.map((chapter) => {
          const isActive = activeBook.name_en.toLowerCase() === currentBookName.toLowerCase() && chapter.chapter_number === currentChapterNum;
          const isHovered = hoveredNum === chapter.chapter_number;
          const isUnread = unreadChapters.has(`${activeBook.name_en}-${chapter.chapter_number}`);
          
          // Priority: Display Label (33a) -> Chapter Number (33)
          const label = chapter.display_label || chapter.chapter_number;
          
          return (
            <Link
              key={chapter.chapter_number}
              href={`/read/${encodeURIComponent(activeBook.name_en)}/${chapter.chapter_number}`}
              onClick={() => onChapterClick(chapter.chapter_number)}
              onMouseEnter={() => setHoveredNum(chapter.chapter_number)}
              onMouseLeave={() => setHoveredNum(null)}
              className={`relative aspect-square flex items-center justify-center rounded-xl text-[10px] font-bold transition-all border ${
                isActive 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20 z-10' 
                  : isHovered 
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 scale-105' 
                    : 'bg-transparent border-transparent text-slate-400'
              }`}
            >
              {label}
              {isUnread && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
};