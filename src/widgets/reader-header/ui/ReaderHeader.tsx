// Path: src/widgets/reader-header/ui/ReaderHeader.tsx
import React from 'react';
import { PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
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
  
  // Settings State
  languageMode: 'both' | 'en' | 'he';
  setLanguageMode: (mode: 'both' | 'en' | 'he') => void;
  translation: 'jps1917' | 'modernized';
  setTranslation: (trans: 'jps1917' | 'modernized') => void;
  hebrewStyle: 'niqqud' | 'no-niqqud';
  setHebrewStyle: (style: 'niqqud' | 'no-niqqud') => void;
}

export const ReaderHeader = ({
  isSidebarOpen, toggleSidebar,
  isInsightsOpen, toggleInsights,
  activeBook, activeChapter, hebrewTitle,
  handlePrevChapter, handleNextChapter,
  languageMode, setLanguageMode,
  translation, setTranslation,
  hebrewStyle, setHebrewStyle
}: ReaderHeaderProps) => {
  return (
    <header className="sticky top-0 z-10 px-2 py-3 md:p-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
      
      {/* Left: Sidebar Toggle */}
      <div className="flex-1 flex items-center shrink-0">
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors active:scale-95"
        >
          {isSidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
        </button>
      </div>

      {/* Center: Navigation & Title */}
      <div className="flex items-center gap-1 md:gap-6 shrink-0">
        <button 
          onClick={handlePrevChapter} 
          disabled={activeChapter <= 1} 
          title="Previous Chapter"
          aria-label="Previous Chapter"
          className="p-1.5 md:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 active:scale-95 transition-transform"
        >
          <ChevronLeft size={24}/>
        </button>
        <div className="text-center min-w-25 md:min-w-30">
          <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 capitalize leading-tight">
            {activeBook} {activeChapter}
          </h1>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 md:mt-0">
            {hebrewTitle || '...'}
          </p>
        </div>
        <button 
          onClick={handleNextChapter} 
          title="Next Chapter"
          aria-label="Next Chapter"
          className="p-1.5 md:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"
        >
          <ChevronRight size={24}/>
        </button>
      </div>

      {/* Right: Settings & Mobile Insights Toggle */}
      <div className="flex-1 flex justify-end items-center shrink-0 gap-1 md:gap-2">
        <ReaderSettingsMenu 
          languageMode={languageMode} setLanguageMode={setLanguageMode}
          translation={translation} setTranslation={setTranslation}
          hebrewStyle={hebrewStyle} setHebrewStyle={setHebrewStyle}
        />
        
        {/* Mobile-only Insights Toggle Button */}
        <button
          onClick={toggleInsights}
          title="Toggle Commentary"
          className={`md:hidden p-2 rounded-xl transition-all active:scale-95 ${
            isInsightsOpen 
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' 
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare size={22} />
        </button>
      </div>
    </header>
  );
};