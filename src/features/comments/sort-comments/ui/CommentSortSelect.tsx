// Path: src/features/comments/sort-comments/ui/CommentSortSelect.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowDownWideNarrow, 
  ChevronDown, 
  Clock, 
  History, 
  Heart, 
  MessageCircle, 
  TrendingUp,
  Check
} from 'lucide-react';

export type CommentSortOption = 'newest' | 'oldest' | 'most_liked' | 'recent_reply' | 'most_activity';

interface SortOptionConfig {
  id: CommentSortOption;
  label: string;
  icon: React.ElementType;
}

const SORT_OPTIONS: SortOptionConfig[] = [
  { id: 'newest', label: 'Newest First', icon: Clock },
  { id: 'oldest', label: 'Oldest First', icon: History },
  { id: 'recent_reply', label: 'Recent Replies', icon: MessageCircle },
  { id: 'most_liked', label: 'Most Liked', icon: Heart },
  { id: 'most_activity', label: 'Most Activity', icon: TrendingUp },
];

interface CommentSortSelectProps {
  value: CommentSortOption;
  onChange: (value: CommentSortOption) => void;
}

/**
 * CommentSortSelect - Material V3 Design
 * A custom dropdown menu providing a premium sorting interface
 * with tonal icons and elevation effects.
 */
export const CommentSortSelect = ({ value, onChange }: CommentSortSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeOption = SORT_OPTIONS.find(opt => opt.id === value) || SORT_OPTIONS[0];

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Sort Comments"
        aria-label="Sort comments menu"
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200
          ${isOpen 
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800' 
            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }
        `}
      >
        <ArrowDownWideNarrow size={14} className={isOpen ? 'text-indigo-600' : 'text-slate-400'} />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {activeOption.label}
        </span>
        <ChevronDown 
          size={14} 
          className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-300'}`} 
        />
      </button>

      {/* Material V3 Menu Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5">
          <div className="p-2 border-b border-slate-50 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50">
            <span className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block">
              Sort Insights
            </span>
          </div>
          
          <div className="py-1">
            {SORT_OPTIONS.map((option) => {
              const isSelected = value === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                  title={option.label}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                    ${isSelected 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <option.icon 
                      size={16} 
                      className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} 
                    />
                    <span>{option.label}</span>
                  </div>
                  {isSelected && <Check size={14} strokeWidth={3} className="text-indigo-600 animate-in zoom-in duration-300" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};