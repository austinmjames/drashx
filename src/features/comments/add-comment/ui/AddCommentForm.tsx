// Path: src/features/comments/add-comment/ui/AddCommentForm.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bold, Italic, Underline, X, Loader2, Highlighter, Type } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

interface AddCommentFormProps {
  verseId: string | number;
  groupId?: string; 
  parentId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  fullHeight?: boolean;
  isEditMode?: boolean;
  commentId?: string;
  initialContent?: string;
  referenceLabel?: string;
}

export const AddCommentForm = ({ 
  verseId, 
  groupId,
  parentId = null, 
  onSuccess,
  onCancel,
  fullHeight = false,
  isEditMode = false,
  commentId,
  initialContent = '',
  referenceLabel
}: AddCommentFormProps) => {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [formats, setFormats] = useState({ 
    bold: false, 
    italic: false, 
    underline: false,
    highlight: false,
    small: false,
    large: false
  });

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
    }
  }, [initialContent]);

  const checkFormats = () => {
    if (typeof document !== 'undefined') {
      const fontSize = document.queryCommandValue('fontSize');
      setFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        highlight: document.queryCommandValue('backColor') === 'rgb(254, 240, 138)' || document.queryCommandValue('hiliteColor') === 'rgb(254, 240, 138)',
        small: fontSize === '2',
        large: fontSize === '5'
      });
    }
  };

  const getTextLength = (htmlString: string) => {
    if (typeof window === 'undefined') return htmlString.length;
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlString;
    return tmp.textContent?.trim().length || 0;
  };

  const textLength = getTextLength(content);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (textLength === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error("You must be logged in to post an insight.");
      }

      if (isEditMode && commentId) {
        const { error: updateError } = await supabase
          .from('comments')
          .update({ content, is_edited: true })
          .eq('id', commentId);
          
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('comments')
          .insert([
            { 
              content, 
              verse_id: verseId, 
              group_id: groupId || null, 
              parent_id: parentId,
              user_id: session.user.id 
            }
          ]);
          
        if (insertError) throw insertError;
      }

      setContent('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError(String(err));
    } finally {
      setIsSubmitting(false);
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

  const toggleHighlight = () => {
    const isHighlighted = formats.highlight;
    applyFormat('hiliteColor', isHighlighted ? 'transparent' : '#fef08a');
  };

  const toggleSize = (size: '2' | '5') => {
    const currentSize = document.queryCommandValue('fontSize');
    applyFormat('fontSize', currentSize === size ? '3' : size);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.innerHTML);
    checkFormats();
  };

  const placeholderText = isEditMode 
    ? "Update your insight..." 
    : parentId 
      ? "Write a reply..." 
      : "Share an insight on this verse...";

  return (
    <div 
      className={`flex flex-col bg-white dark:bg-slate-900 transition-all shadow-sm overflow-hidden ${
        fullHeight ? 'h-full w-full' : 'rounded-2xl border border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Tighter Formatting Toolbar (Now includes Close and Reference) */}
      <div className={`flex items-center justify-between p-1 border-b border-slate-100 dark:border-slate-800 ${fullHeight ? 'px-6 py-3 bg-slate-50/50' : 'px-2 bg-white dark:bg-slate-900'}`}>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
            className={`p-1.5 rounded transition-colors ${formats.bold ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Bold"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
            className={`p-1.5 rounded transition-colors ${formats.italic ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Italic"
          >
            <Italic size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
            className={`p-1.5 rounded transition-colors ${formats.underline ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Underline"
          >
            <Underline size={13} />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleHighlight(); }}
            className={`p-1.5 rounded transition-colors ${formats.highlight ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Highlight"
          >
            <Highlighter size={13} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleSize('2'); }}
            className={`p-1.5 rounded transition-colors ${formats.small ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Small Text"
          >
            <div className="flex items-end gap-0.5">
              <Type size={11} />
              <span className="text-[8px] font-bold">S</span>
            </div>
          </button>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleSize('5'); }}
            className={`p-1.5 rounded transition-colors ${formats.large ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Large Text"
          >
            <div className="flex items-end gap-0.5">
              <Type size={15} />
              <span className="text-[8px] font-bold">L</span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {referenceLabel && (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:block">
              {referenceLabel}
            </span>
          )}
          {onCancel && (
            <button 
              type="button"
              onClick={onCancel}
              title="Close"
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-[11px] font-medium border-b border-red-100">
          {error}
        </div>
      )}

      {/* Editor Area with Floating Reply Button */}
      <div className="relative w-full flex-1 flex flex-col min-h-35">
        {textLength === 0 && (
          <div className={`absolute top-4 pointer-events-none select-none text-slate-400 ${fullHeight ? 'left-6 text-base' : 'left-4 text-sm'}`}>
            {placeholderText}
          </div>
        )}
        
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyUp={checkFormats}
          onMouseUp={checkFormats}
          className={`w-full bg-transparent border-none focus:ring-0 outline-none text-slate-700 dark:text-slate-300 leading-relaxed overflow-y-auto [&_b]:font-bold [&_i]:italic [&_u]:underline ${
            fullHeight ? 'flex-1 font-serif text-base p-6' : 'max-h-64 text-sm p-4'
          } pb-16`}
        />

        {/* Floating Submit Button (Positioned inside the box) */}
        <div className="absolute bottom-3 right-3 z-10">
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting || textLength === 0}
            className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full transition-all disabled:opacity-40 shadow-lg shadow-indigo-600/20 px-5 py-1.5 text-xs ${
              fullHeight ? 'sm:px-8 sm:py-2.5 sm:text-sm' : ''
            }`}
          >
            {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            <span>{isSubmitting ? 'Saving' : isEditMode ? 'Save' : parentId ? 'Reply' : 'Publish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};