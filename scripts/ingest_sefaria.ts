/**
 * Sefaria Bulk Ingestion Script v2.1 (Strict Formatting, Tokens & Default Private Visibility)
 * * RUN COMMAND:
 * npx tsx scripts/ingest_sefaria.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const SEFARIA_INDEX_URL = "https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json";

// ============================================================================
// CONFIGURATION
const TARGET_COLLECTION = "Midrash"; 
const TARGET_CATEGORY = "Midrash Rabbah"; // Set to null for the whole collection
// ============================================================================

interface SefariaBookIndex {
  title: string;
  language: string;
  versionTitle: string;
  categories: string[];
  json_url: string;
}

interface SefariaTextFile {
  title: string;
  heTitle?: string;
  language: string;
  versionTitle: string;
  versionSource?: string;
  license?: string;
  text: string[][] | string[]; 
}

interface VerseUpsert {
  id?: string; 
  chapter_id: string;
  verse_number: number;
  text_en: string; 
  text_he: string; 
  words: unknown[]; 
}

interface TranslationUpsert {
  verse_id: string;
  translation_slug: string;
  content: string;
  footnotes: { id: string; text: string }[];
}

interface ProcessedText {
  text: string;
  footnotes: { id: string; text: string }[];
}

/**
 * Validates if the given license string meets our requirements for open/free usage.
 * Explicitly allows 'unknown' to catch edge-case open texts.
 */
function isFreeLicense(licenseString?: string): boolean {
  if (!licenseString) return true; // Treat missing as unknown/allowable
  const l = licenseString.toLowerCase();
  return l.includes('public domain') || 
         l.includes('cc0') || 
         l.includes('cc-by') || 
         l.includes('creative commons') ||
         l.includes('open') ||
         l.includes('unknown');
}

/**
 * 1. Extracts Sefaria's embedded HTML footnotes into a structured array.
 * 2. Replaces them with clean <sup data-footnote="id"> markers.
 * 3. STRIPS all other HTML formatting (<b>, <i>, <big>, etc.) from the text.
 */
function processSefariaText(rawText: string, isEnglish: boolean): ProcessedText {
  if (!rawText) return { text: '', footnotes: [] };
  
  let cleanText = rawText;
  const footnotes: { id: string, text: string }[] = [];
  let fnCounter = 1;
  
  if (isEnglish) {
    // Extract standard Sefaria footnotes: <sup class="footnote-marker">*</sup><i class="footnote">...</i>
    const fnRegex = /<sup class="footnote-marker">(.*?)<\/sup>\s*<i class="footnote">(.*?)<\/i>/gi;
    cleanText = cleanText.replace(fnRegex, (match, marker, fnHtml) => {
      const id = `fn-${fnCounter++}`;
      footnotes.push({ id, text: fnHtml.replace(/<[^>]+>/g, '').trim() });
      return `<sup data-footnote="${id}">${marker || '*'}</sup>`;
    });

    // Extract alternative footnote pattern: just <i class="footnote">...</i> without a marker
    const altFnRegex = /<i class="footnote">(.*?)<\/i>/gi;
    cleanText = cleanText.replace(altFnRegex, (match, fnHtml) => {
      const id = `fn-${fnCounter++}`;
      footnotes.push({ id, text: fnHtml.replace(/<[^>]+>/g, '').trim() });
      return `<sup data-footnote="${id}">*</sup>`;
    });
  }

  // STRIP ALL FORMATTING: Removes <b>, <i>, <strong>, <em>, <big>, etc.
  // Preserves our <sup> markers.
  cleanText = cleanText.replace(/<(?!\/?sup(?=>|\s.*>))\/?[\w:-]+[^>]*>/gi, '');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  return { text: cleanText, footnotes };
}

/**
 * Generates interactive words array with G0/H0 placeholders for live lexicon lookups.
 */
