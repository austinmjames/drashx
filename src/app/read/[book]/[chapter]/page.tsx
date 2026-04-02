import React from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '@/shared/api/supabase';
import { ReaderPage } from '@/views/reader/ui/ReaderPage';

/**
 * Optimized Server Component
 * Path: src/app/read/[book]/[chapter]/page.tsx
 * * UPGRADES:
 * 1. Server-Side Data Fetching: Fetches book and verses before rendering.
 * 2. Instant First Paint: Eliminates the "Loading verses..." skeleton on first load.
 * 3. SEO: Makes Hebrew and English text visible to search engines.
 */
export default async function ReadChapterRoute({ 
  params 
}: { 
  params: { book: string, chapter: string } 
}) {
  const { book, chapter } = params;
  const decodedBook = decodeURIComponent(book);
  const chapterNum = parseInt(chapter, 10);

  // 1. Fetch Book Metadata (Hebrew Title) on the Server
  const { data: bookData } = await supabase
    .from('books')
    .select('*')
    .ilike('name_en', decodedBook)
    .single();

  // Handle invalid book names immediately
  if (!bookData) return notFound();

  // 2. Fetch Verses for initial render on the Server
  const { data: versesData } = await supabase
    .from('reader_verses_view')
    .select('*')
    .eq('book_id', bookData.name_en)
    .eq('chapter_num', chapterNum)
    .order('verse_num', { ascending: true });

  // 3. Pass the fetched data as "initial" props to the Client Component
  // This satisfies the "Server-Side Fetching" version of ReaderPage in your Canvas.
  return (
    <ReaderPage 
      bookName={decodedBook}
      chapterNumber={chapterNum}
      initialVerses={versesData || []}
      initialHebrewTitle={bookData.name_he}
    />
  );
}