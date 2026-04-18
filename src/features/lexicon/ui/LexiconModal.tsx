// Path: src/features/lexicon/ui/LexiconModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Info, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/api/supabase';

// Internal Imports
import { LexiconEntry } from '../model/types';
import { getNormalizedStrongsId } from '../lib/lexicon-utils';
import { DefinitionView } from './DefinitionView'; 
import { ReferencesTab, ReferenceItem } from './ReferencesTab';
import { VerseWord } from '@/entities/verse/ui/VerseCard';
import { getVersePath } from '@/shared/lib/reference-navigation';
import { SmartText } from '@/shared/ui/SmartText';
import { fetchSefariaDefinitions, SefariaDefinition } from '@/features/lexicon/api/sefaria';

// Refactored Sub-components & Libs
import { getAffixSound, decodeMorphology, analyzeHebrewAffixes, AffixAnalysis } from '../lib/morphology';
import { LexiconHeader } from './LexiconHeader';
import { LexiconTabs } from './LexiconTabs';

// Dynamically extract the expected prop type from LexiconTabs to avoid import/export errors
type ChildTabType = React.ComponentProps<typeof LexiconTabs>['activeTab'];
type ModalTabType = 'definition' | 'analysis' | 'scholarly' | 'references';

interface LexiconModalProps {
  strongsNumber: string | null;
  wordContext?: VerseWord | null; 
  isOpen: boolean;
  onClose: () => void;
  verseTranslation?: string;
}

interface ViewVerseRow {
  book_id: string;
  chapter_num: number;
  verse_num: number;
  text_he: string;
  text_en: string | null;
  words: VerseWord[];
}

