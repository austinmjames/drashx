// Path: src/entities/verse/ui/WordTooltip.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VerseWord } from './VerseCard';
import { supabase } from '@/shared/api/supabase';

const PREFIX_STOP_WORDS = new Set(['and', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'with', 'for']);

interface WordTooltipProps {
  word: VerseWord;
  placement: 'top' | 'bottom';
  align: 'left' | 'center' | 'right';
  verseTranslation: string;
  pos: string;
  grammar: string;
}

export const WordTooltip = ({ 
  word, 
  placement: initialPlacement, 
  verseTranslation,
  pos,
  grammar
}: WordTooltipProps) => {
  const [lexiconData, setLexiconData] = useState<{ pron: string | null, xlit: string | null, shortDef: string | null } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, arrowLeft: 0, placement: initialPlacement });
  const [mounted, setMounted] = useState(false); 
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hasFetchedRef = useRef(false);

  // Push the mount state update to the next tick to avoid synchronous cascading renders.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    // Lazy-load lexicon data ONLY when the word is hovered/touched.
    if (!word.strongs || !isHovered || hasFetchedRef.current) return;

    const fetchLexicon = async () => {
      hasFetchedRef.current = true;
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
  }, [word.strongs, isHovered]);

  const updatePosition = () => {
    if (!triggerRef.current?.parentElement) return;
    
    const rect = triggerRef.current.parentElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const tooltipWidth = 320; 
    const tooltipHeight = 220; 
    const padding = 20;

    const targetCenter = rect.left + (rect.width / 2);
    let left = targetCenter - (tooltipWidth / 2);
    
    if (left < padding) left = padding;
    if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }

    const arrowLeft = targetCenter - left;

    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const placement = (spaceBelow < tooltipHeight && spaceAbove > spaceBelow) ? 'top' : 'bottom';
    
    const top = placement === 'top' ? rect.top - 14 : rect.bottom + 14;

    setCoords({ top, left, arrowLeft, placement });
  };

  const displayPhonetic = useMemo(() => {
    const p = lexiconData?.pron || word.pronunciation;
    const x = lexiconData?.xlit || word.transliteration;
    if (p && p !== 'N/A' && p !== '') return p;
    if (x && x !== 'N/A' && x !== '') return x;
    return 'N/A';
  }, [lexiconData, word]);

  const definitionItems = useMemo(() => {
    const sourceMeaning = lexiconData?.shortDef || word.meaning;
    if (!sourceMeaning) return [];
    
    const raw = sourceMeaning.replace(/<[^>]+>/g, '').replace(/\([^)]*\)/g, '');
    const parts = new Set<string>();
    
    if (word.meaning) {
        word.meaning.replace(/<[^>]+>/g, '').split(/[,;]/).forEach(m => {
            const clean = m.replace(/[\[\]]/g, '').trim().toLowerCase();
            if (clean.length > 1) parts.add(clean);
        });
    }

    raw.split(/[,/;\n]/).forEach(item => {
      if (/\[[^\]]*\]/.test(item)) return;
      let cleanItem = item.replace(/\+/g, '').replace(/×/g, '').replace(/\bX\b/g, '').toLowerCase().trim();
      cleanItem = cleanItem.replace(/^(by implication|by extension|by resemblance|i\.e\.|e\.g\.|figuratively|literally|specifically|generally|perhaps|also|as|for|but)\s+/g, '');
      cleanItem = cleanItem.replace(/[.,!?;:()"“”‘’]/g, '').trim();
      if (cleanItem.length > 0 && !PREFIX_STOP_WORDS.has(cleanItem)) parts.add(cleanItem);
    });

    const cleanTrans = verseTranslation.toLowerCase().replace(/[.,!?;:()"“”‘’]/g, '').replace(/-/g, ' ');
    const transWords = cleanTrans.split(/\s+/);

    const parsedLabels = Array.from(parts).map(dictItem => {
      const normalize = (w: string) => w.replace(/(s|es|ed|ing|ly)$/, '');
      const labelWords = dictItem.split(/\s+/).filter(w => !PREFIX_STOP_WORDS.has(w) && w.length > 0);
      
      let matchLevel = 0;

      for (const token of transWords) {
        const cleanToken = token.toLowerCase();
        const cleanDictItem = dictItem.toLowerCase();

        if (cleanToken === cleanDictItem) { matchLevel = 3; break; }
        const normToken = normalize(cleanToken);
        const normDictItem = normalize(cleanDictItem);
        if (normToken === normDictItem || normToken + 'e' === normDictItem || normDictItem + 'e' === normToken) { matchLevel = Math.max(matchLevel, 2); }
        if (cleanToken.length >= 4 && cleanDictItem.length >= 4 && (cleanToken.startsWith(cleanDictItem) || cleanDictItem.startsWith(cleanToken))) { matchLevel = Math.max(matchLevel, 1); }
        for (const lw of labelWords) {
          const cleanLw = lw.toLowerCase();
          if (cleanToken === cleanLw) { matchLevel = Math.max(matchLevel, 3); } 
          else if (normalize(cleanToken) === normalize(cleanLw)) { matchLevel = Math.max(matchLevel, 2); }
        }
        if (matchLevel === 3) break;
      }
      return { label: dictItem.charAt(0).toUpperCase() + dictItem.slice(1), matchLevel, isContextual: matchLevel > 0 };
    });

    const uniqueResults: typeof parsedLabels = [];
    const seen = new Set<string>();
    for (const res of parsedLabels) {
      const key = res.label.toLowerCase();
      if (!seen.has(key)) { seen.add(key); uniqueResults.push(res); }
    }

    return uniqueResults.sort((a, b) => b.matchLevel - a.matchLevel).slice(0, 4);
  }, [lexiconData, word.meaning, verseTranslation]);
  
  const isGreek = word.strongs?.startsWith('G');
  const arrowPlacementClasses = coords.placement === 'top' ? "-bottom-1.5 border-r border-b" : "-top-1.5 border-l border-t";

  return (
    <>
      <span 
        ref={triggerRef} 
        className="absolute inset-0 pointer-events-auto z-10 block select-none" 
        onMouseEnter={() => { updatePosition(); setIsHovered(true); }}
        onMouseLeave={() => setIsHovered(false)}
        // Mobile Touch Support: Simulates hover state for tooltips
        onTouchStart={() => { updatePosition(); setIsHovered(true); }}
        onTouchEnd={() => setIsHovered(false)}
      />

      {mounted && typeof document !== 'undefined' && createPortal(
        <div 
          dir="ltr"
          className="fixed z-9999 pointer-events-none duration-200 ease-out"
          style={{ 
            top: coords.top, 
            left: coords.left,
            opacity: isHovered ? 1 : 0,
            transformOrigin: coords.placement === 'top' ? 'bottom center' : 'top center',
            transform: `${coords.placement === 'top' ? 'translateY(-100%)' : ''} scale(${isHovered ? 1 : 0.95})`,
            transitionProperty: 'opacity, transform',
            visibility: isHovered ? 'visible' : 'hidden'
          }}
        >
          <div dir="ltr" className="select-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 min-w-60 max-w-[85vw] sm:max-w-xs flex flex-col gap-3 shadow-indigo-500/10">
            
            <div className="flex items-center justify-between gap-4">
              <span className={`text-2xl font-bold text-indigo-600 dark:text-indigo-400 ${isGreek ? 'font-serif' : 'font-hebrew'}`} dir={isGreek ? "ltr" : "rtl"}>
                {word.text.replace(/\//g, '')}
              </span>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase tabular-nums">{word.strongs}</span>
                {word.root_text && (
                  <span className={`text-[10px] text-slate-500 dark:text-slate-400 font-bold ${isGreek ? 'font-serif' : 'font-hebrew'}`} dir={isGreek ? "ltr" : "rtl"}>
                    {word.root_text}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               <span className="text-sm font-sans font-bold tracking-tight capitalize text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700/50">{displayPhonetic}</span>
            </div>

            <div className="py-1 flex flex-wrap gap-x-2 gap-y-1.5 min-h-6">
              {definitionItems.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 italic">Tap word for full archive entry</p>
              ) : (
                definitionItems.map((item, i) => (
                  <div key={i} className="flex items-center">
                    <span className={`text-sm leading-snug tracking-tight ${item.isContextual ? 'font-black text-indigo-700 dark:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4' : 'font-bold text-slate-600 dark:text-slate-400'}`}>
                      {item.label}{i < definitionItems.length - 1 && <span className="text-slate-300 dark:text-slate-600 font-normal no-underline mx-0.5">,</span>}
                    </span>
                  </div>
                ))
              )}
            </div>

            {pos && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{pos}</span>
                {grammar && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-tighter">{grammar}</span>
                  </>
                )}
              </div>
            )}
            
            {/* Tooltip Arrow */}
            <div 
              className={`absolute w-3 h-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${arrowPlacementClasses}`} 
              style={{ 
                left: coords.arrowLeft, 
                transform: 'translateX(-50%) rotate(45deg)',
                zIndex: -1 
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};