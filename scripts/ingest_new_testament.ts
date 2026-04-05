/**
 * New Testament (Brit Chadashah) Ingestion Script - SCHOLARLY EDITION
 * Integrates Morphological Greek (Strong's mapped) from local OpenGNT CSV
 * and automatically fetches WEB Translation from GitHub.
 * * * * PREREQUISITES:
 * 1. Place 'OpenGNT_OpenTextAnnotations_English_html.csv' in root.
 * 2. Place 'DictRMAC.json' in root.
 * * * * Run: npx tsx scripts/ingest_new_testament.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// --- URL Config ---
// We pull English from TehShrike's World English Bible JSON repository
const WEB_BASE_URL = 'https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json/';

// --- Interfaces ---

interface GreekWord {
  id: number;
  text: string;
  strongs: string | null;
  morph: string | null;
  meaning: string | null; 
}

interface VerseUpsert {
  chapter_id: string;
  verse_number: number;
  text_en: string;
  text_he: string; 
  words: GreekWord[];
}

// Map OpenGNT Book IDs (40-66) to DB names
const BOOK_ID_MAP: Record<string, string> = {
  '40': 'Matthew', '41': 'Mark', '42': 'Luke', '43': 'John', '44': 'Acts',
  '45': 'Romans', '46': 'I Corinthians', '47': 'II Corinthians', '48': 'Galatians',
  '49': 'Ephesians', '50': 'Philippians', '51': 'Colossians', '52': 'I Thessalonians',
  '53': 'II Thessalonians', '54': 'I Timothy', '55': 'II Timothy', '56': 'Titus',
  '57': 'Philemon', '58': 'Hebrews', '59': 'James', '60': 'I Peter', '61': 'II Peter',
  '62': 'I John', '63': 'II John', '64': 'III John', '65': 'Jude', '66': 'Revelation'
};

/**
 * Converts "I Corinthians" -> "1corinthians" to match GitHub file naming.
 */
function normalizeBookForUrl(name: string): string {
    return name
        .replace(/^I /, '1')
        .replace(/^II /, '2')
        .replace(/^III /, '3')
        .toLowerCase()
        .replace(/\s/g, '');
}

/**
 * Safely extracts English text regardless of the incoming JSON structure.
 * Robustly handles aggregated paragraph text sections (as seen in 1 John).
 */
function extractEnglishText(data: unknown, chapter: number, verse: number): string {
  if (!data || !Array.isArray(data)) return '';

  try {
    const arr = data as Array<Record<string, unknown>>;
    
    // 1. Handle Aggregated Paragraph Sections (e.g. 1 John format)
    // Matches: { type: "paragraph text", chapterNumber: 1, verseNumber: 1, value: "..." }
    const paragraphParts = arr.filter(item => 
      item.type === 'paragraph text' && 
      Number(item.chapterNumber || item.chapter) === chapter && 
      Number(item.verseNumber || item.verse) === verse
    );
    
    if (paragraphParts.length > 0) {
      return paragraphParts.map(p => String(p.value || p.text || '')).join('').trim();
    }

    // 2. Handle Flat Array of Verse Objects
    const match = arr.find(item => 
      (Number(item.chapter) === chapter || Number(item.chapterNumber) === chapter) && 
      (Number(item.verse) === verse || Number(item.verseNumber) === verse)
    );
    
    if (match) {
      const val = match.text || match.value;
      if (val) return String(val).trim();
    }

    // 3. Handle Array of Chapters -> Array of Verses (Classic TehShrike)
    if (Array.isArray(data[0])) {
      const dataArr = data as unknown[][];
      const chapterArray = dataArr[chapter] || dataArr[chapter - 1];
      if (Array.isArray(chapterArray)) {
        const verseData = chapterArray[verse] || chapterArray[verse - 1];
        if (typeof verseData === 'string') return verseData;
        if (verseData && typeof verseData === 'object') {
            const vObj = verseData as Record<string, unknown>;
            if (vObj.text) return String(vObj.text);
        }
      }
    }
  } catch {
    // Silently fallback on failure
  }

  return '';
}

/**
 * Extracts clean word data from the OpenGNT HTML annotation string.
 */
