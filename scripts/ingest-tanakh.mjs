import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

/**
 * PHASE 7: AUTOMATED TANAKH INGESTION (RESILIENT VERSION)
 * This script fetches the entire Tanakh from the Sefaria API,
 * cleans the text, and syncs it to Supabase with automatic retries.
 */

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env.local. Ensure SUPABASE_SERVICE_ROLE_KEY is set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Full Tanakh canonical list
const TANAKH_STRUCTURE = {
  "Torah": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
  "Nevi'im": [
    "Joshua", "Judges", "I Samuel", "II Samuel", "I Kings", "II Kings",
    "Isaiah", "Jeremiah", "Ezekiel", "Hosea", "Joel", "Amos", "Obadiah",
    "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"
  ],
  "Ketuvim": [
    "Psalms", "Proverbs", "Job", "Song of Songs", "Ruth", "Lamentations",
    "Ecclesiastes", "Esther", "Daniel", "Ezra", "Nehemiah", "I Chronicles", "II Chronicles"
  ]
};

/**
 * Helper: Exponential Backoff Retry for Supabase/API calls
 */
async function withRetry(fn, label = "Operation", maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await fn();
      if (result.error) throw result.error;
      return result.data;
    } catch (err) {
      const isLastRetry = i === maxRetries - 1;
      const delay = Math.pow(2, i) * 1000;
      
      // Check if the error message is HTML (Gateway error)
      const errorMsg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
      const isGatewayError = errorMsg.includes("<!DOCTYPE html>") || errorMsg.includes("502") || errorMsg.includes("Bad gateway");

      if (isLastRetry) {
        throw new Error(`${label} failed after ${maxRetries} attempts. Error: ${errorMsg.substring(0, 200)}...`);
      }

      if (isGatewayError) {
        process.stdout.write(` (Retrying ${label} in ${delay}ms due to 502) `);
      } else {
        process.stdout.write(` (Retrying ${label} in ${delay}ms) `);
      }
      
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

/**
 * Clean Sefaria text: removes footnotes, Masoretic markers, and HTML tags.
 */
function cleanText(text) {
  if (!text) return "";
  if (Array.isArray(text)) text = text.join(" "); 
  
  return text
    // 1. Remove footnote markers and the actual footnote content in <i> tags
    .replace(/<sup class="footnote-marker">.*?<\/sup>/g, "") 
    .replace(/<i class="footnote">.*?<\/i>/g, "")
    // 2. Remove Masoretic paragraph markers and their spans (e.g., {פ}, {ס})
    .replace(/<span class="mam-spi-[^>]*">.*?<\/span>/g, "")
    .replace(/\{[פס]\}/g, "")
    // 3. Strip all remaining HTML tags (big, small, b, br, etc.)
    .replace(/<[^>]*>?/gm, "")
    // 4. Standardize whitespace and remove HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&thinsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch a single book from Sefaria API.
 */
async function fetchBookData(bookName) {
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(bookName)}?context=0&commentary=0&pad=0`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sefaria API error for ${bookName}: ${response.statusText}`);
  
  const data = await response.json();
  if (data.error) throw new Error(`Sefaria Error: ${data.error}`);
  
  return data;
}

/**
 * Logic to ingest a specific book into Supabase
 */
async function ingestBook(bookName, category) {
  console.log(`\n📖 Processing ${bookName} (${category})...`);
  
  try {
    const data = await fetchBookData(bookName);
    const bookNameEn = data.title || bookName;
    const bookNameHe = data.heTitle || data.heBook || bookName;

    // 1. Upsert Book record (with retry)
    const book = await withRetry(async () => {
      return await supabase
        .from('books')
        .upsert({ 
          name_en: bookNameEn, 
          name_he: bookNameHe, 
          category: category 
        }, { onConflict: 'name_en' })
        .select()
        .single();
    }, `Book: ${bookName}`);

    const chaptersEn = data.text || [];
    const chaptersHe = data.he || [];
    const maxChapters = Math.max(chaptersEn.length, chaptersHe.length);
    
    // 2. Iterate through Chapters
    for (let cIdx = 0; cIdx < maxChapters; cIdx++) {
      const chapterNum = cIdx + 1;
      const versesEn = chaptersEn[cIdx] || [];
      const versesHe = chaptersHe[cIdx] || [];

      // Upsert Chapter record (with retry)
      const chapter = await withRetry(async () => {
        return await supabase
          .from('chapters')
          .upsert({ 
            book_id: book.id, 
            chapter_number: chapterNum 
          }, { onConflict: 'book_id,chapter_number' })
          .select()
          .single();
      }, `Ch ${chapterNum}`);

      // 3. Prepare Verse Payloads
      const verseCount = Math.max(versesEn.length, versesHe.length);
      const versePayloads = [];

      for (let vIdx = 0; vIdx < verseCount; vIdx++) {
        versePayloads.push({
          chapter_id: chapter.id,
          verse_number: vIdx + 1,
          text_en: cleanText(versesEn[vIdx] || ""),
          text_he: cleanText(versesHe[vIdx] || ""),
          metadata: {
            sefaria_version_en: data.versionTitle || 'merged',
            sefaria_version_he: data.heVersionTitle || 'merged'
          }
        });
      }

      // 4. Bulk Upsert Verses (with retry)
      if (versePayloads.length > 0) {
        await withRetry(async () => {
          return await supabase
            .from('verses')
            .upsert(versePayloads, { onConflict: 'chapter_id,verse_number' });
        }, `Verses Ch ${chapterNum}`);
        
        process.stdout.write(`.`); 
      }
    }
    console.log(`\n✅ Completed ${bookNameEn}`);
  } catch (error) {
    console.error(`\n❌ Fatal error for ${bookName}:`, error.message);
  }
}

/**
 * Main Runner
 */
async function runFullIngestion() {
  console.log("🚀 Starting Full Tanakh Ingestion from Sefaria API...");
  console.log("-----------------------------------------------------");
  
  const startTime = Date.now();

  for (const [category, books] of Object.entries(TANAKH_STRUCTURE)) {
    for (const book of books) {
      await ingestBook(book, category);
      // Wait between books to respect Sefaria rate limits and let DB breathe
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n✨ Success! Full Tanakh synchronized in ${duration} minutes.`);
}

runFullIngestion();