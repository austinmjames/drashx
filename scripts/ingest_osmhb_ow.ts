/**
 * OSMHB (Morphological Hebrew Bible) ENRICHED OVERWRITE Script
 * Matches XML Strong's numbers to Lexicon IDs like 'H1', 'H7225'.
 * * CHANGE LOG:
 * 1. Pagination Fix: Loads all 8,700+ lexicon entries (Supabase defaults to 1000).
 * 2. Data Preservation Fix: Selects '*' from verses to ensure columns like 
 * 'text_he_no_vowels' aren't wiped during upsert.
 * 3. Type Safety: Replaced 'any' with specific interfaces for Batch and XML nodes.
 * 4. Reporting: Active utilization of 'report' and 'failedChapters' for post-run analysis.
 */

import { createClient } from '@supabase/supabase-js';
import xml2js from 'xml2js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// --- Reporting & Cache State ---
interface IngestionReport {
  updated: string[];
  partial: { book: string; chapters: number[] }[];
  failed: { book: string; error: string }[];
}

const report: IngestionReport = { updated: [], partial: [], failed: [] };
const lexiconCache = new Map<string, { lemma: string, translit: string | null, meaning: string | null }>();

// --- XML Parser Interfaces ---
interface OsisWordNode { _?: string; $?: { lemma?: string; morph?: string; }; }
interface OsisVerse { $: { osisID: string; }; w: OsisWordNode | OsisWordNode[] | string | string[]; }
interface OsisChapter { $: { osisID: string; }; verse: OsisVerse | OsisVerse[]; }
interface OsisResult {
  osis: {
    osisText: {
      div: { chapter: OsisChapter | OsisChapter[]; } | { chapter: OsisChapter | OsisChapter[]; }[];
    } | {
      div: { chapter: OsisChapter | OsisChapter[]; } | { chapter: OsisChapter | OsisChapter[]; }[];
    }[];
  };
}

interface IngestedWord { 
  id: number; 
  text: string; 
  divided_text: string | null; 
  morph: string | null; 
  strongs: string | null;
  root_text?: string | null;       
  transliteration?: string | null; 
  meaning?: string | null;
}

interface VerseUpdateRow { 
  id: number | string; 
  chapter_id: number | string; 
  verse_number: number; 
  text_en: string; 
  text_he: string; 
  words: IngestedWord[]; 
  [key: string]: unknown; // Allow for extra columns from select(*)
}

const FILENAME_TO_DB_BOOK: Record<string, string> = {
  'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
  'Josh': 'Joshua', 'Judg': 'Judges', '1Sam': 'I Samuel', '2Sam': 'II Samuel', 
  '1Kgs': 'I Kings', '2Kgs': 'II Kings', '1Chr': 'I Chronicles', '2Chr': 'II Chronicles',
  'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Ezek': 'Ezekiel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
  'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zechariah',
  'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi', 'Ps': 'Psalms', 'Prov': 'Proverbs', 'Job': 'Job',
  'Song': 'Song of Songs', 'Ruth': 'Ruth', 'Lam': 'Lamentations', 'Eccl': 'Ecclesiastes', 'Esth': 'Esther',
  'Dan': 'Daniel', 'Ezra': 'Ezra', 'Neh': 'Nehemiah'
};

const BOOKS = Object.keys(FILENAME_TO_DB_BOOK);

/**
 * Fetches ALL entries from the lexicon table using pagination.
 */
async function loadLexiconCache() {
  console.log('📚 Loading full lexicon into memory...');
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from('lexicon').select('id, lemma, transliteration, short_def').range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(item => {
        lexiconCache.set(item.id.toUpperCase(), { 
          lemma: item.lemma, 
          translit: item.transliteration,
          meaning: item.short_def
        });
      });
      page++;
      process.stdout.write(`\rLoaded ${lexiconCache.size} entries...`);
    }
  }
  console.log(`\n✅ Cache ready.`);
}

