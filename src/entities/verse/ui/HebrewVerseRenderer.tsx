// Path: src/entities/verse/ui/HebrewVerseRenderer.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { VerseWord } from './VerseCard';
import { supabase } from '@/shared/api/supabase';

/**
 * Common English stopwords to prevent false-positive dictionary matching
 * e.g., prevents "waste" from falsely matching the translation token "was".
 */
const STOP_WORDS = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 
  'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 
  'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'don', 
  'should', 'now', 'it', 'he', 'she', 'they', 'them', 'their', 'his', 'hers', 'its', 'my', 
  'mine', 'your', 'yours', 'our', 'ours', 'we', 'us', 'me', 'i', 'shall', 'unto', 'let', 
  'hath', 'thou', 'thee', 'thy', 'thine', 'ye', 'o', 'without', 'upon', 'within', 'also', 'even',
  'yea', 'yet', 'till', 'these', 'those', 'who', 'whom', 'which', 'what', 'whose'
]);

/**
 * Helper to decode Hebrew OSIS/OSMHB morphology codes into simplified human-readable strings.
 */
const decodeMorphology = (morph: string | null): { pos: string; grammar: string } => {
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

const WordTooltip = ({ 
  word, 
  placement, 
  align,
  verseTranslation 
}: { 
  word: VerseWord; 
  placement: 'top' | 'bottom';
  align: 'left' | 'center' | 'right';
  verseTranslation: string;
}) => {
  // --- Data Sync State ---
  const [lexiconData, setLexiconData] = useState<{ 
    pron: string | null, 
    xlit: string | null, 
    shortDef: string | null 
  } | null>(null);

  useEffect(() => {
    const fetchLexicon = async () => {
      if (!word.strongs) return;
      const { data } = await supabase
        .from('lexicon')
        .select('pronunciation, transliteration, short_def')
        .eq('id', word.strongs)
        .single();
      
      if (data) {
        setLexiconData({
          pron: data.pronunciation,
          xlit: data.transliteration,
          shortDef: data.short_def
        });
      }
    };
    fetchLexicon();
  }, [word.strongs]);

  // Priority: 1. Live Lexicon Table Data, 2. Verse JSON Data, 3. Fallback
  const displayPron = lexiconData?.pron || word.pronunciation || 'N/A';
  const displayXlit = lexiconData?.xlit || word.transliteration || 'N/A';
  const sourceMeaning = lexiconData?.shortDef || word.meaning;

  const definitionItems = useMemo(() => {
    if (!sourceMeaning) return [];
    
    let raw = sourceMeaning;
    
    // Clean Strong's metadata artifacts ([phrase], + signs, multipliers)
    raw = raw.replace(/\[[^\]]*\]/g, ''); 
    raw = raw.replace(/\+/g, ''); 
    raw = raw.replace(/×/g, '').replace(/\bX\b/g, ''); 
    
    // Remove all parenthetical notes completely to avoid broken suffixes 
    // (e.g., "-ness" from "good (deed, -ness)") becoming standalone definitions.
    raw = raw.replace(/\([^)]*\)/g, '');
    
    const parts = new Set<string>();
    raw.split(/[,/;\n]/).forEach(item => {
      let cleanItem = item.toLowerCase().trim();
      cleanItem = cleanItem.replace(/^(by implication|by extension|by resemblance|i\.e\.|e\.g\.|figuratively|literally|specifically|generally|perhaps|also|as|for|but)\s+/g, '');
      cleanItem = cleanItem.replace(/^(a|an|the|to|of|and|or)\s+/g, '');
      cleanItem = cleanItem.replace(/[.,!?;:()"“”‘’]/g, '');
      cleanItem = cleanItem.trim();
      
      if (cleanItem.length > 1 && !STOP_WORDS.has(cleanItem)) {
        parts.add(cleanItem);
      }
    });

    // Strip stopwords and split dashes from the verse to guarantee clean matching
    const cleanTrans = verseTranslation.toLowerCase().replace(/[.,!?;:()"“”‘’]/g, '').replace(/-/g, ' ');
    const translationTokens = cleanTrans.split(/\s+/).filter(t => !STOP_WORDS.has(t) && t.length > 2);

    const parsedLabels = Array.from(parts).map(dictItem => {
      const normalize = (w: string) => w.replace(/(s|es|ed|ing|ly)$/, '');
      
      // Break the dictionary phrase down to test against the verse
      const labelWords = dictItem.split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 2);
      const matchedVerseTokens = new Set<string>();

      for (const token of translationTokens) {
        const normToken = normalize(token);

        // 1. Check if the entire dictionary phrase matches
        const normDictItem = normalize(dictItem);
        if (normToken === normDictItem || normToken + 'e' === normDictItem || normDictItem + 'e' === normToken) {
          matchedVerseTokens.add(token);
        } else if (token.length >= 4 && dictItem.length >= 4 && (token.startsWith(dictItem) || dictItem.startsWith(token))) {
          // Removed greedy .includes() to prevent "form" matching "unformed"
          matchedVerseTokens.add(token);
        }

        // 2. Check internal words
        for (const lw of labelWords) {
          const normLw = normalize(lw);
          if (normToken === normLw || normToken + 'e' === normLw || normLw + 'e' === normToken) {
            matchedVerseTokens.add(token);
          } else if (token.length >= 4 && lw.length >= 4 && (token.startsWith(lw) || lw.startsWith(token))) {
            // Removed greedy .includes() to prevent "form" matching "unformed"
            matchedVerseTokens.add(token);
          }
        }
      }

      const isContextual = matchedVerseTokens.size > 0;
      
      // Default: The exact dictionary pill
      let displayLabel = dictItem.charAt(0).toUpperCase() + dictItem.slice(1);

      // User Request: Inject the text extracted from the verse ONLY if it matches the pill
      if (isContextual) {
        displayLabel = Array.from(matchedVerseTokens)
          .map(m => m.charAt(0).toUpperCase() + m.slice(1))
          .join(', ');
      }
        
      return { label: displayLabel, isContextual };
    });

    // Deduplicate labels
    const uniqueResults: typeof parsedLabels = [];
    const seen = new Set<string>();
    
    for (const res of parsedLabels) {
      const key = res.label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(res);
      }
    }

    // EXCLUSIVE CONTEXT LOGIC: Only show context matches if they exist
    const contextualItems = uniqueResults.filter(res => res.isContextual);
    if (contextualItems.length > 0) {
      return contextualItems.slice(0, 4);
    }

    return uniqueResults.slice(0, 4);
  }, [sourceMeaning, verseTranslation]);

  const { pos, grammar } = useMemo(() => decodeMorphology(word.morph), [word.morph]);
  
  const positionClasses = placement === 'top' ? "bottom-full mb-3.5" : "top-full mt-3.5";
  const arrowPlacementClasses = placement === 'top' ? "-bottom-1.5 border-r border-b" : "-top-1.5 border-l border-t";
  const alignClasses = align === 'left' ? "left-0" : align === 'right' ? "right-0" : "left-1/2 -translate-x-1/2";
  const arrowAlignClasses = align === 'left' ? "left-4" : align === 'right' ? "right-4" : "left-1/2 -translate-x-1/2";

  return (
    <div className={`absolute z-50 pointer-events-none invisible opacity-0 group-hover/word:visible group-hover/word:opacity-100 transition-all duration-200 scale-95 group-hover/word:scale-100 ${positionClasses} ${alignClasses}`}>
      <div dir="ltr" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-5 min-w-60 max-w-[85vw] sm:max-w-xs flex flex-col gap-2.5 shadow-indigo-500/20">
        <div className="flex items-center justify-between gap-4">
          <span className="text-2xl font-serif text-indigo-600 dark:text-indigo-400 font-medium" dir="rtl">{word.text.replace(/\//g, '')}</span>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase">{word.strongs}</span>
            {word.root_text && <span className="text-[10px] font-serif text-slate-400 dark:text-slate-500" dir="rtl">Root: {word.root_text}</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
           <span className="font-sans font-semibold tracking-tight">{displayPron}</span>
           {displayXlit !== 'N/A' && (
             <>
               <span className="text-slate-300 dark:text-slate-700">|</span>
               <span className="font-mono text-xs opacity-80">{displayXlit}</span>
             </>
           )}
        </div>

        <div className="py-0.5 flex flex-wrap gap-x-2 gap-y-1">
          {definitionItems.length === 0 ? <p className="text-sm font-bold text-slate-400 italic">Tap for definition</p> : 
            definitionItems.map((item, i) => (
              <div key={i} className="flex items-center">
                <span className={`text-sm leading-snug ${item.isContextual ? 'font-black text-indigo-600 dark:text-indigo-400 underline decoration-indigo-500/40 underline-offset-4' : 'font-bold text-slate-700 dark:text-slate-200'}`}>
                  {item.label}{i < definitionItems.length - 1 && <span className="text-slate-500 dark:text-slate-400 font-normal no-underline">,</span>}
                </span>
              </div>
            ))
          }
        </div>

        {pos && (
          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-white/5">
            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">{pos}</span>
            {grammar && <><span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" /><span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">{grammar}</span></>}
          </div>
        )}
        
        <div className={`absolute w-3 h-3 bg-white dark:bg-slate-900 rotate-45 border-slate-200 dark:border-white/10 ${arrowPlacementClasses} ${arrowAlignClasses}`} />
      </div>
    </div>
  );
};

interface HebrewVerseRendererProps {
  words: VerseWord[];
  hebrewStyle: 'niqqud' | 'no-niqqud';
  verseTranslation: string;
  highlightStrongs?: string | null;
  onWordClick?: (strongs: string) => void;
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
    const container = target.closest('.overflow-y-auto, [class*="max-w-"]') || document.body;
    const containerRect = container.getBoundingClientRect();
    
    const placement = rect.top - containerRect.top < 220 ? 'bottom' : 'top';
    
    let align: 'left' | 'center' | 'right' = 'center';
    if (rect.left - containerRect.left < 160) {
      align = 'left';
    } else if (containerRect.right - rect.right < 160) {
      align = 'right';
    }

    setTooltipConfig({ placement, align });
  };

  const fontSizeClass = size === 'md' ? 'text-xl sm:text-2xl leading-relaxed' : 'text-2xl sm:text-3xl leading-[1.8]';

  return (
    <div className={`${fontSizeClass} text-right font-serif text-slate-900 dark:text-slate-100 flex flex-wrap gap-x-1.5 sm:gap-x-2 max-w-full relative`} dir="rtl">
      {words.map((w, index) => {
        const cleanText = w.text.replace(/\//g, '');
        const displayText = hebrewStyle === 'niqqud' ? cleanText : cleanText.replace(/[\u0591-\u05C7]/g, '');
        const isTargetWord = highlightStrongs && w.strongs === highlightStrongs;

        return (
          <span
            key={w.id || index}
            onMouseEnter={handleMouseEnter}
            onClick={(e) => {
              if (w.strongs && onWordClick) {
                e.stopPropagation();
                onWordClick(w.strongs);
              }
            }}
            className={`relative group/word rounded-lg px-0.5 sm:px-1 transition-all inline-block hover:z-50 ${w.strongs ? "cursor-pointer active:scale-95" : ""} ${isTargetWord ? "font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-900/40 ring-1 ring-indigo-200/50" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
          >
            {displayText}
            {w.strongs && (
              <WordTooltip 
                word={w} 
                placement={tooltipConfig.placement} 
                align={tooltipConfig.align}
                verseTranslation={verseTranslation} 
              />
            )}
          </span>
        );
      })}
    </div>
  );
};