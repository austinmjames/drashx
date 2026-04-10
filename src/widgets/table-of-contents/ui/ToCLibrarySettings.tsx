// Path: src/widgets/table-of-contents/ui/ToCLibrarySettings.tsx
import React, { useState } from 'react';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import { supabase } from '../../../shared/api/supabase';

interface ToCLibrarySettingsProps {
  userId?: string | null;
  extendedLibraryEnabled: boolean;
  enabledCollections: string[];
  onSave: (extended: boolean, collections: string[]) => void;
  onClose: () => void;
}

const AVAILABLE_COLLECTIONS = [
  { 
    id: 'Tanakh', 
    name: 'Tanakh', 
    description: 'Torah, Nevi\'im, Ketuvim. The foundational Hebrew Bible.', 
    locked: true
  },
  { 
    id: 'Christianity', 
    name: 'Christianity', 
    description: 'Gospels, Acts, Epistles, Revelation (Brit Chadashah).', 
    locked: false
  }
];

export const ToCLibrarySettings = ({
  userId,
  extendedLibraryEnabled,
  enabledCollections,
  onSave,
  onClose
}: ToCLibrarySettingsProps) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [localExtended, setLocalExtended] = useState(extendedLibraryEnabled);
  const [localCollections, setLocalCollections] = useState<string[]>(enabledCollections);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If not authenticated, we can only update local state temporarily for this session
    if (!userId) {
      setSuccess(true);
      onSave(localExtended, localCollections);
      setTimeout(() => { setSuccess(false); onClose(); }, 1000);
      return;
    }

    setSaving(true); 
    setError(null); 
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          extended_library_enabled: localExtended,
          enabled_collections: localCollections,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
      
      setSuccess(true);
      onSave(localExtended, localCollections);
      setTimeout(() => { setSuccess(false); onClose(); }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSavePreferences} className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-8">
      {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2"><AlertCircle size={14} className="shrink-0" /><p>{error}</p></div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl border border-emerald-100 flex items-start gap-2"><Check size={14} className="shrink-0" /><p>Library updated successfully.</p></div>}

      <div className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl transition-colors">
        {/* Master Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="pr-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              Extended Library <span className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[8px] uppercase tracking-widest rounded font-black">Opt-In</span>
            </h4>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              Enable access to additional texts and collections. Manage which ones appear in your Table of Contents.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0 pt-1" title="Toggle Extended Library">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={localExtended}
              onChange={(e) => setLocalExtended(e.target.checked)}
              aria-label="Toggle Extended Library"
            />
            <div className="relative w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 shadow-inner"></div>
          </label>
        </div>

        {/* Granular Collections List */}
        {localExtended && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
            <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Available Collections</h5>
            <div className="space-y-2">
              {AVAILABLE_COLLECTIONS.map(collection => {
                const isEnabled = localCollections.includes(collection.id) || collection.locked;
                const isDisabled = collection.locked;
                
                return (
                  <label 
                    key={collection.id} 
                    className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                      isEnabled 
                        ? 'bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900/50 shadow-sm' 
                        : 'bg-transparent border-slate-200 dark:border-slate-700/50 grayscale opacity-70 hover:opacity-100'
                    } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800'}`}
                  >
                    <div className="pr-3">
                      <p className={`text-xs font-bold flex items-center gap-1.5 ${isEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {collection.name}
                        {collection.locked && (
                          <span className="text-[8px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black">Req</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">{collection.description}</p>
                    </div>
                    
                    <div className="relative inline-flex items-center shrink-0 pt-0.5">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isEnabled}
                        disabled={isDisabled}
                        onChange={(e) => {
                          if (isDisabled) return;
                          if (e.target.checked) {
                            setLocalCollections(prev => [...prev, collection.id]);
                          } else {
                            setLocalCollections(prev => prev.filter(id => id !== collection.id));
                          }
                        }}
                      />
                      <div className={`relative w-8 h-4 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 shadow-inner ${collection.locked ? 'opacity-50' : ''}`}></div>
                    </div>
                  </label>
                );
              })}
            </div>
            
            {!userId && (
              <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-4 text-center font-bold px-2">
                Sign in to permanently save your library preferences across devices.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs transition-all disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={14} /> : 'Save Library'}
        </button>
      </div>
    </form>
  );
};