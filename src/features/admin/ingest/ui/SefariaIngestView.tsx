// Path: src/features/admin/ingest/ui/SefariaIngestView.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FolderTree, BookType, Terminal, Loader2, CheckSquare, Square, Play, RefreshCw, Layers, ListOrdered } from 'lucide-react';
import { supabase } from '@/shared/api/supabase';

const SEFARIA_BOOKS_URL = "https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json";
const SEFARIA_INDEX_URL = "https://www.sefaria.org/api/index";

// --- Types for Canonical Index ---
interface SefariaIndexNode {
  category?: string;
  title?: string;
  heTitle?: string;
  order?: number;
  contents?: SefariaIndexNode[];
}

// --- Types for Export Catalog ---
interface SefariaExportBook {
  title: string;
  language: string;
  versionTitle: string;
  categories: string[];
  json_url: string;
}

interface ConsolidatedBook {
  title: string;
  heTitle?: string;
  collection: string;
  category: string;
  order: number;
  enUrls: string[];
  heUrls: string[];
}

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'progress';
  timestamp: Date;
}

export const SefariaIngestView = () => {
  // Data Sources
  const [exportCatalog, setExportCatalog] = useState<SefariaExportBook[]>([]);
  const [canonicalIndex, setCanonicalIndex] = useState<SefariaIndexNode[]>([]);
  
  // Selections
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());

  // Search & Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [isReingest, setIsReingest] = useState(false);

  // Status
  const [isIngesting, setIsIngesting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentBookProgress, setCurrentBookProgress] = useState(0);
  const [totalBooksProcessed, setTotalBooksProcessed] = useState(0);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'progress' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), message, type, timestamp: new Date() }]);
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // 1. Dual Fetch: Load Export URLs and Canonical Order Index
  useEffect(() => {
    const fetchData = async () => {
      addLog("Initializing Sefaria sync engines...", "info");
      try {
        const [exportRes, indexRes] = await Promise.all([
          fetch(SEFARIA_BOOKS_URL),
          fetch(SEFARIA_INDEX_URL)
        ]);

        const exportData = await exportRes.json();
        const indexData = await indexRes.json();

        // FIX: Remove 'merged' filter so we can access Sefaria's recommended 
        // compiled texts, especially for Apocrypha works.
        const validExports = exportData.books as SefariaExportBook[];

        setExportCatalog(validExports);
        setCanonicalIndex(indexData);
        addLog(`Engines ready. Indexed ${indexData.length} top-level collections.`, "success");
      } catch {
        addLog("Failed to reach Sefaria API. Check network connection.", "error");
      }
    };
    fetchData();
  }, []);

  // 2. Hierarchical Resolvers (Collections sorted by order)
  const collections = useMemo(() => {
    return [...canonicalIndex]
      .filter(node => node.category)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [canonicalIndex]);

  const categories = useMemo(() => {
    if (!selectedCollection) return [];
    const colNode = collections.find(c => c.category === selectedCollection);
    if (!colNode || !colNode.contents) return [];

    return colNode.contents
      .filter(node => node.category)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [selectedCollection, collections]);

  // 3. Resolve and Consolidate Books in Category
  const books = useMemo(() => {
    if (!selectedCollection || !selectedCategory) return [];
    
    const colNode = collections.find(c => c.category === selectedCollection);
    const catNode = colNode?.contents?.find(c => c.category === selectedCategory);
    
    if (!catNode || !catNode.contents) return [];

    const canonicalBooks = catNode.contents
      .filter(node => node.title)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return canonicalBooks.map(cb => {
      const exports = exportCatalog.filter(eb => eb.title === cb.title);
      
      // Prioritize Sefaria's "merged" files as the top choice for URL arrays
      const sortByMerged = (a: SefariaExportBook, b: SefariaExportBook) => {
        const aMerged = a.versionTitle.toLowerCase().includes('merged');
        const bMerged = b.versionTitle.toLowerCase().includes('merged');
        if (aMerged && !bMerged) return -1;
        if (!aMerged && bMerged) return 1;
        return 0;
      };
      
      return {
        title: cb.title!,
        heTitle: cb.heTitle,
        collection: selectedCollection,
        category: selectedCategory,
        order: cb.order || 0,
        enUrls: exports.filter(e => e.language === 'English' || e.language === 'en')
                       .sort(sortByMerged)
                       .map(e => e.json_url),
        heUrls: exports.filter(e => e.language === 'Hebrew' || e.language === 'he')
                       .sort(sortByMerged)
                       .map(e => e.json_url)
      } as ConsolidatedBook;
    }).filter(b => b.heUrls.length > 0 || b.enUrls.length > 0); // Allow books that ONLY have English!
  }, [selectedCollection, selectedCategory, collections, exportCatalog]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return books;
    return books.filter(b => b.title.toLowerCase().includes(q));
  }, [searchQuery, books]);

  const toggleBookSelection = (title: string) => {
    setSelectedBooks(prev => {
      const n = new Set(prev);
      if (n.has(title)) n.delete(title);
      else n.add(title);
      return n;
    });
  };

  const handleIngest = async () => {
    if (selectedBooks.size === 0) return;
    setIsIngesting(true);
    setTotalBooksProcessed(0);
    setCurrentBookProgress(0);
    setLogs([]); 

    const booksToProcess = books.filter(b => selectedBooks.has(b.title));
    addLog(`Initiating pipeline for ${booksToProcess.length} books in canonical order...`, "info");

    try {
      await supabase.from('collection_configs').upsert({ id: selectedCollection }, { onConflict: 'id' });
      await supabase.from('category_configs').upsert({ 
        collection_id: selectedCollection, 
        name_en: selectedCategory 
      }, { onConflict: 'collection_id, name_en' });
    } catch {
      addLog("Metadata registration failed, continuing...", "info");
    }

    let existingTitles = new Set<string>();
    if (!isReingest) {
      const { data } = await supabase.from('books').select('name_en').eq('collection', selectedCollection);
      if (data) existingTitles = new Set(data.map(d => d.name_en));
    }

    for (const book of booksToProcess) {
      if (!isReingest && existingTitles.has(book.title)) {
        addLog(`Skipped ${book.title}: Already exists in database.`, "info");
        setTotalBooksProcessed(prev => prev + 1);
        continue;
      }

      // --- NEW LOGGING TO EXPOSE JSON URLs ---
      addLog(`🔍 Debug URL (HE): ${book.heUrls[0] || 'None'}`, "progress");
      addLog(`🔍 Debug URL (EN): ${book.enUrls[0] || 'None'}`, "progress");

      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success) {
        attempts++;
        setCurrentBookProgress(0);
        if (attempts > 1) await new Promise(r => setTimeout(r, 5000));

        try {
          const response = await fetch('/api/admin/ingest/sefaria', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(book) 
          });

          if (!response.body) throw new Error("No response stream available.");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  addLog(data.message, data.type);
                  if (data.progress !== undefined) setCurrentBookProgress(data.progress);
                  if (data.type === 'success') success = true;
                } catch (err) { console.error("Stream parse error", err); }
              }
            }
          }
          if (success) {
            setTotalBooksProcessed(prev => prev + 1);
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (err) {
          addLog(`Interrupt on ${book.title}: ${err instanceof Error ? err.message : String(err)}`, "error");
          if (attempts >= maxAttempts) setTotalBooksProcessed(prev => prev + 1);
        }
      }
    }
    setIsIngesting(false);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[75vh]">
      {/* SELECTION PANELS */}
      <div className="xl:col-span-5 flex flex-col gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <ListOrdered size={16} className="text-blue-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Canonical Selector</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="collection-select" className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">1. Collection</label>
              <div className="relative">
                <FolderTree size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  id="collection-select"
                  title="Select Sefaria Collection"
                  aria-label="Select Sefaria Collection"
                  value={selectedCollection} 
                  onChange={(e) => { setSelectedCollection(e.target.value); setSelectedCategory(''); setSelectedBooks(new Set()); }}
                  disabled={isIngesting || collections.length === 0}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none cursor-pointer appearance-none"
                >
                  <option value="">Select Collection (Ordered)...</option>
                  {collections.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category-select" className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">2. Category</label>
              <div className="relative">
                <BookType size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  id="category-select"
                  title="Select Sefaria Category"
                  aria-label="Select Sefaria Category"
                  value={selectedCategory} 
                  onChange={(e) => { setSelectedCategory(e.target.value); setSelectedBooks(new Set()); }}
                  disabled={isIngesting || !selectedCollection}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none cursor-pointer appearance-none"
                >
                  <option value="">Select Category (Ordered)...</option>
                  {categories.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[50vh]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Search size={16} className="text-indigo-500" />
                3. Select Books
              </h3>
              {filteredBooks.length > 0 && (
                <button 
                  onClick={() => setSelectedBooks(selectedBooks.size === filteredBooks.length ? new Set() : new Set(filteredBooks.map(b => b.title)))} 
                  disabled={isIngesting}
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors disabled:opacity-50"
                >
                  {selectedBooks.size === filteredBooks.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            <div className="relative group">
              <label htmlFor="book-search-input" className="sr-only">Search books in category</label>
              <Search size={16} className={`absolute left-4 top-3 transition-colors z-10 ${searchQuery ? 'text-indigo-500' : 'text-slate-400'}`} />
              <input 
                id="book-search-input" 
                title="Search books in this category"
                aria-label="Search books in this category"
                placeholder="Search books..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none shadow-sm" 
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            {filteredBooks.length === 0 ? (
               <div className="h-full flex items-center justify-center text-slate-400 text-xs italic opacity-70">
                 Select a category to view books in Sefaria order.
               </div>
            ) : (
              <div className="space-y-1">
                {filteredBooks.map(book => (
                  <button
                    key={book.title}
                    onClick={() => toggleBookSelection(book.title)}
                    disabled={isIngesting}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all disabled:opacity-50 ${
                      selectedBooks.has(book.title) 
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/50' 
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-left flex items-center gap-3">
                       <span className="text-[9px] font-mono text-slate-400 w-4">{book.order}</span>
                       <span className={`font-bold ${selectedBooks.has(book.title) ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {book.title}
                      </span>
                    </div>
                    {selectedBooks.has(book.title) ? <CheckSquare size={18} className="text-indigo-500" /> : <Square size={18} className="text-slate-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TERMINAL & ACTIONS */}
      <div className="xl:col-span-7 flex flex-col gap-4">
        <div className="h-80 bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden font-mono text-sm ring-1 ring-white/10">
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
            <Terminal size={14} className="text-emerald-500" />
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">DrashX Ingestion Relay</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto text-slate-300 space-y-1.5 text-xs select-text">
            {logs.length === 0 && <span className="opacity-50">Awaiting canonical commands...</span>}
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-slate-600 shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
                {log.message.startsWith('http') ? (
                  <a href={log.message} target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all">
                    {log.message}
                  </a>
                ) : (
                  <span className={`${log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-rose-400' : log.type === 'progress' ? 'text-blue-400' : 'text-slate-300'} break-all`}>
                    {log.message}
                  </span>
                )}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isReingest ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                 {isReingest ? <RefreshCw size={16} /> : <Layers size={16} />}
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-900 dark:text-white">{isReingest ? 'Re-ingest Mode' : 'Detect Mode'}</p>
                <p className="text-[10px] text-slate-500">{isReingest ? 'Overwrite existing records' : 'Skip already synced books'}</p>
              </div>
           </div>
           <label htmlFor="reingest-toggle" className="relative inline-flex items-center cursor-pointer">
              <input 
                id="reingest-toggle" 
                title="Enable Re-ingest mode (overwrite existing records)"
                aria-label="Enable Re-ingest mode"
                type="checkbox" 
                className="sr-only peer" 
                checked={isReingest} 
                onChange={(e) => setIsReingest(e.target.checked)} 
                disabled={isIngesting} 
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
           </label>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 w-full space-y-3">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Progress</span>
                <span className="text-blue-500">{currentBookProgress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${currentBookProgress}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Overall</span>
                <span className="text-emerald-500">{selectedBooks.size > 0 ? Math.round((totalBooksProcessed / selectedBooks.size) * 100) : 0}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${selectedBooks.size > 0 ? (totalBooksProcessed / selectedBooks.size) * 100 : 0}%` }} />
              </div>
            </div>

            <button onClick={handleIngest} disabled={isIngesting || selectedBooks.size === 0} className="shrink-0 flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg disabled:opacity-40 transition-all">
              {isIngesting ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
              {isIngesting ? 'Syncing...' : 'Run Pipeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};