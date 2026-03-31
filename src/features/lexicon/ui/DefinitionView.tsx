// Path: src/features/lexicon/ui/DefinitionView.tsx
import React from 'react';

/**
 * Note: This component is now largely handled by the main LexiconModal flow 
 * for the Hybrid Strategy, but remains here for backward compatibility or 
 * simple local-only views.
 */

interface DefinitionViewProps {
  usagePills: string[];
  formattedBody: string | null;
}

export const DefinitionView = ({ usagePills, formattedBody }: DefinitionViewProps) => {
  return (
    <div className="p-8 space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      {/* Usage Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Short Gloss & Usage</h3>
        <div className="flex flex-wrap gap-2">
          {usagePills.map((pill, i) => (
            <span 
              key={i} 
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm font-bold border border-indigo-100 dark:border-indigo-800/50 shadow-sm"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* Local Definition Body */}
      <div className="lexicon-rich-content">
        {formattedBody ? (
          <div className="prose prose-slate dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formattedBody }} />
        ) : (
          <div className="text-slate-400 italic text-sm text-center py-10 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200">
            Select &ldquo;Definition&rdquo; tab to refresh scholarly sources.
          </div>
        )}
      </div>
    </div>
  );
};