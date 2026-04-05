// Path: src/features/lexicon/ui/DefinitionView.tsx
import React from 'react';
import { Check, Quote, Tag, Layers } from 'lucide-react';
import { AffixAnalysis } from '../lib/morphology';

interface Pill {
  label: string;
  isContextual: boolean;
}

interface DefinitionViewProps {
  usagePills: Pill[];
  contextualMeaning?: string | null;
  morphologyDetails?: string[];
  affixAnalysis?: AffixAnalysis[];
  lemma?: string; // Root lemma for the dynamic title
}

export const DefinitionView = ({ 
  usagePills, 
  contextualMeaning,
  morphologyDetails,
  affixAnalysis,
  lemma
}: DefinitionViewProps) => {
  
  const allTranslations = React.useMemo(() => {
    let basePills = usagePills.map(p => ({ ...p })); 
    
    if (contextualMeaning) {
      const cleanContext = contextualMeaning.trim();
      basePills = basePills.map(p => ({ ...p, isContextual: false }));
      basePills = basePills.filter(p => p.label.toLowerCase() !== cleanContext.toLowerCase());
      basePills.unshift({
        label: cleanContext,
        isContextual: true
      });
    }
    
    return basePills;
  }, [usagePills, contextualMeaning]);

  const hasHighlightedMatch = allTranslations.some(p => p.isContextual);

  // Helper to detect Hebrew script for 2x scaling
  const isHebrew = lemma ? /[\u0591-\u05FF]/.test(lemma) : false;

  return (
    <div className="p-8 md:p-10 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Affix Explanation Section */}
      {affixAnalysis && affixAnalysis.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Layers size={14} className="text-indigo-500" /> Prefix and Suffix Explanation
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {affixAnalysis.map((affix, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xl font-hebrew text-indigo-600 dark:text-indigo-400 min-w-6 text-center">
                  {affix.text}
                </span>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {affix.meaning}
                </span>
                <span className="ml-auto text-[8px] font-black uppercase tracking-tighter text-slate-400 px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
                  {affix.type}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Common Definitions Section */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Quote size={14} className="text-indigo-500 shrink-0" /> 
          {lemma ? (
            <span className="flex items-baseline gap-2 normal-case">
              <span className={isHebrew ? "text-xl font-serif text-indigo-600 dark:text-indigo-400 leading-none" : "uppercase"}>
                {lemma}
              </span>
              <span className="uppercase">common definitions</span>
            </span>
          ) : 'Common Definitions'}
        </h3>

        <div className="flex flex-wrap gap-2.5">
          {allTranslations.length > 0 ? (
            allTranslations.map((pill, i) => (
              <div 
                key={i} 
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border transition-all ${
                  pill.isContextual
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-200 dark:shadow-none'
                    : 'bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-900'
                }`}
              >
                {pill.isContextual && <Check size={14} strokeWidth={3} />}
                {pill.label}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400 italic">No translations found in the archive.</p>
          )}
        </div>
        
        {hasHighlightedMatch && (
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight pl-1">
            * Highlighted entry represents the best contextual match
          </p>
        )}

        {/* 3. Parts of Speech & Morphology */}
        {morphologyDetails && morphologyDetails.length > 0 && (
          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/50">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Tag size={12} className="text-indigo-500" /> Morphological Analysis
            </h4>
            <div className="flex flex-wrap gap-2">
              {morphologyDetails.map((detail, idx) => (
                <span 
                  key={idx} 
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-indigo-100 dark:border-indigo-800/50 shadow-sm"
                >
                  {detail}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};