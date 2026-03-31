// Path: src/shared/ui/SmartText.tsx
import React, { useMemo } from 'react';
import { splitTextByReferences, ParsedReference } from '@/shared/lib/ReferenceParser';
import { ReferenceLink } from '@/shared/ui/ReferenceLink';

interface SmartTextProps {
  text: string;
  className?: string;
  onReferenceClick: (book: string, chapter: number, verse: number) => void;
  isHtml?: boolean; // Added to support rich text from comments
}

/**
 * SmartText takes a raw string, identifies Biblical references using ReferenceParser,
 * and replaces them with interactive ReferenceLink components.
 */
export const SmartText = ({ text, className = "", onReferenceClick, isHtml = false }: SmartTextProps) => {
  // Memoize the parsing to avoid re-calculating on every render 
  // unless the text itself changes.
  const parts = useMemo(() => splitTextByReferences(text), [text]);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        // If the part is a string, render it normally or as HTML
        if (typeof part === 'string') {
          return isHtml ? (
            <span key={`text-${index}`} dangerouslySetInnerHTML={{ __html: part }} />
          ) : (
            <span key={`text-${index}`}>{part}</span>
          );
        }

        // If the part is a ParsedReference object, render the Link component
        const ref = part as ParsedReference;
        return (
          <ReferenceLink
            key={`ref-${index}-${ref.book}-${ref.chapter}-${ref.verse}`}
            book={ref.book}
            chapter={ref.chapter}
            verse={ref.verse}
            label={ref.originalText}
            onClick={onReferenceClick}
            hidePreview={false} 
            className="mx-1 inline-flex"
          />
        );
      })}
    </div>
  );
};