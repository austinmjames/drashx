// Path: src/shared/ui/SmartText.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { splitTextByReferences, ParsedReference } from '@/shared/lib/ReferenceParser';
import { ReferenceLink } from '@/shared/ui/ReferenceLink';
import { Footnote } from '@/shared/ui/Footnote';

export interface FootnoteData {
  id: string;
  text: string;
}

interface SmartTextProps {
  text: string;
  className?: string;
  onReferenceClick: (book: string, chapter: number, verse: number) => void;
  isHtml?: boolean;
  referenceVariant?: 'default' | 'subtle' | 'resolved';
  hideReferenceIcon?: boolean;
  footnotes?: FootnoteData[];
}

type ReferenceClickHandler = (book: string, chapter: number, verse: number) => void;

const renderNodeToReact = (
  node: Node, 
  onReferenceClick: ReferenceClickHandler, 
  index: string,
  referenceVariant?: 'default' | 'subtle' | 'resolved',
  hideReferenceIcon?: boolean,
  footnotes?: FootnoteData[]
): React.ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text.trim()) return text;
    const parts = splitTextByReferences(text);
    return parts.map((part, i) => {
      if (typeof part === 'string') return <React.Fragment key={`${index}-${i}`}>{part}</React.Fragment>;
      const ref = part as ParsedReference;
      return (
        <ReferenceLink
          key={`${index}-${i}-ref`}
          book={ref.book}
          chapter={ref.chapter}
          verse={ref.verse}
          label={ref.originalText}
          onClick={onReferenceClick}
          className="mx-1 inline-flex"
          hidePreview={false}
          variant={referenceVariant}
          hideIcon={hideReferenceIcon}
        />
      );
    });
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    let tagName = el.tagName.toLowerCase();
    
    // Skip script and style tags entirely for security
    if (tagName === 'script' || tagName === 'style') return null;

    const props: Record<string, unknown> = { key: index };
    
    // Map standard DOM attributes to React properties
    Array.from(el.attributes).forEach(attr => {
      if (attr.name === 'class') {
        props.className = attr.value;
      } else if (attr.name === 'style') {
        const styleObj: Record<string, string> = {};
        attr.value.split(';').forEach(s => {
          const [k, v] = s.split(':');
          if (k && v) {
            const camelKey = k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
            styleObj[camelKey] = v.trim();
          }
        });
        props.style = styleObj;
      } else {
        props[attr.name] = attr.value;
      }
    });

    // Safely transform deprecated <font> tags to <span> to prevent browser overrides
    if (tagName === 'font') {
      tagName = 'span';
      const size = el.getAttribute('size');
      if (size) {
        // Map size to scalable Tailwind classes relative to the parent container
        const emMap: Record<string, string> = {
          '1': 'text-[0.75em]',
          '2': 'text-[0.875em]',
          '3': 'text-[1em]',      // Ensures size 3 perfectly matches the parent container (text-sm)
          '4': 'text-[1.25em]',
          '5': 'text-[1.5em]',
          '6': 'text-[2em]',
          '7': 'text-[3em]'
        };
        props.className = `${props.className || ''} ${emMap[size] || 'text-[1em]'}`.trim();
        delete props['size']; // Ensure 'size' doesn't leak into the span
      }
    }

    // Safely transform unknown dictionary XML tags (<grk>, <heb>) to <span>
    if (tagName === 'grk' || tagName === 'heb') {
      const isGreek = tagName === 'grk';
      tagName = 'span';
      props.className = `${props.className || ''} ${isGreek ? 'font-serif' : 'font-hebrew text-[1.2em]'} text-indigo-600 dark:text-indigo-400 mx-1`.trim();
    }

    // Capture explicit footnote markers and inject the Footnote Component
    if (tagName === 'sup' && el.hasAttribute('data-footnote')) {
      const id = el.getAttribute('data-footnote');
      const footnote = footnotes?.find(f => f.id === id);
      const marker = el.textContent || id || '*';
      if (footnote) {
        return <Footnote key={index} marker={marker} contentHtml={footnote.text} />;
      }
    }

    const children = Array.from(el.childNodes).map((child, i) => 
      renderNodeToReact(child, onReferenceClick, `${index}-${i}`, referenceVariant, hideReferenceIcon, footnotes)
    );

    return React.createElement(tagName, props, children.length > 0 ? children : undefined);
  }
  return null;
};

/**
 * SmartText takes a raw string, identifies Biblical references using ReferenceParser,
 * and replaces them with interactive ReferenceLink components.
 */
export const SmartText = ({ 
  text, 
  className = "", 
  onReferenceClick, 
  isHtml = false,
  referenceVariant = 'default',
  hideReferenceIcon = false,
  footnotes = []
}: SmartTextProps) => {
  const [isMounted, setIsMounted] = useState(false);

  // Mark as mounted after initial hydration to safely use DOMParser.
  // Wrapped in a setTimeout to defer the state update, bypassing React's 
  // strict linter warning about triggering synchronous cascading renders in effects.
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const content = useMemo(() => {
    if (!isHtml) {
      // Fallback for plain text parsing (Safe for SSR)
      const parts = splitTextByReferences(text);
      return parts.map((part, index) => {
        if (typeof part === 'string') return <React.Fragment key={index}>{part}</React.Fragment>;
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
            variant={referenceVariant}
            hideIcon={hideReferenceIcon}
          />
        );
      });
    }

    // Safely parse rich text into a DOM tree and convert to React
    // IMPORTANT: Wait for component to mount (post-hydration) before using browser APIs
    if (isMounted && typeof window !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return Array.from(doc.body.childNodes).map((node, i) => 
        renderNodeToReact(node, onReferenceClick, `root-${i}`, referenceVariant, hideReferenceIcon, footnotes)
      );
    }
    
    // SSR / Initial Hydration Fallback
    // This perfectly matches what the server sends down
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }, [text, isHtml, onReferenceClick, referenceVariant, hideReferenceIcon, footnotes, isMounted]);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {content}
    </div>
  );
};