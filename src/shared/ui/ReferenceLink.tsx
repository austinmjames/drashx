// Path: src/shared/ui/ReferenceLink.tsx
"use client";

import React, { useState, useCallback } from 'react';
import { ExternalLink, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/api/supabase';

interface ReferenceLinkProps {
  book: string;
  chapter: number;
  verse: number;
  label?: string; // Added to support displaying raw inputs like "Gen 1:1-3"
  className?: string;
  onClick: (book: string, chapter: number, verse: number) => void;
  hidePreview?: boolean;
  variant?: 'default' | 'subtle' | 'resolved'; // Added for context styling
  hideIcon?: boolean; // Added to remove the external link icon when requested
}

export const ReferenceLink = ({ 
  book, 
  chapter, 
  verse, 
  label,
  className = "", 
  onClick,
  hidePreview = false,
  variant = 'default',
  hideIcon = false
}: ReferenceLinkProps) => {
  const [preview, setPreview] = useState<{ he: string; en: string } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Advanced Dynamic Placement State
  const [tooltipStyle, setTooltipStyle] = useState({
    left: '50%',
    arrowLeft: '50%',
    placement: 'top' as 'top' | 'bottom',
    transform: 'translateX(-50%)'
  });

  // Calculate display string and detect if this is a multi-verse range
  const displayLabel = label || `${book} ${chapter}:${verse}`;
  const isRange = displayLabel.includes('-') || displayLabel.includes(',');

  const fetchPreview = useCallback(async () => {
    if (hidePreview || preview || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reader_verses_view')
        .select('text_he, text_en')
        .eq('book_id', book)
        .eq('chapter_num', chapter)
        .eq('verse_num', verse)
        .single();
      
      if (data && !error) {
        setPreview({ he: data.text_he, en: data.text_en || '' });
      }
    } catch (e) {
      console.error("Preview fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [book, chapter, verse, hidePreview, preview, loading]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (hidePreview) return;
    fetchPreview();

    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    
    // Find the scroll boundaries
    const container = target.closest('.insights-scroll-container, .overflow-y-auto, [class*="max-w-"]') || document.body;
    const containerRect = container.getBoundingClientRect();

    // 1. HORIZONTAL CLAMPING
    const tooltipWidth = 320; // Exact width of w-[320px]
    const padding = 16; // Edge buffer
    
    const targetCenter = rect.left + (rect.width / 2);
    let tooltipLeft = targetCenter - (tooltipWidth / 2);
    
    // Clamp to ensure it never crosses the left/right bounds of the container/viewport
    const minLeft = Math.max(containerRect.left + padding, padding);
    const maxLeft = Math.min(containerRect.right - padding, window.innerWidth - padding) - tooltipWidth;
    
    if (tooltipLeft < minLeft) tooltipLeft = minLeft;
    if (tooltipLeft > maxLeft) tooltipLeft = maxLeft;

    // Relative to the word button's absolute position
    const cssLeft = tooltipLeft - rect.left;
    
    // Slide the arrow internally so it points squarely back at the word's center
    const cssArrowLeft = targetCenter - tooltipLeft;

    // 2. VERTICAL FLIPPING
    // How much space do we actually have above and below inside the container?
    const spaceAbove = rect.top - Math.max(containerRect.top, 0);
    const spaceBelow = Math.min(containerRect.bottom, window.innerHeight) - rect.bottom;
    
    // Tooltip height is roughly 220px. If we don't have enough space below, 
    // and there is MORE space above, flip to 'top'. Otherwise, default 'bottom'.
    const placement = spaceBelow < 240 && spaceAbove > spaceBelow ? 'top' : 'bottom';

    setTooltipStyle({
      left: `${cssLeft}px`,
      transform: 'none', // Raw offsets used, kill the default transform
      arrowLeft: `${cssArrowLeft}px`,
      placement
    });
  };

  const positionClasses = tooltipStyle.placement === 'top' ? "bottom-full mb-3" : "top-full mt-3";
  const arrowPlacementClasses = tooltipStyle.placement === 'top' ? "-bottom-1.5 border-r border-b" : "-top-1.5 border-l border-t";

  // --- Dynamic Color Variants ---
  const baseColorClasses = variant === 'subtle'
    ? "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 hover:dark:bg-slate-800 hover:text-slate-700 hover:dark:text-slate-300"
    : variant === 'resolved'
    ? "bg-white/10 text-blue-100 border-white/20 hover:bg-white/20 hover:text-white"
    : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-600 hover:text-white";

  return (
    <div className="relative group/ref-container inline-block">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClick(book, chapter, verse);
        }}
        onMouseEnter={handleMouseEnter}
        className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black rounded-md border shadow-sm transition-all group/badge active:scale-95 ${baseColorClasses} ${className}`}
        title={`Jump to ${displayLabel}`}
      >
        {displayLabel}
        {!hideIcon && <ExternalLink size={10} className="opacity-0 group-hover/badge:opacity-100 transition-opacity" />}
      </button>

      {!hidePreview && (
        <div 
          className={`absolute z-100 pointer-events-none invisible opacity-0 group-hover/ref-container:visible group-hover/ref-container:opacity-100 transition-all duration-200 scale-95 group-hover/ref-container:scale-100 ${positionClasses}`}
          style={{ left: tooltipStyle.left, transform: tooltipStyle.transform }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 w-[320px] max-w-[calc(100vw-2rem)] flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <BookOpen size={14} className="text-indigo-500 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">
                {displayLabel}
              </span>
            </div>
            
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest">Consulting Scrolls...</span>
              </div>
            ) : preview ? (
              <div className="space-y-3">
                <p className="text-xl font-serif text-slate-900 dark:text-slate-100 text-right leading-relaxed" dir="rtl">
                  {preview.he}{isRange && " ..."}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic border-l-2 border-slate-100 dark:border-slate-800 pl-3">
                  {preview.en}{isRange && " ..."}
                </p>
                {isRange && (
                  <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">
                      View full range in reader
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Preview unavailable.</p>
            )}
            
            {/* Dynamically Slid Arrow */}
            <div 
              className={`absolute w-3 h-3 bg-white dark:bg-slate-900 rotate-45 border-slate-200 dark:border-slate-800 ${arrowPlacementClasses}`}
              style={{ left: tooltipStyle.arrowLeft, transform: 'translateX(-50%) rotate(45deg)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};