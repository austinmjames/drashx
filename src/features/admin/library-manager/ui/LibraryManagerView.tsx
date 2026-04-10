// Path: src/features/admin/library-manager/ui/LibraryManagerView.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Library, FolderTree, Book as BookIcon, 
  Loader2, Eye, Clock, 
  ListOrdered, CheckCircle2, AlertCircle, Trash2, AlertTriangle, 
  Pencil, Move
} from 'lucide-react';
import { supabase } from '@/shared/api/supabase';

interface CollectionConfig { id: string; order_id: number; visibility_status: string; }
interface CategoryConfig { id: string; collection_id: string; name_en: string; order_id: number; visibility_status: string; }
interface BookRow { id: string; name_en: string; category: string; collection: string; order_id: number; visibility_status: string; }

export const LibraryManagerView = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data State
  const [collections, setCollections] = useState<CollectionConfig[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [books, setBooks] = useState<BookRow[]>([]);

  // Navigation Selection
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async (retryCount = 0) => {
      if (retryCount === 0) setLoading(true);
      try {
        const [colRes, catRes, bookRes] = await Promise.all([
          supabase.from('collection_configs').select('*').order('order_id'),
          supabase.from('category_configs').select('*').order('order_id'),
          supabase.from('books').select('*').order('order_id')
        ]);

        if (colRes.error) throw colRes.error;
        if (catRes.error) throw catRes.error;
        if (bookRes.error) throw bookRes.error;

        if (isMounted) {
          setCollections(colRes.data || []);
          setCategories(catRes.data || []);
          setBooks(bookRes.data || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Catch Supabase Auth Lock errors and retry with exponential backoff
        if ((errorMsg.includes('AbortError') || errorMsg.includes('Lock broken') || errorMsg.includes('steal')) && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 500 + Math.random() * 500;
          setTimeout(() => {
            if (isMounted) fetchData(retryCount + 1);
          }, delay);
          return;
        }

        console.error("Error fetching library management data:", err);
        if (isMounted) {
          setError("Failed to load library management data.");
          setLoading(false);
        }
      }
    };

    // Slight initial delay to prevent concurrent mount contention
    const timer = setTimeout(() => {
      if (isMounted) fetchData(0);
    }, Math.random() * 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleRename = async (type: 'col' | 'cat' | 'book', id: string) => {
    const newValue = editValue.trim();
    if (!newValue) return setEditingId(null);
    
    setSaving(id);
    try {
      if (type === 'col') {
        const { error: err } = await supabase.from('collection_configs').update({ id: newValue }).eq('id', id);
        if (err) throw err;
        setCollections(prev => prev.map(c => c.id === id ? { ...c, id: newValue } : c));
        if (selectedCol === id) setSelectedCol(newValue);
      } 
      else if (type === 'cat') {
        const oldCatName = categories.find(c => c.id === id)?.name_en;
        const { error: err } = await supabase.from('category_configs').update({ name_en: newValue }).eq('id', id);
        if (err) throw err;
        
        await supabase.from('books').update({ category: newValue }).eq('collection', selectedCol).eq('category', oldCatName);
        
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name_en: newValue } : c));
        setBooks(prev => prev.map(b => b.collection === selectedCol && b.category === oldCatName ? { ...b, category: newValue } : b));
      } 
      else {
        const { error: err } = await supabase.from('books').update({ name_en: newValue }).eq('id', id);
        if (err) throw err;
        setBooks(prev => prev.map(b => b.id === id ? { ...b, name_en: newValue } : b));
      }

      setSuccess("Renamed successfully.");
      setEditingId(null);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleMoveCategory = async (catId: string, newCollectionId: string) => {
    setSaving(catId);
    try {
      const catToMove = categories.find(c => c.id === catId);
      if (!catToMove) throw new Error("Category not found");

      const { error: err } = await supabase.from('category_configs').update({ collection_id: newCollectionId }).eq('id', catId);
      if (err) throw err;
      
      // Also move all books in this category to the new collection
      const { error: bookErr } = await supabase.from('books')
        .update({ collection: newCollectionId })
        .eq('collection', catToMove.collection_id)
        .eq('category', catToMove.name_en);
      if (bookErr) throw bookErr;

      setCategories(prev => prev.map(c => c.id === catId ? { ...c, collection_id: newCollectionId } : c));
      setBooks(prev => prev.map(b => (b.collection === catToMove.collection_id && b.category === catToMove.name_en) ? { ...b, collection: newCollectionId } : b));
      
      setSuccess("Category moved.");
      if (selectedCat === catId && selectedCol !== newCollectionId) {
          setSelectedCat(null); // Deselect if moved out of current view
      }
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleMoveBook = async (bookId: string, newCategoryName: string) => {
    setSaving(bookId);
    try {
      const { error: err } = await supabase.from('books').update({ category: newCategoryName }).eq('id', bookId);
      if (err) throw err;
      setBooks(prev => prev.map(b => b.id === bookId ? { ...b, category: newCategoryName } : b));
      setSuccess("Book moved.");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (type: 'col' | 'cat' | 'book', id: string, extraParam?: string) => {
    setDeleting(id);
    try {
      if (type === 'col') {
        const { error: err } = await supabase.rpc('delete_collection_cascade', { p_collection_id: id });
        if (err) throw err;
        setCollections(prev => prev.filter(c => c.id !== id));
        if (selectedCol === id) { setSelectedCol(null); setSelectedCat(null); }
      } else if (type === 'cat') {
        const { error: err } = await supabase.rpc('delete_category_cascade', { p_collection_id: selectedCol, p_category_name: extraParam });
        if (err) throw err;
        setCategories(prev => prev.filter(c => c.id !== id));
        setBooks(prev => prev.filter(b => !(b.collection === selectedCol && b.category === extraParam)));
        if (selectedCat === id) setSelectedCat(null);
      } else {
        const { error: err } = await supabase.rpc('delete_book_cascade', { p_book_id: id });
        if (err) throw err;
        setBooks(prev => prev.filter(b => b.id !== id));
      }
      setSuccess(`Deleted successfully.`);
      setConfirmDelete(null);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  };

  const updateStatus = async (type: 'col' | 'cat' | 'book', id: string, status: string) => {
    setSaving(id);
    try {
      const table = type === 'col' ? 'collection_configs' : type === 'cat' ? 'category_configs' : 'books';
      const { error: err } = await supabase.from(table).update({ visibility_status: status }).eq('id', id);
      if (err) throw err;
      
      if (type === 'col') setCollections(prev => prev.map(c => c.id === id ? { ...c, visibility_status: status } : c));
      if (type === 'cat') setCategories(prev => prev.map(c => c.id === id ? { ...c, visibility_status: status } : c));
      if (type === 'book') setBooks(prev => prev.map(b => b.id === id ? { ...b, visibility_status: status } : b));
      
      setSuccess(`Updated status.`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const updateOrder = async (type: 'col' | 'cat' | 'book', id: string, val: string) => {
    const orderId = parseInt(val, 10);
    if (isNaN(orderId)) return;
    setSaving(id);
    try {
      const table = type === 'col' ? 'collection_configs' : type === 'cat' ? 'category_configs' : 'books';
      const { error: err } = await supabase.from(table).update({ order_id: orderId }).eq('id', id);
      if (err) throw err;
      if (type === 'col') setCollections(prev => prev.map(c => c.id === id ? { ...c, order_id: orderId } : c).sort((a,b) => a.order_id - b.order_id));
      if (type === 'cat') setCategories(prev => prev.map(c => c.id === id ? { ...c, order_id: orderId } : c).sort((a,b) => a.order_id - b.order_id));
      if (type === 'book') setBooks(prev => prev.map(b => b.id === id ? { ...b, order_id: orderId } : b).sort((a,b) => a.order_id - b.order_id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  const StatusPill = ({ status, onToggle }: { status: string, onToggle: (s: string) => void }) => {
    const config: Record<string, { icon: React.ElementType, color: string, label: string }> = {
      'default': { icon: Eye, color: 'bg-emerald-100 text-emerald-700', label: 'Default' },
      'extended': { icon: FolderTree, color: 'bg-indigo-100 text-indigo-700', label: 'Extended' },
      'coming-soon': { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Soon' }
    };
    const c = config[status] || config['extended'];
    const Icon = c.icon;
    return (
      <button 
        onClick={() => {
          const next = status === 'default' ? 'extended' : status === 'extended' ? 'coming-soon' : 'default';
          onToggle(next);
        }}
        title={`Change visibility status from ${status}`}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-transparent hover:border-current ${c.color}`}
      >
        <Icon size={10} strokeWidth={3} /> {c.label}
      </button>
    );
  };

  if (loading) return <div className="h-96 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={40} /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Mapping the Library...</p></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[70vh]">
      
      {/* 1. COLLECTIONS */}
      <div className="lg:col-span-3 flex flex-col gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2"><Library size={12}/> Collections</h3>
        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2 scrollbar-hide">
          {collections.map(col => (
            <div key={col.id} className={`p-4 rounded-2xl border transition-all flex flex-col gap-4 ${selectedCol === col.id ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-lg' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between gap-2">
                {editingId === col.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input 
                      autoFocus 
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleRename('col', col.id)} 
                      title="New collection name"
                      placeholder="Collection Name"
                      className="w-full bg-white dark:bg-slate-800 border border-indigo-500 rounded px-1.5 py-0.5 text-sm font-bold outline-none" 
                    />
                    <button 
                      onClick={() => handleRename('col', col.id)} 
                      title="Confirm rename"
                      className="text-emerald-500 shrink-0"
                    >
                      <CheckCircle2 size={16}/>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => { setSelectedCol(col.id); setSelectedCat(null); }} 
                      title={`Manage ${col.id} collection`}
                      className="text-sm font-black text-slate-900 dark:text-white hover:text-indigo-600 truncate w-full text-left"
                    >
                      {col.id}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                   <button 
                     onClick={() => { setEditingId(col.id); setEditValue(col.id); }} 
                     title="Rename collection"
                     className="p-1 text-slate-300 hover:text-indigo-500"
                   >
                     <Pencil size={12}/>
                   </button>
                   {confirmDelete === col.id ? (
                     <button 
                       onClick={() => handleDelete('col', col.id)} 
                       title="Confirm delete collection"
                       className="p-1 text-rose-600"
                     >
                       <AlertTriangle size={14}/>
                     </button>
                   ) : (
                    <button 
                      onClick={() => setConfirmDelete(col.id)} 
                      title="Delete collection"
                      className="p-1 text-slate-300 hover:text-rose-500"
                    >
                      <Trash2 size={12}/>
                    </button>
                   )}
                   <StatusPill status={col.visibility_status} onToggle={(s) => updateStatus('col', col.id, s)} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                <ListOrdered size={12} className="text-slate-400" />
                <input 
                  type="number" 
                  value={col.order_id} 
                  onChange={(e) => updateOrder('col', col.id, e.target.value)} 
                  title={`Order ID for ${col.id}`}
                  placeholder="0"
                  className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-bold outline-none" 
                />
              </div>
              {(saving === col.id || deleting === col.id) && <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center rounded-2xl z-10"><Loader2 className="animate-spin text-indigo-500" size={20}/></div>}
            </div>
          ))}
        </div>
      </div>

      {/* 2. CATEGORIES */}
      <div className="lg:col-span-4 flex flex-col gap-3 border-x border-slate-100 dark:border-slate-900 px-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2"><FolderTree size={12}/> Categories</h3>
        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2 scrollbar-hide">
          {!selectedCol ? (
            <div className="h-40 flex items-center justify-center text-slate-400 text-xs italic text-center opacity-50">Select collection.</div>
          ) : categories.filter(c => c.collection_id === selectedCol).map(cat => (
            <div key={cat.id} className={`p-4 rounded-2xl border transition-all flex flex-col gap-4 ${selectedCat === cat.id ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-lg' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'}`}>
               <div className="flex items-center justify-between gap-2">
                {editingId === cat.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input 
                      autoFocus 
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleRename('cat', cat.id)} 
                      title="New category name"
                      placeholder="Category Name"
                      className="w-full bg-white dark:bg-slate-800 border border-indigo-500 rounded px-1.5 py-0.5 text-sm font-bold outline-none" 
                    />
                    <button 
                      onClick={() => handleRename('cat', cat.id)} 
                      title="Confirm rename"
                      className="text-emerald-500 shrink-0"
                    >
                      <CheckCircle2 size={16}/>
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => setSelectedCat(cat.id)} 
                      title={`Select ${cat.name_en} category`}
                      className="text-sm font-black text-slate-900 dark:text-white hover:text-indigo-600 truncate w-full text-left"
                    >
                      {cat.name_en}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                   <button 
                     onClick={() => { setEditingId(cat.id); setEditValue(cat.name_en); }} 
                     title="Rename category"
                     className="p-1 text-slate-300 hover:text-indigo-500"
                   >
                     <Pencil size={12}/>
                   </button>
                   {confirmDelete === cat.id ? (
                     <button 
                       onClick={() => handleDelete('cat', cat.id, cat.name_en)} 
                       title="Confirm delete category"
                       className="p-1 text-rose-600"
                     >
                       <AlertTriangle size={14}/>
                     </button>
                   ) : (
                    <button 
                      onClick={() => setConfirmDelete(cat.id)} 
                      title="Delete category"
                      className="p-1 text-slate-300 hover:text-rose-500"
                    >
                      <Trash2 size={12}/>
                    </button>
                   )}
                   <StatusPill status={cat.visibility_status} onToggle={(s) => updateStatus('cat', cat.id, s)} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-2">
                  <ListOrdered size={12} className="text-slate-400" />
                  <input 
                    type="number" 
                    value={cat.order_id} 
                    onChange={(e) => updateOrder('cat', cat.id, e.target.value)} 
                    title={`Order ID for ${cat.name_en}`}
                    placeholder="0"
                    className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-bold outline-none" 
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Move size={12} className="text-slate-400" />
                  <select 
                    title="Move Category to Collection"
                    value={cat.collection_id} 
                    onChange={(e) => handleMoveCategory(cat.id, e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded px-2 py-0.5 outline-none cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.id}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(saving === cat.id || deleting === cat.id) && <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center rounded-2xl z-10"><Loader2 className="animate-spin text-indigo-500" size={20}/></div>}
            </div>
          ))}
        </div>
      </div>

      {/* 3. BOOKS */}
      <div className="lg:col-span-5 flex flex-col gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2"><BookIcon size={12}/> Books</h3>
        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2 scrollbar-hide">
          {!selectedCat ? (
            <div className="h-40 flex items-center justify-center text-slate-400 text-xs italic text-center opacity-50">Select category.</div>
          ) : (
            books.filter(b => b.collection === selectedCol && b.category === categories.find(c => c.id === selectedCat)?.name_en).map(book => (
              <div key={book.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {editingId === book.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          autoFocus 
                          value={editValue} 
                          onChange={(e) => setEditValue(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleRename('book', book.id)} 
                          title="New book name"
                          placeholder="Book Name"
                          className="w-full bg-white dark:bg-slate-800 border border-indigo-500 rounded px-1.5 py-0.5 text-sm font-bold outline-none" 
                        />
                        <button 
                          onClick={() => handleRename('book', book.id)} 
                          title="Confirm rename"
                          className="text-emerald-500 shrink-0"
                        >
                          <CheckCircle2 size={16}/>
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{book.name_en}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => { setEditingId(book.id); setEditValue(book.name_en); }} 
                      title="Rename book"
                      className="p-1 text-slate-300 hover:text-indigo-500"
                    >
                      <Pencil size={12}/>
                    </button>
                    {confirmDelete === book.id ? (
                      <button 
                        onClick={() => handleDelete('book', book.id)} 
                        title="Confirm delete book"
                        className="p-1 text-rose-600"
                      >
                        <AlertTriangle size={14}/>
                      </button>
                    ) : (
                      <button 
                        onClick={() => setConfirmDelete(book.id)} 
                        title="Delete book"
                        className="p-1 text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 size={12}/>
                      </button>
                    )}
                    <StatusPill status={book.visibility_status} onToggle={(s) => updateStatus('book', book.id, s)} />
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <ListOrdered size={12} className="text-slate-400" />
                    <input 
                      type="number" 
                      value={book.order_id} 
                      onChange={(e) => updateOrder('book', book.id, e.target.value)} 
                      title={`Order ID for ${book.name_en}`}
                      placeholder="0"
                      className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-bold outline-none" 
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Move size={12} className="text-slate-400" />
                    <select 
                      title="Move Book to Category"
                      value={book.category} 
                      onChange={(e) => handleMoveBook(book.id, e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded px-2 py-0.5 outline-none cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                    >
                      {categories.filter(c => c.collection_id === selectedCol).map(c => (
                        <option key={c.id} value={c.name_en}>{c.name_en}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(saving === book.id || deleting === book.id) && <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center rounded-2xl z-10"><Loader2 className="animate-spin text-indigo-500" size={20}/></div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* FOOTER MESSAGES */}
      {(success || error) && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border ${success ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-50 text-white'}`}>
            {success ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
            <span className="text-sm font-bold">{success || error}</span>
          </div>
        </div>
      )}
    </div>
  );
};