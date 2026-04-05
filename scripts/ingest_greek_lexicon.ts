/**
 * Strong's Greek Lexicon Ingestion Script
 * Syncs the local Strong's Greek Dictionary file with Supabase.
 * * Greek IDs are prefixed with 'G' (e.g., G1, G2424 for 'Jesus').
 * * Prerequisites: Ensure 'strongs-greek-dictionary.js' is in the root directory.
 * * Run: npx tsx scripts/ingest_greek_lexicon.ts
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

const LOCAL_FILE_PATH = path.join(process.cwd(), 'strongs-greek-dictionary.js');

// Made properties optional to safely handle missing data in the JSON
interface GreekEntry {
  lemma?: string;
  translit?: string;
  pron?: string;
  strongs_def?: string;
  kjv_def?: string;
  derivation?: string;
}

async function ingestGreekLexicon() {
  console.log('📖 Reading local Strong\'s Greek Dictionary...');
  
  if (!fs.existsSync(LOCAL_FILE_PATH)) {
    throw new Error(`Could not find ${LOCAL_FILE_PATH}. Please ensure the file is in your root folder.`);
  }

  const fileContent = fs.readFileSync(LOCAL_FILE_PATH, 'utf8');

  // Since the file is a .js file with a "var" assignment, we need to extract the JSON object.
  const jsonStart = fileContent.indexOf('{');
  const jsonEnd = fileContent.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Could not locate JSON data inside the dictionary file.");
  }

  const jsonStr = fileContent.substring(jsonStart, jsonEnd + 1);
  const data: Record<string, GreekEntry> = JSON.parse(jsonStr);
  const entries = Object.entries(data);
  
  console.log(`🚀 Syncing ${entries.length} Greek root words to Supabase...`);
  
  const batchSize = 100;
  let successCount = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize).map(([id, entry]) => {
      // Normalize ID format: G02424 -> G2424 (Matching Hebrew H1, H10 format)
      const normalizedId = id.replace(/^G0+/, 'G').toUpperCase();
      
      // Safely fallback undefined fields
      const translit = entry.translit || 'N/A';
      const lemma = entry.lemma || 'Unknown';
      const strongsDef = entry.strongs_def || 'No definition available.';
      const shortDef = entry.kjv_def || null;
      const derivation = entry.derivation || null;
      
      /**
       * Construct the long definition to match the Hebrew "Premium" HTML look.
       * Uses Tailwind classes for consistent typography in the DrashX Reader.
       */
      const longDefHtml = `
        <div>
          <p>
            <strong class="font-black text-slate-800 dark:text-slate-200">${normalizedId}. ${translit}</strong>
          </p>
          <p>
            <span class="font-serif text-2xl text-indigo-600 dark:text-indigo-400 mx-1" dir="ltr">${lemma}</span>
            <strong class="font-black text-slate-800 dark:text-slate-200">Greek root</strong>
          </p>
          <p class="mt-4 text-slate-700 dark:text-slate-300">
            ${strongsDef.trim()}
          </p>
          ${derivation ? `
            <p class="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 italic">
              <strong>Derivation:</strong> ${derivation}
            </p>
          ` : ''}
        </div>
      `.replace(/\s+/g, ' ').trim();
      
      return {
        id: normalizedId,
        lemma: lemma,
        transliteration: translit,
        pronunciation: entry.pron || 'N/A',
        short_def: shortDef,
        long_def: longDefHtml
      };
    });

    const { error } = await supabase.from('lexicon').upsert(batch, { onConflict: 'id' });
    
    if (error) {
      console.error(`\n❌ Error at index ${i}:`, error.message);
    } else {
      successCount += batch.length;
      process.stdout.write(`\r✅ Processed ${successCount} / ${entries.length} entries...`);
    }
  }

  console.log('\n\n🎉 Greek Lexicon successfully integrated into your platform with matched Hebrew styling.');
}

ingestGreekLexicon().catch(console.error);