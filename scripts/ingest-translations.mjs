import dotenv from 'dotenv';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Next.js typically uses .env.local, so we check for that first
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config(); // Fallback to standard .env
}

// Support both standard and Next.js public prefixes
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Throw a helpful error if they are still missing
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Missing Supabase environment variables!\n" +
    "Please ensure your .env or .env.local file contains:\n" +
    "  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key\n"
  );
  process.exit(1);
}

// Initialize Supabase Client (Use service_role key to bypass RLS during ingestion)
const supabase = createClient(supabaseUrl, supabaseKey);

// =========================================================================
// Configuration
// =========================================================================

// Sefaria exact version strings for the requested translations 
const VERSIONS = {
  JPS1917: 'The Holy Scriptures: A New Translation (JPS 1917)',
  MODERNIZED: 'Modernized Tanakh - Based on JPS 1917, Edited by Adam Cohn'
};

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

// Flatten the structure into a single array of book names to iterate over
const ALL_BOOKS = Object.values(TANAKH_STRUCTURE).flat();

// A delay function to be polite to the Sefaria API rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Cleans the raw text returned from Sefaria, stripping footnotes,
 * Masoretic markers, HTML tags, and formatting entities.
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
 * Fetches a specific English translation for a full chapter from Sefaria
 */
async function fetchSefariaChapter(bookName, chapterNum, versionTitle) {
  const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(bookName)}.${chapterNum}?ven=${encodeURIComponent(versionTitle)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data.error) {
      const errMsg = data.error.toLowerCase();
      // Expanded endOfBook detection based on Sefaria's actual error messages
      if (
        errMsg.includes('not found') || 
        errMsg.includes('no text') || 
        errMsg.includes('ends at')
      ) {
        return { verses: [], endOfBook: true };
      }
      console.warn(`⚠️ Sefaria API Error for '${versionTitle}': ${data.error}`);
      return { verses: [], endOfBook: false };
    }

    if (!data.text || data.text.length === 0) {
      return { verses: [], endOfBook: true };
    }

    return { 
      verses: data.text.map(verse => cleanText(verse)), 
      endOfBook: false 
    };
  } catch (error) {
    console.error(`Error fetching ${bookName} ${chapterNum} (${versionTitle}):`, error.message);
    return { verses: [], endOfBook: false };
  }
}

/**
 * Main Ingestion Function
 */
async function runIngestion() {
  console.log('Starting Full Tanakh Translation Ingestion from Sefaria API...');

  for (const bookName of ALL_BOOKS) {
    console.log(`\n=========================================`);
    console.log(`📖 Processing Book: ${bookName}`);
    console.log(`=========================================\n`);

    let chapterNum = 1;
    let consecutiveMissing = 0;

    while (true) {
      console.log(`Processing ${bookName} Chapter ${chapterNum}...`);

      const [jpsResult, modernizedResult] = await Promise.all([
        fetchSefariaChapter(bookName, chapterNum, VERSIONS.JPS1917),
        fetchSefariaChapter(bookName, chapterNum, VERSIONS.MODERNIZED)
      ]);

      // Detect if we have reached the end of the book
      // We break if BOTH results signal the end of the book
      if (jpsResult.endOfBook && modernizedResult.endOfBook) {
        console.log(`🏁 Reached the end of ${bookName} (Chapter ${chapterNum - 1}). Moving to next book...`);
        break; 
      }

      const jpsVerses = jpsResult.verses;
      const modernizedVerses = modernizedResult.verses;

      // If one version is missing but the other isn't, we still process what we have
      if (jpsVerses.length === 0 && modernizedVerses.length === 0) {
        consecutiveMissing++;
        if (consecutiveMissing >= 2) {
          console.log(`⚠️ Multiple missing chapters in a row for ${bookName}. Moving on.`);
          break;
        }
        chapterNum++;
        await delay(1000);
        continue;
      }
      
      consecutiveMissing = 0;

      // Query our 'reader_verses_view' to find the actual verse IDs.
      const { data: viewData, error: fetchError } = await supabase
        .from('reader_verses_view')
        .select('verse_id, verse_num')
        .eq('book_id', bookName)
        .eq('chapter_num', chapterNum);

      if (fetchError) {
        console.error(`Error mapping verses for ${bookName} Ch ${chapterNum}:`, fetchError);
        chapterNum++;
        continue;
      }

      if (!viewData || viewData.length === 0) {
        console.warn(`⏭️ No mapped rows found for ${bookName} Ch ${chapterNum}. Ensure Hebrew is seeded.`);
        chapterNum++;
        continue;
      }

      console.log(`Updating ${viewData.length} verses in database...`);

      let updatedCount = 0;
      for (const row of viewData) {
        const verseIndex = row.verse_num - 1; 

        const jpsText = jpsVerses[verseIndex] || null;
        const modernizedText = modernizedVerses[verseIndex] || null;

        const updatePayload = {};
        if (jpsText) updatePayload.text_en = jpsText;
        if (modernizedText) updatePayload.text_en_modernized = modernizedText;

        if (Object.keys(updatePayload).length === 0) continue;

        const { error: updateError } = await supabase
          .from('verses')
          .update(updatePayload)
          .eq('id', row.verse_id);

        if (updateError) {
          console.error(`Failed update on ${bookName} ${chapterNum}:${row.verse_num}:`, updateError.message);
        } else {
          updatedCount++;
        }
      }

      console.log(`✅ ${bookName} Chapter ${chapterNum} updated (${updatedCount} verses).`);
      
      chapterNum++;
      await delay(1000); 
    }
  }

  console.log('\n🎉 Full Tanakh Ingestion Complete!');
}

runIngestion();