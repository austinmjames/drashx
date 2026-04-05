// Path: src/features/lexicon/lib/morphology.ts

/**
 * Hebrew Morphological Transliterator
 * Maps contextual prefixes and suffixes to approximate English sounds.
 */
export const getAffixSound = (hebrewStr: string, isPrefix: boolean): string => {
  const clean = hebrewStr.replace(/[\u0591-\u05AF\u05BD-\u05C0\u05C3-\u05C7]/g, ''); // Strip cantillation
  
  const prefixMap: Record<string, string> = {
    "בְּ": "b'", "בָּ": "ba-", "בַּ": "ba-", "בִּ": "bi-", "בֵּ": "be-",
    "וְ": "v'", "וָ": "va-", "וַ": "va-", "וּ": "u-",
    "הַ": "ha-", "הָ": "ha-", "הֶ": "he-", 
    "לְ": "l'", "לָ": "la-", "לַ": "la-", "לִ": "li-", "לֵ": "le-",
    "כְּ": "k'", "כָּ": "ka-", "כַּ": "ka-", "כִּ": "ki-",
    "מִ": "mi-", "מֵ": "me-", "מַ": "ma-",
    "שֶׁ": "she-", "שַׁ": "sha-"
  };

  const suffixMap: Record<string, string> = {
    "וֹ": "-o", "ִי": "-i", "ךָ": "-cha", "ֵךְ": "-ech", "וֹת": "-ot", "ִים": "-im", 
    "הָ": "-ah", "נּוּ": "-nu", "ָם": "-am", "ֶם": "-em", "כֶם": "-chem", "הֶם": "-hem",
    "תִּי": "-ti", "תָּ": "-ta", "תְּ": "-t", "וּ": "-u", "הוּ": "-hu", "מוֹ": "-mo"
  };

  const map = isPrefix ? prefixMap : suffixMap;
  const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    if (clean.includes(key)) return map[key];
  }

  // Broad Fallbacks
  if (isPrefix) {
    if (clean.includes('ב')) return "b'";
    if (clean.includes('ו')) return "v'";
    if (clean.includes('ה')) return "ha-";
    if (clean.includes('ל')) return "l'";
    if (clean.includes('מ')) return "m'";
    if (clean.includes('ש')) return "sh'";
    if (clean.includes('כ')) return "k'";
    return "";
  } else {
    if (clean.includes('ם') || clean.includes('מ')) return "-m";
    if (clean.includes('ן') || clean.includes('נ')) return "-n";
    if (clean.includes('ת')) return "-t";
    if (clean.includes('י')) return "-i";
    if (clean.includes('ו')) return "-o";
    if (clean.includes('ה')) return "-ah";
    if (clean.includes('ך') || clean.includes('כ')) return "-ch";
    return "";
  }
};

/**
 * Hebrew Affix Meaning Provider
 * Translates prefixes and suffixes into their semantic meanings.
 */
export const getAffixMeaning = (hebrewStr: string, isPrefix: boolean): string => {
  const clean = hebrewStr.replace(/[\u0591-\u05AF\u05BD-\u05C0\u05C3-\u05C7]/g, '');

  const prefixMeanings: Record<string, string> = {
    "ב": "In, with, by, at (Preposition)",
    "ו": "And, but, also (Conjunction)",
    "ה": "The (Definite Article)",
    "ל": "To, for, regarding (Preposition)",
    "מ": "From, out of, than (Preposition)",
    "ש": "Who, which, that (Relative Pronoun)",
    "כ": "As, like, according to (Preposition)"
  };

  const suffixMeanings: Record<string, string> = {
    "וֹ": "his / him (Pronominal)",
    "ִי": "my / me (Pronominal)",
    "ךָ": "your (masc. sing.)",
    "ֵךְ": "your (fem. sing.)",
    "וֹת": "plural (feminine)",
    "ִים": "plural (masculine)",
    "ָה": "her / feminine marker",
    "נוּ": "our / we",
    "ָם": "their (masc.)",
    "ֶם": "your (masc. plural)",
    "כֶם": "your (masc. plural)",
    "הֶם": "their (masc.)",
    "תִּי": "I (verbal suffix)",
    "תָּ": "you (masc. sing. verbal)"
  };

  const map = isPrefix ? prefixMeanings : suffixMeanings;
  
  // Try to match the exact character
  for (const char of clean) {
    if (map[char]) return map[char];
  }

  return isPrefix ? "Prefix modifier" : "Grammatical suffix";
};

export interface AffixAnalysis {
  text: string;
  meaning: string;
  type: 'prefix' | 'suffix';
}

/**
 * Analyzes a Hebrew word with slashes to extract all prefixes and suffixes.
 */
export const analyzeHebrewAffixes = (slashedText: string): AffixAnalysis[] => {
  if (!slashedText.includes('/')) return [];

  const parts = slashedText.split('/');
  let rootIndex = 0;
  let maxLength = 0;
  
  // Identify the root by finding the part with the most non-vowel characters
  parts.forEach((p, i) => {
    const len = p.replace(/[\u0591-\u05C7]/g, '').length;
    if (len > maxLength) {
      maxLength = len;
      rootIndex = i;
    }
  });

  const analysis: AffixAnalysis[] = [];

  // Map Prefixes
  parts.slice(0, rootIndex).forEach(p => {
    analysis.push({
      text: p,
      meaning: getAffixMeaning(p, true),
      type: 'prefix'
    });
  });

  // Map Suffixes
  parts.slice(rootIndex + 1).forEach(p => {
    analysis.push({
      text: p,
      meaning: getAffixMeaning(p, false),
      type: 'suffix'
    });
  });

  return analysis;
};

