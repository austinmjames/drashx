/**
 * Hybrid Strong's + BDB Lexicon Ingestion Script (100% Offline)
 * * This script combines two local data sources to build the ultimate lexicon:
 * 1. `SHD.js` (for metadata and short KJV gloss pills).
 * 2. `DictBDB.json` (for authoritative, scholarly depth).
 * * Run with:
 * npx tsx scripts/ingest_hybrid_lexicon.ts
 */

import fs from 'fs';
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

interface StrongsEntry {
  lemma: string;
  xlit: string;
  pron: string;
  derivation: string;
  strongs_def: string;
  kjv_def: string;
}

/**
 * Cleans the custom HTML found inside DictBDB.json BEFORE it hits the database.
 * This converts their proprietary tags into clean Tailwind-friendly HTML,
 * removing the burden from the frontend React components.
 */
function cleanBdbHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml
    // 1. Convert <heb><ref0><font> wrappers into clean Hebrew spans
    .replace(/<heb><ref0[^>]*><font[^>]*>(.*?)<\/font><\/ref0><\/heb>/gi, '<span class="font-hebrew text-2xl text-indigo-600 dark:text-indigo-400 mx-1" dir="rtl">$1</span>')
    
    // 2. Convert raw <heb> wrappers that lack the inner font tag
    .replace(/<heb>(.*?)<\/heb>/gi, '<span class="font-hebrew text-2xl text-indigo-600 dark:text-indigo-400 mx-1" dir="rtl">$1</span>')
    
    // 3. Convert Bible reference links into subdued UI text
    .replace(/<a href='bible:\/\/[^']*'>(.*?)<\/a>/gi, '<span class="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mx-1">$1</span>')
    
    // 4. Remove Left-To-Right (LTR) hidden Unicode marks that mess up text rendering
    .replace(/&#x200E;/gi, '')
    
    // 5. Clean up bold/subscript tags for consistency
    .replace(/<b>(.*?)<\/b>/gi, '<strong class="font-black text-slate-800 dark:text-slate-200">$1</strong>')
    .replace(/<sub>(.*?)<\/sub>/gi, '<sub class="text-[9px] text-slate-400">$1</sub>')
    .replace(/<sup>(.*?)<\/sup>/gi, '<sup class="text-[9px] text-slate-400">$1</sup>')
    
    // 6. Collapse excess whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

async function processHybridLexicon() {
  console.log('📖 Starting 100% Offline Hybrid Lexicon Ingestion...');

  // --- 1. Load Local BDB JSON ---
  const bdbMap = new Map<string, string>();
  if (fs.existsSync('DictBDB.json')) {
    console.log('✅ Found DictBDB.json. Loading scholarly definitions...');
    const bdbRaw = fs.readFileSync('DictBDB.json', 'utf8');
    const bdbData = JSON.parse(bdbRaw);
    
    for (const item of bdbData) {
      if (item.top && item.top.startsWith('H')) {
        bdbMap.set(item.top, cleanBdbHtml(item.def));
      }
    }
    console.log(`   Loaded ${bdbMap.size} scholarly BDB entries.`);
  } else {
    console.warn('⚠️ DictBDB.json not found in root directory! Please add it.');
    return;
  }

  // --- 2. Load Local Strong's JS ---
  console.log(`\n🌐 Loading Strong's Metadata from local SHD.js...`);
  let strongsData: Record<string, StrongsEntry> | null = null;
  
  if (fs.existsSync('SHD.js')) {
    const rawJs = fs.readFileSync('SHD.js', 'utf8');
    // Extract the JSON object from the JS wrapper by finding the first '{' and last '}'
    const jsonStart = rawJs.indexOf('{');
    const jsonEnd = rawJs.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = rawJs.substring(jsonStart, jsonEnd + 1);
      try {
        strongsData = JSON.parse(jsonStr);
        console.log('✅ Successfully extracted Strong\'s metadata from SHD.js!');
      } catch (e) {
        console.error('❌ Failed to parse JSON from SHD.js:', e);
        return;
      }
    } else {
      console.error('❌ Could not locate JSON object inside SHD.js');
      return;
    }
  } else {
    console.error('❌ SHD.js not found in root directory! Please add it.');
    return;
  }

  // --- 3. Merge and Upload ---
  if (!strongsData) {
    console.error('❌ Failed to load Strong\'s data. Cannot proceed.');
    return;
  }

  const entries = Object.entries(strongsData);
  console.log(`\n🚀 Starting database upload of ${entries.length} hybrid entries...`);

  const batchSize = 100;
  let successCount = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize).map(([strongsId, data]) => {
      // Ensure "H1" format matching across datasets
      const normalizedId = strongsId.replace(/^H0+/, 'H');
      
      let longDefHtml = bdbMap.get(normalizedId) || null;
      
      // Fallback if BDB doesn't have an entry for this word
      if (!longDefHtml && data.strongs_def) {
        longDefHtml = `
          <div class="prose prose-slate dark:prose-invert text-sm leading-relaxed">
            ${data.derivation ? `<p class="italic text-slate-500 mb-4"><strong>Etymology:</strong> ${data.derivation}</p>` : ''}
            <p>${data.strongs_def}</p>
          </div>
        `;
      }

      return {
        id: normalizedId,
        lemma: data.lemma || 'Unknown',
        transliteration: data.xlit || null,
        pronunciation: data.pron || null,
        short_def: data.kjv_def || null, 
        long_def: longDefHtml
      };
    });

    const { error } = await supabase
      .from('lexicon')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`\n❌ Error uploading batch at index ${i}:`, error.message);
    } else {
      successCount += batch.length;
      process.stdout.write(`\r✅ Synced ${successCount} / ${entries.length} hybrid definitions...`);
    }
  }

  console.log(`\n\n🎉 Done! The lexicon is now fully populated with pristine offline data.`);
}

processHybridLexicon().catch(console.error);