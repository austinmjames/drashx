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

export interface HistoryLocation {
  book: string;
  chapter: number;
  verse?: number;
}

interface ReaderHeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isInsightsOpen: boolean;
  toggleInsights: () => void;
  activeBook: string;
  activeChapter: number;
  chapterLabel?: string | null; // For Talmudic folios/labels
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

  // Reference Navigation Backstack
  navigationHistory?: HistoryLocation[];
  handleGoBack?: () => void;
}

/**
 * ReaderHeader 2.0
 * The primary navigation and command bar for the DrashX Reader.
 * Orchestrates chapter navigation, history backstack, and global text settings.
 */
export const ReaderHeader = ({
  isSidebarOpen, toggleSidebar,
  isInsightsOpen, toggleInsights,
  activeBook, activeChapter, chapterLabel,
  hebrewTitle,
  handlePrevChapter, handleNextChapter,
  languageMode, setLanguageMode,
  translation, setTranslation,
  availableTranslations,
  hebrewStyle, setHebrewStyle,
  navigationHistory = [],
  handleGoBack
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

  // Derive the last location to display in the back button
  const lastLocation = navigationHistory.length > 0 
    ? navigationHistory[navigationHistory.length - 1] 
    : null;

  // Display Logic: Priority to Folio Label (e.g., 33a)
  const displayChapter = chapterLabel || activeChapter;

  return (
    <header className="flex-none z-20 px-3 md:px-6 py-3 md:py-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
      
      {/* Left: Sidebar Control & History Backstack */}
      <div className="flex-1 flex items-center gap-2 min-w-0 pr-2">
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
          aria-label={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
          className={`p-2 rounded-xl transition-all duration-300 active:scale-90 shrink-0 ${
            isSidebarOpen 
              ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600' 
              : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-600'
          }`}
        >
          {isSidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
        </button>

        {lastLocation && handleGoBack && (
          <button
            onClick={handleGoBack}
            title={`Return to ${lastLocation.book} ${lastLocation.chapter}${lastLocation.verse ? `:${lastLocation.verse}` : ''}`}
            aria-label="Go back to previous verse"
            className="flex items-center gap-1 pl-1.5 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] md:text-xs font-bold transition-all border border-slate-200 dark:border-slate-800 active:scale-95 shrink min-w-0 shadow-sm animate-in fade-in slide-in-from-left-2"
          >
            <ChevronLeft size={14} className="shrink-0 text-slate-400" />
            <span className="truncate max-w-18.75 md:max-w-37.5">
              {lastLocation.book} {lastLocation.chapter}{lastLocation.verse ? `:${lastLocation.verse}` : ''}
            </span>
          </button>
        )}
      </div>

      {/* Center: Navigation Bridge & Canon Title */}
      <div className="flex items-center gap-2 md:gap-8 shrink-0">
        <button 
          onClick={handlePrevChapter} 
          disabled={activeChapter <= 1} 
          title="Previous Chapter"
          aria-label="Previous Chapter"
          className="p-1.5 md:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 active:scale-90 transition-all text-slate-400 hover:text-indigo-600"
        >
          <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center min-w-28 md:min-w-40 text-center select-none justify-center">
          <h1 className="text-[15px] md:text-xl font-semibold text-slate-900 dark:text-white tracking-tight leading-none flex items-center gap-2">
            {formattedBookName} {displayChapter}
          </h1>
          <div className="mt-0.5 md:mt-1 flex items-center gap-2">
            <div className="h-px w-1.5 md:w-2 bg-slate-200 dark:bg-slate-800" />
            <p className="text-[11px] md:text-sm font-hebrew font-medium text-slate-500 dark:text-slate-400 tracking-normal leading-none" dir="rtl">
              {hebrewTitle || '...'}
            </p>
            <div className="h-px w-1.5 md:w-2 bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        <button 
          onClick={handleNextChapter} 
          title="Next Chapter"
          aria-label="Next Chapter"
          className="p-1.5 md:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all text-slate-400 hover:text-indigo-600"
        >
          <ChevronRight className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
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
          className={`md:hidden p-2 rounded-xl transition-all active:scale-90 border ${
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