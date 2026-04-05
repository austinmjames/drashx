// Path: src/shared/ui/ReferenceLink.tsx
"use client";

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Loader2, Lock, Sparkles, ExternalLink } from 'lucide-react';
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
  const [enabling, setEnabling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
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
  const displayLabel = label || `${book} ${chapter}:${verse}`;
  const isRange = displayLabel.includes('-') || displayLabel.includes(',');

  /**
   * Enhanced checkAccess to return collection info for the preview fetcher.
   */
  const checkAccess = useCallback(async (retryCount = 0): Promise<{ restricted: boolean; collection: string }> => {
    try {
      const { data: bookMeta } = await supabase
        .from('books')
        .select('collection')
        .ilike('name_en', book.trim())
        .single();
      
      const collection = bookMeta?.collection || 'Tanakh';
      setTargetCollection(collection);

      if (collection === 'Tanakh') {
        setIsRestricted(false);
        return { restricted: false, collection };
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!user) {
        setIsRestricted(true);
        return { restricted: true, collection };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('enabled_collections')
        .eq('id', user.id)
        .single();
      
      const restricted = !profile?.enabled_collections?.includes(collection);
      setIsRestricted(restricted);
      return { restricted, collection };
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
    
    // 1. Check access and get the collection context
    const { restricted, collection } = await checkAccess();
    if (restricted) { setLoading(false); return; }

    // 2. Map collection to the primary translation slug for the preview
    // Tanakh defaults to JPS, Christianity defaults to WEB
    const slug = collection === 'Christianity' ? 'WEB' : 'JPS';

    try {
      // FIX: Added .eq('translation_slug', slug) to ensure the view returns exactly one row.
      // Without this filter, the new multi-translation architecture returns 0 rows or errors.
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
        // Final fallback: try without a slug if the join failed (for newly added verses not yet in translation table)
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

  const handleEnableCollection = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Must be logged in");
      const { data: profile } = await supabase.from('profiles').select('enabled_collections').eq('id', user.id).single();
      const currentCols = profile?.enabled_collections || ['Tanakh'];
      const updatedCols = Array.from(new Set([...currentCols, targetCollection]));
      await supabase.from('profiles').update({ extended_library_enabled: true, enabled_collections: updatedCols, updated_at: new Date().toISOString() }).eq('id', user.id);
      setIsRestricted(false);
      setTimeout(fetchPreview, 50);
    } catch (err) {
      console.error("Failed to enable collection:", err);
    } finally {
      setEnabling(false);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (hidePreview) return;
    fetchPreview();
    setIsHovered(true);

    const rect = e.currentTarget.getBoundingClientRect();
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

    const estimatedHeight = isRestricted ? 220 : 340; 
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    
    const placement = (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;

    setTooltipStyle({
      top, left: tooltipLeft, arrowLeft: cssArrowLeft,
      placement, opacity: 1, scale: 1
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTooltipStyle(prev => ({ ...prev, opacity: 0, scale: 0.95 }));
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRestricted) return;
    onClick(book, chapter, verse);
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
        onClick={handleLinkClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black rounded-md border shadow-sm transition-all group/badge active:scale-95 ${baseColorClasses} ${className}`}
        title={isRestricted ? `${targetCollection} Restricted` : `Jump to ${displayLabel}`}
      >
        {isRestricted && <Lock size={10} className="text-slate-400" />}
        {displayLabel}
        {!hideIcon && !isRestricted && (
          <ExternalLink size={10} className="opacity-0 group-hover/badge:opacity-100 transition-opacity" />
        )}
      </button>

      {typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-9999 pointer-events-none duration-200 ease-out"
          style={{ 
            top: tooltipStyle.top, 
            left: tooltipStyle.left, 
            opacity: tooltipStyle.opacity,
            transform: `${tooltipStyle.placement === 'top' ? 'translateY(-100%) ' : ''}scale(${tooltipStyle.scale})`,
            transformOrigin: tooltipStyle.placement === 'top' ? 'bottom center' : 'top center',
            transitionProperty: 'opacity, transform',
            visibility: isHovered ? 'visible' : 'hidden'
          }}
        >
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 w-[320px] flex flex-col gap-3 text-left pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
            
            {isRestricted ? (
                <div className="py-2 text-center space-y-4">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm rotate-3">
                    <Lock size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Library Access Restricted</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed px-2">
                      The <span className="font-bold text-indigo-600 dark:text-indigo-400">{targetCollection}</span> collection has not yet been enabled.
                    </p>
                  </div>
                  <button onClick={handleEnableCollection} disabled={enabling} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95">
                    {enabling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Enable {targetCollection}
                  </button>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Manage in Account Settings &gt; Library</p>
                </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <BookOpen size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">{displayLabel}</span>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 py-6 text-slate-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Consulting Scrolls...</span>
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