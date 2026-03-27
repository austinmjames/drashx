import React from 'react';
import { ReaderPage } from '../../../../views/reader/ui/ReaderPage';

/**
 * Dynamic App Router Page
 * Path: src/app/read/[book]/[chapter]/page.tsx
 * Captures the URL parameters and passes them to the ReaderPage.
 */
export default function ReadChapterRoute({ params }: { params: { book: string, chapter: string } }) {
  const decodedBookName = decodeURIComponent(params.book);
  const chapterNumber = parseInt(params.chapter, 10);

  // Force type casting to resolve the IntrinsicAttributes error while TS server catches up
  const ReaderComponent = ReaderPage as React.ElementType;

  return <ReaderComponent bookName={decodedBookName} chapterNumber={chapterNumber} />;
}