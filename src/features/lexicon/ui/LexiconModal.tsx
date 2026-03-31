// Path: src/features/lexicon/ui/LexiconModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Book, Hash, List, Volume2, PencilLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/shared/api/supabase';

// Internal Imports
import { LexiconEntry } from '../model/types';
import { getNormalizedStrongsId } from '../lib/lexicon-utils';
import { DefinitionTab } from './DefinitionTab';
import { ReferencesTab, ReferenceItem } from './ReferencesTab';
import { VerseWord } from '@/entities/verse/ui/VerseCard';
import { getVersePath } from '@/shared/lib/reference-navigation';

interface LexiconModalProps {
  strongsNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
  verseTranslation?: string;
}

interface ViewVerseResponse {
  book_id: string;
  chapter_num: number;
  verse_num: number;
  text_he: string;
  text_en?: string | null;
  words: VerseWord[];
}

export const LexiconModal = ({ strongsNumber, isOpen, onClose, verseTranslation = "" }: LexiconModalProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'definition' | 'references'>('definition');
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [occLoading, setOccLoading] = useState(false);
  const [localEntry, setLocalEntry] = useState<LexiconEntry | null>(null);
  
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceCount, setReferenceCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const PAGE_SIZE = 15;
  const loaderRef = useRef<HTMLDivElement>(null);
  const searchId = useMemo(() => getNormalizedStrongsId(strongsNumber), [strongsNumber]);

  const fetchFullData = useCallback(async () => {
    if (!searchId) return;
    setLoadingLocal(true);
    try {
      const { data: localData, error } = await supabase
        .from('lexicon')
        .select('*')
        .eq('id', searchId)
        .single();
        
      if (localData && !error) {
        setLocalEntry(localData as LexiconEntry);
      } else {
        setLocalEntry({
          id: searchId, lemma: 'Unknown', transliteration: 'N/A', pronunciation: 'N/A',
          short_def: 'No definition found.', long_def: null
        });
      }
    } catch (error) {
      console.error("Local Dictionary Error:", error);
    } finally {
      setLoadingLocal(false);
    }
  }, [searchId]);

  const fetchReferences = useCallback(async (page: number, append: boolean = false) => {
    if (!searchId) return;
    setOccLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data: occData, count, error } = await supabase
        .from('reader_verses_view')
        .select('book_id, chapter_num, verse_num, text_he, text_en, words', { count: 'exact' })
        .filter('words', 'cs', JSON.stringify([{ strongs: searchId }]))
        .order('id', { ascending: true }) 
        .range(from, to); 

      if (error) throw error;

      if (occData) {
        const typedData = occData as unknown as ViewVerseResponse[];
        const newRefs: ReferenceItem[] = typedData.map((v) => ({
          book_name: v.book_id || 'Unknown',
          chapter_number: v.chapter_num || 0,
          verse_number: v.verse_num || 0,
          text: v.text_he,
          translation: v.text_en || 'Translation unavailable',
          words: v.words 
        }));
        
        if (append) setReferences(prev => [...prev, ...newRefs]);
        else setReferences(newRefs);
        
        setReferenceCount(count || 0);
        setHasMore(from + (occData?.length || 0) < (count || 0));
      }
    } catch (err) {
      console.error("Top-level References exception:", err);
    } finally {
      setOccLoading(false);
    }
  }, [searchId]);

  useEffect(() => {
    if (isOpen && searchId) {
      setActiveTab('definition');
      setCurrentPage(1);
      setReferences([]);
      setHasMore(true);
      fetchFullData();
      fetchReferences(1, false);
    }
  }, [isOpen, searchId, fetchFullData, fetchReferences]);

  useEffect(() => {
    if (activeTab !== 'references' || !hasMore || occLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        fetchReferences(nextPage, true);
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [activeTab, hasMore, occLoading, currentPage, fetchReferences]);

  const handleReferenceJump = (book: string, chapter: number, verse: number) => {
    onClose();
    router.push(getVersePath(book, chapter, verse));
  };

  const usagePills = useMemo(() => {
    if (!localEntry?.short_def) return [];
    let raw = localEntry.short_def;
    raw = raw.replace(/×/g, '').replace(/\([^)]*-[^)]*\)/g, '').replace(/\([^)]*\)/g, ''); 
    const pills = new Set<string>();
    raw.split(',').forEach(item => {
      const cleanItem = item.trim();
      if (cleanItem.length > 1 && !['and', 'or', 'the', 'of', 'to'].includes(cleanItem.toLowerCase())) pills.add(cleanItem);
    });
    const cleanTrans = verseTranslation.toLowerCase().replace(/[.,!?;:()"]/g, '');
    return Array.from(pills).map(label => {
      const lowerLabel = label.toLowerCase();
      const isContextual = cleanTrans.includes(lowerLabel) || (lowerLabel.length > 3 && cleanTrans.split(' ').some(w => w.startsWith(lowerLabel)));
      return { label: label.charAt(0).toUpperCase() + label.slice(1), isContextual };
    }).sort((a, b) => (a.isContextual === b.isContextual ? a.label.localeCompare(b.label) : a.isContextual ? -1 : 1));
  }, [localEntry, verseTranslation]);

  if (!isOpen || !strongsNumber) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 overflow-hidden">
      {/* Invisible click-away backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-950 rounded-t-4xl sm:rounded-3xl shadow-2xl ring-1 ring-slate-200/50 dark:ring-slate-800/50 w-full sm:w-135 sm:max-w-xl h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col relative z-10">
        
        {/* Header Section */}
        <div className="flex-none px-6 sm:px-8 py-6 sm:py-8 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between rounded-t-4xl sm:rounded-t-3xl relative z-20">
          <div className="space-y-3 sm:space-y-4 max-w-[80%]">
            <div className="flex items-center gap-3">
               <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[10px] sm:text-xs font-bold font-mono border border-slate-200 dark:border-slate-700 shadow-sm tabular-nums">
                <Hash size={12} className="text-indigo-500" /> {searchId}
               </span>
               <span className="hidden sm:inline text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Lexicon Archive</span>
            </div>
            
            {loadingLocal ? (
              <div className="h-14 animate-pulse bg-slate-200 dark:bg-slate-800 w-48 rounded-2xl" />
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-8 gap-y-3">
                <h1 className="text-4xl sm:text-5xl font-serif text-slate-900 dark:text-white leading-none" dir="rtl">{localEntry?.lemma}</h1>
                <div className="flex flex-wrap gap-2">
                  {localEntry?.transliteration && localEntry.transliteration !== 'N/A' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-800/50 self-start shadow-sm">
                      <PencilLine size={12} />
                      <span className="text-sm sm:text-base font-mono font-bold tracking-wider uppercase">{localEntry.transliteration}</span>
                    </div>
                  )}
                  {localEntry?.pronunciation && localEntry.pronunciation !== 'N/A' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800/50 self-start shadow-sm">
                      <Volume2 size={12} />
                      <span className="text-sm sm:text-base font-sans font-semibold tracking-tight">{localEntry.pronunciation}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={onClose} 
            title="Close Lexicon"
            aria-label="Close Lexicon"
            className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm border border-slate-100 dark:border-slate-700 active:scale-90 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 sm:px-10 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 relative z-20">
          <button 
            onClick={() => setActiveTab('definition')} 
            title="View Dictionary Definition"
            aria-label="View Dictionary Definition"
            className={`flex items-center gap-2.5 px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === 'definition' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Book size={16} /> Dictionary
            {activeTab === 'definition' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full animate-in fade-in" />}
          </button>
          <button 
            onClick={() => setActiveTab('references')} 
            title="View Bible References"
            aria-label="View Bible References"
            className={`flex items-center gap-2.5 px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] transition-all relative ${activeTab === 'references' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={16} /> References
            {referenceCount > 0 && <span className="ml-1 px-2 py-0.5 rounded-lg text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold font-mono tabular-nums">{referenceCount}</span>}
            {activeTab === 'references' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full animate-in fade-in" />}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide bg-white dark:bg-slate-950 relative z-30">
          {activeTab === 'definition' ? (
            <DefinitionTab usagePills={usagePills} longDef={localEntry?.long_def} verseTranslation={verseTranslation} />
          ) : (
            <ReferencesTab 
              references={references} 
              loading={occLoading} 
              hasMore={hasMore} 
              referenceCount={referenceCount} 
              loaderRef={loaderRef} 
              highlightStrongs={searchId} 
              onReferenceClick={handleReferenceJump} 
              onWordClick={(s) => { 
                onClose(); 
                setTimeout(() => window.dispatchEvent(new CustomEvent('lexicon-pivot', { detail: s })), 100); 
              }} 
            />
          )}
        </div>

        {/* Modal Footer: Simple Attribution */}
        <div className="flex-none px-8 py-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 flex justify-center items-center relative z-20">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">
            Source Data: BDB & Strong&rsquo;s Biblical Hebrew Dictionary (CC)
          </p>
        </div>
      </div>
    </div>
  );
};