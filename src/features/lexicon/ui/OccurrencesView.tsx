// Path: src/features/lexicon/ui/OccurrencesView.tsx
import React from 'react';
import { Search, Loader2, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Occurrence } from '../model/types';

interface OccurrencesViewProps {
  loading: boolean;
  occurrences: Occurrence[];
  count: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export const OccurrencesView = ({ loading, occurrences, count, page, totalPages, onPageChange }: OccurrencesViewProps) => {
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Searching Scrolls...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Pagination Header */}
      <div className="flex items-center justify-between bg-slate-900 dark:bg-black p-4 rounded-2xl text-white shadow-xl">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black">{count}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Occurrences Found</span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button 
                title="Previous page"
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all"
              ><ChevronLeft size={16} /></button>
              <button 
                title="Next page"
                aria-label="Next page"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all"
              ><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 min-h-100">
        {occurrences.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Search size={40} className="mx-auto text-slate-200 dark:text-slate-800" />
            <p className="text-slate-400 italic text-sm font-serif">No usage examples found.</p>
          </div>
        ) : (
          occurrences.map((occ, idx) => (
            <div key={idx} className="py-6 group cursor-default">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 rounded-md">
                  {occ.book_name} {occ.chapter_number}:{occ.verse_number}
                </span>
                <div className="h-px grow bg-slate-50 dark:bg-slate-800" />
                <ArrowRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-serif text-slate-900 dark:text-slate-200 dir-rtl text-right leading-relaxed tracking-wide">
                {occ.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};