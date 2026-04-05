// Path: src/features/lexicon/ui/ReferencesTab.tsx
import React, { RefObject, useMemo } from 'react';
import { Search, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { HebrewVerseRenderer } from '../../../entities/verse/ui/HebrewVerseRenderer';
import { GreekVerseRenderer } from '../../../entities/verse/ui/GreekVerseRenderer';
import { VerseWord } from '../../../entities/verse/ui/VerseCard';

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
  // UPDATED: Now expects the full VerseWord object to support the Analysis Tab
  onWordClick?: (word: VerseWord) => void;
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
  const isGreekSearch = useMemo(() => highlightStrongs?.startsWith('G'), [highlightStrongs]);

  return (
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
              <div key={idx} className="py-5 group cursor-default space-y-3">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onReferenceClick?.(ref.book_name, ref.chapter_number, ref.verse_number)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black rounded-md border shadow-sm transition-all active:scale-95 bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white group/link"
                    title={`Jump to ${ref.book_name} ${ref.chapter_number}:${ref.verse_number}`}
                  >
                    <BookOpen size={12} className="text-indigo-500 shrink-0" />
                    {ref.book_name} {ref.chapter_number}:{ref.verse_number}
                  </button>
                  <div className="h-px grow bg-slate-50 dark:bg-slate-800" />
                  <ArrowRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-3">
                  {ref.words && ref.words.length > 0 ? (
                    isGreekSearch ? (
                      <GreekVerseRenderer 
                        words={ref.words} 
                        verseTranslation={ref.translation}
                        onWordClick={onWordClick}
                        highlightStrongs={highlightStrongs}
                        size="md" // Mapped to 1x size in renderer
                      />
                    ) : (
                      <HebrewVerseRenderer 
                        words={ref.words} 
                        hebrewStyle="niqqud" 
                        verseTranslation={ref.translation}
                        onWordClick={onWordClick}
                        highlightStrongs={highlightStrongs}
                        size="md" // Mapped to 1.3x size in renderer
                      />
                    )
                  ) : (
                    <p className={`font-serif text-slate-900 dark:text-slate-200 leading-relaxed tracking-wide ${isGreekSearch ? 'text-base text-left' : 'text-xl text-right'}`} dir={isGreekSearch ? 'ltr' : 'rtl'}>
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