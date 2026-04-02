import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { supabase } from '@/shared/api/supabase';
import { ReaderPage } from '@/views/reader/ui/ReaderPage';

interface PageProps {
  params: Promise<{
    book: string;
    chapter: string;
  }>;
}

/**
 * SEO Optimization: Dynamic Metadata
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book, chapter } = await params;
  const decodedBook = decodeURIComponent(book);
  
  return {
    title: `${decodedBook} ${chapter} | DrashX Tanakh Reader`,
    description: `Read and study ${decodedBook} chapter ${chapter} with collaborative community commentary.`,
  };
}

/**
 * Optimized Server Component
 * Path: src/app/read/[book]/[chapter]/page.tsx
 */
export default async function ReadChapterRoute(props: PageProps) {
  // 1. Await params (Required for Next.js 15 compatibility)
  const params = await props.params;
  const { book, chapter } = params;
  
  const decodedBook = decodeURIComponent(book);
  const chapterNum = parseInt(chapter, 10);

  // 2. Fetch Book Metadata (Hebrew Title) on the Server
  // Using .ilike for case-insensitive matching
  const { data: bookData, error: bookError } = await supabase
    .from('books')
    .select('*')
    .ilike('name_en', decodedBook)
    .single();

  // If the book doesn't exist at all, we return a 404
  if (bookError || !bookData) {
    console.error(`Book lookup failed for: ${decodedBook}`, bookError);
    return notFound();
  }

  // 3. Fetch Verses for initial render on the Server
  const { data: versesData } = await supabase
    .from('reader_verses_view')
    .select('*')
    .eq('book_id', bookData.name_en)
    .eq('chapter_num', chapterNum)
    .order('verse_num', { ascending: true });

  // 4. Pass the fetched data as "initial" props to the Client Component
  return (
    <ReaderPage 
      bookName={decodedBook}
      chapterNumber={chapterNum}
      initialVerses={versesData || []}
      initialHebrewTitle={bookData.name_he}
    />
  );
}