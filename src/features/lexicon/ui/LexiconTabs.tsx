// Path: src/features/lexicon/ui/LexiconTabs.tsx
import React from 'react';
import { Book, Microscope, List } from 'lucide-react';

type TabType = 'definition' | 'scholarly' | 'references';

interface LexiconTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  referenceCount: number;
}

export const LexiconTabs = ({ activeTab, setActiveTab, referenceCount }: LexiconTabsProps) => {
  return (
    <div className="flex-none shrink-0 flex justify-around px-2 sm:px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 relative z-20">
      <button 
        onClick={() => setActiveTab('definition')} 
        title="Contextual Definition"
        className={`flex-1 flex justify-center items-center py-4 transition-all relative ${activeTab === 'definition' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
      >
        <Book size={20} />
        {activeTab === 'definition' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full animate-in fade-in" />}
      </button>

      <button 
        onClick={() => setActiveTab('scholarly')} 
        title="Scholarly Lexical Entry"
        className={`flex-1 flex justify-center items-center py-4 transition-all relative ${activeTab === 'scholarly' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
      >
        <Microscope size={20} />
        {activeTab === 'scholarly' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full animate-in fade-in" />}
      </button>

      <button 
        onClick={() => setActiveTab('references')} 
        title="Verse References"
        className={`flex-1 flex justify-center items-center py-4 transition-all relative ${activeTab === 'references' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
      >
        <div className="relative flex items-center">
          <List size={20} />
          {referenceCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 px-1 py-0.5 rounded-full text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold font-mono tabular-nums leading-none shadow-sm">
              {referenceCount > 99 ? '99+' : referenceCount}
            </span>
          )}
        </div>
        {activeTab === 'references' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full animate-in fade-in" />}
      </button>
    </div>
  );
};