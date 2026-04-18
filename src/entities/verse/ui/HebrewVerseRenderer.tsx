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
  const posMap: Record<string, string> = { 'N': 'Noun', 'V': 'Verb', 'A': 'Adjective', 'R': 'Preposition', 'C': 'Conjunction', 'D': 'Adverb', 'P': 'Pronoun', 'T': 'Particle', 'H': 'Article' };
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
  onWordClick?: (word: VerseWord) => void; 
  size?: 'md' | 'lg';
}

export const HebrewVerseRenderer = ({ 
  words, hebrewStyle, verseTranslation, highlightStrongs, onWordClick, size = 'lg' 
}: HebrewVerseRendererProps) => {
  const [tooltipConfig, setTooltipConfig] = useState<{ placement: 'top' | 'bottom', align: 'left' | 'center' | 'right' }>({ placement: 'top', align: 'center' });

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    
    // Better container boundary detection to prevent tooltip clipping
    const container = target.closest('.overflow-y-auto, [class*="max-w-"]') || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const placement = rect.top - containerRect.top < 220 ? 'bottom' : 'top';
    let align: 'left' | 'center' | 'right' = 'center';
    
    if (rect.left - containerRect.left < 160) align = 'left';
    else if (containerRect.right - rect.right < 160) align = 'right';

    setTooltipConfig({ placement, align });
  };

  const fontSizeClass = size === 'md' ? 'text-xl sm:text-2xl leading-relaxed' : 'text-2xl sm:text-3xl leading-[1.8]';

  return (
    <div className={`${fontSizeClass} text-right font-hebrew text-slate-900 dark:text-slate-100 flex flex-wrap gap-x-1.5 sm:gap-x-2 max-w-full relative`} dir="rtl">
      {words.map((w, index) => {
        const cleanText = w.text.replace(/\//g, '');
        
        // 1. Separate punctuation from the core word so it sits outside the highlight span
        const match = cleanText.match(/^([.,!?;:()"“”‘’<>··\[\]\u05C3]*)(.*?)([.,!?;:()"“”‘’<>··\[\]\u05C3]*)$/);
        const leadingPunct = match ? match[1] : '';
        const coreWord = match ? match[2] : cleanText;
        const trailingPunct = match ? match[3] : '';

        // 2. Strip cantillation (Teamim) from the highlighted word for cleaner reading
        const CANTILLATION_REGEX = /[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C4\u05C5\u05C6]/g;
        const displayCoreWithNiqqud = coreWord.replace(CANTILLATION_REGEX, '');
        const displayText = hebrewStyle === 'niqqud' ? displayCoreWithNiqqud : coreWord.replace(/[\u0591-\u05C7]/g, '');
        
        const isTargetWord = highlightStrongs && w.strongs === highlightStrongs;
        const { pos, grammar } = decodeHebrewMorphology(w.morph);
        
        const highlightClasses = isTargetWord 
          ? (size === 'md' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-normal" : "font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-900/40 ring-1 ring-indigo-200/50")
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
                word={w} 
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