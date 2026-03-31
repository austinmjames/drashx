// Filepath: scripts/ingest_lexicon.ts
/**
 * Strong's Hebrew Lexicon to Supabase Ingestion Script
 * * This script automatically fetches an open-source JSON version of the 
 * Strong's Hebrew Dictionary and uploads it to your `lexicon` table.
 * * * Run with:
 * npx ts-node scripts/ingest_lexicon.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables. Please check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// A reliable, open-source GitHub repository hosting the Strong's Dictionary in clean JSON
const DICTIONARY_JSON_URL = 'https://raw.githubusercontent.com/adoken1/Strongs-Dictionary-JSON/master/strongs-hebrew.json';

interface StrongsEntry {
  lemma: string;
  xlit: string;
  pron: string;
  derivation: string;
  strongs_def: string;
  kjv_def: string;
}

async function processLexicon() {
  console.log('📖 Fetching Strong\'s Hebrew Dictionary from GitHub...');
  
  try {
    const response = await fetch(DICTIONARY_JSON_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const dictionaryData: Record<string, StrongsEntry> = await response.json();
    const entries = Object.entries(dictionaryData);
    
    console.log(`✅ Downloaded ${entries.length} dictionary entries. Starting database upload...`);

    const batchSize = 100; // Upload in batches to avoid overwhelming Supabase
    let successCount = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize).map(([strongsNumber, data]) => {
        // The JSON keys are usually formatted like "H0001", "H0002". 
        // We ensure it matches our OSMHB extraction format (e.g., "H1", "H7225") by stripping leading zeros.
        const normalizedId = strongsNumber.replace(/^H0+/, 'H');

        return {
          id: normalizedId,
          lemma: data.lemma || 'Unknown',
          transliteration: data.xlit || null,
          pronunciation: data.pron || null,
          short_def: data.kjv_def || null, // KJV glosses are usually good short definitions
          long_def: data.strongs_def ? `${data.derivation ? `<em>${data.derivation}</em><br/>` : ''}${data.strongs_def}` : null
        };
      });

      const { error } = await supabase
        .from('lexicon')
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error uploading batch starting at index ${i}:`, error.message);
      } else {
        successCount += batch.length;
        process.stdout.write(`\r🚀 Uploaded ${successCount} / ${entries.length} definitions...`);
      }
    }

    console.log(`\n\n🎉 Done! Successfully populated the lexicon with ${successCount} ancient Hebrew root words.`);
    
  } catch (err) {
    console.error('❌ Failed to process lexicon:', err);
  }
}

processLexicon();