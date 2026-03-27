import React from 'react';
import { PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReaderSettingsMenu } from '../../../features/reader/reader-settings/ui/ReaderSettingsMenu';

interface ReaderHeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
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
  activeBook, activeChapter, hebrewTitle,
  handlePrevChapter, handleNextChapter,
  languageMode, setLanguageMode,
  translation, setTranslation,
  hebrewStyle, setHebrewStyle
}: ReaderHeaderProps) => {
  return (
    <header className="sticky top-0 z-10 p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
      <div className="flex-1 flex items-center">
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <button 
          onClick={handlePrevChapter} 
          disabled={activeChapter <= 1} 
          title="Previous Chapter"
          aria-label="Previous Chapter"
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
        >
          <ChevronLeft size={24}/>
        </button>
        <div className="text-center min-w-30">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 capitalize">
            {activeBook} {activeChapter}
          </h1>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{hebrewTitle || '...'}</p>
        </div>
        <button 
          onClick={handleNextChapter} 
          title="Next Chapter"
          aria-label="Next Chapter"
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight size={24}/>
        </button>
      </div>

      <div className="flex-1 flex justify-end items-center shrink-0">
        <ReaderSettingsMenu 
          languageMode={languageMode} setLanguageMode={setLanguageMode}
          translation={translation} setTranslation={setTranslation}
          hebrewStyle={hebrewStyle} setHebrewStyle={setHebrewStyle}
        />
      </div>
    </header>
  );
};