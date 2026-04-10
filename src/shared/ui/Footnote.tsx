// Path: src/shared/ui/Footnote.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface FootnoteProps {
  marker: string;
  contentHtml: string;
}

export const Footnote = ({ marker, contentHtml }: FootnoteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close footnote if the user starts scrolling the page
  useEffect(() => {
    const handleScroll = () => setIsOpen(false);
    if (isOpen) window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      
      // Calculate horizontal center relative to the button
      let left = rect.left - 150 + (rect.width / 2);
      
      // Keep the popover safely within the viewport bounds
      if (left < 16) left = 16;
      if (left + 300 > window.innerWidth - 16) left = window.innerWidth - 300 - 16;

      setCoords({
        top: rect.bottom + 8, // Just below the marker
        left: left
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`inline-flex items-center justify-center min-w-[1.6em] h-[1.6em] px-1 ml-0.5 rounded-md text-[0.7em] font-black align-super transition-all shadow-sm border ${
          isOpen 
            ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/30 scale-110 z-50 relative' 
            : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
        }`}
        aria-label={`View footnote ${marker}`}
        title={`View footnote ${marker}`}
      >
        {marker}
      </button>
      
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9998" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
          {/* Shaded backdrop specific to the footnote */}
          <div className="absolute inset-0 bg-slate-900/5 dark:bg-black/20 backdrop-blur-[1px] transition-all" />
          
          {/* Popover Card */}
          <div 
            className="absolute z-9999 w-75 max-w-[85vw] bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 leading-relaxed animate-in fade-in zoom-in-95 duration-200"
            style={{ top: coords.top, left: coords.left }}
            onClick={e => e.stopPropagation()}
          >
            <div 
              className="prose prose-slate dark:prose-invert prose-sm max-w-none [&_b]:font-black [&_b]:text-slate-900 [&_b]:dark:text-white"
              dangerouslySetInnerHTML={{ __html: contentHtml }} 
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};