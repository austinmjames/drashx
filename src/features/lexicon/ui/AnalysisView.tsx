// Path: src/features/lexicon/ui/AnalysisView.tsx
import React from 'react';
import { FileText, Tags, GitBranch, Quote, CheckCircle2 } from 'lucide-react';
import { VerseWord } from '@/entities/verse/ui/VerseCard';

interface AnalysisViewProps {
  wordContext: VerseWord;
  isGreek: boolean;
}

export const AnalysisView = ({ wordContext, isGreek }: AnalysisViewProps) => {
  // FIX: Default 'variants' to an empty object during destructuring
  // This satisfies TypeScript and prevents "possibly undefined" runtime crashes
  const { meaning, semantic_domain, variants = {} } = wordContext;

  // Filter variants, strictly excluding the Documentary Hypothesis as requested
  const variantKeys = Object.keys(variants).filter(k => k !== 'doc_hyp' && variants[k]);

  return (
    <div className="p-8 md:p-10 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Direct Contextual Gloss */}
      {meaning && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Quote size={14} className="text-indigo-500" /> Contextual Translation
          </h3>
          <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 shadow-sm">
            <p className="text-lg font-medium text-indigo-900 dark:text-indigo-100">{meaning}</p>
            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-2 flex items-center gap-1.5">
              <CheckCircle2 size={12}/> Specific meaning within this verse
            </p>
          </div>
        </section>
      )}

      {/* 2. Semantic Domain (Louw-Nida) */}
      {semantic_domain && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Tags size={14} className="text-emerald-500" /> Semantic Domain
          </h3>
          <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 shadow-sm">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Louw-Nida Category: <span className="font-bold">{semantic_domain}</span></p>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-2">Classifies this specific occurrence based on its contextual field of meaning.</p>
          </div>
        </section>
      )}

      {/* 3. Manuscript Variants */}
      {variantKeys.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <GitBranch size={14} className="text-rose-500" /> Manuscript Apparatus
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variantKeys.map(key => {
              const labelMap: Record<string, string> = {
                oshb: 'Open Scriptures (OSHB)',
                uhb: 'UnfoldingWord (UHB)',
                uxlc: 'Leningrad Codex (UXLC)',
                na28: 'Critical Text (NA28)',
                byz: 'Majority Text (Byzantine)',
                sbl: 'SBLGNT'
              };
              const displayLabel = labelMap[key] || key;
              const val = variants[key] as string;

              return (
                <div key={key} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 shadow-sm">
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{displayLabel}</span>
                   <span className={`font-medium ${isGreek ? 'font-serif text-lg text-left' : 'font-hebrew text-xl dir-rtl text-right'} text-slate-900 dark:text-slate-100`}>
                     {val}
                   </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Fallback state if no advanced data is present */}
      {!meaning && !semantic_domain && variantKeys.length === 0 && (
         <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
           <FileText className="mx-auto h-8 w-8 text-slate-300 mb-4" />
           <p className="text-sm text-slate-500 italic">No advanced textual analysis available for this exact occurrence.</p>
         </div>
      )}
    </div>
  );
};