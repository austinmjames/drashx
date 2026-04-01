// Path: src/features/comments/add-comment/ui/AddCommentForm.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, X, Maximize2, Minimize2, 
  Loader2, BookOpen, AlertCircle, Info,
  Bold, Italic, Underline, Highlighter, Type 
} from 'lucide-react';
import { supabase } from '@/shared/api/supabase';

interface AddCommentFormProps {
  verseId: string | number;
  groupId?: string | null;
  parentId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
  initialContent?: string;
  initialTitle?: string;
  isEditMode?: boolean;
  commentId?: string;
  referenceLabel?: string;
  fullHeight?: boolean; 
}

export const AddCommentForm = ({
  verseId, groupId, parentId, onSuccess, onCancel,
  initialContent = "", initialTitle = "", isEditMode = false, 
  commentId, referenceLabel, fullHeight = false
}: AddCommentFormProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isExpanded, setIsExpanded] = useState(fullHeight);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const titleRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [formats, setFormats] = useState({ 
    bold: false, 
    italic: false, 
    underline: false,
    highlight: false,
    small: false,
    large: false
  });

  // Sync initial content and title to contentEditable divs
  useEffect(() => {
    if (titleRef.current && initialTitle && titleRef.current.innerHTML !== initialTitle) {
      titleRef.current.innerHTML = initialTitle;
    }
    if (editorRef.current && initialContent && editorRef.current.innerHTML !== initialContent) {
      editorRef.current.innerHTML = initialContent;
    }
  }, [initialTitle, initialContent]);

  const checkFormats = () => {
    if (typeof document !== 'undefined') {
      const fontSize = document.queryCommandValue('fontSize');
      setFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        highlight: document.queryCommandValue('backColor') === 'rgb(254, 240, 138)' || 
                   document.queryCommandValue('hiliteColor') === 'rgb(254, 240, 138)',
        small: fontSize === '2',
        large: fontSize === '4'
      });
    }
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
      editorRef.current.focus();
      setTimeout(checkFormats, 10); 
    }
  };

  const toggleSize = (size: '2' | '4') => {
    const isCurrentlyActive = (size === '2' && formats.small) || (size === '4' && formats.large);
    applyFormat('fontSize', isCurrentlyActive ? '3' : size);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const strippedContent = content.replace(/<[^>]*>?/gm, '').trim();
    if (!strippedContent && !isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");

      const payload = {
        user_id: user.id,
        verse_id: typeof verseId === 'string' ? parseInt(verseId, 10) : verseId,
        group_id: groupId === user.id ? null : (groupId || null),
        parent_id: parentId || null,
        title: !parentId ? (title.replace(/<[^>]*>?/gm, '').trim() || null) : null,
        content: content.trim()
      };

      let result;
      if (isEditMode && commentId) {
        result = await supabase.from('comments').update(payload).eq('id', commentId);
      } else {
        result = await supabase.from('comments').insert(payload);
      }

      if (result.error) throw result.error;
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to post insight.";
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const containerClasses = isExpanded 
    ? "absolute inset-0 z-[60] bg-white dark:bg-slate-950 flex flex-col animate-in fade-in zoom-in-95 duration-200"
    : "flex flex-col gap-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden";

  /**
   * GLOBAL SCALING INJECTOR:
   * We apply character-level scaling to anything marked .hebrew-scale
   * and we force the font-serif for consistent glyph weights.
   */
  const scalingClasses = `
    [&_.hebrew-scale]:text-[1.5em] 
    [&_.hebrew-scale]:leading-none
    [&_.hebrew-scale]:font-serif
    [&_.title-area_.hebrew-scale]:text-[1.8em]
    [&_div[contenteditable]]:outline-none
  `;

  const placeholderText = isEditMode 
    ? "Update your insight..." 
    : parentId 
      ? "Write a reply..." 
      : "Share an insight on this verse...";

  const isTextEmpty = content.replace(/<[^>]*>?/gm, '').trim().length === 0;
  const isTitleEmpty = title.replace(/<[^>]*>?/gm, '').trim().length === 0;

  return (
    <form onSubmit={handleSubmit} className={`${containerClasses} ${scalingClasses}`}>
      {/* 1. Header & Toolbar */}
      <div className={`flex flex-col border-b border-slate-100 dark:border-slate-800 ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/50' : ''}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <BookOpen size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
                {isEditMode ? 'Edit' : parentId ? 'Reply' : 'Add Insight'}
              </h3>
              {referenceLabel && <p className="text-[10px] text-slate-400 font-bold">{referenceLabel}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Minimize" : "Expand to fill"} aria-label={isExpanded ? "Minimize editor" : "Maximize editor"} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all">
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" onClick={onCancel} title="Cancel" aria-label="Cancel editing" className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-4 py-1.5 border-t border-slate-50 dark:border-slate-800/50">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className={`p-1.5 rounded transition-colors ${formats.bold ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`} title="Bold" aria-label="Toggle bold text"><Bold size={14} /></button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className={`p-1.5 rounded transition-colors ${formats.italic ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`} title="Italic" aria-label="Toggle italic text"><Italic size={14} /></button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className={`p-1.5 rounded transition-colors ${formats.underline ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`} title="Underline" aria-label="Toggle underline text"><Underline size={14} /></button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat('hiliteColor', formats.highlight ? 'transparent' : '#fef08a'); }} className={`p-1.5 rounded transition-colors ${formats.highlight ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`} title="Highlight" aria-label="Toggle text highlight"><Highlighter size={14} /></button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleSize('2'); }} className={`p-1.5 rounded transition-colors ${formats.small ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`} title="Small Text" aria-label="Switch to small font size"><div className="flex items-end gap-0.5"><Type size={12} /><span className="text-[8px] font-bold">S</span></div></button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleSize('4'); }} className={`p-1.5 rounded transition-colors ${formats.large ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`} title="Large Text" aria-label="Switch to large font size"><div className="flex items-end gap-0.5"><Type size={16} /><span className="text-[8px] font-bold">L</span></div></button>
        </div>
      </div>

      {/* 2. Inputs Area */}
      <div className={`flex-1 flex flex-col relative overflow-y-auto ${isExpanded ? 'p-6 md:p-10 max-w-4xl mx-auto w-full' : 'p-4'}`}>
        {!parentId && (
          <div className="mb-4 relative title-area">
            {isTitleEmpty && (
              <div className="absolute top-0 left-0 pointer-events-none select-none text-slate-300 dark:text-slate-700 text-lg md:text-xl font-black italic">
                Insight Title (Optional)...
              </div>
            )}
            <div
              ref={titleRef}
              contentEditable
              dir="auto"
              onInput={(e) => setTitle(e.currentTarget.innerHTML)}
              className="w-full bg-transparent text-lg md:text-xl font-black text-slate-900 dark:text-white border-b border-transparent focus:border-indigo-500/30 transition-all pb-2 font-serif min-h-[1.5em]"
            />
          </div>
        )}

        <div className="relative flex-1 flex flex-col min-h-37.5">
          {isTextEmpty && (
            <div className="absolute top-0 left-0 pointer-events-none select-none text-slate-400 italic">
              {placeholderText}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            dir="auto"
            onInput={(e) => setContent(e.currentTarget.innerHTML)}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
            onKeyUp={checkFormats}
            onMouseUp={checkFormats}
            className={`w-full flex-1 bg-transparent border-none focus:ring-0 outline-none text-slate-700 dark:text-slate-200 leading-relaxed [&_b]:font-bold [&_i]:italic [&_u]:underline ${isExpanded ? 'text-lg' : 'text-sm'}`}
          />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      {/* 3. Form Footer */}
      <div className={`px-4 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/50' : ''}`}>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <Info size={12} className="text-indigo-500" />
          <span>Rich text enabled</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button type="submit" disabled={isTextEmpty || isSubmitting} onClick={handleSubmit} aria-label={isEditMode ? 'Update insight' : parentId ? 'Post reply' : 'Publish insight'} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale transition-all active:scale-95">
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isEditMode ? 'Update' : parentId ? 'Reply' : 'Publish'}
          </button>
        </div>
      </div>
    </form>
  );
};