/**
 * OSMHB (Morphological Hebrew Bible) Ingestion Script
 * Updates Strong's numbers and grammatical divisions in the 'verses' table.
 * * This version includes:
 * 1. Smart Skip: Automatically skips books that are already fully ingested.
 * 2. Progress Tracker: Logs success/partial/failure.
 * 3. Corrected Filenames: Fixed mapping for Kings and Chronicles.
 */

import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// --- Reporting State ---
interface IngestionReport {
  skipped: string[];
  success: string[];
  partial: { book: string; chapters: number[] }[];
  failed: { book: string; error: string }[];
}

const report: IngestionReport = {
  skipped: [],
  success: [],
  partial: [],
  failed: []
};

// --- Interfaces ---
interface OsisWordNode { _?: string; $?: { lemma?: string; morph?: string; }; }
interface OsisVerse { $: { osisID: string; }; w: (string | OsisWordNode)[]; }
interface OsisChapter { $: { osisID: string; }; verse: OsisVerse[]; }
interface OsisXml { osis: { osisText: Array<{ div: Array<{ chapter: OsisChapter[]; }>; }>; }; }
interface IngestedWord { id: number; text: string; divided_text: string | null; morph: string | null; strongs: string | null; }
interface VerseUpdateRow { id: number | string; chapter_id: number | string; verse_number: number; text_en: string; text_he: string; words: IngestedWord[]; }

/**
 * FILENAME MAPPING:
 * Maps GitHub filenames to DB book names.
 * Filenames are verified against: https://github.com/openscriptures/morphhb/tree/master/wlc
 */
const FILENAME_TO_DB_BOOK: Record<string, string> = {
  'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
  'Josh': 'Joshua', 'Judg': 'Judges', '1Sam': 'I Samuel', '2Sam': 'II Samuel', 
  '1Kgs': 'I Kings', '2Kgs': 'II Kings', '1Chr': 'I Chronicles', '2Chr': 'II Chronicles',
  'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Ezek': 'Ezekiel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
  'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zephaniah',
  'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi', 'Ps': 'Psalms', 'Prov': 'Proverbs', 'Job': 'Job',
  'Song': 'Song of Songs', 'Ruth': 'Ruth', 'Lam': 'Lamentations', 'Eccl': 'Ecclesiastes', 'Esth': 'Esther',
  'Dan': 'Daniel', 'Ezra': 'Ezra', 'Neh': 'Nehemiah'
};

const BOOKS = Object.keys(FILENAME_TO_DB_BOOK);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 5, backoff = 1000): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    if (retries <= 0) throw err;
    await sleep(backoff);
    return fetchWithRetry(url, retries - 1, backoff * 2);
  }
}

