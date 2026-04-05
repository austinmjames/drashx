// Path: src/entities/verse/ui/HebrewVerseRenderer.tsx
import React, { useState } from 'react';
import { VerseWord } from './VerseCard';
import { WordTooltip } from './WordTooltip';

const decodeHebrewMorphology = (morph: string | null): { pos: string; grammar: string } => {
  if (!morph) return { pos: '', grammar: '' };
  if (/^H\d+$/.test(morph)) return { pos: '', grammar: '' };

  const cleanedMorph = morph.replace(/^H(?=[A-Z])/, '');
  const parts = cleanedMorph.split(/[/:]/);
  const base = parts[parts.length - 1];
  
  const posMap: Record<string, string> = {
    'N': 'Noun', 'V': 'Verb', 'A': 'Adjective', 'R': 'Preposition',
    'C': 'Conjunction', 'D': 'Adverb', 'P': 'Pronoun', 'T': 'Particle', 'H': 'Article',
  };

  const isDefinitive = parts.some(p => p.startsWith('Td') || p === 'd');
  const rawPos = base.startsWith('Np') ? 'Proper Name' : (posMap[base[0]] || 'Word');
  const pos = (isDefinitive && rawPos !== 'Article') ? `Definitive ${rawPos}` : rawPos;
  
  let grammar = '';
  const traits = base.substring(1); 
  const numberMatch = traits.match(/[mfc]([spd])/i);
  
  if (numberMatch) {
    const code = numberMatch[1].toLowerCase();
    if (code === 'p') grammar = 'plural';
    else if (code === 's') grammar = 'singular';
    else if (code === 'd') grammar = 'dual';
  }

  return { pos, grammar };
};

interface HebrewVerseRendererProps {
  words: VerseWord[];
  hebrewStyle: 'niqqud' | 'no-niqqud';
  verseTranslation: string;
  highlightStrongs?: string | null;
  // MUST KEEP: Passes the full VerseWord object to power the Lexicon Analysis Tab
  onWordClick?: (word: VerseWord) => void; 
  size?: 'md' | 'lg';
}

export const HebrewVerseRenderer = ({ 
  words, 
  hebrewStyle, 
  verseTranslation, 
  highlightStrongs, 
  onWordClick,
  size = 'lg' 
}: HebrewVerseRendererProps) => {
  const [tooltipConfig, setTooltipConfig] = useState<{ placement: 'top' | 'bottom', align: 'left' | 'center' | 'right' }>({ placement: 'top', align: 'center' });

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    
    // RESTORED FROM OLD: Better container boundary detection to prevent tooltip clipping
    const container = target.closest('.overflow-y-auto, [class*="max-w-"]') || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const placement = rect.top - containerRect.top < 220 ? 'bottom' : 'top';
    let align: 'left' | 'center' | 'right' = 'center';
    
    if (rect.left - containerRect.left < 160) align = 'left';
    else if (containerRect.right - rect.right < 160) align = 'right';

    setTooltipConfig({ placement, align });
  };

  // RESTORED FROM OLD: Slightly larger font sizes for the 'md' size layout
  const fontSizeClass = size === 'md' ? 'text-xl sm:text-2xl leading-relaxed' : 'text-2xl sm:text-3xl leading-[1.8]';

  return (
    <div className={`${fontSizeClass} text-right font-hebrew text-slate-900 dark:text-slate-100 flex flex-wrap gap-x-1.5 sm:gap-x-2 max-w-full relative`} dir="rtl">
      {words.map((w, index) => {
        const cleanText = w.text.replace(/\//g, '');
        const displayText = hebrewStyle === 'niqqud' ? cleanText : cleanText.replace(/[\u0591-\u05C7]/g, '');
        const isTargetWord = highlightStrongs && w.strongs === highlightStrongs;
        const { pos, grammar } = decodeHebrewMorphology(w.morph);

        // KEEP NEW: Size-aware highlighting (makes highlights subtle when embedded in comments)
        const highlightClasses = isTargetWord 
          ? (size === 'md' 
              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-normal" 
              : "font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-900/40 ring-1 ring-indigo-200/50")
          : "hover:bg-slate-100 dark:hover:bg-slate-800";

        return (
          <span
            key={w.id || index}
            onMouseEnter={handleMouseEnter}
            onClick={(e) => {
              if (w.strongs && onWordClick) {
                e.stopPropagation();
                onWordClick(w); // KEEP NEW: Passes full word object
              }
            }}
            className={`relative group/word rounded-lg px-0.5 sm:px-1 transition-all inline-block hover:z-50 ${w.strongs ? "cursor-pointer active:scale-95" : ""} ${highlightClasses}`}
          >
            {displayText}
            {w.strongs && (
              <WordTooltip 
                word={w} 
                placement={tooltipConfig.placement} 
                align={tooltipConfig.align}
                verseTranslation={verseTranslation} 
                pos={pos}
                grammar={grammar}
              />
            )}
          </span>
        );
      })}
    </div>
  );
};