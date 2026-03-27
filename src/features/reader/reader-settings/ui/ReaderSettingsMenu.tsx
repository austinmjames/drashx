// Path: src/features/reader/reader-settings/ui/ReaderSettingsMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Settings, Check, Type, Languages, BookText, Lock } from 'lucide-react';

interface ReaderSettingsMenuProps {
  languageMode: 'both' | 'en' | 'he';
  setLanguageMode: (mode: 'both' | 'en' | 'he') => void;
  translation: 'jps1917' | 'modernized';
  setTranslation: (trans: 'jps1917' | 'modernized') => void;
  hebrewStyle: 'niqqud' | 'no-niqqud';
  setHebrewStyle: (style: 'niqqud' | 'no-niqqud') => void;
}

/**
 * ReaderSettingsMenu component providing control over display language,
 * Hebrew vocalization, and English translation versions.
 * Optimized with cleaner typography and less bulky font weights.
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

  const translationOptions: { id: 'jps1917' | 'modernized'; label: string; disabled?: boolean }[] = [
    { id: 'jps1917', label: 'JPS 1917 (Classic)', disabled: false },
    { id: 'modernized', label: 'Modernized', disabled: true },
  ];

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Reader Settings"
        aria-label="Toggle reader settings menu"
        className={`p-2 rounded-full transition-all ${
          isOpen 
            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
        }`}
      >
        <Settings size={20} className={isOpen ? 'rotate-90 duration-300' : 'duration-300'} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings size={16} className="text-indigo-500" />
              Reader Preferences
            </h3>
          </div>

          <div className="p-4 space-y-6">
            {/* Display Language Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center gap-1.5">
                <Languages size={14} /> Display Language
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                {(['en', 'both', 'he'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLanguageMode(mode)}
                    className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-md transition-all ${
                      languageMode === mode 
                        ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {mode === 'both' ? 'Both' : mode}
                  </button>
                ))}
              </div>
            </section>

            {/* Hebrew Style Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center gap-1.5">
                <Type size={14} /> Hebrew Text
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                <button
                  onClick={() => setHebrewStyle('niqqud')}
                  className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-md transition-all ${
                    hebrewStyle === 'niqqud' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Vocalized
                </button>
                <button
                  onClick={() => setHebrewStyle('no-niqqud')}
                  className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-md transition-all ${
                    hebrewStyle === 'no-niqqud' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Consonantal
                </button>
              </div>
            </section>

            {/* English Translation Section */}
            <section className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center gap-1.5">
                <BookText size={14} /> English Translation
              </label>
              <div className="space-y-1">
                {translationOptions.map((trans) => (
                  <button
                    key={trans.id}
                    disabled={trans.disabled}
                    onClick={() => !trans.disabled && setTranslation(trans.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
                      trans.disabled 
                        ? 'opacity-40 grayscale cursor-not-allowed text-slate-400'
                        : translation === trans.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {trans.label}
                      {trans.disabled && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 tracking-tight">
                          <Lock size={8} /> Coming Soon
                        </span>
                      )}
                    </div>
                    {translation === trans.id && !trans.disabled && <Check size={16} />}
                  </button>
                ))}
              </div>
            </section>

          </div>
        </div>
      )}
    </div>
  );
};