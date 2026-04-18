// Path: app/api/admin/ingest/sefaria/route_v6.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- Types & Helpers ---

interface ProcessedText { 
  text: string; 
  footnotes: { id: string; text: string }[]; 
}

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

function isFreeLicense(licenseString?: string): boolean {
  if (!licenseString) return true;
  const l = licenseString.toLowerCase();
  return l.includes('public domain') || l.includes('cc0') || l.includes('cc-by') || l.includes('creative commons') || l.includes('open') || l.includes('unknown');
}

function isStrictlyEnglish(language: string, versionTitle: string): boolean {
  const lang = language?.toLowerCase();
  const title = versionTitle?.toLowerCase() || '';
  if (lang !== 'english' && lang !== 'en') return false;
  const restrictedMarkers = ['[fr]', '[es]', '[ru]', '[de]', '[pt]', '[it]', '[he]'];
  if (restrictedMarkers.some(marker => title.includes(marker))) return false;
  if (title.includes('spanish') || title.includes('french') || title.includes('russian')) return false;
  return true;
}

function getTalmudFolio(index: number): { num: number, label: string } {
  const folioNum = Math.floor(index / 2) + 2;
  const side = index % 2 === 0 ? 'a' : 'b';
  return { num: index + 1, label: `${folioNum}${side}` };
}

/**
 * Robust Balanced-Tag Parser
 * Precisely captures footnotes even if they contain nested HTML tags like <i>
 */
function processSefariaText(rawText: string | null, isEnglish: boolean): ProcessedText {
  if (!rawText || typeof rawText !== 'string') return { text: '', footnotes: [] };
  
  let cleanText = rawText;
  const footnotes: { id: string, text: string }[] = [];
  let fnCounter = 1;
  
  if (isEnglish) {
    let startIndex = 0;
    while (true) {
      const footnoteMatch = cleanText.substring(startIndex).match(/<i\s+class="footnote">/i);
      if (!footnoteMatch) break;
      
      const fnStartAbs = startIndex + footnoteMatch.index!;
      let openCount = 1;
      let i = fnStartAbs + footnoteMatch[0].length;
      
      while (i < cleanText.length && openCount > 0) {
        const remainder = cleanText.substring(i);
        // Using word boundary \b to strictly match <i> or <i ...> but ignore <img>
        const openMatch = remainder.match(/^<i\b[^>]*>/i);
        const closeMatch = remainder.match(/^<\/i>/i);
        
        if (openMatch) {
          openCount++;
          i += openMatch[0].length;
        } else if (closeMatch) {
          openCount--;
          if (openCount === 0) break;
          i += closeMatch[0].length;
        } else {
          i++;
        }
      }
      
      if (openCount === 0) {
        const footnoteHtml = cleanText.substring(fnStartAbs + footnoteMatch[0].length, i);
        const id = `fn-${fnCounter++}`;
        footnotes.push({ id, text: footnoteHtml.replace(/<[^>]+>/g, '').trim() });
        
        const beforeFn = cleanText.substring(0, fnStartAbs);
        const afterFn = cleanText.substring(i + 4); // </i> is 4 chars
        
        const supMatch = beforeFn.match(/<sup[^>]*class="footnote-marker"[^>]*>([^<]*)<\/sup>\s*$/i);
        
        if (supMatch) {
          const marker = supMatch[1] || '*';
          const replacement = `<sup data-footnote="${id}">${marker}</sup>`;
          cleanText = beforeFn.substring(0, supMatch.index) + replacement + afterFn;
          startIndex = beforeFn.substring(0, supMatch.index!).length + replacement.length;
        } else {
          const replacement = `<sup data-footnote="${id}">*</sup>`;
          cleanText = beforeFn + replacement + afterFn;
          startIndex = beforeFn.length + replacement.length;
        }
      } else {
        startIndex = fnStartAbs + 1; // Prevent infinite loop if HTML is malformed
      }
    }
  }

  // STRIP ALL REMAINING FORMATTING EXCEPT <sup>
  cleanText = cleanText.replace(/<(?!\/?sup(?=>|\s.*>))\/?[\w:-]+[^>]*>/gi, '');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  return { text: cleanText, footnotes };
}

