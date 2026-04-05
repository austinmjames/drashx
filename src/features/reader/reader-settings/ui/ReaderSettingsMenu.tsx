// Path: src/features/reader/reader-settings/ui/ReaderSettingsMenu.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Check, Type, Languages, BookText, Lock, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { TranslationOption } from '../../../../views/reader/ui/ReaderPage';

interface ReaderSettingsMenuProps {
  languageMode: 'both' | 'en' | 'he';
  setLanguageMode: (mode: 'both' | 'en' | 'he') => void;
  translation: TranslationOption;
  setTranslation: (trans: string) => void;
  hebrewStyle: 'niqqud' | 'no-niqqud';
  setHebrewStyle: (style: 'niqqud' | 'no-niqqud') => void;
}

const NT_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'I Corinthians', 'II Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', 'I Thessalonians', 'II Thessalonians',
  'I Timothy', 'II Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', 'I Peter', 'II Peter',
  'I John', 'II John', 'III John', 'Jude', 'Revelation'
];

/**
 * ReaderSettingsMenu 2.0
 * Provides scholarly control over display modes, source text styling, 
 * and context-aware translation selection.
 */
export const ReaderSettingsMenu = ({
  languageMode,
  setLanguageMode,
  translation,
  setTranslation,
  hebrewStyle,
  setHebrewStyle
}: ReaderSettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const params = useParams();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Contextually determine if we are in the Old or New Testament
  const activeBook = decodeURIComponent((params?.book as string) || '');
  const isNT = useMemo(() => NT_BOOKS.includes(activeBook), [activeBook]);

  // Dynamic Translation Options Hierarchy
  const translationOptions = useMemo(() => {
    const options = [
      { id: 'default', label: 'Default (Recommended)', disabled: false }
    ];

    if (isNT) {
      options.push({ id: 'web', label: 'World English Bible (WEB)', disabled: false });
    } else {
      options.push({ id: 'jps1917', label: 'JPS 1917 (Classic)', disabled: false });
      options.push({ id: 'modernized', label: 'Modernized (Scholarly)', disabled: false });
    }

    return options;
  }, [isNT]);

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-auto'}`} ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Reader Settings"
        aria-label="Toggle reader settings menu"
        className={`p-2 rounded-xl transition-all duration-300 ${
          isOpen 
            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
        }`}
      >
        <Settings size={22} className={isOpen ? 'rotate-90' : ''} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-100 animate-in fade-in slide-in-from-top-3 duration-200">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-500" />
              Reader Settings
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-tighter">v2.0</span>
          </div>

          <div className="p-5 space-y-7">
            {/* Display Language Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Languages size={14} /> Display Layout
              </label>
              <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                {(['en', 'both', 'he'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLanguageMode(mode)}
                    title={mode === 'en' ? 'English Only' : mode === 'both' ? 'Parallel View' : 'Source Only'}
                    aria-label={`Switch layout to ${mode}`}
                    className={`py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
                      languageMode === mode 
                        ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {mode === 'en' && <span className="font-sans text-xs font-black">EN</span>}
                    {mode === 'both' && <Languages size={18} strokeWidth={2.5} />}
                    {mode === 'he' && (
                      <span className={`font-serif leading-none ${isNT ? 'text-sm font-black' : 'text-xl font-bold'}`}>
                        {isNT ? 'GR' : 'א'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Source Text Style Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Type size={14} /> {isNT ? 'Greek' : 'Hebrew'} Script
              </label>
              <div className="grid grid-cols-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                <button
                  onClick={() => setHebrewStyle('niqqud')}
                  title={isNT ? "Polytonic Greek" : "Vocalized Hebrew (Niqqud)"}
                  aria-label={isNT ? "Switch to Polytonic Greek" : "Switch to Vocalized Hebrew"}
                  className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                    hebrewStyle === 'niqqud' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {isNT ? 'Polytonic' : 'Vocalized'}
                </button>
                <button
                  onClick={() => setHebrewStyle('no-niqqud')}
                  title={isNT ? "Monotonic Greek" : "Consonantal Hebrew (No Niqqud)"}
                  aria-label={isNT ? "Switch to Monotonic Greek" : "Switch to Consonantal Hebrew"}
                  className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                    hebrewStyle === 'no-niqqud' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {isNT ? 'Monotonic' : 'Consonantal'}
                </button>
              </div>
            </section>

            {/* English Translation Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <BookText size={14} /> English Version
              </label>
              <div className="space-y-1.5">
                {translationOptions.map((trans) => (
                  <button
                    key={trans.id}
                    disabled={trans.disabled}
                    onClick={() => !trans.disabled && setTranslation(trans.id)}
                    title={trans.label}
                    aria-label={`Select ${trans.label} translation`}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs transition-all border ${
                      trans.disabled 
                        ? 'opacity-40 grayscale cursor-not-allowed border-transparent'
                        : translation === trans.id
                          ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-400 font-bold'
                          : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {trans.label}
                      {trans.disabled && (
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 tracking-tighter">
                          <Lock size={8} /> Lock
                        </span>
                      )}
                    </div>
                    {translation === trans.id && !trans.disabled && <Check size={16} strokeWidth={3} />}
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