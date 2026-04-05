// Path: src/features/reader/reader-settings/ui/ReaderSettingsMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Settings, Check, Type, Languages, BookText, Sparkles } from 'lucide-react';

interface ReaderSettingsMenuProps {
  languageMode: 'both' | 'en' | 'he';
  setLanguageMode: (mode: 'both' | 'en' | 'he') => void;
  translation: string;
  setTranslation: (trans: string) => void;
  hebrewStyle: 'niqqud' | 'no-niqqud';
  setHebrewStyle: (style: 'niqqud' | 'no-niqqud') => void;
  availableTranslations: Array<{slug: string, name: string}>;
}

export const ReaderSettingsMenu = ({
  languageMode, setLanguageMode,
  translation, setTranslation,
  hebrewStyle, setHebrewStyle,
  availableTranslations
}: ReaderSettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // We determine NT context based on available translations from the DB
  const isNT = availableTranslations.some(t => t.slug === 'WEB');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-auto'}`} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        title="Reader Settings"
        aria-label="Toggle reader settings menu"
        className={`p-2 rounded-xl transition-all duration-300 ${isOpen ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}
      >
        <Settings size={22} className={isOpen ? 'rotate-90' : ''} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-100 animate-in fade-in slide-in-from-top-3 duration-200">
          
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-500" />
              Reader Settings
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-tighter">v2.1</span>
          </div>

          <div className="p-5 space-y-7">
            <section className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><Languages size={14} /> Display Layout</label>
              <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                {(['en', 'both', 'he'] as const).map((mode) => (
                  <button 
                    key={mode} 
                    onClick={() => setLanguageMode(mode)} 
                    title={mode === 'en' ? 'English Only' : mode === 'both' ? 'Parallel View' : 'Source Only'}
                    aria-label={`Switch layout to ${mode}`}
                    className={`py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${languageMode === mode ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {mode === 'en' && <span className="font-sans text-xs font-black">EN</span>}
                    {mode === 'both' && <Languages size={18} strokeWidth={2.5} />}
                    {mode === 'he' && <span className={`font-serif leading-none ${isNT ? 'text-sm font-black' : 'text-xl font-bold'}`}>{isNT ? 'GR' : 'א'}</span>}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><Type size={14} /> {isNT ? 'Greek' : 'Hebrew'} Script</label>
              <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                <button 
                  onClick={() => setHebrewStyle('niqqud')} 
                  title={isNT ? "Polytonic Greek" : "Vocalized Hebrew (Niqqud)"}
                  aria-label={isNT ? "Switch to Polytonic Greek" : "Switch to Vocalized Hebrew"}
                  className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${hebrewStyle === 'niqqud' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {isNT ? 'Polytonic' : 'Vocalized'}
                </button>
                <button 
                  onClick={() => setHebrewStyle('no-niqqud')} 
                  title={isNT ? "Monotonic Greek" : "Consonantal Hebrew (No Niqqud)"}
                  aria-label={isNT ? "Switch to Monotonic Greek" : "Switch to Consonantal Hebrew"}
                  className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${hebrewStyle === 'no-niqqud' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {isNT ? 'Monotonic' : 'Consonantal'}
                </button>
              </div>
            </section>

            {/* Dynamic English Translation Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><BookText size={14} /> English Version</label>
              <div className="space-y-1.5">
                
                {/* Default Translation Toggle */}
                <button
                  onClick={() => setTranslation('default')}
                  title="Default Translation"
                  aria-label="Select Default Translation"
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs transition-all border ${
                    translation === 'default'
                      ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-400 font-bold'
                      : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span>Default (Contextual)</span>
                    <span className={`text-[9px] uppercase tracking-widest ${translation === 'default' ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {isNT ? 'World English Bible' : 'JPS 1917'}
                    </span>
                  </div>
                  {translation === 'default' && <Check size={16} strokeWidth={3} />}
                </button>

                {availableTranslations.length === 0 ? (
                   <p className="text-xs text-slate-400 italic px-2 py-1 mt-2">No additional translations available.</p>
                ) : availableTranslations.map((trans) => (
                  <button
                    key={trans.slug}
                    onClick={() => setTranslation(trans.slug)}
                    title={trans.name}
                    aria-label={`Select ${trans.name} translation`}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs transition-all border mt-1.5 ${
                      translation === trans.slug
                        ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-400 font-bold'
                        : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    {trans.name}
                    {translation === trans.slug && <Check size={16} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </section>
          </div>
          
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/30">
             <p className="text-[9px] text-center text-slate-400 font-medium">Preferences are synced to your DrashX cloud profile.</p>
          </div>
        </div>
      )}
    </div>
  );
};