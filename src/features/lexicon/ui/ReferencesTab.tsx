// Path: src/features/lexicon/ui/ReferencesTab.tsx
import React, { RefObject } from 'react';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import { HebrewVerseRenderer } from '../../../entities/verse/ui/HebrewVerseRenderer';
import { VerseWord } from '../../../entities/verse/ui/VerseCard';
import { ReferenceLink } from '../../../shared/ui/ReferenceLink';

export interface ReferenceItem {
  book_name: string;
  chapter_number: number;
  verse_number: number;
  text: string;
  translation: string;
  words?: VerseWord[];
}

interface ReferencesTabProps {
  references: ReferenceItem[];
  loading: boolean;
  hasMore: boolean;
  referenceCount: number;
  loaderRef: RefObject<HTMLDivElement | null>;
  highlightStrongs?: string | null;
  onWordClick?: (strongs: string) => void;
  onReferenceClick?: (book: string, chapter: number, verse: number) => void;
}

export const ReferencesTab = ({ 
  references, 
  loading, 
  hasMore, 
  referenceCount, 
  loaderRef, 
  highlightStrongs,
  onWordClick,
  onReferenceClick
}: ReferencesTabProps) => {
  return (
    /**
     * REFINED SPACING: 
     * pt-2 closes the gap between the sticky Nav and the first item.
     * px-6 and pb-8 provide comfortable horizontal and bottom breathing room.
     */
    <div className="pt-2 px-6 pb-8 space-y-2 animate-in slide-in-from-bottom-4 duration-500">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {references.length === 0 && !loading ? (
          <div className="py-20 text-center space-y-3">
            <Search size={40} className="mx-auto text-slate-200 dark:text-slate-800" />
            <p className="text-slate-400 italic text-sm font-serif">No usage examples found in the reader archive.</p>
          </div>
        ) : (
          <>
            {references.map((ref, idx) => (
              /**
               * ITEM SPACING:
               * py-5 (reduced from py-8) makes the list more efficient and 
               * improves tooltip flip detection.
               */
              <div key={idx} className="py-5 group cursor-default space-y-3">
                <div className="flex items-center gap-2">
                  <ReferenceLink 
                    book={ref.book_name} 
                    chapter={ref.chapter_number} 
                    verse={ref.verse_number} 
                    onClick={() => onReferenceClick?.(ref.book_name, ref.chapter_number, ref.verse_number)}
                    hidePreview={true} // Logic added to disable the hover preview here
                  />
                  <div className="h-px grow bg-slate-50 dark:bg-slate-800" />
                  <ArrowRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-3">
                  {ref.words && ref.words.length > 0 ? (
                    <HebrewVerseRenderer 
                      words={ref.words} 
                      hebrewStyle="niqqud" 
                      verseTranslation={ref.translation}
                      onWordClick={onWordClick}
                      highlightStrongs={highlightStrongs}
                      size="md" // Uses smaller font for reference list
                    />
                  ) : (
                    <p className="text-2xl font-serif text-slate-900 dark:text-slate-200 dir-rtl text-right leading-relaxed tracking-wide">
                      {ref.text}
                    </p>
                  )}
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed pl-4 border-l-2 border-slate-100 dark:border-slate-800 italic">
                    {ref.translation}
                  </p>
                </div>
              </div>
            ))}
            
            <div ref={loaderRef} className="py-12 flex justify-center">
              {loading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                  <span className="text-xs font-black uppercase tracking-widest animate-pulse">Loading Scrolls...</span>
                </div>
              ) : hasMore ? (
                <div className="h-10 w-full" />
              ) : referenceCount > 0 && (
                <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">End of Biblical References</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};