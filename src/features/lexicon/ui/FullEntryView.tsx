// Path: src/features/lexicon/ui/FullEntryView.tsx
import React from 'react';
import { Info } from 'lucide-react';

interface FullEntryViewProps {
  formattedBody: string | null;
}

export const FullEntryView = ({ formattedBody }: FullEntryViewProps) => {
  return (
    <div className="p-8 md:p-10 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Scholarly Lexical Entry
        </h4>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-900" />
      </div>

      <div className="lexicon-rich-content pb-10">
        {formattedBody ? (
          <div 
            className="prose prose-slate dark:prose-invert max-w-none text-base leading-[1.8] font-serif text-left" 
            dangerouslySetInnerHTML={{ __html: formattedBody }} 
          />
        ) : (
          <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Info className="mx-auto h-8 w-8 text-slate-300 mb-4" />
            <p className="text-sm text-slate-500 italic">Extended scholarly detail is not available for this entry.</p>
          </div>
        )}
      </div>
    </div>
  );
};