// Path: src/widgets/table-of-contents/ui/ChapterGrid.tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { BookType } from './TableOfContents';

interface ChapterGridProps {
  activeBook: BookType;
  currentBookName: string;
  currentChapterNum: number | null;
  unreadChapters: Set<string>;
  onChapterClick: (num: number) => void;
}

export const ChapterGrid = ({ activeBook, currentBookName, currentChapterNum, unreadChapters, onChapterClick }: ChapterGridProps) => {
  const [hoveredNum, setHoveredNum] = useState<number | null>(null);

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-indigo-500" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Chapters</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">{activeBook.chapters.length} Total</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {activeBook.chapters.map(chapter => {
          const isActive = activeBook.name_en.toLowerCase() === currentBookName.toLowerCase() && chapter.chapter_number === currentChapterNum;
          const isHovered = hoveredNum === chapter.chapter_number;
          const isUnread = unreadChapters.has(`${activeBook.name_en}-${chapter.chapter_number}`);
          
          return (
            <Link
              key={chapter.chapter_number}
              href={`/read/${encodeURIComponent(activeBook.name_en)}/${chapter.chapter_number}`}
              onClick={() => onChapterClick(chapter.chapter_number)}
              onMouseEnter={() => setHoveredNum(chapter.chapter_number)}
              onMouseLeave={() => setHoveredNum(null)}
              className={`relative aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition-all border ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20 z-10' : isHovered ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 scale-105' : 'bg-transparent border-transparent text-slate-400'}`}
            >
              {chapter.chapter_number}
              {isUnread && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
};