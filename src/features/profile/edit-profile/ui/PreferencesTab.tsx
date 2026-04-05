// Path: src/features/profile/edit-profile/ui/PreferencesTab.tsx
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Check, Library } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

interface PreferencesTabProps {
  userId: string;
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

export const PreferencesTab = ({ userId }: PreferencesTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [extendedLibraryEnabled, setExtendedLibraryEnabled] = useState(false);
  const [enabledCollections, setEnabledCollections] = useState<string[]>(['Tanakh']);

  useEffect(() => {
    let isMounted = true;

    const fetchPreferences = async (retryCount = 0) => {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;
        
        if (data && isMounted) {
          setExtendedLibraryEnabled(data.extended_library_enabled || false);
          setEnabledCollections(data.enabled_collections || ['Tanakh']);
          setLoading(false);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        if ((errorMsg.includes('AbortError') || errorMsg.includes('Lock broken') || errorMsg.includes('steal')) && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 500 + Math.random() * 500;
          setTimeout(() => {
            if (isMounted) fetchPreferences(retryCount + 1);
          }, delay);
          return;
        }

        console.error("Error fetching preferences:", err);
        if (isMounted) {
          setError("Failed to load study preferences.");
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      if (isMounted) fetchPreferences(0);
    }, Math.random() * 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [userId]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); 
    setError(null); 
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          extended_library_enabled: extendedLibraryEnabled,
          enabled_collections: enabledCollections,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <form onSubmit={handleSavePreferences} className="space-y-8 animate-in fade-in">
      {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2"><AlertCircle size={14} /><p>{error}</p></div>}
      {success && <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl border border-emerald-100 flex items-start gap-2"><Check size={14} /><p>Preferences updated successfully.</p></div>}

      <div className="space-y-6">
        <div className="space-y-1.5 mb-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <Library size={14} className="text-indigo-500" /> Library Access
          </label>
          <p className="text-xs text-slate-500">Manage which texts are available in your Table of Contents and searches.</p>
        </div>

        <div className="flex flex-col p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl transition-colors hover:border-indigo-100 dark:hover:border-indigo-900/50">
          
          {/* Master Toggle */}
          <div className="flex items-center justify-between">
            <div className="pr-6">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Extended Library <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[9px] uppercase tracking-widest rounded font-black">Opt-In</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Enable access to a growing library of texts. You can manually adjust which types of texts will appear in preferences.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Toggle Extended Library">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={extendedLibraryEnabled}
                onChange={(e) => setExtendedLibraryEnabled(e.target.checked)}
                aria-label="Toggle Extended Library"
              />
              <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 shadow-inner"></div>
            </label>
          </div>

          {/* Granular Collections List */}
          {extendedLibraryEnabled && (
            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Active Collections</h5>
              <div className="space-y-2">
                {AVAILABLE_COLLECTIONS.map(collection => {
                  const isEnabled = enabledCollections.includes(collection.id) || collection.locked;
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
                      <div className="pr-4">
                        <p className={`text-sm font-bold flex items-center gap-2 ${isEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                          {collection.name}
                          {collection.locked && (
                            <span className="text-[9px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black">Required</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{collection.description}</p>
                      </div>
                      
                      <div className="relative inline-flex items-center shrink-0 pt-1">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={isEnabled}
                          disabled={isDisabled}
                          onChange={(e) => {
                            if (isDisabled) return;
                            if (e.target.checked) {
                              setEnabledCollections(prev => [...prev, collection.id]);
                            } else {
                              setEnabledCollections(prev => prev.filter(id => id !== collection.id));
                            }
                          }}
                        />
                        <div className={`relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 shadow-inner ${collection.locked ? 'opacity-50' : ''}`}></div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 disabled:opacity-50 mt-8">
        {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Preferences'}
      </button>
    </form>
  );
};