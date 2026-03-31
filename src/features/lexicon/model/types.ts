// Path: src/features/lexicon/model/types.ts

export interface LexiconEntry {
  id: string; // Strong's number e.g., H1254
  lemma: string;
  transliteration: string | null;
  pronunciation: string | null;
  short_def: string | null;
  long_def: string | null;
}

export interface Occurrence {
  book_name: string;
  chapter_number: number;
  verse_number: number;
  text: string;
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
  chapters: SupabaseChapter | SupabaseChapter[] | null;
}