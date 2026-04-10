// Path: app/api/admin/ingest/sefaria/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- Types & Helpers ---

interface ProcessedText { 
  text: string; 
  footnotes: { id: string; text: string }[]; 
}

interface ChapterData {
  number: number;
  label: string;
  verses: Map<number, ProcessedText>;
}

/**
 * Sefaria texts can be a single string, an array of strings, or nested objects/arrays 
 * representing Sections > Chapters > Verses.
 */
type SefariaTextNode = string | number | SefariaTextNode[] | Record<string, unknown> | null;

interface SefariaTextFile {
  title: string;
  heTitle?: string;
  language: string;
  versionTitle: string;
  versionSource?: string;
  license?: string;
  text: SefariaTextNode;
}

interface ConsolidatedBook {
  title: string;
  heTitle?: string;
  collection: string;
  category: string;
  order: number;
  enUrls: string[];
  heUrls: string[];
}

/**
 * A shared state class to ensure that when we process the Hebrew text and English text 
 * independently, they are perfectly aligned to the exact same database chapter numbers.
 * Ensures Hebrew and English maps synchronize perfectly, separating 
 * introductions (0, -1) from canonical chapters (1, 2).
 */
class SharedChapterMapper {
  private introCounter = 0;
  private map = new Map<string, number>();
  
  getChapterNumber(key: string, isIntro: boolean, preferredNumber: number): number {
    if (!this.map.has(key)) {
      if (isIntro) {
        this.map.set(key, this.introCounter--); // Intros count backwards from 0
      } else {
        this.map.set(key, preferredNumber);
      }
    }
    return this.map.get(key)!;
  }
}

/**
 * Validates open licenses.
 */
function isFreeLicense(licenseString?: string): boolean {
  if (!licenseString) return true;
  const l = licenseString.toLowerCase();
  return l.includes('public domain') || 
         l.includes('cc0') || 
         l.includes('cc-by') || 
         l.includes('creative commons') || 
         l.includes('open') || 
         l.includes('unknown');
}

/**
 * Strict Language Guard
 */
function isStrictlyEnglish(language: string, versionTitle: string): boolean {
  const lang = language?.toLowerCase();
  const title = versionTitle?.toLowerCase() || '';
  
  if (lang !== 'english' && lang !== 'en') return false;
  
  const restrictedMarkers = ['[fr]', '[es]', '[ru]', '[de]', '[pt]', '[it]', '[he]'];
  if (restrictedMarkers.some(marker => title.includes(marker))) return false;
  if (title.includes('spanish') || title.includes('french') || title.includes('russian')) return false;

  return true;
}

/**
 * TALMUD FOLIO CONVERTER
 */
function getTalmudFolio(index: number): { num: number, label: string } {
  const folioNum = Math.floor(index / 2) + 2;
  const side = index % 2 === 0 ? 'a' : 'b';
  return { num: index + 1, label: `${folioNum}${side}` };
}

/**
 * 1. Extracts footnotes.
 * 2. Replaces them with <sup data-footnote="id">.
 * 3. Strips formatting.
 */
function processSefariaText(rawText: string | null, isEnglish: boolean): ProcessedText {
  if (!rawText || typeof rawText !== 'string') return { text: '', footnotes: [] };
  
  let cleanText = rawText;
  const footnotes: { id: string, text: string }[] = [];
  let fnCounter = 1;
  
  if (isEnglish) {
    const fnRegex = /<sup class="footnote-marker">(.*?)<\/sup>\s*<i class="footnote">(.*?)<\/i>/gi;
    cleanText = cleanText.replace(fnRegex, (match, marker, fnHtml) => {
      const id = `fn-${fnCounter++}`;
      footnotes.push({ id, text: fnHtml.replace(/<[^>]+>/g, '').trim() });
      return `<sup data-footnote="${id}">${marker || '*'}</sup>`;
    });

    const altFnRegex = /<i class="footnote">(.*?)<\/i>/gi;
    cleanText = cleanText.replace(altFnRegex, (match, fnHtml) => {
      const id = `fn-${fnCounter++}`;
      footnotes.push({ id, text: fnHtml.replace(/<[^>]+>/g, '').trim() });
      return `<sup data-footnote="${id}">*</sup>`;
    });
  }

  // STRIP ALL FORMATTING EXCEPT <sup>
  cleanText = cleanText.replace(/<(?!\/?sup(?=>|\s.*>))\/?[\w:-]+[^>]*>/gi, '');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  return { text: cleanText, footnotes };
}

