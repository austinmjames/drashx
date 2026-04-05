// Path: src/features/lexicon/ui/LexiconHeader.tsx
import React from 'react';
import { X, Hash, Volume2, Network, Book } from 'lucide-react';

interface LexiconHeaderProps {
  searchId: string;
  isGreek: boolean;
  loading: boolean;
  displayWord: string;
  formattedPronunciation: React.ReactNode;
  rootId?: string | null;
  originId?: string | null;
  onClose: () => void;
  onOriginClick: (id: string) => void;
}

export const LexiconHeader = ({
  searchId, isGreek, loading, displayWord, formattedPronunciation,
  rootId, originId, onClose, onOriginClick
}: LexiconHeaderProps) => {
  return (
    <div className="flex-none px-6 sm:px-8 py-6 sm:py-8 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between rounded-t-4xl sm:rounded-t-3xl relative z-20">
      <div className="space-y-3 sm:space-y-4 max-w-[80%] w-full">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] sm:text-xs font-bold font-mono border border-slate-200 dark:border-slate-700 shadow-sm tabular-nums">
            <Hash size={12} className="text-indigo-500" /> {searchId}
          </span>
          <span className="hidden sm:inline text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Lexicon Archive</span>
        </div>
        
        {loading ? (
          <div className="space-y-3 pt-1">
            <div className="h-10 sm:h-12 bg-slate-200 dark:bg-slate-800 w-48 rounded-2xl animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 bg-slate-100 dark:bg-slate-800/50 w-24 rounded-full animate-pulse" />
              <div className="h-6 bg-slate-100 dark:bg-slate-800/50 w-32 rounded-full animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-8 gap-y-3">
            <h1 className="text-4xl sm:text-5xl font-serif text-slate-900 dark:text-white leading-none" dir={isGreek ? "ltr" : "rtl"}>
              {displayWord}
            </h1>
            <div className="flex flex-wrap gap-2">
              {formattedPronunciation && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800/50 self-start shadow-sm">
                  <Volume2 size={12} />
                  <span className="text-sm sm:text-base">{formattedPronunciation}</span>
                </div>
              )}
              {rootId && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-100 dark:border-emerald-800/50 self-start shadow-sm" title={`Derived from root: ${rootId}`}>
                  <Network size={12} />
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">{rootId}</span>
                </div>
              )}
              {originId && originId.split('+').map((rawId, idx) => {
                const cleanNum = rawId.replace(/[^0-9]/g, '');
                if (!cleanNum) return null;
                const finalId = `H${cleanNum}`;
                return (
                  <button 
                    key={`${finalId}-${idx}`}
                    onClick={() => onOriginClick(finalId)}
                    title={`Jump to Hebraic Term: ${finalId}`}
                    aria-label={`Jump to Hebraic Term: ${finalId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full border border-amber-100 dark:border-amber-800/50 self-start shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer" 
                  >
                    <Book size={12} />
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Hebraic Term: {finalId}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button 
        onClick={onClose} 
        title="Close Lexicon"
        aria-label="Close Lexicon"
        className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 active:scale-90 transition-all"
      >
        <X size={20} />
      </button>
    </div>
  );
};