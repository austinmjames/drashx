// Path: src/entities/verse/ui/WordTooltip.tsx
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Volume2, Book, Search, Globe } from 'lucide-react';
import { VerseWord } from './VerseCard';
import { supabase } from '@/shared/api/supabase';
import { getAffixSound } from '@/features/lexicon/lib/morphology';
import { fetchSefariaDefinitions } from '@/features/lexicon/api/sefaria';

const PREFIX_STOP_WORDS = new Set(['and', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'with', 'for']);

interface WordTooltipProps {
  word: VerseWord;
  placement: 'top' | 'bottom';
  align: 'left' | 'center' | 'right';
  verseTranslation: string;
  pos: string;
  grammar: string;
  onWordClick?: (word: VerseWord) => void;
}

export const WordTooltip = ({ 
  word, 
  placement: initialPlacement, 
  verseTranslation,
  pos,
  grammar,
  onWordClick
}: WordTooltipProps) => {
  const [lexiconData, setLexiconData] = useState<{ pron: string | null, xlit: string | null, shortDef: string | null, id: string | null, source?: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, arrowLeft: 0, placement: initialPlacement });
  const [mounted, setMounted] = useState(false); 
  const [isFallbackMatch, setIsFallbackMatch] = useState(false);
  
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);
  const isTouchRef = useRef(false);

  const isGreek = word.strongs?.startsWith('G') || /[a-zA-Z\u0370-\u03FF]/.test(word.text);

  // Smart Device Detection
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true);
      const hasCoarse = window.matchMedia("(pointer: coarse)").matches;
      const hasFine = window.matchMedia("(pointer: fine)").matches;
      if (hasCoarse && !hasFine) {
        setIsTouch(true);
        isTouchRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // Dismiss tooltip when clicking outside (Fallback for Desktop)
  useEffect(() => {
    if (!isHovered || isTouchRef.current) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) && 
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsHovered(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHovered]);

  useEffect(() => {
    if (!isHovered || hasFetchedRef.current) return;

    const fetchLexicon = async () => {
      hasFetchedRef.current = true;
      
      // 1. PRIMARY LOOKUP (Database Strong's Number)
      if (word.strongs && word.strongs !== 'G0' && word.strongs !== 'H0') {
        const { data } = await supabase
          .from('lexicon')
          .select('id, pronunciation, transliteration, short_def')
          .eq('id', word.strongs)
          .single();
        
        if (data) {
          setLexiconData({ id: data.id, pron: data.pronunciation, xlit: data.transliteration, shortDef: data.short_def });
          return;
        }
      }

      // --- FALLBACK STRATEGY ---
      // Strip punctuation and diacritics for clean string matching
      const cleanSearchText = word.text.replace(/[.,!?;:()"“”‘’<>··]/g, '').trim();

      // 2. SEFARIA LIVE API (Hebrew Unmapped Texts)
      if (!isGreek && cleanSearchText) {
        const hebrewQuery = cleanSearchText.replace(/[\u0591-\u05C7]/g, ''); // Strip Niqqud
        try {
          const sefariaDefs = await fetchSefariaDefinitions(hebrewQuery);
          if (sefariaDefs && sefariaDefs.length > 0) {
            setIsFallbackMatch(true);
            const combinedDef = sefariaDefs.slice(0, 2).map(d => d.content.replace(/<[^>]+>/g, '')).join('; ');
            setLexiconData({
              id: null, pron: null, xlit: null, source: 'sefaria',
              shortDef: combinedDef || 'Sefaria matched, click for details.'
            });
            return;
          }
        } catch (e) {
          console.error("Sefaria fallback failed", e);
        }
      }

      // 3. LOCAL STRING MATCH (Greek Unmapped Texts like the Didache)
      if (cleanSearchText) {
        const localQuery = isGreek ? cleanSearchText : cleanSearchText.replace(/[\u0591-\u05C7]/g, '');
        
        const { data: exactMatch } = await supabase
          .from('lexicon')
          .select('id, pronunciation, transliteration, short_def')
          .ilike('lemma', localQuery)
          .limit(1)
          .maybeSingle();

        if (exactMatch) {
          setIsFallbackMatch(true);
          setLexiconData({ id: exactMatch.id, pron: exactMatch.pronunciation, xlit: exactMatch.transliteration, shortDef: exactMatch.short_def, source: 'local' });
          return;
        }

        // 4. LOOSE GREEK FALLBACK (Wildcard first 4 chars to bypass inflections/suffixes)
        if (isGreek && cleanSearchText.length > 4) {
          const prefix = cleanSearchText.substring(0, 4);
          const { data: looseData } = await supabase
            .from('lexicon')
            .select('id, pronunciation, transliteration, short_def')
            .ilike('lemma', `${prefix}%`)
            .limit(1)
            .maybeSingle();
            
          if (looseData) {
            setIsFallbackMatch(true);
            setLexiconData({ id: looseData.id, pron: looseData.pronunciation, xlit: looseData.transliteration, shortDef: looseData.short_def, source: 'wildcard' });
          }
        }
      }
    };
    
    fetchLexicon();
  }, [word.strongs, word.text, isHovered, isGreek]);

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
    if (left + tooltipWidth > viewportWidth - padding) left = viewportWidth - tooltipWidth - padding;
    
    const arrowLeft = targetCenter - left;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const placement = (spaceBelow < tooltipHeight && spaceAbove > spaceBelow) ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 14 : rect.bottom + 14;
    
    setCoords({ top, left, arrowLeft, placement });
  };

  const executeNavigation = () => {
    setIsHovered(false);
    // If we found a local DB id through fallback, use it. Otherwise rely on the original word prop.
    const finalStrongs = lexiconData?.id || word.strongs;
    if (onWordClick) {
      onWordClick({ ...word, strongs: finalStrongs });
    } else {
      const parentSpan = triggerRef.current?.parentElement;
      if (parentSpan) {
          const overlay = triggerRef.current;
          if (overlay) overlay.style.pointerEvents = 'none';
          parentSpan.click();
          if (overlay) overlay.style.pointerEvents = 'auto';
      } else if (finalStrongs) {
          window.dispatchEvent(new CustomEvent('lexicon-pivot', { detail: finalStrongs }));
      }
    }
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault(); 
    if (isTouchRef.current) {
      if (!isHovered) { updatePosition(); setIsHovered(true); }
      else setIsHovered(false);
    } else {
      executeNavigation();
    }
  };

  const formatWithAffixes = useCallback((baseStr: string | null | undefined) => {
    if (!baseStr || baseStr === 'N/A' || baseStr === '') return null;

    if (word.text?.includes('/')) {
      const parts = word.text.split('/');
      const rootIdx = parts.reduce((max, part, i) => 
        part.replace(/[\u0591-\u05C7]/g, '').length > parts[max].replace(/[\u0591-\u05C7]/g, '').length ? i : max, 0);

      const pre = parts.slice(0, rootIdx).map(part => getAffixSound(part, true)).join('');
      const suf = parts.slice(rootIdx + 1).map(part => getAffixSound(part, false)).join('');

      return (
        <span className="flex items-baseline">
          {pre && <span className="text-slate-400 dark:text-slate-500 mr-0.5 lowercase">{pre}</span>}
          <span className="font-normal">{baseStr.replace(/^-|-$/g, '')}</span>
          {suf && <span className="text-slate-400 dark:text-slate-500 ml-0.5 lowercase">{suf}</span>}
        </span>
      );
    }
    return <span className="font-normal">{baseStr}</span>;
  }, [word.text]);

  const pronunciationContent = useMemo(() => {
    const p = lexiconData?.pron || word.pronunciation;
    return formatWithAffixes(p);
  }, [lexiconData, word, formatWithAffixes]);

  const transliterationContent = useMemo(() => {
    const x = lexiconData?.xlit || word.transliteration;
    const p = lexiconData?.pron || word.pronunciation;
    if (x && p && x.toLowerCase() === p.toLowerCase()) return null;
    return formatWithAffixes(x);
  }, [lexiconData, word, formatWithAffixes]);

  // Advanced Fuzzy Matching & Contextual Highlighting Algorithm
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

  const arrowPlacementClasses = coords.placement === 'top' ? "-bottom-1.5 border-r border-b" : "-top-1.5 border-l border-t";

  if (!mounted) return null;

  return (
    <>
      <span 
        ref={triggerRef} 
        className="absolute inset-0 pointer-events-auto z-10 block select-none cursor-pointer" 
        onClick={handleInteraction}
        onTouchStart={() => { if (!isTouchRef.current) { isTouchRef.current = true; setIsTouch(true); } }}
        onMouseEnter={() => { if (!isTouchRef.current) { updatePosition(); setIsHovered(true); } }}
        onMouseLeave={() => { if (!isTouchRef.current) setIsHovered(false); }}
      />

      {typeof document !== 'undefined' && createPortal(
        <>
          {isHovered && isTouch && (
            <div 
              className="fixed inset-0 z-9998 cursor-pointer" 
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsHovered(false); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setIsHovered(false); }}
            />
          )}

          <div 
            ref={tooltipRef}
            className="fixed z-9999 pointer-events-none transition-opacity duration-150 ease-out"
            style={{ 
              top: coords.top, left: coords.left,
              opacity: isHovered ? 1 : 0,
              transform: coords.placement === 'top' ? 'translateY(-100%)' : 'none',
              visibility: isHovered ? 'visible' : 'hidden'
            }}
          >
            <div dir="ltr" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 min-w-60 max-w-[85vw] sm:max-w-xs flex flex-col gap-3 pointer-events-auto shadow-indigo-500/10">
              
              <div className="flex items-center justify-between gap-4">
                <span className={`text-2xl font-bold text-indigo-600 dark:text-indigo-400 ${isGreek ? 'font-serif' : 'font-hebrew'}`} dir={isGreek ? "ltr" : "rtl"}>
                  {word.text.replace(/\//g, '')}
                </span>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase tabular-nums">{lexiconData?.id || word.strongs || '...'}</span>
                  {isFallbackMatch && lexiconData?.source === 'sefaria' && (
                    <span className="text-[8px] font-black bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1 mt-1">
                      <Globe size={8} /> Sefaria Match
                    </span>
                  )}
                  {isFallbackMatch && lexiconData?.source !== 'sefaria' && (
                    <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-500 uppercase flex items-center gap-1 mt-1">
                      <Search size={8} /> {lexiconData?.source === 'wildcard' ? 'Loose Match' : 'Exact Match'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                 {transliterationContent && (
                   <span className="flex items-center gap-1.5 text-sm font-sans tracking-tight capitalize text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700/50" title="Transliteration">
                     <Book size={14} className="text-slate-400 shrink-0" />
                     {transliterationContent}
                   </span>
                 )}
                 {pronunciationContent && (
                   <span className="flex items-center gap-1.5 text-sm font-sans tracking-tight capitalize text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700/50" title="Pronunciation">
                     <Volume2 size={14} className="text-slate-400 shrink-0" />
                     {pronunciationContent}
                   </span>
                 )}
              </div>

              <div className="py-1 flex flex-wrap gap-x-2 gap-y-1.5 min-h-6">
                {definitionItems.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 italic">Consulting the archive...</p>
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

              {isTouch && (
                <div className="-mx-5 -mb-5 mt-3 px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-b-2xl pointer-events-auto">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Tap outside to dismiss</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); executeNavigation(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-95 shrink-0"
                  >
                    More <ArrowRight size={12} strokeWidth={3} />
                  </button>
                </div>
              )}
              
              {/* Tooltip Arrow */}
              <div 
                className={`absolute w-3 h-3 border-slate-200 dark:border-slate-800 ${arrowPlacementClasses} ${
                  coords.placement === 'top' && isTouch ? 'bg-slate-50 dark:bg-slate-950' : 'bg-white dark:bg-slate-900'
                }`} 
                style={{ 
                  left: coords.arrowLeft, 
                  transform: 'translateX(-50%) rotate(45deg)',
                  zIndex: -1 
                }}
              />
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};