/**
 * Generates the interactive words array for the reader.
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
 * RECURSIVE FLATTENER (V7 - Semantic Prologue Preserving)
 * Evaluates node names to separate chapters from introductions.
 */
function extractTextMap(data: SefariaTextNode, isEnglish: boolean, isTalmud: boolean, mapper: SharedChapterMapper): Map<number, ChapterData> {
  const chapters = new Map<number, ChapterData>();
  
  function walk(node: SefariaTextNode, path: number[], pathNames: string[]) {
    // Terminal Case: String found (or null/empty placeholder)
    if (typeof node === 'string' || typeof node === 'number' || node === null) {
      const strNode = node === null ? '' : String(node);

      const activeName = pathNames.length > 0 ? pathNames[pathNames.length - 1] : null;
      const isDefault = activeName?.toLowerCase() === 'default';
      
      let isIntro = false;
      let isNamedChapter = false;
      let explicitChapNum: number | null = null;

      // Smart Node Parsing
      if (activeName && !isDefault) {
        const match = activeName.match(/^(\d+)$/);
        const matchChap = activeName.match(/chapter\s+(\d+)/i);
        if (match) {
          isNamedChapter = true;
          explicitChapNum = parseInt(match[1], 10);
        } else if (matchChap) {
          isNamedChapter = true;
          explicitChapNum = parseInt(matchChap[1], 10);
        } else {
          isIntro = true;
        }
      }

      let chapterKey: string;
      let chapLabel: string;
      let verseNum: number;
      let preferredNum: number = 1;

      if (isIntro) {
        chapterKey = `intro-${pathNames.join('-')}`;
        chapLabel = activeName || pathNames.join(' ');
        verseNum = path.length > 0 ? path[path.length - 1] + 1 : 1;
      } else if (isNamedChapter) {
        chapterKey = `named-${explicitChapNum}`;
        chapLabel = activeName!;
        verseNum = path.length > 0 ? path[path.length - 1] + 1 : 1;
        preferredNum = explicitChapNum!;
      } else {
        if (path.length === 0) {
           chapterKey = `main-root`;
           chapLabel = '1';
           verseNum = 1;
           preferredNum = 1;
        } else if (path.length === 1) {
           chapterKey = `main-1`;
           chapLabel = '1';
           verseNum = path[0] + 1;
           preferredNum = 1;
        } else if (isTalmud) {
           const rawIdx = path[0];
           const folio = getTalmudFolio(rawIdx);
           chapterKey = `talmud-${rawIdx}`;
           chapLabel = folio.label;
           verseNum = path[path.length - 1] + 1;
           preferredNum = folio.num;
        } else {
           const chapterIndices = path.slice(0, -1);
           chapterKey = `main-${chapterIndices.join('-')}`;
           if (chapterIndices.length === 1) {
             chapLabel = (chapterIndices[0] + 1).toString();
             preferredNum = chapterIndices[0] + 1;
           } else {
             chapLabel = chapterIndices.map(i => i + 1).join('.');
             // Generates sequential numeric mapping for deep nested books (e.g. 1.2 -> 1002)
             preferredNum = parseInt(chapterIndices.map(i => (i+1).toString().padStart(3, '0')).join(''), 10) || 1;
           }
           verseNum = path[path.length - 1] + 1;
        }
      }

      // 3. Resolve the finalized database chapter number
      const finalChapNum = mapper.getChapterNumber(chapterKey, isIntro, preferredNum);

      if (!chapters.has(finalChapNum)) {
        chapters.set(finalChapNum, { number: finalChapNum, label: chapLabel.substring(0, 50), verses: new Map() });
      }
      
      const processed = processSefariaText(strNode, isEnglish);
      chapters.get(finalChapNum)!.verses.set(verseNum, processed);

    } else if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child as SefariaTextNode, [...path, index], pathNames));
    } else if (typeof node === 'object' && node !== null) {
      for (const [key, child] of Object.entries(node)) {
        walk(child as SefariaTextNode, path, [...pathNames, key]);
      }
    }
  }

  walk(data, [], []);
  return chapters;
}

