import { createClient } from '@supabase/supabase-js';

/**
 * Global Supabase client instance.
 * In a Next.js App Router environment, this client is typically used 
 * for Client Components. Server Components should use the @supabase/ssr helper,
 * but this shared instance serves as our primary API gateway.
 */

// Note: These variables must be defined in .env.local located in the 
// root of your 'tanakh-commentary' folder.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// The apiKey is provided by the runtime environment as per instructions
const apiKey = ""; 

/**
 * TRoubleshooting 'supabaseUrl is required':
 * 1. Ensure your .env.local file is inside the 'tanakh-commentary' folder.
 * 2. Ensure the variables start with NEXT_PUBLIC_.
 * 3. You MUST restart your terminal (Ctrl+C and npm run dev) after creating .env.local.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || apiKey
);

/**
 * Type-safe Database helper.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Tanakh Text Domain
      books: {
        Row: { id: number; name_en: string; name_he: string; category: string };
      };
      chapters: {
        Row: { id: number; book_id: number; chapter_number: number };
      };
      verses: {
        Row: { 
          id: number; 
          chapter_id: number; 
          verse_number: number; 
          text_en: string; 
          text_he: string;
          metadata: Json;
        };
      };
      // Social Graph
      profiles: {
        Row: { id: string; username: string; avatar_url: string | null; bio: string | null };
      };
      comments: {
        Row: { 
          id: string; 
          user_id: string; 
          verse_id: number; 
          parent_id: string | null; 
          content: string; 
          created_at: string;
          is_edited: boolean;
        };
      };
      likes: {
        Row: { id: number; user_id: string; comment_id: string };
      };
    };
  };
}