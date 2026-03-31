// Path: src/shared/lib/ReferenceParser.ts

/**
 * Standardizes common Bible book abbreviations and variations to the canonical names
 * used in your database (e.g., "Gen" -> "Genesis").
 */
const bookMapping: Record<string, string> = {
  "gen": "Genesis", "genesis": "Genesis",
  "ex": "Exodus", "exod": "Exodus", "exodus": "Exodus",
  "lev": "Leviticus", "levi": "Leviticus", "leviticus": "Leviticus",
  "num": "Numbers", "numb": "Numbers", "numbers": "Numbers",
  "deut": "Deuteronomy", "deutero": "Deuteronomy", "deuteronomy": "Deuteronomy",
  "josh": "Joshua", "joshua": "Joshua",
  "judg": "Judges", "judges": "Judges",
  "ruth": "Ruth",
  "1 sam": "1 Samuel", "i samuel": "1 Samuel", "1 samuel": "1 Samuel",
  "2 sam": "2 Samuel", "ii samuel": "2 Samuel", "2 samuel": "2 Samuel",
  "1 kings": "1 Kings", "i kings": "1 Kings",
  "2 kings": "2 Kings", "ii kings": "2 Kings",
  "isa": "Isaiah", "isaiah": "Isaiah",
  "jer": "Jeremiah", "jeremiah": "Jeremiah",
  "ezek": "Ezekiel", "ezekiel": "Ezekiel",
  "hos": "Hosea", "hosea": "Hosea",
  "joel": "Joel",
  "amos": "Amos",
  "obad": "Obadiah",
  "jonah": "Jonah",
  "mic": "Micah",
  "nah": "Nahum",
  "hab": "Habakkuk",
  "zeph": "Zephaniah",
  "hag": "Haggai",
  "zech": "Zechariah",
  "mal": "Malachi",
  "ps": "Psalms", "psa": "Psalms", "psalm": "Psalms", "psalms": "Psalms",
  "prov": "Proverbs", "proverbs": "Proverbs",
  "job": "Job",
  "cant": "Song of Songs", "song": "Song of Songs", "sos": "Song of Songs",
  "lam": "Lamentations", "lamentations": "Lamentations",
  "eccl": "Ecclesiastes", "ecclesiastes": "Ecclesiastes",
  "est": "Esther", "esther": "Esther",
  "dan": "Daniel", "daniel": "Daniel",
  "ezra": "Ezra",
  "neh": "Nehemiah", "nehemiah": "Nehemiah",
  "1 chr": "1 Chronicles", "i chronicles": "1 Chronicles",
  "2 chr": "2 Chronicles", "ii chronicles": "2 Chronicles",
};

/**
 * Interface for a detected Bible reference
 */
export interface ParsedReference {
  originalText: string; // e.g., "gen 1:1-19"
  book: string;         // e.g., "Genesis"
  chapter: number;      // e.g., 1
  verse: number;        // e.g., 1 (always the start verse)
}

/**
 * Matches patterns like:
 * - Genesis 1:1
 * - gen 1:1-19
 * - 2 Sam 2:1
 * - II Samuel 2:1-3
 * - Psalms 23 (Chapter only)
 */
const REF_REGEX = /(?:(?:I|II|1|2)\s+)?(?:[A-Za-z]+)\s+\d+(?::\d+(?:-\d+(?::\d+)?)?)?/g;

/**
 * Scans a string for Bible references and returns an array of matches with metadata.
 */
export const parseReferences = (text: string): ParsedReference[] => {
  const matches: ParsedReference[] = [];
  const found = text.matchAll(REF_REGEX);

  for (const match of found) {
    const original = match[0];
    const parts = original.toLowerCase().trim().split(/\s+/);
    
    // Identify the book part (could be "sam" or "2 sam")
    let bookKey = "";
    let startIndex = 0;

    if (["1", "2", "i", "ii"].includes(parts[0])) {
      bookKey = `${parts[0]} ${parts[1]}`;
      startIndex = 2;
    } else {
      bookKey = parts[0];
      startIndex = 1;
    }

    const canonicalBook = bookMapping[bookKey] || bookMapping[bookKey.replace(/\.$/, "")];
    
    if (canonicalBook) {
      const coordPart = parts.slice(startIndex).join(""); // e.g., "1:1-19"
      const mainCoords = coordPart.split("-")[0]; // "1:1"
      const [chapterStr, verseStr] = mainCoords.split(":");

      matches.push({
        originalText: original,
        book: canonicalBook,
        chapter: parseInt(chapterStr, 10),
        verse: verseStr ? parseInt(verseStr, 10) : 1 // Default to 1 if chapter-only
      });
    }
  }

  return matches;
};

/**
 * Splits a string into parts of text and parsed reference objects
 * Useful for rendering: [ "Read ", {ParsedReference}, " for more info." ]
 */
export const splitTextByReferences = (text: string) => {
  const refs = parseReferences(text);
  const result: (string | ParsedReference)[] = [];
  let lastIndex = 0;

  refs.forEach((ref) => {
    const index = text.indexOf(ref.originalText, lastIndex);
    if (index > lastIndex) {
      result.push(text.substring(lastIndex, index));
    }
    result.push(ref);
    lastIndex = index + ref.originalText.length;
  });

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
};