// --- Streaming API Route ---
export async function POST(request: Request) {
  // Initialize Supabase inside the POST request to prevent build-time crashes.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse(
      JSON.stringify({ error: "Missing Supabase configuration." }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const encoder = new TextEncoder();
  const body = await request.json() as ConsolidatedBook;

  const stream = new ReadableStream({
    async start(controller) {
      const log = (msg: string, type: 'info' | 'success' | 'error' | 'progress' = 'info', progress?: number) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: msg, type, progress })}\n\n`));
      };

      try {
        const { title, heUrls, enUrls, collection, category, order } = body;
        const isTalmud = collection.includes('Talmud') || category.includes('Bavli') || category.includes('Mishnah');
        const mapper = new SharedChapterMapper();

        log(`Initializing sync for ${title}...`);

        if ((!heUrls || heUrls.length === 0) && (!enUrls || enUrls.length === 0)) {
          log(`Skipping ${title}: No text URLs available.`, 'error');
          controller.close();
          return;
        }

        // 1. Download Hebrew Source (If Available)
        let heData: SefariaTextFile | null = null;
        if (heUrls && heUrls.length > 0) {
          log(`Downloading source text...`);
          const heResp = await fetch(heUrls[0]);
          if (heResp.ok) heData = await heResp.json() as SefariaTextFile;
        }

        // 2. Download and Verify up to 3 English Translations
        const validTranslations: { slug: string; map: Map<number, ChapterData> }[] = [];

        if (enUrls && enUrls.length > 0) {
          log(`Processing translations (up to 3)...`);
          for (const url of enUrls.slice(0, 3)) {
            const enResp = await fetch(url);
            if (!enResp.ok) continue;
            
            const fetchedEnData = await enResp.json() as SefariaTextFile;
            
            // STRICT VALIDATION: License + Language
            if (isFreeLicense(fetchedEnData.license)) {
              if (isStrictlyEnglish(fetchedEnData.language, fetchedEnData.versionTitle)) {
                const cleanVersionName = fetchedEnData.versionTitle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 15) || `TRANS${validTranslations.length + 1}`;
                const translationSlug = `SEFARIA-${cleanVersionName}`;

                await supabase.from('translations').upsert({
                  slug: translationSlug,
                  name: fetchedEnData.versionTitle,
                  license: fetchedEnData.license || 'unknown',
                  version_source: fetchedEnData.versionSource || 'Sefaria Export',
                  target_collections: [collection]
                }, { onConflict: 'slug' });
                
                log(`Translation Verified: ${fetchedEnData.versionTitle}`, 'success');
                
                const tMap = extractTextMap(fetchedEnData.text, true, isTalmud, mapper);
                validTranslations.push({ slug: translationSlug, map: tMap });
              } else {
                log(`Skipped Version: Non-English translation detected [${fetchedEnData.versionTitle}]`, 'error');
              }
            } else {
              log(`Skipping Translation: Restricted license '${fetchedEnData.license}'`, 'error');
            }
          }
        }

        if (!heData && validTranslations.length === 0) {
           log(`Skipped: Neither source text nor a valid open-license translation is available.`, 'error');
           controller.close();
           return;
        }

        // 3. Extract Hebrew Map
        log(`Mapping recursive hierarchy...`);
        const heMap = heData ? extractTextMap(heData.text, false, isTalmud, mapper) : new Map<number, ChapterData>();

        // 4. Determine Book Order & Upsert
        log(`Registering book metadata...`);
        
        let finalOrderId = order;
        
        if (!finalOrderId) {
          const { data: maxOrderData } = await supabase
            .from('books')
            .select('order_id')
            .eq('collection', collection)
            .eq('category', category)
            .order('order_id', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          finalOrderId = (maxOrderData?.order_id || 0) + 1;
        }

        // Title Fallback handling: Try Hebrew, then fallback to first valid translation title, else base title
        const finalHeTitle = heData?.heTitle || title;

        const { data: bookRecord, error: bookErr } = await supabase
          .from('books')
          .upsert({
            name_en: title,
            name_he: finalHeTitle,
            category: category,
            collection: collection,
            order_id: finalOrderId,
            visibility_status: 'extended' 
          }, { onConflict: 'name_en' })
          .select('id')
          .single();

        if (bookErr || !bookRecord) throw new Error(`Metadata Sync Failed: ${bookErr?.message}`);

        // 5. Bi-Directional Merge & Process (Multi-Translation Support)
        const allChapterNumbersSet = new Set<number>();
        if (heMap) Array.from(heMap.keys()).forEach(k => allChapterNumbersSet.add(k));
        validTranslations.forEach(t => Array.from(t.map.keys()).forEach(k => allChapterNumbersSet.add(k)));
        
        const allChapterNumbers = Array.from(allChapterNumbersSet).sort((a, b) => a - b);
        let processedCount = 0;

        for (const cNum of allChapterNumbers) {
          const heChapData = heMap.get(cNum);
          const primaryEnChapData = validTranslations[0]?.map.get(cNum);
          const chapLabel = heChapData?.label || primaryEnChapData?.label || cNum.toString();

          // --- RESILIENT CHAPTER RESOLUTION ---
          let chapId: string;
          const { data: existingChap } = await supabase
            .from('chapters')
            .select('id')
            .eq('book_id', bookRecord.id)
            .eq('chapter_number', cNum)
            .maybeSingle();

          if (existingChap) {
            chapId = existingChap.id;
            await supabase.from('chapters').update({ display_label: chapLabel }).eq('id', chapId);
          } else {
            const { data: newChap, error: insChapErr } = await supabase
              .from('chapters')
              .insert({ book_id: bookRecord.id, chapter_number: cNum, display_label: chapLabel })
              .select('id')
              .single();

            if (insChapErr || !newChap) {
              log(`Chapter insertion error [${chapLabel}]: ${insChapErr?.message}`, 'error');
              continue;
            }
            chapId = newChap.id;
          }

          // Merge verse keys from Hebrew + All valid English versions
          const allVerseNumbersSet = new Set<number>();
          if (heChapData) Array.from(heChapData.verses.keys()).forEach(k => allVerseNumbersSet.add(k));
          validTranslations.forEach(t => {
            const tChap = t.map.get(cNum);
            if (tChap) Array.from(tChap.verses.keys()).forEach(k => allVerseNumbersSet.add(k));
          });
          const allVerseNumbers = Array.from(allVerseNumbersSet).sort((a, b) => a - b);
          
          // --- RESILIENT VERSE RESOLUTION ---
          const { data: existingVerses } = await supabase
            .from('verses')
            .select('id, verse_number')
            .eq('chapter_id', chapId);
            
          const existingVerseMap = new Map(existingVerses?.map(v => [v.verse_number, v.id]) || []);
          
          const CHUNK_SIZE = 100;
          for (let i = 0; i < allVerseNumbers.length; i += CHUNK_SIZE) {
            const chunk = allVerseNumbers.slice(i, i + CHUNK_SIZE);
            const verseBatch = chunk.map(vNum => {
                const heTextObj = heChapData?.verses.get(vNum) || { text: '', footnotes: [] };
                const primaryEnTextObj = primaryEnChapData?.verses.get(vNum) || { text: '', footnotes: [] };
                
                const existingId = existingVerseMap.get(vNum);
                
                return {
                    // FIX: Explicitly assign a new UUID if the verse does not exist to satisfy strict DB constraints
                    id: existingId || crypto.randomUUID(),
                    chapter_id: chapId,
                    verse_number: vNum,
                    text_he: heTextObj.text,
                    text_en: primaryEnTextObj.text, // Legacy column acts as primary fallback
                    words: generateWordsArray(heTextObj.text, cNum, vNum)
                };
            });

            const { data: upsertedVerses, error: vErr } = await supabase
                .from('verses')
                .upsert(verseBatch)
                .select('id, verse_number');

            if (vErr) {
              log(`Verse error in ${chapLabel} [Chunk ${i/CHUNK_SIZE+1}]: ${vErr.message}`, 'error');
              continue;
            }

            // --- MULTI-TRANSLATION MERGE ---
            if (upsertedVerses && validTranslations.length > 0) {
              const translationBatch: { verse_id: string; translation_slug: string; content: string; footnotes: { id: string; text: string }[] }[] = [];
              
              upsertedVerses.forEach(uv => {
                validTranslations.forEach(t => {
                  const tChap = t.map.get(cNum);
                  if (!tChap) return;
                  
                  const engObj = tChap.verses.get(uv.verse_number);
                  if (engObj && engObj.text) {
                    translationBatch.push({
                      verse_id: uv.id,
                      translation_slug: t.slug,
                      content: engObj.text,
                      footnotes: engObj.footnotes
                    });
                  }
                });
              });

              if (translationBatch.length > 0) {
                await supabase.from('verse_translations').upsert(translationBatch, { onConflict: 'verse_id,translation_slug' });
              }
            }
          }

          processedCount++;
          const progress = Math.round((processedCount / allChapterNumbers.length) * 100);
          log(`Synced ${chapLabel} (${allVerseNumbers.length} verses)`, 'progress', progress);
        }

        log(`Successfully ingested ${title}`, 'success', 100);

      } catch (err: unknown) {
        log(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}