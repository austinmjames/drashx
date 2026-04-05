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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book, chapter } = await params;
  const decodedBook = decodeURIComponent(book);
  return {
    title: `${decodedBook} ${chapter} | DrashX`,
    description: `Read and study ${decodedBook} chapter ${chapter}.`,
  };
}

export default async function ReadChapterRoute(props: PageProps) {
  const params = await props.params;
  const { book, chapter } = params;
  const decodedBook = decodeURIComponent(book);
  const chapterNum = parseInt(chapter, 10);

  // 1. Get Book & Chapter UUIDs (The "Bridge")
  // Fetching the specific chapter record is very fast.
  const { data: chapterData, error: chapterErr } = await supabase
    .from('chapters')
    .select('id, books!inner(name_en, name_he)')
    .eq('chapter_number', chapterNum)
    .ilike('books.name_en', decodedBook)
    .single();

  if (chapterErr || !chapterData) {
    console.error(`Chapter lookup failed: ${decodedBook} ${chapterNum}`, chapterErr);
    return notFound();
  }

  const bookData = Array.isArray(chapterData.books) ? chapterData.books[0] : chapterData.books;

  // 2. Fetch Verses using the Chapter Metadata
  // Filtering the view by the verse's specific book and chapter is consistent with view logic.
  // Note: 'id' returned here is the new UUID for the verse.
  const { data: versesData, error: versesError } = await supabase
    .from('reader_verses_view')
    .select('*')
    .eq('book_id', bookData.name_en) 
    .eq('chapter_num', chapterNum)
    .eq('translation_slug', 'JPS')
    .order('verse_num', { ascending: true });

  if (versesError) {
    console.error("Verse fetch error:", versesError.message);
  }

  return (
    <ReaderPage 
      bookName={decodedBook}
      chapterNumber={chapterNum}
      initialVerses={versesData || []}
      initialHebrewTitle={bookData.name_he}
    />
  );
}