// Path: src/features/lexicon/ui/DefinitionTab.tsx
import React from 'react';
import { Check, Info } from 'lucide-react';

interface Pill {
  label: string;
  isContextual: boolean;
}

interface DefinitionTabProps {
  usagePills: Pill[];
  longDef: string | null | undefined;
  verseTranslation?: string;
}

export const DefinitionTab = ({ 
  usagePills, 
  longDef, 
  verseTranslation
}: DefinitionTabProps) => {
  return (
    <div className="p-10 space-y-12 animate-in slide-in-from-bottom-6 duration-700">
      
      {/* PILLS SECTION */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          Common English Glosses
          {verseTranslation && <span className="text-[9px] font-normal lowercase tracking-normal italic opacity-60">(Highlighted based on verse context)</span>}
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {usagePills.length > 0 ? (
            usagePills.map((pill, i) => (
              <div 
                key={i} 
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${
                  pill.isContextual 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-200 dark:shadow-none' 
                    : 'bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800'
                }`}
              >
                {pill.isContextual && <Check size={14} strokeWidth={3} />}
                {pill.label}
              </div>
            ))
          ) : (
            <span className="text-sm text-slate-400 italic">No short definitions available.</span>
          )}
        </div>
      </div>

      {/* BDB SECTION */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            Brown-Driver-Briggs Entry
          </h4>
          <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
        </div>

        {longDef ? (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div 
              className="lexicon-rich-content text-base leading-[1.8] font-serif text-slate-700 dark:text-slate-300 selection:bg-indigo-100 dark:selection:bg-indigo-900/50"
              dangerouslySetInnerHTML={{ __html: longDef }}
            />
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Info className="mx-auto h-8 w-8 text-slate-300 mb-4" />
            <p className="text-sm text-slate-500 italic">Scholarly detail not found in current volume.</p>
          </div>
        )}
      </div>
    </div>
  );
};