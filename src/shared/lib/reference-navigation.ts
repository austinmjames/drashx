// Path: src/shared/lib/reference-navigation.ts

/**
 * Reusable utility to generate a path to a specific location in the reader.
 * Used by Lexicon, Comments, and Search results.
 */
export const getVersePath = (bookName: string, chapterNumber: number, verseNumber?: number) => {
  // Ensure the book name is URL-safe
  const encodedBook = encodeURIComponent(bookName.trim());
  const path = `/read/${encodedBook}/${chapterNumber}`;
  
  // Appends a query parameter so the ReaderPage can scroll to/highlight the verse
  return verseNumber ? `${path}?v=${verseNumber}` : path;
};

/**
 * Simple interface for a Biblical Reference
 */
export interface BibleRef {
  book: string;
  chapter: number;
  verse?: number;
}