/**
 * Decodes complex morphology codes (OSMHB for Hebrew, RMAC for Greek) 
 * into human-readable grammar tags.
 */
export const decodeMorphology = (morph: string, isGreek: boolean): string[] => {
  const details: string[] = [];

  if (isGreek) {
    const parts = morph.split('-');
    const posCode = parts[0];
    const parseCode = parts.length > 1 ? parts.slice(1).join('-') : '';

    const posMap: Record<string, string> = { 'N': 'Noun', 'V': 'Verb', 'A': 'Adjective', 'T': 'Article', 'P': 'Pronoun', 'PREP': 'Preposition', 'ADV': 'Adverb', 'CONJ': 'Conjunction', 'PRT': 'Particle' };
    if (posMap[posCode]) details.push(posMap[posCode]);

    if (parseCode) {
      if (posCode === 'V') {
        const tvm = parseCode.split('-')[0] || '';
        const pn = parseCode.split('-')[1] || '';
        if (tvm) {
          const tMap: Record<string, string> = { 'P': 'Present', 'I': 'Imperfect', 'F': 'Future', 'A': 'Aorist', 'X': 'Perfect', 'Y': 'Pluperfect' };
          const vMap: Record<string, string> = { 'A': 'Active', 'M': 'Middle', 'P': 'Passive', 'D': 'Middle/Passive Deponent' };
          const mMap: Record<string, string> = { 'I': 'Indicative', 'M': 'Imperative', 'S': 'Subjunctive', 'O': 'Optative', 'N': 'Infinitive', 'P': 'Participle' };
          if (tMap[tvm[0]]) details.push(tMap[tvm[0]]);
          if (vMap[tvm[1]]) details.push(vMap[tvm[1]]);
          if (mMap[tvm[2]]) details.push(mMap[tvm[2]]);
        }
        if (pn && pn.length === 2) {
          const p = pn[0];
          const n = pn[1];
          if (['1','2','3'].includes(p)) details.push(`${p}${p==='1'?'st':p==='2'?'nd':'rd'} Person`);
          if (n === 'S') details.push('Singular');
          if (n === 'P') details.push('Plural');
        }
      } else if (parseCode.length >= 3) {
        const cMap: Record<string, string> = { 'N': 'Nominative', 'G': 'Genitive', 'D': 'Dative', 'A': 'Accusative', 'V': 'Vocative' };
        const nMap: Record<string, string> = { 'S': 'Singular', 'P': 'Plural' };
        const gMap: Record<string, string> = { 'M': 'Masculine', 'F': 'Feminine', 'N': 'Neuter' };
        if (cMap[parseCode[0]]) details.push(cMap[parseCode[0]]);
        if (gMap[parseCode[2]]) details.push(gMap[parseCode[2]]);
        if (nMap[parseCode[1]]) details.push(nMap[parseCode[1]]);
      }
    }
  } else {
    const cleanMorph = morph.replace(/^H(?=[A-Z])/, '');
    const segments = cleanMorph.split(/[/:]/);
    segments.forEach(segment => {
      if (!segment) return;
      const posCode = segment[0];
      if (segment.startsWith('Td') || segment === 'd') details.push('Definite Article');
      else if (posCode === 'R' && segment.length === 1) details.push('Preposition');
      else if (posCode === 'C' && segment.length === 1) details.push('Conjunction');
      else if (posCode === 'T') details.push(segment === 'To' ? 'Direct Object Marker' : 'Particle');

      if (posCode === 'V' && segment.length >= 6) {
        details.push('Verb');
        const stemMap: Record<string, string> = { 'q': 'Qal', 'N': 'Niphal', 'p': 'Piel', 'P': 'Pual', 'h': 'Hiphil', 'H': 'Hophal', 't': 'Hithpael', 'o': 'Polel', 'O': 'Poal' };
        const aspectMap: Record<string, string> = { 'p': 'Perfect', 'q': 'Sequential Perfect', 'i': 'Imperfect', 'w': 'Sequential Imperfect', 'v': 'Imperative', 'c': 'Construct Infinitive', 'a': 'Absolute Infinitive', 'r': 'Active Participle', 's': 'Passive Participle' };
        if (stemMap[segment[1]]) details.push(stemMap[segment[1]]);
        if (aspectMap[segment[2]]) details.push(aspectMap[segment[2]]);
        if (['1','2','3'].includes(segment[3])) details.push(`${segment[3]}${segment[3]==='1'?'st':segment[3]==='2'?'nd':'rd'} Person`);
        if (segment[4] === 'm') details.push('Masculine');
        if (segment[4] === 'f') details.push('Feminine');
        if (segment[5] === 's') details.push('Singular');
        if (segment[5] === 'p') details.push('Plural');
      } else if (['N', 'A', 'P', 'S'].includes(posCode) && segment.length >= 3) {
        if (posCode === 'N' && segment[1] === 'p') details.push('Proper Noun');
        else if (posCode === 'N') details.push('Noun');
        else if (posCode === 'A') details.push('Adjective');
        else if (posCode === 'P') details.push('Pronoun');
        else if (posCode === 'S') details.push('Suffix');
        const gender = segment[posCode === 'P' || posCode === 'S' ? 3 : 2];
        const number = segment[posCode === 'P' || posCode === 'S' ? 4 : 3];
        if (gender === 'm') details.push('Masculine');
        if (gender === 'f') details.push('Feminine');
        if (number === 's') details.push('Singular');
        if (number === 'p') details.push('Plural');
      }
    });
  }
  return Array.from(new Set(details));
};