function generateWordsArray(cleanText: string, chapterNum: number, verseNum: number): unknown[] {
  if (!cleanText) return [];
  const isGreek = /[α-ωΑ-Ω]/.test(cleanText);
  const fallbackStrongs = isGreek ? 'G0' : 'H0';

  return cleanText.split(/\s+/).filter(w => w.trim().length > 0).map((word, idx) => ({
    id: `w-${chapterNum}-${verseNum}-${idx}`,
    text: word,
    meaning: "Tap for scholarly analysis", 
    morph: null,
    strongs: fallbackStrongs, 
    root_text: null,
    pronunciation: "N/A",
    transliteration: "N/A"
  }));
}

/**
 * Flat map Chapters/Verses from Sefaria's flexible depth JSON.
 */
function extractTextMap(dataArray: unknown[], isEnglish: boolean): Map<number, Map<number, ProcessedText>> {
  const map = new Map<number, Map<number, ProcessedText>>();
  if (!Array.isArray(dataArray)) return map;

  dataArray.forEach((chapterData, chapIdx) => {
    const chapterNum = chapIdx + 1;
    if (!map.has(chapterNum)) map.set(chapterNum, new Map());
    
    if (Array.isArray(chapterData)) {
      chapterData.forEach((verseText, verseIdx) => {
        const verseNum = verseIdx + 1;
        if (typeof verseText === 'string' && verseText.trim().length > 0) {
          map.get(chapterNum)!.set(verseNum, processSefariaText(verseText, isEnglish));
        }
      });
    } else if (typeof chapterData === 'string' && chapterData.trim().length > 0) {
      map.get(1)!.set(chapterNum, processSefariaText(chapterData, isEnglish)); 
    }
  });

  return map;
}

