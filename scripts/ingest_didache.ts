/**
 * Didache Ingestion Script
 * Processes the provided CSV and integrates it into the Christianity collection.
 * * Run with: npx tsx scripts/ingest_didache.ts
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

interface DidacheRow {
  chapter: string;
  verse: string;
  text_gr: string;
  text_en: string;
}

async function ingestDidache() {
  console.log('📖 Starting Didache Ingestion...');

  const csvPath = path.join(process.cwd(), 'Didache - Sheet1.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error("Could not find 'Didache - Sheet1.csv' in the root directory.");
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as DidacheRow[];

  const BOOK_NAME = 'Didache';
  const HEBREW_NAME = 'Διδαχή'; // Using Greek title in the "Hebrew" field for consistency
  const CATEGORY = 'General Epistles';
  const COLLECTION = 'Christianity';
  const TRANSLATION_SLUG = 'DIDACHE-EN';

  try {
    // 1. Determine Order ID (Place at the absolute end)
    const { data: maxOrderRes } = await supabase
      .from('books')
      .select('order_id')
      .order('order_id', { ascending: false })
      .limit(1);
    
    const nextOrder = (maxOrderRes?.[0]?.order_id || 127) + 1;

    // 2. Register Book Metadata
    const { data: book, error: bookErr } = await supabase
      .from('books')
      .upsert({
        name_en: BOOK_NAME,
        name_he: HEBREW_NAME,
        category: CATEGORY,
        collection: COLLECTION,
        order_id: nextOrder,
        visibility_status: 'extended'
      }, { onConflict: 'name_en' })
      .select('id')
      .single();

    if (bookErr || !book) throw new Error(`Book Registration Failed: ${bookErr.message}`);
    console.log(`✅ Registered ${BOOK_NAME} (Order ID: ${nextOrder})`);

    // 3. Register Translation Meta
    await supabase.from('translations').upsert({
      slug: TRANSLATION_SLUG,
      name: 'Didache (English)',
      license: 'Public Domain',
      version_source: 'User Upload',
      target_collections: [COLLECTION],
      target_categories: [CATEGORY],
      target_books: [BOOK_NAME]
    }, { onConflict: 'slug' });

    // 4. Ensure Category Config exists for the Admin Curator
    await supabase.from('collection_configs').upsert({ id: COLLECTION }, { onConflict: 'id' });
    await supabase.from('category_configs').upsert({ 
      collection_id: COLLECTION, 
      name_en: CATEGORY 
    }, { onConflict: 'collection_id, name_en' });

    // 5. Group records by chapter
    const chaptersMap = new Map<number, DidacheRow[]>();
    records.forEach(row => {
      const cNum = parseInt(row.chapter, 10);
      const vNum = parseInt(row.verse, 10);
      
      // Skip invalid or header rows
      if (isNaN(cNum) || isNaN(vNum)) return;

      if (!chaptersMap.has(cNum)) chaptersMap.set(cNum, []);
      chaptersMap.get(cNum)!.push(row);
    });

    console.log(`🧪 Processing ${chaptersMap.size} chapters...`);

    for (const [chapterNum, rows] of Array.from(chaptersMap.entries())) {
      
      // RESILIENT CHAPTER RESOLUTION: Check then insert to avoid missing unique constraint errors
      let chapId: string;
      const { data: existingChap } = await supabase
        .from('chapters')
        .select('id')
        .eq('book_id', book.id)
        .eq('chapter_number', chapterNum)
        .maybeSingle();

      if (existingChap) {
        chapId = existingChap.id;
      } else {
        const { data: newChap, error: insChapErr } = await supabase
          .from('chapters')
          .insert({ book_id: book.id, chapter_number: chapterNum })
          .select('id')
          .single();

        if (insChapErr || !newChap) {
          console.error(`   ❌ Chapter ${chapterNum} failed:`, insChapErr?.message);
          continue;
        }
        chapId = newChap.id;
      }

      // Fetch existing verses for this chapter to handle updates properly
      const { data: existingVerses } = await supabase
        .from('verses')
        .select('id, verse_number')
        .eq('chapter_id', chapId);

      const verseLookup = new Map(existingVerses?.map(v => [v.verse_number, v.id]) || []);

      // Prepare Verse Batch
      const verseBatch = rows.map(r => {
        const vNum = parseInt(r.verse, 10);
        const existingId = verseLookup.get(vNum);
        
        // --- FIX: ENFORCE GREEK RENDERING ---
        // The UI determines the numeral style (Hebrew vs Greek) based on 
        // the presence of Greek Strong's numbers (starting with 'G') in the words array.
        // We split the Greek text into words and tag them with a placeholder Strong's ID.
        const greekWordsPlaceholder = r.text_gr.split(/\s+/).map((word, idx) => ({
          id: idx + 1,
          text: word,
          strongs: 'G0', // Placeholder to trigger Greek rendering in the UI
          morph: null
        }));

        return {
          // Conditional spread: Only include 'id' key if we actually have an existing UUID.
          ...(existingId ? { id: existingId } : {}),
          chapter_id: chapId,
          verse_number: vNum,
          text_he: r.text_gr, 
          text_en: r.text_en, 
          words: greekWordsPlaceholder 
        };
      });

      const { data: upsertedVerses, error: vErr } = await supabase
        .from('verses')
        .upsert(verseBatch)
        .select('id, verse_number');

      if (vErr || !upsertedVerses) {
        console.error(`   ❌ Verse Batch (Ch ${chapterNum}) failed:`, vErr?.message);
        continue;
      }

      // Map translations to slugs
      const translationBatch = upsertedVerses.map(uv => {
        const sourceRow = rows.find(r => parseInt(r.verse, 10) === uv.verse_number);
        return {
          verse_id: uv.id,
          translation_slug: TRANSLATION_SLUG,
          content: sourceRow?.text_en || ''
        };
      }).filter(t => t.content);

      if (translationBatch.length > 0) {
        await supabase.from('verse_translations').upsert(translationBatch, { onConflict: 'verse_id, translation_slug' });
      }

      process.stdout.write(`\r🚀 Synced Chapter ${chapterNum}/${chaptersMap.size}...`);
    }

    console.log('\n\n🎉 Ingestion Complete. Didache is now live as GREEK text!');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Fatal Error:', errorMsg);
  }
}

ingestDidache();