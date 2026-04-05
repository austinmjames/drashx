// Path: src/features/lexicon/lib/lexicon-utils.ts

/**
 * Normalizes Strong's IDs to the standard format used in the database.
 * Handles both Hebrew (H) and Greek (G) prefixes.
 */
export const getNormalizedStrongsId = (id: string | null): string => {
  if (!id) return '';
  const upper = id.toUpperCase().trim();
  
  // If it already has a valid prefix, return as is
  if (upper.startsWith('H') || upper.startsWith('G')) {
    return upper;
  }
  
  // Default to Hebrew (H) if no prefix is present (backward compatibility)
  return `H${upper}`;
};

/**
 * Aggressively cleans and formats raw BDB XML/HTML strings for a premium scholarly look.
 */
export const formatLexiconHtml = (
  rawHtml: string | null, 
  etymLemmas: Record<string, string>
): string | null => {
  if (!rawHtml) return null;

  let html = rawHtml;

  // 1. Structural Cleanup (Remove usage, labels, and subheaders)
  html = html.replace(/<div[^>]*italic[^>]*>[\s\S]*?<\/div>/i, ''); 
  html = html.replace(/<strong[^>]*>Lexicon Entry<\/strong>/gi, '');
  html = html.replace(/<h4[^>]*>Brown-Driver-Briggs Full Entry<\/h4>/gi, '');

  // 2. Artifact Scrubbing (Remove raw XML noise like brackets and ref tags)
  html = html.replace(/\[\]/g, '').replace(/—/g, '').replace(/\bref\b/gi, '');
  html = html.replace(/\s*\.\s*\./g, '.');

  // 3. Part of Speech & Stem Formatting (vb, Hiph, etc.)
  const grammarPattern = /\s(n\.m\.pl|n\.f\.|v\.|n\.m\.|adj\.|adj\.f\.|adj\.m\.|adv\.|n\.pr\.m\.|n\.pr\.f\.|n\.f\.pl|n\.m\.sg|vb|Hiph|Niph|Piel|Pual|Hith|Hof)/gi;
  html = html.replace(grammarPattern, ' <span class="grammar-code">($1)</span>');

  // 4. BDB Header Identifiers
  html = html.replace(/(\d{4,5})\s*\./gi, '<span class="bdb-id">BDB $1 .</span>');

  // 5. TRUNCATION: Kill everything after the Lemma + Grammar Header in the BDB block
  const bdbOpenTag = '<div class="bdb-full-scholarly">';
  const bdbIndex = html.indexOf(bdbOpenTag);
  if (bdbIndex !== -1) {
    const beforeBdb = html.substring(0, bdbIndex + bdbOpenTag.length);
    const afterBdb = html.substring(bdbIndex + bdbOpenTag.length);
    
    // Terminate at the first grammar code encountered in the BDB segment
    const headerEndMatch = afterBdb.match(/<span class="grammar-code">.*?<\/span>/i);
    if (headerEndMatch) {
      const headerEndIndex = afterBdb.indexOf(headerEndMatch[0]) + headerEndMatch[0].length;
      html = beforeBdb + '\n' + afterBdb.substring(0, headerEndIndex) + '</div>';
    }
  }

  // 6. Cleanup broken fragments/orphaned sentences
  html = html.replace(/\.?\s*in\s+number\.?\s+pl[\s\S]*?angels/gi, '');
  html = html.replace(/pl\.\s+intensiveor\s+works\s+of\s+God[\s\S]*?him/gi, '');
  html = html.replace(/[\u0590-\u05FF]+\s*=\s*[\u0590-\u05FF]+/g, '');
  html = html.replace(/\bbase\b\s*$/i, '');

  // 7. Resolve Etymology IDs (e.g., ;433 -> ; H433, אֱלוֹהַּ)
  html = html.replace(
    /<strong>Etymology:<\/strong>\s*(.*?)\s*;\s*<span[^>]*>(\d+)<\/span>/gi,
    (match, relation, id) => {
      const lemma = etymLemmas[id] ? `, <span class="font-serif text-indigo-500 text-xl mx-2" dir="rtl">${etymLemmas[id]}</span>` : '';
      const capRelation = relation.charAt(0).toUpperCase() + relation.slice(1).trim();
      return `<div class="etym-block"><strong>Etymology:</strong> ${capRelation} <span class="strongs-ref-inline font-mono">H${id}</span>${lemma}</div>`;
    }
  );

  return html.replace(/\s+/g, ' ').trim();
};