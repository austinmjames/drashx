// Path: src/features/lexicon/model/types.ts
import { VerseWord } from '@/entities/verse/ui/VerseCard';

export interface LexiconEntry {
  id: string; // Strong's number e.g., H1254
  lemma: string;
  transliteration: string | null;
  pronunciation: string | null;
  short_def: string | null;
  long_def: string | null;
  root_id?: string | null;
  semantic_domain?: string | null;
  origin_id?: string | null;
}

export interface Occurrence {
  book_name: string;
  chapter_number: number;
  verse_number: number;
  text: string;
  translation: string; // Added for English display in ReferencesTab
  words?: VerseWord[]; // Added for Greek/Hebrew word-level highlighting
}

export interface SupabaseBook {
  name_en: string;
}

export interface SupabaseChapter {
  chapter_number: number;
  books: SupabaseBook | SupabaseBook[] | null;
}

export interface SupabaseVerseResponse {
  verse_number: number;
  text_he: string;
  text_en?: string | null; // Added
  words?: VerseWord[];     // Added
  chapters: SupabaseChapter | SupabaseChapter[] | null;
}