// Path: src/entities/verse/ui/VerseCard.tsx
"use client";

import React, { useState } from 'react';
import { HebrewVerseRenderer } from './HebrewVerseRenderer';
import { useVerseReadStatus } from '@/features/comments/read-receipts/api/useVerseReadStatus';

const toHebrewNumeral = (n: number): string => {
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת"];
  if (n === 15) return "טו";
  if (n === 16) return "טז";
  let res = "";
  let num = n;
  if (num >= 100) { res += hundreds[Math.floor(num / 100)]; num %= 100; }
  if (num >= 10) { res += tens[Math.floor(num / 10)]; num %= 10; }
  res += units[num];
  return res;
};

export interface VerseWord {
  id: number;
  text: string;
  divided_text?: string | null;
  strongs: string | null;
  morph: string | null;
  root_text?: string | null;
  transliteration?: string | null;
  pronunciation?: string | null; 
  meaning?: string | null;
}

export interface Verse {
  id?: number | string;
  verse_id?: number | string;
  verse_number?: number;
  verse_num?: number;
  text_he?: string;
  text_he_voweled?: string;
  text_he_no_vowels?: string;
  text_he_consonantal?: string;
  text_en?: string;
  text_en_jps?: string;
  text_en_modernized?: string;
  words?: VerseWord[];
  latest_comment_at?: string;
}

interface VerseCardProps {
  verse: Verse;
  active?: boolean;
  languageMode?: 'both' | 'en' | 'he';
  translation: 'jps1917' | 'modernized';
  hebrewStyle: 'niqqud' | 'no-niqqud';
  onClick?: () => void;
  onWordClick?: (strongs: string) => void;
  groupId?: string | null; 
  userId?: string | null;   
}

export const VerseCard = ({ 
  verse, 
  active = false, 
  languageMode = 'both', 
  translation,
  hebrewStyle, 
  onClick,
  onWordClick,
  groupId,
  userId
}: VerseCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOptimisticallyRead, setIsOptimisticallyRead] = useState(false);

  const verseId = verse.verse_id || verse.id;
  const { status, markAsRead } = useVerseReadStatus(verseId, groupId, userId);

  // Derived status taking into account the local optimistic click
  const currentStatus = isOptimisticallyRead ? (status === 'none' ? 'none' : 'read') : status;

  const voweled = verse.text_he_voweled || verse.text_he || "";
  const consonantal = verse.text_he_consonantal || verse.text_he_no_vowels || "";
  const displayHebrew = hebrewStyle === 'niqqud' ? voweled : (consonantal || voweled);

  const jps = verse.text_en_jps || verse.text_en || "";
  const modernized = verse.text_en_modernized || "";
  const displayEnglish = translation === 'modernized' ? (modernized || jps) : jps;

  const verseNumber = verse.verse_num || verse.verse_number || 0;

  // Boost Z-index minimally when hovered or active so lexicon tooltips appear OVER adjacent cards,
  // but remain UNDER sticky site-wide elements like headers (which typically use z-10 or higher).
  const stateClasses = active 
    ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 z-[1]" 
    : isHovered 
      ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 z-[2]" 
      : "bg-transparent border-slate-200 dark:border-slate-800 z-0";

  const handleCardClick = () => {
    if (currentStatus === 'unread') {
      setIsOptimisticallyRead(true);
      markAsRead();
    }
    if (onClick) onClick();
  };

  // Determine vertical offset for top-aligned items (Card padding is p-6 = 24px)
  const isHebrewVisible = (languageMode === 'both' || languageMode === 'he');
  const firstLineHeight = isHebrewVisible ? 'h-[1.8em]' : 'h-[1.625em]';

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`p-6 border-b transition-all cursor-pointer group relative isolate ${stateClasses}`}
    >
      {/* LEFT SIDE: Unread Status Indicator - Vertically Centered */}
      {currentStatus === 'unread' && (
        <div 
          className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-blue-500 dark:bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest rounded shadow-sm shadow-blue-500/30 z-10"
          title="Unread commentary available"
        >
          New
        </div>
      )}

      {/* TOP RIGHT: Read Status Indicator - Centered with first line of text. top-7 provides a slight nudge down from the padding edge. */}
      {currentStatus === 'read' && (
        <div 
          className={`absolute right-3 top-7 ${firstLineHeight} flex items-center transition-all duration-300 z-10`}
        >
          <div 
            className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500/40 opacity-60"
            title="Commentary read"
          />
        </div>
      )}

      {/* Main Content with Horizontal Padding to prevent icon overlap */}
      <div className="flex flex-col gap-6 px-4">
        
        {/* Hebrew Block */}
        {isHebrewVisible && (
          <div className="flex gap-6 items-start" dir="rtl">
            {/* Number Container: Forced height to match text line-height for perfect vertical centering */}
            <div className="shrink-0 min-w-8 flex items-center justify-end h-[1.8em] text-3xl">
              <span className={`text-lg font-serif font-bold transition-colors ${active || isHovered ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-700'}`}>
                {toHebrewNumeral(verseNumber)}
              </span>
            </div>
            
            <div className="flex-1">
              {verse.words && verse.words.length > 0 ? (
                <HebrewVerseRenderer 
                  words={verse.words} 
                  hebrewStyle={hebrewStyle} 
                  verseTranslation={displayEnglish}
                  onWordClick={onWordClick}
                />
              ) : (
                <span className="text-3xl leading-[1.8] font-serif text-slate-900 dark:text-slate-100">{displayHebrew}</span>
              )}
            </div>
          </div>
        )}

        {/* English Block */}
        {(languageMode === 'both' || languageMode === 'en') && (
          <div className="flex gap-6 items-start" dir="ltr">
            {/* Number Container: Matches 'leading-relaxed' (approx 1.625em) and 'text-lg' of the paragraph */}
            <div className="shrink-0 min-w-8 flex items-center justify-start h-[1.625em] text-lg">
              <span className={`text-sm font-sans tabular-nums font-medium transition-colors ${active || isHovered ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {verseNumber}
              </span>
            </div>
            
            <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 flex-1">
              {displayEnglish || <span className="text-slate-300 italic">Translation missing</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};