export const LexiconModal = ({ 
  strongsNumber, wordContext, isOpen, onClose, verseTranslation = "" 
}: LexiconModalProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ModalTabType>('definition');
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [occLoading, setOccLoading] = useState(false);
  
  const [localEntry, setLocalEntry] = useState<(LexiconEntry & { source?: string }) | null>(null);
  const [sefariaEntries, setSefariaEntries] = useState<SefariaDefinition[]>([]);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceCount, setReferenceCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const PAGE_SIZE = 15;
  const loaderRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null); 

  const searchId = useMemo(() => getNormalizedStrongsId(strongsNumber), [strongsNumber]);
  const isGreek = searchId?.startsWith('G');
  const isUnmappedText = searchId === 'G0' || searchId === 'H0';

  useEffect(() => {
    if (contentAreaRef.current) contentAreaRef.current.scrollTop = 0;
  }, [searchId]);

  // ============================================================================
  // AGGRESSIVE PUNCTUATION STRIPPING
  // Ensures the Modal Header and API Searches never capture brackets or commas
  // ============================================================================
  const cleanDisplayWord = useMemo(() => {
    if (!wordContext?.text) return '';
    return wordContext.text
      .replace(/\//g, '') // Strip internal slash dividers
      .replace(/[^\p{L}\p{M}\s\-'־]/gu, '') // STRICT: Keep ONLY letters, vowel marks, spaces, and hyphens
      .replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C4\u05C5\u05C6]/g, '') // Strip cantillation marks
      .trim();
  }, [wordContext?.text]);

  const fetchFullData = useCallback(async () => {
    if (!searchId) return;
    setLoadingLocal(true);
    setSefariaEntries([]);
    
    try {
      // 1. Fetch Primary Data from Supabase if it is a real Strong's Number
      if (!isUnmappedText) {
        const { data, error } = await supabase.from('lexicon').select('*').eq('id', searchId).single();
        if (data && !error) setLocalEntry(data);
        else setLocalEntry({ id: searchId, lemma: 'Unknown', transliteration: 'N/A', pronunciation: 'N/A', short_def: 'No definition found.', long_def: null, root_id: null, semantic_domain: null, origin_id: null });
      } else {
        // Prepare a blank slate for the unmapped placeholder
        setLocalEntry({ id: searchId, lemma: cleanDisplayWord || 'Unknown', transliteration: 'N/A', pronunciation: 'N/A', short_def: null, long_def: null, root_id: null, semantic_domain: null, origin_id: null });
      }

      // 2. 3-TIER FALLBACK STRATEGY (For unmapped or missing words)
      if (cleanDisplayWord && isUnmappedText) {
        const hebrewQuery = cleanDisplayWord.replace(/[\u0591-\u05C7]/g, ''); // Strip Niqqud for live searches

        // Tier A: Sefaria API (Hebrew Only)
        if (!isGreek) {
          try {
            const sefariaDefs = await fetchSefariaDefinitions(hebrewQuery);
            if (sefariaDefs && sefariaDefs.length > 0) {
              setSefariaEntries(sefariaDefs);
              const combinedDef = sefariaDefs[0].content.replace(/<[^>]+>/g, '');
              
              setLocalEntry({
                id: searchId,
                lemma: hebrewQuery,
                transliteration: 'N/A',
                pronunciation: 'N/A',
                short_def: combinedDef,
                long_def: null,
                root_id: null,
                semantic_domain: null,
                origin_id: null,
                source: 'sefaria'
              });
              
              setLoadingLocal(false);
              return;
            }
          } catch (e) {
            console.error("Sefaria fallback failed", e);
          }
        }

        // Tier B: Wiktionary API (Global Encyclopedia Backup)
        const searchQuery = isGreek ? cleanDisplayWord : hebrewQuery;
        try {
          const wikiRes = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(searchQuery)}`);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            const definitions = isGreek ? (wikiData.grc || wikiData.el || Object.values(wikiData)[0]) : (wikiData.he || Object.values(wikiData)[0]);
            if (definitions && Array.isArray(definitions) && definitions.length > 0) {
              const firstDef = definitions[0].definitions?.[0]?.definition;
              if (firstDef) {
                setLocalEntry({ 
                  id: 'WIKTIONARY', 
                  lemma: cleanDisplayWord, 
                  transliteration: 'N/A',
                  pronunciation: 'N/A',
                  short_def: firstDef.replace(/<[^>]+>/g, '').trim(), 
                  long_def: null,
                  root_id: null,
                  semantic_domain: null,
                  origin_id: null,
                  source: 'wiktionary' 
                });
                setLoadingLocal(false);
                return;
              }
            }
          }
        } catch (e) {
          console.error("Wiktionary fallback failed", e);
        }

        // Tier C: Local DB String Matching
        // Notice we use `cleanDisplayWord` (with Niqqud) for Hebrew, because the local DB 'lemma' column stores vowels.
        const { data: exactMatch } = await supabase.from('lexicon').select('*').ilike('lemma', cleanDisplayWord).limit(1).maybeSingle();
        if (exactMatch) {
          setLocalEntry({ ...exactMatch, source: 'local' });
          setLoadingLocal(false);
          return;
        }

        // Tier D: CONSONANTAL FUZZY MATCHING (Bypass Prefixes & Vowel Points)
        if (isGreek && cleanDisplayWord.length > 4) {
          const prefix = cleanDisplayWord.substring(0, 4);
          const { data: looseData } = await supabase
            .from('lexicon')
            .select('*')
            .ilike('lemma', `${prefix}%`)
            .limit(3); // Fetch potentials
            
          if (looseData && looseData.length > 0) {
            const xlits = Array.from(new Set(looseData.map(d => d.transliteration).filter(Boolean))).join(' / ');
            const prons = Array.from(new Set(looseData.map(d => d.pronunciation).filter(Boolean))).join(' / ');
            const combinedDef = looseData.map(d => d.short_def).filter(Boolean).join(' OR ');

            setLocalEntry({ 
              ...looseData[0],
              transliteration: xlits,
              pronunciation: prons,
              short_def: looseData.length > 1 ? `Potentials: ${combinedDef}` : combinedDef, 
              source: 'wildcard' 
            });
            setLoadingLocal(false);
            return;
          }
        } else if (!isGreek && cleanDisplayWord.length > 2) {
          // Drop the first character (often a prepositional prefix like ב, ל, מ)
          // Inject '%' wildcards between consonants to jump over database vowel points
          const fuzzyPattern = `%${cleanDisplayWord.substring(1).split('').join('%')}%`;
          
          const { data: looseData } = await supabase
            .from('lexicon')
            .select('*')
            .ilike('lemma', fuzzyPattern)
            .limit(3); // Fetch potentials
            
          if (looseData && looseData.length > 0) {
            const xlits = Array.from(new Set(looseData.map(d => d.transliteration).filter(Boolean))).join(' / ');
            const prons = Array.from(new Set(looseData.map(d => d.pronunciation).filter(Boolean))).join(' / ');
            const combinedDef = looseData.map(d => d.short_def).filter(Boolean).join(' OR ');

            setLocalEntry({ 
              ...looseData[0],
              transliteration: xlits,
              pronunciation: prons,
              short_def: looseData.length > 1 ? `Potentials: ${combinedDef}` : combinedDef, 
              source: 'wildcard' 
            });
            setLoadingLocal(false);
            return;
          }
        }
      }
      
    } catch (e) { 
      console.error("Lexicon Fetch Error:", e); 
    } finally { 
      setLoadingLocal(false); 
    }
  }, [searchId, isUnmappedText, isGreek, cleanDisplayWord]);

  const fetchReferences = useCallback(async (page: number, append: boolean = false) => {
    if (!searchId) return;
    setOccLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    try {
      // If it is unmapped text, search by string match instead of Strongs!
      let filterString = `words.cs.[{"strongs":"${searchId}"}]`;
      if (isUnmappedText && cleanDisplayWord) {
         filterString = `words.cs.[{"text":"${cleanDisplayWord}"}]`;
      }

      const { data, count, error } = await supabase.from('reader_verses_view')
        .select('book_id, chapter_num, verse_num, text_he, text_en, words', { count: 'exact' })
        .or(filterString)
        .order('id', { ascending: true })
        .range(from, to);
      
      if (data && !error) {
        const typedData = data as unknown as ViewVerseRow[];
        const newRefs: ReferenceItem[] = typedData.map((v) => ({ 
            book_name: v.book_id, 
            chapter_number: v.chapter_num, 
            verse_number: v.verse_num, 
            text: v.text_he, 
            translation: v.text_en || 'Translation unavailable', 
            words: v.words 
        }));
        if (append) setReferences(prev => [...prev, ...newRefs]);
        else setReferences(newRefs);
        setReferenceCount(count || 0);
        setHasMore(from + data.length < (count || 0));
      }
    } catch (e) { 
      console.error("References Fetch Error:", e); 
    } finally { 
      setOccLoading(false); 
    }
  }, [searchId, isUnmappedText, cleanDisplayWord]);

  useEffect(() => {
    if (isOpen && searchId) {
      setActiveTab('definition'); setCurrentPage(1); setReferences([]); setHasMore(true);
      fetchFullData(); fetchReferences(1, false);
    }
  }, [isOpen, searchId, fetchFullData, fetchReferences]);

  useEffect(() => {
    if (activeTab !== 'references' || !hasMore || occLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage); fetchReferences(nextPage, true);
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [activeTab, hasMore, occLoading, currentPage, fetchReferences]);

  const usagePills = useMemo(() => {
    const pills = new Map<string, string>(); 
    // Filter out the hardcoded Sefaria placeholder so it doesn't render as a translation pill
    if (wordContext?.meaning && wordContext.meaning !== 'Tap for scholarly analysis') {
      wordContext.meaning.split(/[,;]/).forEach(m => {
        const clean = m.replace(/[\[\]]/g, '').trim();
        if (clean.length > 1) pills.set(clean.toLowerCase(), clean);
      });
    }
    if (localEntry?.short_def) {
      // If it's a generated "Potentials:" string, strip that prefix so it parses cleanly
      const rawDef = localEntry.short_def.startsWith('Potentials: ') 
        ? localEntry.short_def.replace('Potentials: ', '') 
        : localEntry.short_def;

      const raw = rawDef.replace(/×/g, '').replace(/\([^)]*-[^)]*\)/g, '').replace(/\([^)]*\)/g, '').replace(/\./g, ''); 
      // Split by OR (used in fuzzy matching) and commas
      raw.split(/,| OR /).forEach(item => {
        const lower = item.trim().toLowerCase();
        if (lower.length > 1 && !['and', 'or', 'the', 'of', 'to', 'a', 'an'].includes(lower)) {
          if (!pills.has(lower)) pills.set(lower, item.trim());
        }
      });
    }
    const cleanTrans = verseTranslation.toLowerCase().replace(/[.,!?;:()“”‘’]/g, '');
    const transWords = cleanTrans.split(/\s+/);
    const matchStem = (w1: string, w2: string) => w1 === w2 || w1 + 's' === w2 || w2 + 's' === w1 || w1 + 'ed' === w2 || w2 + 'ed' === w1;
    let bestMatchLabel: string | null = null;
    let bestMatchScore = 0;
    const evaluated = Array.from(pills.values()).map(label => {
      const lower = label.toLowerCase();
      const score = (cleanTrans.includes(` ${lower} `)) ? 300 : (transWords.some(w => matchStem(w, lower))) ? 200 : 0;
      if (score > bestMatchScore) { bestMatchScore = score; bestMatchLabel = label; }
      return { label: label.charAt(0).toUpperCase() + label.slice(1), score };
    });
    return evaluated.map(res => ({ label: res.label, isContextual: res.label.toLowerCase() === bestMatchLabel?.toLowerCase() && res.score > 0 }))
      .sort((a, b) => (a.isContextual === b.isContextual ? a.label.localeCompare(b.label) : a.isContextual ? -1 : 1));
  }, [localEntry, wordContext, verseTranslation]);

  const morphologyDetails = useMemo(() => 
    wordContext?.morph ? decodeMorphology(wordContext.morph, isGreek) : []
  , [wordContext?.morph, isGreek]);

  const affixAnalysis = useMemo((): AffixAnalysis[] => 
    wordContext?.text ? analyzeHebrewAffixes(wordContext.text) : []
  , [wordContext?.text]);

  const formatWithAffixes = useCallback((baseStr: string | null | undefined) => {
    if (!baseStr || baseStr === 'N/A' || baseStr === '') return null;

    if (wordContext?.text?.includes('/')) {
      const parts = wordContext.text.split('/');
      const rootIdx = parts.reduce((max, p, i) => 
        p.replace(/[\u0591-\u05C7]/g, '').length > parts[max].replace(/[\u0591-\u05C7]/g, '').length ? i : max, 0);
      
      const pre = parts.slice(0, rootIdx).map(p => getAffixSound(p, true)).join('');
      const suf = parts.slice(rootIdx + 1).map(p => getAffixSound(p, false)).join('');
      
      return (
        <span className="flex items-baseline font-normal">
          {pre && <span className="text-slate-400 dark:text-slate-500 mr-0.5 lowercase">{pre}</span>}
          <span>{baseStr.replace(/^-|-$/g, '')}</span>
          {suf && <span className="text-slate-400 dark:text-slate-500 ml-0.5 lowercase">{suf}</span>}
        </span>
      );
    }
    return <span className="font-normal">{baseStr}</span>;
  }, [wordContext?.text]);

  const pronunciationContent = useMemo(() => {
    const p = localEntry?.pronunciation !== 'N/A' ? localEntry?.pronunciation : null;
    return formatWithAffixes(p);
  }, [localEntry?.pronunciation, formatWithAffixes]);

  const transliterationContent = useMemo(() => {
    const x = localEntry?.transliteration !== 'N/A' ? localEntry?.transliteration : null;
    const p = localEntry?.pronunciation !== 'N/A' ? localEntry?.pronunciation : null;
    if (x && p && x.toLowerCase() === p.toLowerCase()) return null;
    return formatWithAffixes(x);
  }, [localEntry?.transliteration, localEntry?.pronunciation, formatWithAffixes]);

  if (!isOpen || !strongsNumber) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center pt-12 sm:p-4 animate-in fade-in duration-200 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="bg-white dark:bg-slate-950 rounded-t-3xl sm:rounded-3xl shadow-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 w-full sm:w-136 sm:max-w-xl h-full max-h-[calc(100dvh-4rem)] sm:h-auto sm:max-h-[85vh] flex flex-col relative z-10 overflow-hidden">
        
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-full h-5 absolute top-0 left-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="w-12 h-1.5 bg-slate-300/50 dark:bg-slate-600/50 rounded-full" />
        </div>
        
        <LexiconHeader 
          searchId={localEntry?.id || searchId} 
          isGreek={isGreek} 
          loading={loadingLocal}
          displayWord={cleanDisplayWord || localEntry?.lemma || 'Unknown'}
          pronunciationContent={pronunciationContent}
          transliterationContent={transliterationContent}
          rootId={localEntry?.root_id} originId={localEntry?.origin_id}
          onClose={onClose} 
          onOriginClick={(id) => { window.dispatchEvent(new CustomEvent('lexicon-pivot', { detail: id })); }}
        />

        <LexiconTabs 
          activeTab={activeTab as unknown as ChildTabType} 
          setActiveTab={setActiveTab as unknown as (tab: ChildTabType) => void} 
          referenceCount={referenceCount} 
        />

        <div ref={contentAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide bg-white dark:bg-slate-950 relative z-30">
          {activeTab === 'definition' ? (
            <DefinitionView 
                usagePills={usagePills} 
                contextualMeaning={wordContext?.meaning === 'Tap for scholarly analysis' ? null : wordContext?.meaning} 
                morphologyDetails={morphologyDetails}
                affixAnalysis={affixAnalysis}
                lemma={wordContext?.root_text || localEntry?.lemma} 
            />
          ) : activeTab === 'analysis' ? (
            // Fallback for Analysis if needed (can be customized)
            <div className="p-8 text-center text-slate-500">Analysis content would appear here</div>
          ) : activeTab === 'scholarly' ? (
            <div className="p-8 md:p-10 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dictionary Entry</h4>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              
              <div className="lexicon-rich-content">
                {/* 1. SEFARIA LIVE DATA (If available) */}
                {sefariaEntries.length > 0 && (
                  <div className="space-y-6 mb-8">
                    <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <Globe size={14} /> Sefaria API Results
                    </h4>
                    {sefariaEntries.map((def, i) => (
                      <div key={i} className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-3">
                           <span className="font-bold text-lg font-hebrew text-indigo-600 dark:text-indigo-400" dir="rtl">{def.headword}</span>
                           <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded uppercase tracking-widest">{def.source}</span>
                        </div>
                        <SmartText text={def.content} isHtml={true} onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))} className="prose prose-slate dark:prose-invert max-w-none text-sm leading-[1.8]" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. LOCAL DB DATA */}
                {localEntry?.long_def ? (
                  <SmartText text={localEntry.long_def} isHtml={true} onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))} referenceVariant="subtle" hideReferenceIcon={true} className="prose prose-slate dark:prose-invert max-w-none text-base leading-[1.8] font-serif text-left selection:bg-indigo-100 dark:selection:bg-indigo-900/50" />
                ) : sefariaEntries.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800"><Info className="mx-auto h-8 w-8 text-slate-300 mb-4" /><p className="text-sm text-slate-500 italic">Detailed scholarly entry pending review.</p></div>
                ) : null}
              </div>
            </div>
          ) : (
            <ReferencesTab 
              references={references} 
              loading={occLoading} 
              hasMore={hasMore} 
              referenceCount={referenceCount} 
              loaderRef={loaderRef} 
              highlightStrongs={isUnmappedText ? (isGreek ? 'G_NONE' : 'H_NONE') : searchId} 
              onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))} 
              onWordClick={(w) => { window.dispatchEvent(new CustomEvent('lexicon-pivot', { detail: w.strongs })); }} 
            />
          )}
        </div>

        <div className="flex-none px-8 py-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 flex justify-center items-center relative z-20">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Lexical Archive v2.5 (Sefaria Linked)</p>
        </div>
      </div>
    </div>
  );
};