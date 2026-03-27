import React, { useState } from 'react';

/**
 * Helper to convert numbers to Hebrew Gematria numerals
 */
const toHebrewNumeral = (n: number): string => {
  const units = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const hundreds = ["", "ק", "ר", "ש", "ת"];

  if (n === 15) return "טו";
  if (n === 16) return "טז";

  let res = "";
  let num = n;
  if (num >= 100) {
    res += hundreds[Math.floor(num / 100)];
    num %= 100;
  }
  if (num >= 10) {
    res += tens[Math.floor(num / 10)];
    num %= 10;
  }
  res += units[num];
  return res;
};

/**
 * Verse Entity Type Definition
 */
export interface Verse {
  id?: number | string;
  verse_id?: number | string;
  verse_number?: number;
  verse_num?: number;

  // Hebrew Variations
  text_he?: string;
  text_he_voweled?: string;
  text_he_no_vowels?: string;
  text_he_consonantal?: string;

  // English Variations
  text_en?: string;
  text_en_jps?: string;
  text_en_modernized?: string;

  chapter_id?: number | string;
  chapter_num?: number;
}

interface VerseCardProps {
  verse: Verse;
  active?: boolean;
  languageMode?: 'both' | 'en' | 'he';
  translation: 'jps1917' | 'modernized';
  hebrewStyle: 'niqqud' | 'no-niqqud';
  onClick?: () => void;
}

export const VerseCard = ({
  verse,
  active = false,
  languageMode = 'both',
  translation,
  hebrewStyle,
  onClick
}: VerseCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // 1. Resolve Hebrew text
  const voweled = verse.text_he_voweled || verse.text_he || "";
  const consonantal = verse.text_he_consonantal || verse.text_he_no_vowels || "";
  const displayHebrew = hebrewStyle === 'niqqud' ? voweled : (consonantal || voweled);

  // 2. Resolve English translation
  const jps = verse.text_en_jps || verse.text_en || "";
  const modernized = verse.text_en_modernized || "";
  const displayEnglish = translation === 'modernized' ? modernized : jps;

  // 3. Resolve numbers
  const verseNumber = verse.verse_num || verse.verse_number || 0;

  // Logic-based background classes to bypass CSS build issues
  const baseClasses = "p-6 border-b transition-colors cursor-pointer group";
  const stateClasses = active 
    ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200" 
    : isHovered 
      ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800" 
      : "bg-transparent border-slate-200 dark:border-slate-800";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${baseClasses} ${stateClasses}`}
    >
      <div className="flex flex-col gap-6">
        
        {/* Hebrew Text Block (Hebrew Number on the RIGHT) */}
        {(languageMode === 'both' || languageMode === 'he') && (
          <div className="flex gap-6 items-start" dir="rtl">
            <span className={`text-lg font-serif font-bold pt-1 shrink-0 min-w-8 text-right transition-colors ${active || isHovered ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-700'}`}>
              {toHebrewNumeral(verseNumber)}
            </span>
            <p className="text-3xl leading-[1.8] text-right font-serif text-slate-900 dark:text-slate-100 flex-1">
              {displayHebrew || <span className="text-slate-300 italic">Hebrew text missing</span>}
            </p>
          </div>
        )}
        
        {/* English Text Block (English Number on the LEFT) */}
        {(languageMode === 'both' || languageMode === 'en') && (
          <div className="flex gap-6 items-start" dir="ltr">
            <span className={`text-sm font-sans tabular-nums font-medium pt-1.5 shrink-0 min-w-8 text-left transition-colors ${active || isHovered ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`}>
              {verseNumber}
            </span>
            <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 flex-1">
              {displayEnglish || <span className="text-slate-300 italic">Translation missing</span>}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};