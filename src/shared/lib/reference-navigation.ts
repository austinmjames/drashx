// Path: src/shared/lib/reference-navigation.ts

/**
 * Reusable utility to generate a path to a specific location in the reader.
 * Used by Lexicon, Comments, and Search results.
 * Updated to support textual chapter identifiers (e.g. "Title Page").
 */
export const getVersePath = (bookName: string, chapterNumber: string | number, verseNumber?: number) => {
  // Ensure both book and chapter are URL-safe
  const encodedBook = encodeURIComponent(bookName.trim());
  const encodedChapter = encodeURIComponent(String(chapterNumber).trim());
  
  const path = `/read/${encodedBook}/${encodedChapter}`;
  
  // Appends a query parameter so the ReaderPage can scroll to/highlight the verse
  // Using query params (?v=) is more reliable than hashes (#) for initial React loads
  return verseNumber ? `${path}?v=${verseNumber}` : path;
};

/**
 * Simple interface for a Biblical Reference
 */
export interface BibleRef {
  book: string;
  chapter: string | number;
  verse?: number;
}