function parseGreekHtml(html: string): { words: GreekWord[], plain: string } {
  const words: GreekWord[] = [];
  const plainTextParts: string[] = [];
  
  // Extract content inside <w> tags
  const wordRegex = /<w>.*?dm:\/\/OGNT\.(G\d+)\.rmac\.([\w-]+)'.*?>(.*?)<\/a>.*?<gloss>(.*?)<\/gloss>.*?<\/w>/g;
  let match;
  let id = 1;

  while ((match = wordRegex.exec(html)) !== null) {
    const [, strongs, rmac, text, gloss] = match;
    
    /**
     * CLEANING LOGIC:
     * 1. Strip any embedded HTML tags (like <pm>,</pm>)
     * 2. Strip special markers (Paragraphs, Hyphenation, Variants)
     */
    const cleanWordText = text
      .replace(/<[^>]+>/g, '')
      .replace(/[¶¬°]/g, '')
      .trim();

    // Skip empty fragments
    if (!cleanWordText) continue;

    words.push({
      id: id++,
      text: cleanWordText,
      strongs: strongs.toUpperCase(),
      morph: rmac,
      meaning: gloss.replace(/[\[\]]/g, '').trim()
    });
    plainTextParts.push(cleanWordText);
  }

  return { words, plain: plainTextParts.join(' ') };
}

async function processNewTestament() {
  console.log('📖 Starting Scholarly New Testament Ingestion (Auto-Fetching WEB)...');

  const csvPath = path.join(process.cwd(), 'OpenGNT_OpenTextAnnotations_English_html.csv');
  if (!fs.existsSync(csvPath)) throw new Error("Missing OpenGNT CSV file.");
  
  console.log('📦 Reading local annotations...');
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const lines = csvContent.split('\n').filter(l => l.trim() !== '');
  const ntDataMap = new Map<string, Map<number, Map<number, { words: GreekWord[], plain: string }>>>();

  console.log('🧪 Parsing Greek Metadata...');
  lines.forEach(line => {
    const parts = line.split('\t');
    if (parts.length < 4) return;
    
    const [bookId, chapter, verse, html] = parts;
    const bookName = BOOK_ID_MAP[bookId];
    if (!bookName) return;

    if (!ntDataMap.has(bookName)) ntDataMap.set(bookName, new Map());
    const bookMap = ntDataMap.get(bookName)!;
    
    const chapNum = parseInt(chapter, 10);
    if (!bookMap.has(chapNum)) bookMap.set(chapNum, new Map());
    
    const vNum = parseInt(verse, 10);
    const { words, plain } = parseGreekHtml(html);
    bookMap.get(chapNum)!.set(vNum, { words, plain });
  });

  for (const bookName of Array.from(ntDataMap.keys())) {
    console.log(`\n📚 Syncing: ${bookName}`);
    
    const { data: bookRecord } = await supabase.from('books').select('id').ilike('name_en', bookName).single();
    if (!bookRecord) {
        console.warn(`   ⚠️ Book ${bookName} not found in database. Skipping.`);
        continue;
    }

    const urlName = normalizeBookForUrl(bookName);
    const fetchUrl = `${WEB_BASE_URL}${urlName}.json`;
    let webBookData: unknown = null;
    
    try {
        const resp = await fetch(fetchUrl);
        if (resp.ok) {
            webBookData = await resp.json();
            console.log(`   ✅ Fetched English text for ${bookName}`);
        } else {
            console.error(`   ❌ Failed to fetch English for ${bookName} (HTTP ${resp.status})`);
        }
    } catch (err) {
        console.error(`   ❌ Network error fetching ${bookName}:`, err);
    }

    const bookGreekMap = ntDataMap.get(bookName)!;

    for (const [chapterNum, versesMap] of Array.from(bookGreekMap.entries())) {
      const { data: chapRecord, error: chapErr } = await supabase
        .from('chapters')
        .upsert({ book_id: bookRecord.id, chapter_number: chapterNum }, { onConflict: 'book_id, chapter_number' })
        .select('id')
        .single();

      if (chapErr || !chapRecord) {
          console.error(`   ❌ Could not resolve chapter ${chapterNum}`, chapErr);
          continue;
      }

      const verseBatch: VerseUpsert[] = Array.from(versesMap.entries()).map(([vNum, gData]) => {
        const englishText = extractEnglishText(webBookData, chapterNum, vNum);

        return {
          chapter_id: chapRecord.id,
          verse_number: vNum,
          text_en: englishText.trim(),
          text_he: gData.plain.trim(), 
          words: gData.words
        };
      });

      const { error: upsertErr } = await supabase.from('verses').upsert(verseBatch, { 
        onConflict: 'chapter_id, verse_number' 
      });

      if (upsertErr) console.error(`\n   ❌ Chapter ${chapterNum} DB Error:`, upsertErr.message);
      else process.stdout.write(`\r🚀 ${bookName} Chapter ${chapterNum} synced...`);
    }
    
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n\n🎉 Full New Testament Ingestion Complete (Greek + Aggregated English).');
}

processNewTestament().catch(console.error);