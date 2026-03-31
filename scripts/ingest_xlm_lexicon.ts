/**
 * Scholarly Lexicon Ingestion Script (BDB + Strong's Merge)
 * * This script merges 'HebrewStrong.xml' with 'bdb.xml' to provide 
 * Strong's-indexed scholarly definitions with full BDB depth.
 * * Prerequisites:
 * 1. Save 'HebrewStrong.xml' as 'lexicon.xml' in root.
 * 2. Save 'bdb.xml' in root.
 * 3. Save 'BDBPartsOfSpeech.xml' as 'pos.xml' in root.
 * 4. Run: npx ts-node scripts/ingest_xml_lexicon.ts
 */

import fs from 'fs';
import xml2js from 'xml2js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables. Please check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Interfaces ---

interface BdbNode {
  $?: { n?: string; id?: string; strong?: string; pos?: string; pron?: string; xlit?: string; };
  _?: string;
  [key: string]: unknown;
}

interface BdbEntry {
  $: { id: string; [key: string]: string | undefined; };
  w?: (string | { _: string, $: { pos?: string, pron?: string, xlit?: string } })[];
  orth?: (string | { _: string })[];
  meaning?: (string | { _: string, def?: string[] })[];
  usage?: string[];
  source?: (string | { _: string })[];
  [key: string]: unknown;
}

interface PosEntry {
  Code: string[];
  Name: string[];
}

interface PosXml {
  PartsOfSpeech?: { POS: PosEntry[]; };
}

interface LexiconRow { 
  id: string; 
  lemma: string; 
  transliteration: string; 
  pronunciation: string; 
  short_def: string; 
  long_def: string; 
}

const posMap: Record<string, string> = {};
const bdbDeepData: Record<string, string> = {}; // Maps Hebrew Lemma -> Full BDB HTML

/**
 * Flattens XML into clean HTML.
 * Uses strict type checking to avoid indexing errors on unknown types.
 */
const flattenNode = (node: BdbNode | string | (BdbNode | string)[]): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((n) => flattenNode(n)).join(' ');
  
  let content = '';
  if (node._) content += node._;
  
  const children = Object.keys(node).filter(k => k !== '$' && k !== '_');
  
  for (const tag of children) {
    const rawChild = node[tag];
    if (!Array.isArray(rawChild)) continue;
    
    const child = rawChild as (BdbNode | string)[];

    if (tag === 'meaning' || tag === 'sense') {
      content += `<div class="mt-4"><strong class="text-[10px] uppercase text-slate-400 block mb-1">Lexicon Entry</strong><div class="text-slate-900 dark:text-slate-100">${flattenNode(child)}</div></div>`;
    } else if (tag === 'usage') {
      content += `<div class="mt-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 italic text-sm text-slate-600 dark:text-slate-300">${flattenNode(child)}</div>`;
    } else if (tag === 'source' || tag === 'etym') {
      content += `<div class="mt-3 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2"><strong>Etymology:</strong> ${flattenNode(child)}</div>`;
    } else if (tag === 'def') {
      content += `<span class="font-bold text-indigo-600 dark:text-indigo-400">${flattenNode(child)}</span>`;
    } else if (tag === 'w' || tag === 'orth') {
      const firstChild = child[0];
      const code = (typeof firstChild === 'object' && firstChild !== null && '$' in firstChild) 
        ? (firstChild.$ as { pos?: string })?.pos 
        : undefined;
      const fullName = code ? (posMap[code] || code) : '';
      content += `<span class="font-hebrew text-2xl">${flattenNode(child)}</span> ${fullName ? `<span class="text-[10px] font-bold text-slate-400 uppercase">[${fullName}]</span>` : ''}`;
    } else {
      content += flattenNode(child);
    }
  }
  
  return content;
};

/**
 * Recursively find entries in BDB structure.
 */
const findBdbEntries = (obj: unknown): BdbEntry[] => {
  let entries: BdbEntry[] = [];
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (record.entry && Array.isArray(record.entry)) {
      entries = entries.concat(record.entry as BdbEntry[]);
    }
    for (const key in record) {
      if (key !== 'entry') {
        entries = entries.concat(findBdbEntries(record[key]));
      }
    }
  }
  return entries;
};

