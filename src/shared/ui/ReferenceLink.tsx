// Path: src/shared/ui/ReferenceLink.tsx
"use client";

import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/api/supabase';

interface ReferenceLinkProps {
  book: string;
  chapter: number;
  verse: number;
  label?: string; 
  className?: string;
  onClick: (book: string, chapter: number, verse: number) => void;
  hidePreview?: boolean;
  variant?: 'default' | 'subtle' | 'resolved'; 
  hideIcon?: boolean; 
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
  const [isHovered, setIsHovered] = useState(false);
  
  // Advanced Dynamic Placement State (Viewport Relative for Portal)
  const [tooltipStyle, setTooltipStyle] = useState({
    top: 0,
    left: 0,
    arrowLeft: 0,
    placement: 'top' as 'top' | 'bottom',
    opacity: 0,
    scale: 0.95
  });

  const buttonRef = useRef<HTMLButtonElement>(null);

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
    setIsHovered(true);

    const rect = e.currentTarget.getBoundingClientRect();
    
    // 1. HORIZONTAL CLAMPING (Fixed Viewport Relative)
    const tooltipWidth = 320; 
    const padding = 16; 
    
    const targetCenter = rect.left + (rect.width / 2);
    let tooltipLeft = targetCenter - (tooltipWidth / 2);
    
    // Clamp to viewport
    if (tooltipLeft < padding) tooltipLeft = padding;
    if (tooltipLeft > window.innerWidth - tooltipWidth - padding) {
      tooltipLeft = window.innerWidth - tooltipWidth - padding;
    }

    const cssArrowLeft = targetCenter - tooltipLeft;

    // 2. VERTICAL FLIPPING
    const tooltipHeight = 240; // Est max height
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    const placement = spaceBelow < tooltipHeight && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 12 : rect.bottom + 12;

    setTooltipStyle({
      top,
      left: tooltipLeft,
      arrowLeft: cssArrowLeft,
      placement,
      opacity: 1,
      scale: 1
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTooltipStyle(prev => ({ ...prev, opacity: 0, scale: 0.95 }));
  };

  const arrowPlacementClasses = tooltipStyle.placement === 'top' ? "-bottom-1.5 border-r border-b" : "-top-1.5 border-l border-t";

  const baseColorClasses = variant === 'subtle'
    ? "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 hover:dark:bg-slate-800 hover:text-slate-700 hover:dark:text-slate-300"
    : variant === 'resolved'
    ? "bg-white/10 text-blue-100 border-white/20 hover:bg-white/20 hover:text-white"
    : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-600 hover:text-white";

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(book, chapter, verse);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black rounded-md border shadow-sm transition-all group/badge active:scale-95 ${baseColorClasses} ${className}`}
        title={`Jump to ${displayLabel}`}
      >
        {displayLabel}
        {!hideIcon && <ExternalLink size={10} className="opacity-0 group-hover/badge:opacity-100 transition-opacity" />}
      </button>

      {/* FIX: Use createPortal to move the tooltip to the end of document.body.
          This prevents the parent's 'overflow: hidden' (from line-clamp) from clipping the preview.
      */}
      {!hidePreview && typeof document !== 'undefined' && createPortal(
        <div 
          className={`fixed z-9999 pointer-events-none transition-all duration-200 ease-out`}
          style={{ 
            top: tooltipStyle.top, 
            left: tooltipStyle.left, 
            opacity: tooltipStyle.opacity,
            transform: `scale(${tooltipStyle.scale}) translateY(${tooltipStyle.placement === 'top' ? '0' : '0'})`,
            transformOrigin: tooltipStyle.placement === 'top' ? 'bottom center' : 'top center',
            visibility: isHovered ? 'visible' : 'hidden'
          }}
        >
          <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 p-5 w-[320px] flex flex-col gap-3 text-left ${tooltipStyle.placement === 'top' ? 'mb-3' : 'mt-3'}`}>
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
              style={{ 
                left: tooltipStyle.arrowLeft, 
                transform: 'translateX(-50%) rotate(45deg)',
                bottom: tooltipStyle.placement === 'top' ? '-6px' : 'auto',
                top: tooltipStyle.placement === 'bottom' ? '-6px' : 'auto'
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};