function generateWordsArray(cleanText: string, chapterNum: string, verseNum: number): unknown[] {
  if (!cleanText) return [];
  const isGreek = /[α-ωΑ-Ω]/.test(cleanText);
  const fallbackStrongs = isGreek ? 'G0' : 'H0';

  return cleanText.split(/\s+/).filter(w => w.trim().length > 0).map((word, idx) => ({
    id: `w-${chapterNum}-${verseNum}-${idx}`,
    text: word,
    meaning: null,
    morph: null,
    strongs: fallbackStrongs, 
    root_text: null,
    pronunciation: "N/A",
    transliteration: "N/A"
  }));
}

/**
 * Sequential Chapter Registry
 * Replaces the old negative-number hack. Assigns a strict, chronological 
 * order_id to every node as it is organically encountered in the JSON tree.
 * Uses the literal text label as the chapter_number identifier.
 */
class SharedChapterRegistry {
  private sequence = 1;
  private map = new Map<string, { chapter_number: string, order_id: number }>();
  
  register(key: string, preferredLabel: string): { chapter_number: string, order_id: number } {
    if (!this.map.has(key)) {
      let finalLabel = preferredLabel;
      let suffix = 2;
      
      // Ensure the text label is unique within this specific book's registry
      const existingLabels = Array.from(this.map.values()).map(v => v.chapter_number);
      while (existingLabels.includes(finalLabel)) {
         finalLabel = `${preferredLabel} ${suffix}`;
         suffix++;
      }
      
      this.map.set(key, { chapter_number: finalLabel, order_id: this.sequence++ });
    }
    return this.map.get(key)!;
  }
}

