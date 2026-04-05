// Path: src/features/lexicon/ui/LexiconModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Info } from 'lucide-react';
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

// Refactored Sub-components & Libs
import { getAffixSound, decodeMorphology, analyzeHebrewAffixes, AffixAnalysis } from '../lib/morphology';
import { LexiconHeader } from './LexiconHeader';
import { LexiconTabs } from './LexiconTabs';

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
  const [activeTab, setActiveTab] = useState<'definition' | 'scholarly' | 'references'>('definition');
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [occLoading, setOccLoading] = useState(false);
  
  const [localEntry, setLocalEntry] = useState<(LexiconEntry & { root_id?: string | null }) | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceCount, setReferenceCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const PAGE_SIZE = 15;
  const loaderRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null); 

  const searchId = useMemo(() => getNormalizedStrongsId(strongsNumber), [strongsNumber]);
  const isGreek = searchId?.startsWith('G');

  useEffect(() => {
    if (contentAreaRef.current) contentAreaRef.current.scrollTop = 0;
  }, [searchId]);

  const fetchFullData = useCallback(async () => {
    if (!searchId) return;
    setLoadingLocal(true);
    try {
      const { data, error } = await supabase.from('lexicon').select('*').eq('id', searchId).single();
      if (data && !error) setLocalEntry(data);
      else setLocalEntry({ id: searchId, lemma: 'Unknown', transliteration: 'N/A', pronunciation: 'N/A', short_def: 'No definition found.', long_def: null, root_id: null });
    } catch (e) { console.error("Lexicon Fetch Error:", e); } finally { setLoadingLocal(false); }
  }, [searchId]);

  const fetchReferences = useCallback(async (page: number, append: boolean = false) => {
    if (!searchId) return;
    setOccLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { data, count, error } = await supabase.from('reader_verses_view')
        .select('book_id, chapter_num, verse_num, text_he, text_en, words', { count: 'exact' })
        .filter('words', 'cs', JSON.stringify([{ strongs: searchId }])).order('id', { ascending: true }).range(from, to);
      
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
    } catch (e) { console.error("References Fetch Error:", e); } finally { setOccLoading(false); }
  }, [searchId]);

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
    if (wordContext?.meaning) {
      wordContext.meaning.split(/[,;]/).forEach(m => {
        const clean = m.replace(/[\[\]]/g, '').trim();
        if (clean.length > 1) pills.set(clean.toLowerCase(), clean);
      });
    }
    if (localEntry?.short_def) {
      const raw = localEntry.short_def.replace(/×/g, '').replace(/\([^)]*-[^)]*\)/g, '').replace(/\([^)]*\)/g, '').replace(/\./g, ''); 
      raw.split(',').forEach(item => {
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

  const formattedPronunciation = useMemo(() => {
    const base = localEntry?.pronunciation !== 'N/A' ? localEntry?.pronunciation : localEntry?.transliteration;
    if (!base || base === 'N/A') return null;
    
    if (wordContext?.text?.includes('/')) {
      const parts = wordContext.text.split('/');
      const rootIdx = parts.reduce((max, p, i) => 
        p.replace(/[\u0591-\u05C7]/g, '').length > parts[max].replace(/[\u0591-\u05C7]/g, '').length ? i : max, 0);
      
      const pre = parts.slice(0, rootIdx).map(p => getAffixSound(p, true)).join('');
      const suf = parts.slice(rootIdx + 1).map(p => getAffixSound(p, false)).join('');
      
      return (
        <span className="capitalize font-sans tracking-tight flex items-baseline">
          {pre && <span className="font-black text-indigo-700 dark:text-indigo-300 opacity-90 mr-0.5">{pre}</span>}
          <span className="font-semibold">{base.replace(/^-|-$/g, '')}</span>
          {suf && <span className="font-black text-indigo-700 dark:text-indigo-300 opacity-90 ml-0.5">{suf}</span>}
        </span>
      );
    }
    return <span className="capitalize font-sans font-semibold tracking-tight">{base}</span>;
  }, [localEntry, wordContext]);

  if (!isOpen || !strongsNumber) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-slate-950 rounded-t-4xl sm:rounded-3xl shadow-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 w-full sm:w-135 sm:max-w-xl h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col relative z-10 overflow-hidden">
        
        <LexiconHeader 
          searchId={searchId} isGreek={isGreek} loading={loadingLocal}
          displayWord={wordContext?.text || wordContext?.root_text || localEntry?.lemma || 'Unknown'}
          formattedPronunciation={formattedPronunciation}
          rootId={localEntry?.root_id} originId={localEntry?.origin_id}
          onClose={onClose} 
          onOriginClick={(id) => { window.dispatchEvent(new CustomEvent('lexicon-pivot', { detail: id })); }}
        />

        <LexiconTabs activeTab={activeTab} setActiveTab={setActiveTab} referenceCount={referenceCount} />

        <div ref={contentAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide bg-white dark:bg-slate-950 relative z-30">
          {activeTab === 'definition' ? (
            <DefinitionView 
                usagePills={usagePills} 
                contextualMeaning={wordContext?.meaning} 
                morphologyDetails={morphologyDetails}
                affixAnalysis={affixAnalysis}
                lemma={wordContext?.root_text || localEntry?.lemma} // Passing lemma for the new title
            />
          ) : activeTab === 'scholarly' ? (
            <div className="p-8 md:p-10 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dictionary Entry</h4>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="lexicon-rich-content">
                {localEntry?.long_def ? <SmartText text={localEntry.long_def} isHtml={true} onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))} referenceVariant="subtle" hideReferenceIcon={true} className="prose prose-slate dark:prose-invert max-w-none text-base leading-[1.8] font-serif text-left selection:bg-indigo-100 dark:selection:bg-indigo-900/50" />
                : <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800"><Info className="mx-auto h-8 w-8 text-slate-300 mb-4" /><p className="text-sm text-slate-500 italic">Detailed scholarly entry pending review.</p></div>}
              </div>
            </div>
          ) : (
            <ReferencesTab references={references} loading={occLoading} hasMore={hasMore} referenceCount={referenceCount} loaderRef={loaderRef} highlightStrongs={searchId} onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))} onWordClick={(w) => { window.dispatchEvent(new CustomEvent('lexicon-pivot', { detail: w.strongs })); }} />
          )}
        </div>

        <div className="flex-none px-8 py-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 flex justify-center items-center relative z-20">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Lexical Archive v2.4</p>
        </div>
      </div>
    </div>
  );
};