async function loadBdbDeepData() {
  if (!fs.existsSync('bdb.xml')) {
    console.warn('⚠️ bdb.xml not found. Ingesting without deep scholarly enrichment.');
    return;
  }
  console.log('📖 Pre-processing BDB scholarly entries...');
  const xmlData = fs.readFileSync('bdb.xml', 'utf8');
  const parser = new xml2js.Parser({ explicitArray: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
  const result = await parser.parseStringPromise(xmlData) as { lexicon?: unknown };
  const entries = findBdbEntries(result.lexicon);

  entries.forEach(entry => {
    const wNode = entry.w?.[0];
    const orthNode = entry.orth?.[0];
    
    let lemmaRaw = '';
    if (typeof wNode === 'string') {
      lemmaRaw = wNode;
    } else if (wNode && typeof wNode === 'object' && '_' in wNode) {
      lemmaRaw = wNode._ || '';
    } else if (typeof orthNode === 'string') {
      lemmaRaw = orthNode;
    } else if (orthNode && typeof orthNode === 'object' && '_' in orthNode) {
      lemmaRaw = orthNode._ || '';
    }

    const lemma = lemmaRaw.trim();
    if (lemma) {
      bdbDeepData[lemma] = flattenNode(entry as unknown as BdbNode);
    }
  });
  console.log(`✅ Loaded ${Object.keys(bdbDeepData).length} scholarly BDB definitions.`);
}

async function loadPartsOfSpeech() {
  if (!fs.existsSync('pos.xml')) return;
  const xmlData = fs.readFileSync('pos.xml', 'utf8');
  const parser = new xml2js.Parser({ explicitArray: true });
  const result = (await parser.parseStringPromise(xmlData)) as PosXml;
  const posList = result.PartsOfSpeech?.POS;
  if (posList) {
    posList.forEach((p) => {
      const code = p.Code?.[0];
      const name = p.Name?.[0];
      if (code && name) posMap[code] = name;
    });
  }
}

async function ingestScholarlyLexicon() {
  if (!fs.existsSync('lexicon.xml')) {
    console.error('❌ lexicon.xml (HebrewStrong.xml) required for ID mapping.');
    return;
  }

  await loadPartsOfSpeech();
  await loadBdbDeepData();

  console.log('📖 Merging Strong\'s with BDB Scholarly data...');
  const xmlData = fs.readFileSync('lexicon.xml', 'utf8');
  const parser = new xml2js.Parser({ explicitArray: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
  const parsed = await parser.parseStringPromise(xmlData) as { lexicon?: { entry?: BdbEntry[] }, entry?: BdbEntry[] };
  const entries = (parsed.lexicon?.entry || parsed.entry) || [];

  const batchSize = 100;
  let totalProcessed = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch: LexiconRow[] = entries.slice(i, i + batchSize).map((entry: BdbEntry) => {
      const id = entry.$.id.replace(/^H0+/, 'H');
      const wNode = entry.w?.[0];
      
      let lemma = '';
      let translit = '';
      let pronunciation = '';

      if (typeof wNode === 'string') {
        lemma = wNode;
      } else if (wNode && typeof wNode === 'object') {
        lemma = wNode._ || '';
        translit = wNode.$?.xlit || '';
        pronunciation = wNode.$?.pron || '';
      }
      
      const meaningNode = entry.meaning?.[0];
      let shortDef = '';
      if (typeof meaningNode === 'string') {
        shortDef = meaningNode;
      } else if (meaningNode && typeof meaningNode === 'object') {
        const meaningObj = meaningNode as { def?: string[], _?: string };
        if (meaningObj.def && Array.isArray(meaningObj.def) && meaningObj.def.length > 0) {
          shortDef = meaningObj.def[0];
        } else if (meaningObj._) {
          shortDef = meaningObj._;
        }
      }

      // --- THE MERGE LOGIC ---
      // 1. Get the concise Strong's definition
      const strongsDef = flattenNode(entry as unknown as BdbNode);
      // 2. See if we have a "Deep" BDB entry for this exact Hebrew word
      const deepDef = bdbDeepData[lemma];
      
      // Combine them: Strong's Summary first, followed by the Full Briggs entry
      const longDef = `
        <div class="strongs-summary mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
          ${strongsDef}
        </div>
        ${deepDef ? `
          <div class="bdb-full-scholarly">
            <h4 class="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-4">Brown-Driver-Briggs Full Entry</h4>
            ${deepDef}
          </div>
        ` : ''}
      `.trim();

      return { id, lemma, transliteration: translit, pronunciation, short_def: shortDef, long_def: longDef };
    });

    const { error } = await supabase.from('lexicon').upsert(batch, { onConflict: 'id' });
    if (error) console.error(`\n❌ Error:`, error.message);
    
    totalProcessed += batch.length;
    process.stdout.write(`\r🚀 Progress: ${totalProcessed} / ${entries.length} Scholarly Definitions Synced`);
  }

  console.log(`\n\n🎉 Done! Your reader now features the "Full Briggs" scholarly lexicon.`);
}

ingestScholarlyLexicon().catch(console.error);