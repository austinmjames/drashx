// Path: src/widgets/table-of-contents/ui/ToCHeader.tsx
import React, { useState } from 'react';
import { Library, ChevronLeft } from 'lucide-react';
import { ViewMode, BookType } from './TableOfContents';

interface ToCHeaderProps {
  viewMode: ViewMode;
  activeCollection: string;
  activeCategory: string | null;
  activeBook: BookType | null;
  enabledCollections: string[];
  extendedLibraryEnabled: boolean; // Added to respect master toggle
  onBack: () => void;
}

export const ToCHeader = ({ 
  viewMode, 
  activeCollection, 
  activeCategory, 
  activeBook, 
  enabledCollections, 
  extendedLibraryEnabled,
  onBack 
}: ToCHeaderProps) => {
  const [isBackHovered, setIsBackHovered] = useState(false);
  
  // Logic Fix: Only show back button/extended layers if the master toggle is ON and there is more than 1 collection
  const hasExtendedAccess = extendedLibraryEnabled && enabledCollections.length > 1;
  const showBackButton = (viewMode !== 'collections' && (viewMode !== 'categories' || hasExtendedAccess));

  /**
   * Header Labels Logic: "Show what is the layer previous"
   */
  let headerText = "Library";
  let subtitleText: string | null = "Browse the Canon";

  if (viewMode === 'collections') {
    headerText = "Library";
    subtitleText = hasExtendedAccess ? "Extended Version" : "Browse the Canon";
  } 
  else if (viewMode === 'categories') {
    headerText = "Library";
    subtitleText = activeCollection;
  } 
  else if (viewMode === 'books') {
    headerText = activeCollection;
    subtitleText = null; 
  } 
  else if (viewMode === 'chapters') {
    headerText = activeCategory || '';
    subtitleText = activeBook?.name_en || '';
  }

  return (
    <header className="flex-none pt-5 border-b border-slate-100 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 flex flex-col">
      <div className="px-4 pb-4">
        {!showBackButton ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Library size={16} />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Library</h2>
              <p className="text-[10px] text-slate-400 font-medium">{subtitleText}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={onBack} 
              onMouseEnter={() => setIsBackHovered(true)} 
              onMouseLeave={() => setIsBackHovered(false)} 
              className={`p-1.5 rounded-lg transition-all active:scale-90 ${isBackHovered ? 'bg-slate-100 dark:bg-slate-900 text-indigo-600' : 'text-slate-400'}`} 
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="ml-1 min-w-0">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 truncate">
                {headerText}
              </h2>
              {subtitleText && (
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {subtitleText}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};