async function ingestSefaria() {
  console.log(`🌐 Fetching Sefaria Catalog...`);
  const indexResp = await fetch(SEFARIA_INDEX_URL);
  if (!indexResp.ok) throw new Error("Failed to fetch Sefaria books.json");
  const indexData = await indexResp.json();
  const allBooks: SefariaBookIndex[] = indexData.books;

  // 1. Language Guard
  const targetBooks = allBooks.filter(b => {
    const lang = b.language?.toLowerCase();
    const isEn = lang === 'english' || lang === 'en';
    const isHe = lang === 'hebrew' || lang === 'he';
    if (!isEn && !isHe) return false;
    if (isEn && b.versionTitle?.toLowerCase().includes('merged')) return false;
    if (b.categories[0] !== TARGET_COLLECTION) return false;
    if (TARGET_CATEGORY && !b.categories.includes(TARGET_CATEGORY)) return false;
    return true;
  });
  
  console.log(`📚 Found ${targetBooks.length} editions for ${TARGET_CATEGORY || TARGET_COLLECTION}.`);

  const booksToProcess = new Map<string, { enUrls: string[], heUrls: string[], categories: string[] }>();
  targetBooks.forEach(b => {
    if (!booksToProcess.has(b.title)) {
      booksToProcess.set(b.title, { enUrls: [], heUrls: [], categories: b.categories });
    }
    const entry = booksToProcess.get(b.title)!;
    const lang = b.language?.toLowerCase();
    if (lang === 'english' || lang === 'en') entry.enUrls.push(b.json_url);
    if (lang === 'hebrew' || lang === 'he') entry.heUrls.push(b.json_url);
  });

  for (const [title, urls] of Array.from(booksToProcess.entries())) {
    console.log(`📖 Syncing: ${title}...`);
    if (urls.heUrls.length === 0) continue;

    try {
      const heResp = await fetch(urls.heUrls[0]);
      const heData: SefariaTextFile = await heResp.json();
      let enData: SefariaTextFile | null = null;
      let translationSlug = '';

      if (urls.enUrls.length > 0) {
        const enResp = await fetch(urls.enUrls[0]);
        const fetchedEnData: SefariaTextFile = await enResp.json();
        if (isFreeLicense(fetchedEnData.license)) {
          enData = fetchedEnData;
          const cleanVersionName = enData.versionTitle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 15);
          translationSlug = `SEFARIA-${cleanVersionName}`;
          await supabase.from('translations').upsert({
            slug: translationSlug,
            name: enData.versionTitle,
            license: enData.license || 'unknown',
            version_source: enData.versionSource || 'Sefaria Export',
            target_collections: [TARGET_COLLECTION]
          }, { onConflict: 'slug' });
        }
      }

      const heMap = extractTextMap(heData.text, false);
      const enMap = enData ? extractTextMap(enData.text, true) : new Map();

      // --- 2. CONFIGURATION DEFAULTS (COMING SOON) ---
      // Register Collection
      await supabase.from('collection_configs').upsert({ 
        id: TARGET_COLLECTION, 
        visibility_status: 'coming-soon' 
      }, { onConflict: 'id' });

      // Register Category
      const category = TARGET_CATEGORY || (urls.categories.length > 1 ? urls.categories[1].replace('Seder ', '') : TARGET_COLLECTION);
      await supabase.from('category_configs').upsert({ 
        collection_id: TARGET_COLLECTION, 
        name_en: category, 
        visibility_status: 'coming-soon' 
      }, { onConflict: 'collection_id, name_en' });

      // Register Book (upserting with coming-soon visibility)
      const { data: bookRecord, error: bookErr } = await supabase
        .from('books')
        .upsert({
          name_en: title,
          name_he: heData.heTitle || title,
          category: category,
          collection: TARGET_COLLECTION,
          visibility_status: 'coming-soon' 
        }, { onConflict: 'name_en' })
        .select('id')
        .single();

      if (bookErr || !bookRecord) throw new Error(`Book Sync Failed: ${bookErr?.message}`);

      // 3. Process Chapters & Verses
      for (const [chapterNum, heVerses] of Array.from(heMap.entries())) {
        let chapId: string;
        const { data: existingChap } = await supabase.from('chapters').select('id').eq('book_id', bookRecord.id).eq('chapter_number', chapterNum).maybeSingle();

        if (existingChap) { chapId = existingChap.id; } 
        else {
          const { data: newChap, error: insChapErr } = await supabase.from('chapters').insert({ book_id: bookRecord.id, chapter_number: chapterNum }).select('id').single();
          if (insChapErr || !newChap) continue;
          chapId = newChap.id;
        }

        const { data: existingVerses } = await supabase.from('verses').select('id, verse_number').eq('chapter_id', chapId);
        const existingVerseMap = new Map(existingVerses?.map(v => [v.verse_number, v.id]) || []);
        
        const verseBatch: VerseUpsert[] = [];
        const englishVersesMap = enMap.get(chapterNum) || new Map();

        for (const [verseNum, hebrewObj] of Array.from(heVerses.entries())) {
          const englishObj = englishVersesMap.get(verseNum) || { text: 'Translation pending', footnotes: [] };
          const verseData: VerseUpsert = {
            chapter_id: chapId,
            verse_number: verseNum,
            text_en: englishObj.text, 
            text_he: hebrewObj.text,
            words: generateWordsArray(hebrewObj.text, chapterNum, verseNum) 
          };
          const existingVId = existingVerseMap.get(verseNum);
          if (existingVId) verseData.id = existingVId;
          verseBatch.push(verseData);
        }

        const { data: upsertedVerses, error: upsertErr } = await supabase.from('verses').upsert(verseBatch).select('id, verse_number');
        if (upsertErr || !upsertedVerses) continue;

        if (enData && englishVersesMap.size > 0) {
          const translationBatch: TranslationUpsert[] = [];
          upsertedVerses.forEach(v => {
            const englishObj = englishVersesMap.get(v.verse_number);
            if (englishObj) {
              translationBatch.push({ verse_id: v.id, translation_slug: translationSlug, content: englishObj.text, footnotes: englishObj.footnotes });
            }
          });
          if (translationBatch.length > 0) {
            await supabase.from('verse_translations').upsert(translationBatch, { onConflict: 'verse_id,translation_slug' });
          }
        }
      }
      
      console.log(`   ✅ Ingested ${title} (Default: Coming Soon)`);
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: unknown) {
      console.error(`   ❌ Error processing ${title}:`, err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`\n🎉 Sefaria Ingestion Complete!`);
}

ingestSefaria().catch(console.error);