async function processBook(bookAbbrev: string) {
  const dbBookName = FILENAME_TO_DB_BOOK[bookAbbrev];
  const url = `https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/${bookAbbrev}.xml`;
  const failedChapters: number[] = [];
  
  console.log(`\n📖 Checking: ${bookAbbrev}.xml (Target: ${dbBookName})`);

  try {
    // 1. Get the book ID
    const { data: bookRecord } = await supabase.from('books').select('id').ilike('name_en', dbBookName).single();
    if (!bookRecord) {
      report.failed.push({ book: dbBookName, error: "Book not found in DB" });
      return;
    }

    // 2. SMART SKIP LOGIC: Check if this book needs ingestion
    // Find chapters for this book
    const { data: chaptersInDb } = await supabase.from('chapters').select('id').eq('book_id', bookRecord.id);
    if (!chaptersInDb || chaptersInDb.length === 0) {
      report.failed.push({ book: dbBookName, error: "No chapters found for this book in DB" });
      return;
    }

    const chapterIds = chaptersInDb.map(c => c.id);

    // Count verses in these chapters that are still empty []
    const { count, error: countErr } = await supabase
      .from('verses')
      .select('*', { count: 'exact', head: true })
      .in('chapter_id', chapterIds)
      .eq('words', '[]');

    if (countErr) throw countErr;

    if (count === 0) {
      console.log(`⏭️  Skipping ${dbBookName}: Already fully ingested.`);
      report.skipped.push(dbBookName);
      return;
    }

    console.log(`🚀 Ingesting ${dbBookName}: Found ${count} verses to update.`);

    // 3. Download and Parse XML
    const xml = await fetchWithRetry(url);
    const parser = new xml2js.Parser();
    const result = (await parser.parseStringPromise(xml)) as OsisXml;
    const chapters = result.osis.osisText[0].div[0].chapter;

    for (const chap of chapters) {
      const chapterNum = parseInt(chap.$.osisID.split('.')[1]);
      
      const { data: chapRecord } = await supabase.from('chapters').select('id').eq('book_id', bookRecord.id).eq('chapter_number', chapterNum).single();
      if (!chapRecord) {
        failedChapters.push(chapterNum);
        continue;
      }

      const { data: dbVerses } = await supabase.from('verses').select('id, verse_number, chapter_id, text_en, text_he, words').eq('chapter_id', chapRecord.id);
      if (!dbVerses) { failedChapters.push(chapterNum); continue; }

      const updateBatch: VerseUpdateRow[] = [];
      for (const v of chap.verse) {
        const verseParts = v.$.osisID.split('.');
        const verseNum = parseInt(verseParts[verseParts.length - 1].split('-')[0]);
        if (!v.w) continue;
        
        const targetVerse = dbVerses.find(dv => dv.verse_number === verseNum);
        if (!targetVerse) continue;

        // Optional: Skip specific verses that are already populated within a partial book
        // if (targetVerse.words && targetVerse.words.length > 0 && targetVerse.words[0].strongs) continue;

        const words: IngestedWord[] = v.w.map((w: string | OsisWordNode, index: number) => {
          const rawText = typeof w === 'string' ? w : (w._ || '');
          const lemmaAttr = (typeof w !== 'string' && w.$?.lemma) || '';
          const morphAttr = (typeof w !== 'string' && w.$?.morph) || null;
          const strongsMatch = lemmaAttr.split(' ').find((s: string) => s.toLowerCase().startsWith('h'));
          const normalizedStrongs = strongsMatch ? strongsMatch.toUpperCase().replace(/^H0+/, 'H') : null;
          return { 
            id: index + 1, 
            text: rawText, 
            divided_text: rawText.includes('/') ? rawText.replace(/\//g, '-') : null, 
            morph: morphAttr, 
            strongs: normalizedStrongs 
          };
        });

        updateBatch.push({ 
          id: targetVerse.id, 
          chapter_id: targetVerse.chapter_id, 
          verse_number: targetVerse.verse_number, 
          text_en: targetVerse.text_en, 
          text_he: targetVerse.text_he, 
          words: words 
        });
      }

      if (updateBatch.length > 0) {
        const { error: batchErr } = await supabase.from('verses').upsert(updateBatch, { onConflict: 'id' });
        if (batchErr) {
          console.error(`\n❌ Error batch updating ${dbBookName} ch ${chapterNum}:`, batchErr.message);
          failedChapters.push(chapterNum);
        }
      }
      process.stdout.write(`\r🚀 Chapter ${chapterNum} synced...`);
    }

    if (failedChapters.length > 0) {
      report.partial.push({ book: dbBookName, chapters: failedChapters });
      console.log(`\n⚠️ Finished with ${failedChapters.length} skipped chapters.`);
    } else {
      report.success.push(dbBookName);
      console.log(`\n✅ Finished ${dbBookName}`);
    }

    await sleep(300); // Cool down

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    report.failed.push({ book: dbBookName, error: errorMessage });
    console.error(`\n❌ Fatal error for ${bookAbbrev}:`, errorMessage);
  }
}

async function start() {
  console.log('🏁 Starting Smart Morphology Ingestion...');
  for (const book of BOOKS) {
    await processBook(book);
  }
  
  fs.writeFileSync('ingestion_report.json', JSON.stringify(report, null, 2));
  console.log('\n🎉 ALL DONE! Check ingestion_report.json for details.');
}

start();