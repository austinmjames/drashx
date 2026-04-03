// Path: src/shared/ui/SmartText.tsx
import React, { useMemo } from 'react';
import { splitTextByReferences, ParsedReference } from '@/shared/lib/ReferenceParser';
import { ReferenceLink } from '@/shared/ui/ReferenceLink';

interface SmartTextProps {
  text: string;
  className?: string;
  onReferenceClick: (book: string, chapter: number, verse: number) => void;
  isHtml?: boolean; // Added to support rich text from comments
  referenceVariant?: 'default' | 'subtle' | 'resolved'; // Added for variant support
  hideReferenceIcon?: boolean; // Added to hide external link icon
}

type ReferenceClickHandler = (book: string, chapter: number, verse: number) => void;

const renderNodeToReact = (
  node: Node, 
  onReferenceClick: ReferenceClickHandler, 
  index: string,
  referenceVariant?: 'default' | 'subtle' | 'resolved',
  hideReferenceIcon?: boolean
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

    const children = Array.from(el.childNodes).map((child, i) => 
      renderNodeToReact(child, onReferenceClick, `${index}-${i}`, referenceVariant, hideReferenceIcon)
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
  hideReferenceIcon = false
}: SmartTextProps) => {
  const content = useMemo(() => {
    if (!isHtml) {
      // Fallback for plain text parsing
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
    if (typeof window !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return Array.from(doc.body.childNodes).map((node, i) => 
        renderNodeToReact(node, onReferenceClick, `root-${i}`, referenceVariant, hideReferenceIcon)
      );
    }
    
    // SSR Fallback
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }, [text, isHtml, onReferenceClick, referenceVariant, hideReferenceIcon]);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {content}
    </div>
  );
};