// Path: src/entities/verse/ui/VerseCard.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HebrewVerseRenderer } from './HebrewVerseRenderer';
import { GreekVerseRenderer } from './GreekVerseRenderer';
import { useVerseReadStatus } from '@/features/comments/read-receipts/api/useVerseReadStatus';
import { SmartText } from '@/shared/ui/SmartText';
import { getVersePath } from '@/shared/lib/reference-navigation';

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

const toGreekNumeral = (n: number): string => {
  if (n <= 0 || n >= 1000) return n.toString();
  const ones = ["", "α", "β", "γ", "δ", "ε", "στ", "ζ", "η", "θ"];
  const tens = ["", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ϟ"];
  const hundreds = ["", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω", "ϡ"];
  let res = "";
  let num = n;
  if (num >= 100) { res += hundreds[Math.floor(num / 100)]; num %= 100; }
  if (num >= 10) { res += tens[Math.floor(num / 10)]; num %= 10; }
  res += ones[num];
  return res + "´"; 
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
  root_id?: string | null;
  semantic_domain?: string | null;
  variants?: Record<string, string | null>;
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
  words?: VerseWord[];
  latest_comment_at?: string;
  footnotes?: { id: string; text: string }[];
}

interface VerseCardProps {
  verse: Verse;
  active?: boolean;
  languageMode?: 'both' | 'en' | 'he';
  hebrewStyle: 'niqqud' | 'no-niqqud';
  onClick?: () => void;
  onWordClick?: (word: VerseWord) => void;
  groupId?: string | null; 
  userId?: string | null;   
}

export const VerseCard = ({ 
  verse, active = false, languageMode = 'both', 
  hebrewStyle, onClick, onWordClick, groupId, userId
}: VerseCardProps) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isOptimisticallyRead, setIsOptimisticallyRead] = useState(false);

  const verseId = verse.verse_id || verse.id;
  const { status, markAsRead } = useVerseReadStatus(verseId, groupId, userId);
  const currentStatus = isOptimisticallyRead ? (status === 'none' ? 'none' : 'read') : status;

  const voweled = verse.text_he_voweled || verse.text_he || "";
  const consonantal = verse.text_he_consonantal || verse.text_he_no_vowels || "";
  const displaySourceText = hebrewStyle === 'niqqud' ? voweled : (consonantal || voweled);
  const verseNumber = verse.verse_num || verse.verse_number || 0;
  const isGreekText = verse.words?.some(w => w.strongs?.startsWith('G')) ?? false;

  // Dynamic fetching passes the correct translation securely as `text_en`
  const displayEnglish = verse.text_en || "Translation unavailable.";

  const stateClasses = active 
    ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 z-[2]" 
    : isHovered 
      ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 z-[1]" 
      : "bg-transparent border-slate-200 dark:border-slate-800 z-0";

  const handleCardClick = () => {
    if (currentStatus === 'unread') {
      setIsOptimisticallyRead(true);
      markAsRead();
    }
    if (onClick) onClick();
  };

  const isHebrewVisible = (languageMode === 'both' || languageMode === 'he');
  const firstLineHeight = isHebrewVisible ? 'h-[1.8em]' : 'h-[1.625em]';

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`p-6 border-b transition-all cursor-pointer group relative isolate ${stateClasses}`}
    >
      {currentStatus === 'unread' && (
        <div className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-blue-500 dark:bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest rounded shadow-sm z-10">
          New
        </div>
      )}

      {currentStatus !== 'none' && (
        <div className={`absolute right-3 top-7 ${firstLineHeight} flex items-center transition-all duration-300 z-10`}>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500/40 opacity-60" />
        </div>
      )}

      <div className="flex flex-col gap-6 px-4">
        {isHebrewVisible && (
          <div className={`flex gap-6 items-start`} dir={isGreekText ? "ltr" : "rtl"}>
            <div className={`shrink-0 min-w-8 flex items-center h-[1.8em] text-2xl ${isGreekText ? 'justify-start' : 'justify-end'}`}>
              <span className={`text-lg font-serif font-bold transition-colors ${active || isHovered ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-700'}`}>
                {isGreekText ? toGreekNumeral(verseNumber) : toHebrewNumeral(verseNumber)}
              </span>
            </div>
            
            <div className="flex-1">
              {verse.words && verse.words.length > 0 ? (
                isGreekText ? (
                  <GreekVerseRenderer words={verse.words} verseTranslation={displayEnglish} onWordClick={onWordClick} size="md" />
                ) : (
                  <HebrewVerseRenderer words={verse.words} hebrewStyle={hebrewStyle} verseTranslation={displayEnglish} onWordClick={onWordClick} size="md" />
                )
              ) : (
                <span className="text-2xl leading-[1.8] font-serif font-normal text-slate-900 dark:text-slate-100">
                  {displaySourceText}
                </span>
              )}
            </div>
          </div>
        )}

        {(languageMode === 'both' || languageMode === 'en') && (
          <div className="flex gap-6 items-start" dir="ltr">
            <div className="shrink-0 min-w-8 flex items-center justify-start h-[1.625em] text-lg">
              <span className={`text-sm font-sans tabular-nums font-medium transition-colors ${active || isHovered ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {verseNumber}
              </span>
            </div>
            <div className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 flex-1">
              <SmartText 
                text={displayEnglish} 
                isHtml={true} 
                footnotes={verse.footnotes}
                onReferenceClick={(b,c,v) => router.push(getVersePath(b,c,v))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};