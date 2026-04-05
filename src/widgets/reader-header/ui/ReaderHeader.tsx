// Path: src/widgets/reader-header/ui/ReaderHeader.tsx
import React, { useMemo } from 'react';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare
} from 'lucide-react';
import { ReaderSettingsMenu } from '../../../features/reader/reader-settings/ui/ReaderSettingsMenu';

interface ReaderHeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isInsightsOpen: boolean;
  toggleInsights: () => void;
  activeBook: string;
  activeChapter: number;
  hebrewTitle: string;
  handlePrevChapter: () => void;
  handleNextChapter: () => void;
  
  // Settings State - Dynamically driven by the database translation architecture
  languageMode: 'both' | 'en' | 'he';
  setLanguageMode: (mode: 'both' | 'en' | 'he') => void;
  translation: string;
  setTranslation: (trans: string) => void; 
  hebrewStyle: 'niqqud' | 'no-niqqud';
  setHebrewStyle: (style: 'niqqud' | 'no-niqqud') => void;
  availableTranslations: Array<{slug: string, name: string}>;
}

/**
 * ReaderHeader 2.0
 * The primary navigation and command bar for the DrashX Reader.
 * Orchestrates chapter navigation and global text settings.
 */
export const ReaderHeader = ({
  isSidebarOpen, toggleSidebar,
  isInsightsOpen, toggleInsights,
  activeBook, activeChapter, hebrewTitle,
  handlePrevChapter, handleNextChapter,
  languageMode, setLanguageMode,
  translation, setTranslation,
  availableTranslations,
  hebrewStyle, setHebrewStyle
}: ReaderHeaderProps) => {

  /**
   * Scholarly Formatting Utility
   * Ensures "genesis" -> "Genesis" and "i samuel" -> "I Samuel"
   */
  const formattedBookName = useMemo(() => {
    if (!activeBook) return '';
    return activeBook
      .split(' ')
      .map(word => {
        const lower = word.toLowerCase();
        // Handle Roman Numerals (I, II, III)
        if (['i', 'ii', 'iii'].includes(lower)) return word.toUpperCase();
        // Standard Title Case
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }, [activeBook]);

  return (
    <header className="sticky top-0 z-40 px-3 py-3 md:px-6 md:py-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
      
      {/* Left: Sidebar Control */}
      <div className="flex-1 flex items-center shrink-0">
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
          aria-label={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
          className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${
            isSidebarOpen 
              ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600' 
              : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-600'
          }`}
        >
          {isSidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
        </button>
      </div>

      {/* Center: Navigation Bridge & Canon Title */}
      <div className="flex items-center gap-2 md:gap-8 shrink-0">
        <button 
          onClick={handlePrevChapter} 
          disabled={activeChapter <= 1} 
          title="Previous Chapter"
          aria-label="Previous Chapter"
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 active:scale-90 transition-all text-slate-400 hover:text-indigo-600"
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center min-w-28 md:min-w-40 text-center select-none">
          <h1 className="text-base md:text-xl font-normal text-slate-900 dark:text-white tracking-tight leading-none flex items-center gap-2">
            {formattedBookName} {activeChapter}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-px w-2 bg-slate-200 dark:bg-slate-800" />
            <p className="text-sm md:text-base font-hebrew font-normal text-slate-500 dark:text-slate-400 tracking-normal" dir="rtl">
              {hebrewTitle || '...'}
            </p>
            <div className="h-px w-2 bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        <button 
          onClick={handleNextChapter} 
          title="Next Chapter"
          aria-label="Next Chapter"
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all text-slate-400 hover:text-indigo-600"
        >
          <ChevronRight size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Right: Settings Hub & Commentary Toggle */}
      <div className="flex-1 flex justify-end items-center shrink-0 gap-1 md:gap-3">
        <ReaderSettingsMenu 
          languageMode={languageMode} setLanguageMode={setLanguageMode}
          translation={translation} setTranslation={setTranslation}
          availableTranslations={availableTranslations}
          hebrewStyle={hebrewStyle} setHebrewStyle={setHebrewStyle}
        />
        
        {/* Mobile Commentary Toggle: Visible only on small screens */}
        <button
          onClick={toggleInsights}
          title={isInsightsOpen ? "Close Commentary" : "Open Commentary"}
          aria-label={isInsightsOpen ? "Close Commentary" : "Open Commentary"}
          className={`md:hidden p-2.5 rounded-xl transition-all active:scale-90 border ${
            isInsightsOpen 
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-200'
          }`}
        >
          <MessageSquare size={20} fill={isInsightsOpen ? "currentColor" : "none"} />
        </button>
      </div>
    </header>
  );
};