function extractTextMap(data: SefariaTextNode, isEnglish: boolean, isTalmud: boolean, registry: SharedChapterRegistry): Map<string, { chapter_number: string, order_id: number, verses: Map<number, ProcessedText> }> {
  const chapters = new Map<string, { chapter_number: string, order_id: number, verses: Map<number, ProcessedText> }>();
  
  function walk(node: SefariaTextNode, path: number[], pathNames: string[]) {
    if (typeof node === 'string' || typeof node === 'number' || node === null) {
      const strNode = node === null ? '' : String(node);
      const activeName = pathNames.length > 0 ? pathNames[pathNames.length - 1] : null;
      const isDefault = !activeName || activeName.toLowerCase() === 'default';
      
      let chapLabel = '';
      let chapterKey = '';

      const verseIdx = path.length > 0 ? path[path.length - 1] : 0;
      const verseNum = verseIdx + 1;
      const chapterIndices = path.slice(0, -1);

      if (chapterIndices.length === 0) {
        chapterKey = activeName ? `named-${activeName}` : `main-root`;
        chapLabel = activeName && !isDefault ? activeName : '1';
      } else if (isTalmud) {
         const rawIdx = chapterIndices[chapterIndices.length - 1] || chapterIndices[0];
         const folio = getTalmudFolio(rawIdx);
         chapterKey = `talmud-${rawIdx}`;
         chapLabel = folio.label;
      } else {
         chapterKey = `chap-${pathNames.join('-')}-${chapterIndices.join('-')}`;
         
         if (activeName && !isDefault) {
            const arrayDepth = chapterIndices.length - pathNames.length;
            if (arrayDepth >= 0) {
               const subChapIdx = chapterIndices[chapterIndices.length - 1];
               chapLabel = `${activeName} ${subChapIdx + 1}`;
            } else {
               chapLabel = activeName;
            }
         } else {
            const lastIdx = chapterIndices[chapterIndices.length - 1];
            const preferredNum = lastIdx + 1;
            const cleanPath = pathNames.filter(n => n && n.toLowerCase() !== 'default');
            if (cleanPath.length > 0) {
              chapLabel = `${cleanPath.join(' ')} ${preferredNum}`;
            } else {
              chapLabel = preferredNum.toString();
            }
         }
      }

      // Format truncation for the human-readable label
      let cleanLabel = chapLabel;
      if (cleanLabel.length > 50) {
        const parts = cleanLabel.split(' ');
        const lastPart = parts.pop();
        cleanLabel = parts.slice(0, 3).join(' ') + '... ' + (lastPart || '');
        if (cleanLabel.length > 50) cleanLabel = cleanLabel.substring(0, 50);
      }

      // Register sequentially to receive a pure order_id, preserving exactly the JSON flow
      const chapRef = registry.register(chapterKey, cleanLabel);

      if (!chapters.has(chapRef.chapter_number)) {
        chapters.set(chapRef.chapter_number, { 
          chapter_number: chapRef.chapter_number, 
          order_id: chapRef.order_id, 
          verses: new Map() 
        });
      }
      
      const processed = processSefariaText(strNode, isEnglish);
      chapters.get(chapRef.chapter_number)!.verses.set(verseNum, processed);

    } else if (Array.isArray(node)) {
      const activeName = pathNames.length > 0 ? pathNames[pathNames.length - 1] : null;
      const isIntro = activeName && !activeName.match(/\d+/) && !activeName.toLowerCase().match(/(?:chapter|section|part)/i);
      const isStringArray = node.length > 0 && node.every(child => typeof child === 'string');
      
      if (isStringArray && isIntro) {
        const joinedText = node.join('<br><br>');
        walk(joinedText, path, pathNames);
        return;
      }

      node.forEach((child, index) => walk(child as SefariaTextNode, [...path, index], pathNames));
    } else if (typeof node === 'object' && node !== null) {
      let fallbackIndex = 0; 
      for (const [key, child] of Object.entries(node)) {
        if (key === "") {
          walk(child as SefariaTextNode, path, pathNames);
        } else {
          const match = key.match(/\d+/);
          const indexToUse = match ? parseInt(match[0], 10) - 1 : fallbackIndex;
          walk(child as SefariaTextNode, [...path, indexToUse], [...pathNames, key]);
          fallbackIndex++;
        }
      }
    }
  }

  walk(data, [], []);
  return chapters;
}


