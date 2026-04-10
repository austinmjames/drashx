// Path: src/features/lexicon/api/sefaria.ts

export interface SefariaDefinition {
  headword: string;
  content: string;
  source: string;
  grammar?: {
    pos?: string;
    gender?: string;
    number?: string;
  };
}

export interface SefariaWordResponse {
  word?: string;
  error?: string;
  definitions?: {
    lookups: SefariaDefinition[];
  }[];
}

/**
 * Fetches scholarly definitions from Sefaria's Word API.
 * This provides access to BDB, Klein, and Jastrow dictionaries.
 */
export const fetchSefariaDefinitions = async (lemma: string): Promise<SefariaDefinition[]> => {
  try {
    // Sefaria expects clean Hebrew lemmas
    const response = await fetch(`https://www.sefaria.org/api/words/${encodeURIComponent(lemma)}`);
    
    if (!response.ok) return [];

    const data: SefariaWordResponse = await response.json();
    
    // Safely flatten the nested lookup structure. 
    // Uses optional chaining to prevent crashes if 'definitions' is undefined or an error is returned.
    const allDefinitions = data?.definitions?.flatMap(def => def.lookups) || [];
    
    return allDefinitions;
  } catch (error) {
    console.error("Sefaria API Error:", error);
    return [];
  }
};