// Path: src/entities/verse/ui/GreekVerseRenderer.tsx
import React, { useState } from 'react';
import { VerseWord } from './VerseCard';
import { WordTooltip } from './WordTooltip';

const decodeGreekMorphology = (morph: string | null): { pos: string; grammar: string } => {
  if (!morph) return { pos: '', grammar: '' };
  const parts = morph.split('-');
  const base = parts[0];
  const posMap: Record<string, string> = { 'N': 'Noun', 'V': 'Verb', 'A': 'Adjective', 'T': 'Article', 'P': 'Pronoun', 'PREP': 'Preposition', 'ADV': 'Adverb', 'CONJ': 'Conjunction', 'PRT': 'Particle' };
  const pos = posMap[base] || base;
  let grammar = '';
  if (parts.length > 1) {
    const details = parts.slice(1).join('-');
    if (details.includes('P')) grammar = 'Plural';
    else if (details.includes('S')) grammar = 'Singular';
  }
  return { pos, grammar };
};

interface GreekVerseRendererProps {
  words: VerseWord[];
  verseTranslation: string;
  highlightStrongs?: string | null;
  onWordClick?: (word: VerseWord) => void;
  size?: 'md' | 'lg';
}

export const GreekVerseRenderer = ({ 
  words, verseTranslation, highlightStrongs, onWordClick, size = 'lg' 
}: GreekVerseRendererProps) => {
  const [tooltipConfig, setTooltipConfig] = useState<{ placement: 'top' | 'bottom', align: 'left' | 'center' | 'right' }>({ placement: 'top', align: 'center' });

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const estimatedHeight = 280;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const placement = (spaceAbove < estimatedHeight && spaceBelow > spaceAbove) ? 'bottom' : 'top';
    let align: 'left' | 'center' | 'right' = 'center';
    if (rect.left < 160) align = 'left';
    else if (viewportWidth - rect.right < 160) align = 'right';
    setTooltipConfig({ placement, align });
  };

  const fontSizeClass = size === 'md' ? 'text-lg sm:text-xl leading-relaxed' : 'text-xl sm:text-2xl leading-[1.8]';

  return (
    <div className={`${fontSizeClass} text-left font-serif text-slate-900 dark:text-slate-100 flex flex-wrap gap-x-1.5 sm:gap-x-2 max-w-full relative`} dir="ltr">
      {words.map((w, index) => {
        const cleanText = w.text.replace(/<[^>]+>/g, '');
        
        // Separate punctuation from the core word so it doesn't get highlighted
        const match = cleanText.match(/^([.,!?;:()"“”‘’<>··\[\]]*)(.*?)([.,!?;:()"“”‘’<>··\[\]]*)$/);
        const leadingPunct = match ? match[1] : '';
        const coreWord = match ? match[2] : cleanText;
        const trailingPunct = match ? match[3] : '';

        const displayText = coreWord;
        const cleanWord = { ...w, text: displayText };
        
        const isTargetWord = highlightStrongs && w.strongs === highlightStrongs;
        const { pos, grammar } = decodeGreekMorphology(w.morph);
        
        const highlightClasses = isTargetWord 
          ? (size === 'md' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-normal" : "font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-900/40 ring-1 ring-indigo-200/50")
          : "hover:bg-slate-100 dark:hover:bg-slate-800";

        return (
          <span key={w.id || index} className="inline-block relative whitespace-nowrap">
            {leadingPunct}
            <span
              onMouseEnter={handleMouseEnter}
              onClick={(e) => { if (onWordClick) { e.stopPropagation(); onWordClick(w); } }}
              className={`relative group/word rounded-md px-0.5 transition-all inline-block hover:z-50 cursor-pointer active:scale-95 ${highlightClasses}`}
            >
              {displayText}
              <WordTooltip 
                word={cleanWord} 
                placement={tooltipConfig.placement} 
                align={tooltipConfig.align}
                verseTranslation={verseTranslation} 
                pos={pos} 
                grammar={grammar}
              />
            </span>
            {trailingPunct}
          </span>
        );
      })}
    </div>
  );
};