async function processBook(bookAbbrev: string) {
  const dbBookName = FILENAME_TO_DB_BOOK[bookAbbrev];
  const url = `https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/${bookAbbrev}.xml`;
  const failedChapters: number[] = [];
  
  console.log(`\n📖 Processing: ${dbBookName}`);

  try {
    const { data: bookRecord } = await supabase.from('books').select('id').ilike('name_en', dbBookName).single();
    if (!bookRecord) {
      report.failed.push({ book: dbBookName, error: "Book not found in database" });
      return;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
    
    const xml = await response.text();
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = (await parser.parseStringPromise(xml)) as OsisResult;

    const osisText = Array.isArray(result.osis.osisText) ? result.osis.osisText[0] : result.osis.osisText;
    const div = Array.isArray(osisText.div) ? osisText.div[0] : osisText.div;
    const chapters = Array.isArray(div.chapter) ? div.chapter : [div.chapter];

    for (const chap of chapters) {
      const chapterNum = parseInt(chap.$.osisID.split('.')[1], 10);
      const { data: chapRecord } = await supabase.from('chapters').select('id').eq('book_id', bookRecord.id).eq('chapter_number', chapterNum).single();
      if (!chapRecord) {
        failedChapters.push(chapterNum);
        continue;
      }

      const { data: dbVerses } = await supabase.from('verses').select('*').eq('chapter_id', chapRecord.id);
      if (!dbVerses) {
        failedChapters.push(chapterNum);
        continue;
      }

      const updateBatch: VerseUpdateRow[] = [];
      const xmlVerses = Array.isArray(chap.verse) ? chap.verse : [chap.verse];

      for (const v of xmlVerses) {
        const verseParts = v.$.osisID.split('.');
        const verseNum = parseInt(verseParts[verseParts.length - 1].split('-')[0], 10);
        if (!v.w) continue;
        const targetVerse = dbVerses.find(dv => dv.verse_number === verseNum);
        if (!targetVerse) continue;

        const wordsArray = Array.isArray(v.w) ? v.w : [v.w];
        const words: IngestedWord[] = wordsArray.map((w: string | OsisWordNode, index: number) => {
          const rawText = typeof w === 'string' ? w : (w._ || '');
          const lemmaAttr = (typeof w !== 'string' && w.$?.lemma) || '';
          const match = lemmaAttr.match(/(\d+)/);
          const normalizedStrongs = match ? 'H' + parseInt(match[1], 10) : null;
          const lexInfo = normalizedStrongs ? lexiconCache.get(normalizedStrongs) : null;

          return { 
            id: index + 1, text: rawText, divided_text: rawText.includes('/') ? rawText.replace(/\//g, '-') : null, 
            morph: (typeof w !== 'string' && w.$?.morph) || null, strongs: normalizedStrongs,
            root_text: lexInfo?.lemma || null, transliteration: lexInfo?.translit || null, meaning: lexInfo?.meaning || null
          };
        });
        updateBatch.push({ ...targetVerse, words });
      }

      if (updateBatch.length > 0) {
        const { error: upsertErr } = await supabase.from('verses').upsert(updateBatch, { onConflict: 'id' });
        if (upsertErr) {
          console.error(`\n❌ Upsert Error for ${dbBookName} Ch ${chapterNum}:`, upsertErr.message);
          failedChapters.push(chapterNum);
        }
      }
      process.stdout.write(`\r🚀 Chapter ${chapterNum} updated...`);
    }

    if (failedChapters.length > 0) {
      report.partial.push({ book: dbBookName, chapters: failedChapters });
      console.log(`\n⚠️ Finished ${dbBookName} with ${failedChapters.length} skipped chapters.`);
    } else {
      report.updated.push(dbBookName);
      console.log(`\n✅ Finished ${dbBookName}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    report.failed.push({ book: dbBookName, error: msg });
    console.error(`\n❌ Error processing ${bookAbbrev}:`, msg);
  }
}

async function start() {
  await loadLexiconCache();
  for (const book of BOOKS) await processBook(book);
  
  console.log('\n--- Final Ingestion Report ---');
  console.log(`Updated: ${report.updated.length} books.`);
  console.log(`Partially Updated: ${report.partial.length} books.`);
  console.log(`Failed: ${report.failed.length} books.`);
}
start();