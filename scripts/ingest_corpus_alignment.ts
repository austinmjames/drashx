/**
 * Scholarly Alignment Ingestion Script - UPDATED FOR HIGH RESILIENCE
 * Integrates hebrew.csv, greek.csv, and greekstrongs.csv
 * * Merges Manuscript Variants, Roots, and Semantic Domains into DrashX.
 * * Uses smaller bulk upserts (100 rows) and delays to prevent Supabase timeouts.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// --- Interfaces ---

interface GlobalGreekStrongsRecord {
  'Strongs:Number': string;
  'Strongs:Lemma': string;
  'Strongs:Origin': string;
  'Strongs:Root': string;
  'Strongs:RootLemma': string;
}

interface AlignmentRecord {
  'Ref': string;
  // Hebrew specific
  'TAHOT:RootStrongs'?: string;
  'OSHB:Hebrew'?: string;
  'UHB:Hebrew'?: string;
  'UXLC:Hebrew'?: string;
  'DocumentaryHypothesis'?: string;
  // Greek specific
  'SemDic:LouwNida'?: string;
  'TAGNT:NA28-Idx'?: string;
  'TAGNT:Byz-Idx'?: string;
  'SBLGNT:SBLText'?: string;
}

interface DbVerseWord {
  id: number;
  text: string;
  strongs: string | null;
  morph: string | null;
  root_id?: string | null;
  semantic_domain?: string | null;
  variants?: Record<string, string | null>;
}

interface DbVerseRow {
  id: string | number;
  chapter_id: string | number;
  verse_number: number;
  words: DbVerseWord[];
  [key: string]: unknown; // Captures all other columns to safely upsert
}

// Map USFM Book names to our DB names
const USFM_MAP: Record<string, string> = {
  'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers', 'DEU': 'Deuteronomy',
  'JOS': 'Joshua', 'JDG': 'Judges', '1SA': 'I Samuel', '2SA': 'II Samuel', '1KI': 'I Kings',
  '2KI': 'II Kings', '1CH': 'I Chronicles', '2CH': 'II Chronicles', 'ISA': 'Isaiah',
  'JER': 'Jeremiah', 'EZE': 'Ezekiel', 'HOS': 'Hosea', 'JOE': 'Joel', 'AMO': 'Amos',
  'OBA': 'Obadiah', 'JON': 'Jonah', 'MIC': 'Micah', 'NAH': 'Nahum', 'HAB': 'Habakkuk',
  'ZEP': 'Zephaniah', 'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi', 'PSA': 'Psalms',
  'PRO': 'Proverbs', 'JOB': 'Job', 'SNG': 'Song of Songs', 'RUT': 'Ruth', 'LAM': 'Lamentations',
  'ECC': 'Ecclesiastes', 'EST': 'Esther', 'DAN': 'Daniel', 'EZR': 'Ezra', 'NEH': 'Nehemiah',
  'MAT': 'Matthew', 'MRK': 'Mark', 'LUK': 'Luke', 'JHN': 'John', 'ACT': 'Acts', 'ROM': 'Romans',
  '1CO': 'I Corinthians', '2CO': 'II Corinthians', 'GAL': 'Galatians', 'EPH': 'Ephesians',
  'PHP': 'Philippians', 'COL': 'Colossians', '1TH': 'I Thessalonians', '2TH': 'II Thessalonians',
  '1TI': 'I Timothy', '2TI': 'II Timothy', 'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews',
  'JAS': 'James', '1PE': 'I Peter', '2PE': 'II Peter', '1JO': 'I John', '2JO': 'II John',
  '3JO': 'III John', 'JUD': 'Jude', 'REV': 'Revelation'
};

async function processGlobalGreekStrongs() {
  console.log('🧬 Step 1: Updating Global Greek Lexicon Roots...');
  const csvPath = path.join(process.cwd(), 'greekstrongs.csv');
  if (!fs.existsSync(csvPath)) return console.warn('⚠️ greekstrongs.csv not found.');

  const content = fs.readFileSync(csvPath, 'utf8');
  const records = parse(content, { 
    columns: true, 
    skip_empty_lines: true,
    delimiter: '\t' 
  }) as GlobalGreekStrongsRecord[];

  const batch = records.map((r) => {
    const rawId = String(r['Strongs:Number']).toUpperCase();
    const rawRoot = String(r['Strongs:Root']).toUpperCase();
    const origin = String(r['Strongs:Origin']).toUpperCase();
    
    return {
      id: rawId.startsWith('G') ? rawId : `G${rawId}`,
      root_id: rawRoot ? (rawRoot.startsWith('G') ? rawRoot : `G${rawRoot}`) : null,
      origin_id: origin ? (origin.startsWith('H') ? origin : `H${origin}`) : null,
      lemma: r['Strongs:Lemma']
    };
  });

  for (let i = 0; i < batch.length; i += 100) {
    const { error } = await supabase.from('lexicon').upsert(batch.slice(i, i + 100), { onConflict: 'id' });
    if (error) console.error('Error updating Greek roots:', error);
  }
  console.log(`✅ Greek Lexicon updated with ${batch.length} root associations.`);
}

async function enrichVerses(type: 'hebrew' | 'greek') {
  console.log(`\n📖 Step 2: Enriching ${type} verses...`);
  const filename = `${type}.csv`;
  const csvPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(csvPath)) return console.warn(`⚠️ ${filename} not found.`);

  const content = fs.readFileSync(csvPath, 'utf8');
  const records = parse(content, { 
    columns: true, 
    skip_empty_lines: true,
    delimiter: '\t' 
  }) as AlignmentRecord[];

  const bookCodeGroups = new Map<string, Map<string, AlignmentRecord[]>>();
  records.forEach((r) => {
    const parts = r['Ref'].split('.');
    if (parts.length < 3) return;
    const bookCode = parts[0].toUpperCase();
    const chapter = parts[1];
    const verse = parts[2];
    
    if (!bookCodeGroups.has(bookCode)) bookCodeGroups.set(bookCode, new Map());
    const bookMap = bookCodeGroups.get(bookCode)!;
    const refKey = `${chapter}.${verse}`;
    if (!bookMap.has(refKey)) bookMap.set(refKey, []);
    bookMap.get(refKey)!.push(r);
  });

  console.log(`🔍 Found ${bookCodeGroups.size} books to process.`);

  for (const [bookCode, verseMap] of Array.from(bookCodeGroups.entries())) {
    const bookName = USFM_MAP[bookCode];
    if (!bookName) continue;

    console.log(`\n📚 Syncing Book: ${bookName}`);

    const { data: bookData, error: bookErr } = await supabase
      .from('books')
      .select('id')
      .ilike('name_en', bookName)
      .single();

    if (bookErr || !bookData) {
      console.error(`   ❌ Failed to find book ${bookName} in DB.`);
      continue;
    }

    const { data: chaptersData, error: chapErr } = await supabase
      .from('chapters')
      .select('id, chapter_number')
      .eq('book_id', bookData.id);

    if (chapErr || !chaptersData || chaptersData.length === 0) {
      console.error(`   ❌ Failed to find chapters for ${bookName}.`);
      continue;
    }

    const chapterMap = new Map<string | number, number>();
    const chapterIds = chaptersData.map(c => {
      chapterMap.set(c.id, c.chapter_number);
      return c.id;
    });

    const dbVerses: DbVerseRow[] = [];
    let hasMoreVerses = true;
    let page = 0;
    const PAGE_SIZE = 1000;

    while (hasMoreVerses) {
      const { data: vData, error: fetchErr } = await supabase
        .from('verses')
        .select('*')
        .in('chapter_id', chapterIds)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (fetchErr) {
        console.error(`   ❌ Failed to fetch verses for ${bookName}:`, fetchErr.message);
        // Wait and retry fetch if it failed due to network
        await new Promise(res => setTimeout(res, 2000));
        hasMoreVerses = false;
        break;
      }

      if (vData && vData.length > 0) {
        dbVerses.push(...(vData as DbVerseRow[]));
        if (vData.length < PAGE_SIZE) hasMoreVerses = false;
        else page++;
      } else {
        hasMoreVerses = false;
      }
      // Breath between pages
      await new Promise(res => setTimeout(res, 200));
    }

    if (dbVerses.length === 0) continue;

    const dbLookupSimple = new Map<string, DbVerseRow>();
    dbVerses.forEach((v) => {
      const chapNum = chapterMap.get(v.chapter_id);
      dbLookupSimple.set(`${chapNum}.${v.verse_number}`, v);
    });

    const updateBatch: DbVerseRow[] = [];

    for (const [refKey, rows] of Array.from(verseMap.entries())) {
      const dbVerse = dbLookupSimple.get(refKey);
      if (!dbVerse || !dbVerse.words) continue;

      const updatedWords = (dbVerse.words).map((w, idx) => {
        const alignmentRow = rows[idx];
        if (!alignmentRow) return w;

        if (type === 'hebrew') {
          const rawRoot = alignmentRow['TAHOT:RootStrongs'];
          return {
            ...w,
            root_id: rawRoot ? (rawRoot.startsWith('H') ? rawRoot : `H${rawRoot}`) : (w.root_id || null),
            variants: {
              oshb: alignmentRow['OSHB:Hebrew'] || null,
              uhb: alignmentRow['UHB:Hebrew'] || null,
              uxlc: alignmentRow['UXLC:Hebrew'] || null,
              doc_hyp: alignmentRow['DocumentaryHypothesis'] || null
            }
          };
        } else {
          return {
            ...w,
            semantic_domain: alignmentRow['SemDic:LouwNida'] || null,
            variants: {
              na28: alignmentRow['TAGNT:NA28-Idx'] ? 'Present' : 'Variant',
              byz: alignmentRow['TAGNT:Byz-Idx'] ? 'Majority' : 'Minority',
              sbl: alignmentRow['SBLGNT:SBLText'] || null
            }
          };
        }
      });

      updateBatch.push({ ...dbVerse, words: updatedWords });
    }

    if (updateBatch.length > 0) {
      const CHUNK_SIZE = 100; // Lowered to 100 for maximum reliability on Free Tier
      let hasFatalError = false;

      for (let i = 0; i < updateBatch.length; i += CHUNK_SIZE) {
        if (hasFatalError) break;

        const chunk = updateBatch.slice(i, i + CHUNK_SIZE);
        let success = false;
        let retries = 0;
        const maxRetries = 5; // Increased retries

        while (!success && retries < maxRetries) {
          const { error: upsertErr } = await supabase.from('verses').upsert(chunk, { onConflict: 'id' });
          
          if (upsertErr) {
            retries++;
            console.warn(`\n   ⚠️ Upsert Error on chunk ${i/CHUNK_SIZE + 1}. Retrying (${retries}/${maxRetries})...`);
            await new Promise(res => setTimeout(res, 3000 * retries)); 
            
            if (retries === maxRetries) {
              console.error(`\n   ❌ Fatal upsert error for ${bookName}:`, upsertErr.message);
              hasFatalError = true;
              break;
            }
          } else {
            success = true;
            process.stdout.write(`\r🚀 Synced ${bookName}: ${Math.min(i + CHUNK_SIZE, updateBatch.length)} / ${updateBatch.length} verses...`);
            // Add a small delay between successful chunks to avoid slamming the I/O
            await new Promise(res => setTimeout(res, 500));
          }
        }
      }
      
      if (!hasFatalError) {
        console.log(`\n   ✅ ${bookName} fully enriched.`);
      } else {
        console.log(`\n   🛑 Halted ${bookName} due to errors. You can safely re-run the script.`);
      }
    }
  }
}

async function startIngestion() {
  await processGlobalGreekStrongs();
  await enrichVerses('hebrew');
  await enrichVerses('greek');
  console.log('\n\n🎉 Scholarly Alignment Ingestion Complete.');
}

startIngestion().catch(console.error);