// --- Streaming API Route ---
export async function POST(request: Request) {
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

        log(`Initializing sync for ${title}...`);

        if ((!heUrls || heUrls.length === 0) && (!enUrls || enUrls.length === 0)) {
          log(`Skipping ${title}: No text URLs available.`, 'error');
          controller.close();
          return;
        }

        let heData: SefariaTextFile | null = null;
        if (heUrls && heUrls.length > 0) {
          log(`Downloading source text...`);
          const heResp = await fetch(heUrls[0]);
          if (heResp.ok) heData = await heResp.json() as SefariaTextFile;
        }

        const validTranslations: { slug: string; rawText: SefariaTextNode; title: string }[] = [];
        if (enUrls && enUrls.length > 0) {
          log(`Processing translations...`);
          for (const url of enUrls.slice(0, 3)) {
            const enResp = await fetch(url);
            if (!enResp.ok) continue;
            
            const fetchedEnData = await enResp.json() as SefariaTextFile;
            
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
                validTranslations.push({ slug: translationSlug, rawText: fetchedEnData.text, title: fetchedEnData.versionTitle });
              }
            }
          }
        }

        const subBooksToProcess: {
          bookTitle: string;
          heTitle: string;
          categoryName: string;
          heNode: SefariaTextNode;
          enNodes: { slug: string, node: SefariaTextNode }[];
        }[] = [];

        const primaryData = validTranslations[0]?.rawText || heData?.text;
        let isBookOfBooks = false;
        
        if (primaryData && typeof primaryData === 'object' && !Array.isArray(primaryData)) {
          const keys = Object.keys(primaryData);
          const hasChapterKey = keys.some(k => k.match(/^(\d+)$/) || k.match(/chapter/i) || k.toLowerCase() === 'default');
          if (!hasChapterKey && keys.length > 1) {
            isBookOfBooks = true;
          }
        }

        if (isBookOfBooks) {
          log(`Category Promotion Detected: Splitting '${title}' into multiple distinct books...`, 'info');
          const targetCategory = title; 
          const keys = Object.keys(primaryData as Record<string, unknown>);
          
          keys.forEach((key) => {
            const heNode = heData?.text ? ((heData.text as Record<string, SefariaTextNode>)[key] ?? null) : null;
            const enNodesRaw = validTranslations.map(t => ({
                slug: t.slug,
                node: t.rawText ? ((t.rawText as Record<string, SefariaTextNode>)[key] ?? null) : null
            })).filter(t => t.node);

            subBooksToProcess.push({
                bookTitle: key,
                heTitle: heData?.text ? key : key, 
                categoryName: targetCategory,
                heNode,
                enNodes: enNodesRaw
            });
          });
        } else {
          subBooksToProcess.push({
              bookTitle: title,
              heTitle: heData?.heTitle || title,
              categoryName: category,
              heNode: heData?.text ?? null,
              enNodes: validTranslations.map(t => ({ slug: t.slug, node: t.rawText }))
          });
        }

        let finalOrderId = order;
        if (!finalOrderId) {
          const { data: maxOrderData } = await supabase
            .from('books').select('order_id').eq('collection', collection).eq('category', category)
            .order('order_id', { ascending: false }).limit(1).maybeSingle();
          finalOrderId = (maxOrderData?.order_id || 0) + 1;
        }

        let overallProcessedCount = 0;

        for (const subBook of subBooksToProcess) {
          log(`Syncing ${subBook.bookTitle}...`);

          await supabase.from('category_configs').upsert({
            collection_id: collection,
            name_en: subBook.categoryName,
            visibility_status: 'extended'
          }, { onConflict: 'collection_id, name_en' });

          const { data: bookRecord, error: bookErr } = await supabase.from('books').upsert({
            name_en: subBook.bookTitle.substring(0, 255),
            name_he: subBook.heTitle.substring(0, 255),
            category: subBook.categoryName,
            collection: collection,
            order_id: finalOrderId++,
            visibility_status: 'extended' 
          }, { onConflict: 'name_en' }).select('id').single();

          if (bookErr || !bookRecord) {
             log(`Metadata Sync Failed for ${subBook.bookTitle}: ${bookErr?.message}`, 'error');
             continue;
          }

          const registry = new SharedChapterRegistry();
          const heMap = subBook.heNode ? extractTextMap(subBook.heNode, false, isTalmud, registry) : new Map<string, { chapter_number: string, order_id: number, verses: Map<number, ProcessedText> }>();
          
          const enMaps = new Map<string, Map<string, { chapter_number: string, order_id: number, verses: Map<number, ProcessedText> }>>();
          for (const enT of subBook.enNodes) {
             enMaps.set(enT.slug, extractTextMap(enT.node, true, isTalmud, registry));
          }

          const allChapterStringsSet = new Set<string>();
          if (heMap) Array.from(heMap.keys()).forEach(k => allChapterStringsSet.add(k));
          enMaps.forEach(t => Array.from(t.keys()).forEach(k => allChapterStringsSet.add(k)));
          
          const allChapterNumbers = Array.from(allChapterStringsSet).sort((a, b) => {
            const orderA = heMap.get(a)?.order_id || Array.from(enMaps.values()).find(m => m.has(a))?.get(a)?.order_id || 0;
            const orderB = heMap.get(b)?.order_id || Array.from(enMaps.values()).find(m => m.has(b))?.get(b)?.order_id || 0;
            return orderA - orderB;
          });

          for (const cNumStr of allChapterNumbers) {
            const heChapData = heMap.get(cNumStr);
            let primaryEnChapData;
            for (const tMap of Array.from(enMaps.values())) {
                primaryEnChapData = tMap.get(cNumStr);
                if (primaryEnChapData) break;
            }
            
            const chapRef = heChapData || primaryEnChapData;
            if (!chapRef) continue;

            let chapId: string;
            const { data: existingChap } = await supabase
              .from('chapters')
              .select('id')
              .eq('book_id', bookRecord.id)
              .eq('chapter_number', chapRef.chapter_number)
              .maybeSingle();

            if (existingChap) {
              chapId = existingChap.id;
              await supabase.from('chapters').update({ 
                order_id: chapRef.order_id,
                display_label: chapRef.chapter_number 
              }).eq('id', chapId);
            } else {
              const { data: newChap, error: insChapErr } = await supabase
                .from('chapters')
                .insert({ 
                  book_id: bookRecord.id, 
                  chapter_number: chapRef.chapter_number, 
                  order_id: chapRef.order_id,
                  display_label: chapRef.chapter_number 
                }).select('id').single();
              if (insChapErr || !newChap) continue;
              chapId = newChap.id;
            }

            const allVerseNumbersSet = new Set<number>();
            if (heChapData) Array.from(heChapData.verses.keys()).forEach(k => allVerseNumbersSet.add(k));
            enMaps.forEach(t => {
              const tChap = t.get(cNumStr);
              if (tChap) Array.from(tChap.verses.keys()).forEach(k => allVerseNumbersSet.add(k));
            });
            const allVerseNumbers = Array.from(allVerseNumbersSet).sort((a, b) => a - b);
            
            const { data: existingVerses } = await supabase.from('verses').select('id, verse_number').eq('chapter_id', chapId);
            const existingVerseMap = new Map(existingVerses?.map(v => [v.verse_number, v.id]) || []);
            
            const CHUNK_SIZE = 100;
            for (let i = 0; i < allVerseNumbers.length; i += CHUNK_SIZE) {
              const chunk = allVerseNumbers.slice(i, i + CHUNK_SIZE);
              const verseBatch = chunk.map(vNum => {
                  const heTextObj = heChapData?.verses.get(vNum) || { text: '', footnotes: [] };
                  
                  let primaryEnTextObj: ProcessedText = { text: '', footnotes: [] };
                  for (const tMap of Array.from(enMaps.values())) {
                      const tChap = tMap.get(cNumStr);
                      if (tChap && tChap.verses.has(vNum)) {
                          primaryEnTextObj = tChap.verses.get(vNum)!;
                          break;
                      }
                  }
                  
                  const existingId = existingVerseMap.get(vNum);
                  return {
                      id: existingId || crypto.randomUUID(),
                      chapter_id: chapId,
                      verse_number: vNum,
                      text_he: heTextObj.text,
                      text_en: primaryEnTextObj.text, 
                      words: generateWordsArray(heTextObj.text, chapRef.chapter_number, vNum)
                  };
              });

              const { data: upsertedVerses, error: vErr } = await supabase.from('verses').upsert(verseBatch).select('id, verse_number');
              if (vErr) continue;

              if (upsertedVerses && enMaps.size > 0) {
                const translationBatch: { verse_id: string; translation_slug: string; content: string; footnotes: { id: string; text: string }[] }[] = [];
                
                upsertedVerses.forEach(uv => {
                  enMaps.forEach((tMap, slug) => {
                    const tChap = tMap.get(cNumStr);
                    if (!tChap) return;
                    const engObj = tChap.verses.get(uv.verse_number);
                    if (engObj && engObj.text) {
                      translationBatch.push({
                        verse_id: uv.id,
                        translation_slug: slug,
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

            overallProcessedCount++;
            const estimatedTotalChapters = subBooksToProcess.length * 5; 
            const progress = Math.min(Math.round((overallProcessedCount / estimatedTotalChapters) * 100), 99);
            log(`Synced ${subBook.bookTitle} Chapter ${chapRef.chapter_number} (${allVerseNumbers.length} verses)`, 'progress', progress);
          }
        }

        log(`Successfully ingested ${title} pipeline`, 'success', 100);

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