// Path: src/shared/ui/ReferenceLink.tsx
"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Loader2, Lock, ExternalLink, ArrowRight } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  
  const [isRestricted, setIsRestricted] = useState<boolean | null>(null);
  const [targetCollection, setTargetCollection] = useState<string>('Tanakh');

  const [tooltipStyle, setTooltipStyle] = useState({
    top: 0,
    left: 0,
    arrowLeft: 0,
    placement: 'top' as 'top' | 'bottom',
    opacity: 0,
    scale: 0.95
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const displayLabel = label || `${book} ${chapter}:${verse}`;
  const isRange = displayLabel.includes('-') || displayLabel.includes(',');

  useEffect(() => {
    setMounted(true);
    // Safely detect touch capabilities on mount
    if (typeof window !== 'undefined') {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
    return () => setMounted(false);
  }, []);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const checkAccess = useCallback(async (retryCount = 0): Promise<{ restricted: boolean; collection: string }> => {
    try {
      const { data: bookMeta } = await supabase
        .from('books')
        .select('collection')
        .ilike('name_en', book.trim())
        .single();
      
      const collection = bookMeta?.collection || 'Tanakh';
      setTargetCollection(collection);

      const { data: colConfig } = await supabase
        .from('collection_configs')
        .select('visibility_status')
        .eq('id', collection)
        .single();

      // If the collection is marked as 'coming-soon', only admins can see it
      if (colConfig?.visibility_status === 'coming-soon') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
          if (profile?.is_admin) {
            setIsRestricted(false);
            return { restricted: false, collection };
          }
        }
        setIsRestricted(true);
        return { restricted: true, collection };
      }

      // If it's default or extended, it's public via the segmented control
      setIsRestricted(false);
      return { restricted: false, collection };

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if ((errorMsg.includes('lock') || errorMsg.includes('stole')) && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 400 + Math.random() * 300;
        await new Promise(res => setTimeout(res, delay));
        return checkAccess(retryCount + 1);
      }
      return { restricted: false, collection: 'Tanakh' };
    }
  }, [book]);

  const fetchPreview = useCallback(async () => {
    if (hidePreview || preview || loading) return;
    setLoading(true);
    
    const { restricted, collection } = await checkAccess();
    if (restricted) { setLoading(false); return; }

    const slug = collection === 'Christianity' ? 'WEB' : 'JPS';

    try {
      const { data, error } = await supabase
        .from('reader_verses_view')
        .select('text_he, text_en')
        .eq('book_id', book)
        .eq('chapter_num', chapter)
        .eq('verse_num', verse)
        .eq('translation_slug', slug)
        .single();
      
      if (data && !error) {
        setPreview({ he: data.text_he, en: data.text_en || '' });
      } else {
        const { data: fallback } = await supabase
          .from('reader_verses_view')
          .select('text_he, text_en')
          .eq('book_id', book)
          .eq('chapter_num', chapter)
          .eq('verse_num', verse)
          .limit(1)
          .single();
          
        if (fallback) setPreview({ he: fallback.text_he, en: fallback.text_en || '' });
      }
    } catch (e) {
      console.error("Preview fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [book, chapter, verse, hidePreview, preview, loading, checkAccess]);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const tooltipWidth = 320; 
    const padding = 16; 

    const targetCenter = rect.left + (rect.width / 2);
    let tooltipLeft = targetCenter - (tooltipWidth / 2);
    
    if (tooltipLeft < padding) tooltipLeft = padding;
    if (tooltipLeft > viewportWidth - tooltipWidth - padding) {
      tooltipLeft = viewportWidth - tooltipWidth - padding;
    }

    let cssArrowLeft = targetCenter - tooltipLeft;
    if (cssArrowLeft < 24) cssArrowLeft = 24;
    if (cssArrowLeft > tooltipWidth - 24) cssArrowLeft = tooltipWidth - 24;

    const estimatedHeight = isRestricted ? 180 : 340; 
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    
    const placement = (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

    setTooltipStyle({
      top, left: tooltipLeft, arrowLeft: cssArrowLeft,
      placement, opacity: 1, scale: 1
    });
  };

  // --- CORE BACKSTACK LOGIC ---
  const executeNavigation = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reader-log-history'));
    }
    setIsOpen(false);
    onClick(book, chapter, verse);
  };

  const handleTouchStart = () => {
    if (!isTouch) setIsTouch(true);
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault(); 
    
    if (isTouch) {
      if (!isOpen) {
        updatePosition();
        setIsOpen(true);
        fetchPreview();
      } else {
        setIsOpen(false);
      }
    } else {
      // Desktop: Direct jump if not restricted
      if (!isRestricted) executeNavigation();
    }
  };

  const handleMouseEnter = () => {
    if (isTouch || hidePreview) return;
    updatePosition();
    setIsOpen(true);
    fetchPreview();
  };

  const handleMouseLeave = () => {
    if (isTouch) return;
    setIsOpen(false);
  };

  const isGreek = useMemo(() => {
    if (!preview?.he) return false;
    return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(preview.he);
  }, [preview?.he]);

  const arrowPlacementClasses = tooltipStyle.placement === 'top' 
    ? "-bottom-[6px] border-r border-b" 
    : "-top-[6px] border-l border-t";

  const baseColorClasses = isRestricted === true
    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 grayscale cursor-not-allowed"
    : variant === 'subtle'
      ? "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200 hover:dark:bg-slate-800 hover:text-slate-700 hover:dark:text-slate-300"
      : variant === 'resolved'
      ? "bg-white/10 text-blue-100 border-white/20 hover:bg-white/20 hover:text-white"
      : "bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white";

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={handleInteraction}
        onTouchStart={handleTouchStart}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black rounded-md border shadow-sm transition-all group/badge active:scale-95 ${baseColorClasses} ${className}`}
        title={isRestricted ? `${targetCollection} Restricted` : `View ${displayLabel}`}
      >
        {isRestricted && <Lock size={10} className="text-slate-400" />}
        {displayLabel}
        {!hideIcon && !isRestricted && (
          <ExternalLink size={10} className="opacity-0 group-hover/badge:opacity-100 transition-opacity" />
        )}
      </button>

      {mounted && isOpen && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-9999 pointer-events-none duration-200 ease-out"
          style={{ 
            top: tooltipStyle.top, 
            left: tooltipStyle.left, 
            opacity: tooltipStyle.opacity,
            transform: `${tooltipStyle.placement === 'top' ? 'translateY(-100%) ' : ''}scale(${tooltipStyle.scale})`,
            transformOrigin: tooltipStyle.placement === 'top' ? 'bottom center' : 'top center',
            transitionProperty: 'opacity, transform',
            visibility: isOpen ? 'visible' : 'hidden'
          }}
        >
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-[320px] flex flex-col overflow-hidden pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
            
            {/* Header with Nav Logic */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-indigo-500 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{displayLabel}</span>
              </div>
              
              {!isRestricted && isTouch && (
                <button 
                  onClick={executeNavigation}
                  className="flex items-center gap-1.5 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                >
                  Go to Verse <ArrowRight size={10} strokeWidth={3} />
                </button>
              )}
            </div>

            <div className="p-5 flex flex-col gap-3 text-left">
              {isRestricted ? (
                  <div className="py-2 text-center space-y-4">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm rotate-3">
                      <Lock size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Coming Soon</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed px-2">
                        The <span className="font-bold text-indigo-600 dark:text-indigo-400">{targetCollection}</span> collection is currently being processed and verified for the archive.
                      </p>
                    </div>
                  </div>
              ) : (
                <>
                  {loading ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                      <Loader2 size={24} className="animate-spin text-indigo-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Consulting Scrolls...</span>
                    </div>
                  ) : preview ? (
                    <div className="space-y-4">
                      <p 
                        className={`font-serif text-slate-900 dark:text-slate-100 leading-relaxed ${isGreek ? 'text-sm text-left' : 'text-xl text-right'}`} 
                        dir={isGreek ? "ltr" : "rtl"}
                      >
                        {preview.he}{isRange && " ..."}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic border-l-2 border-slate-100 dark:border-slate-800 pl-3">
                        {preview.en}{isRange && " ..."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-4">Preview unavailable.</p>
                  )}
                </>
              )}
            </div>

            {/* Mobile Touch Helper Footer */}
            {isTouch && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Tap outside to close</span>
              </div>
            )}

            <div 
              className={`absolute w-3 h-3 bg-white dark:bg-slate-900 rotate-45 border-slate-200 dark:border-slate-800 ${arrowPlacementClasses}`}
              style={{ 
                left: tooltipStyle.arrowLeft, 
                transform: 'translateX(-50%) rotate(45deg)',
                zIndex: -1 
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};