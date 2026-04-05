// Path: src/shared/lib/ReferenceParser.ts

/**
 * Standardizes common Bible book abbreviations and variations to the canonical names
 * used in your database (e.g., "Gen" -> "Genesis", "1 Sam" -> "I Samuel").
 */
const bookMapping: Record<string, string> = {
  // Tanakh / Old Testament
  "gen": "Genesis", "genesis": "Genesis",
  "ex": "Exodus", "exod": "Exodus", "exodus": "Exodus",
  "lev": "Leviticus", "levi": "Leviticus", "leviticus": "Leviticus",
  "num": "Numbers", "numb": "Numbers", "numbers": "Numbers",
  "deut": "Deuteronomy", "deutero": "Deuteronomy", "deuteronomy": "Deuteronomy",
  "josh": "Joshua", "joshua": "Joshua",
  "judg": "Judges", "judges": "Judges",
  "ruth": "Ruth",
  "1 sam": "I Samuel", "i samuel": "I Samuel", "1 samuel": "I Samuel",
  "2 sam": "II Samuel", "ii samuel": "II Samuel", "2 samuel": "II Samuel",
  "1 kings": "I Kings", "i kings": "I Kings", "1 kgs": "I Kings",
  "2 kings": "II Kings", "ii kings": "II Kings", "2 kgs": "II Kings",
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
  "1 chr": "I Chronicles", "i chronicles": "I Chronicles", "1 chron": "I Chronicles",
  "2 chr": "II Chronicles", "ii chronicles": "II Chronicles", "2 chron": "II Chronicles",

  // Extended Library / New Testament
  "mat": "Matthew", "matt": "Matthew", "matthew": "Matthew",
  "mark": "Mark", "mrk": "Mark",
  "luke": "Luke", "luk": "Luke",
  "john": "John", "jhn": "John",
  "acts": "Acts", "act": "Acts",
  "rom": "Romans", "romans": "Romans",
  "1 cor": "I Corinthians", "i corinthians": "I Corinthians", "1 corinthians": "I Corinthians", "1co": "I Corinthians",
  "2 cor": "II Corinthians", "ii corinthians": "II Corinthians", "2 corinthians": "II Corinthians", "2co": "II Corinthians",
  "gal": "Galatians", "galatians": "Galatians",
  "eph": "Ephesians", "ephesians": "Ephesians",
  "phil": "Philippians", "php": "Philippians", "philippians": "Philippians",
  "col": "Colossians", "colossians": "Colossians",
  "1 thess": "I Thessalonians", "i thessalonians": "I Thessalonians", "1 thessalonians": "I Thessalonians", "1th": "I Thessalonians",
  "2 thess": "II Thessalonians", "ii thessalonians": "II Thessalonians", "2 thessalonians": "II Thessalonians", "2th": "II Thessalonians",
  "1 tim": "I Timothy", "i timothy": "I Timothy", "1 timothy": "I Timothy", "1ti": "I Timothy",
  "2 tim": "II Timothy", "ii timothy": "II Timothy", "2 timothy": "II Timothy", "2ti": "II Timothy",
  "titus": "Titus", "tit": "Titus",
  "philemon": "Philemon", "phm": "Philemon",
  "hebrews": "Hebrews", "heb": "Hebrews",
  "james": "James", "jas": "James",
  "1 pet": "I Peter", "i peter": "I Peter", "1 peter": "I Peter", "1pe": "I Peter",
  "2 pet": "II Peter", "ii peter": "II Peter", "2 peter": "II Peter", "2pe": "II Peter",
  "1 john": "I John", "i john": "I John", "1 jhn": "I John", "1jo": "I John",
  "2 john": "II John", "ii john": "II John", "2 jhn": "II John", "2jo": "II John",
  "3 john": "III John", "iii john": "III John", "3 jhn": "III John", "3jo": "III John",
  "jude": "Jude", "jud": "Jude",
  "rev": "Revelation", "revelation": "Revelation"
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
 * - III John 1:1
 * - Psalms 23 (Chapter only)
 */
const REF_REGEX = /(?:(?:I|II|III|1|2|3)\s+)?(?:[A-Za-z]+)\s+\d+(?::\d+(?:-\d+(?::\d+)?)?)?/gi;

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

    if (["1", "2", "3", "i", "ii", "iii"].includes(parts[0])) {
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