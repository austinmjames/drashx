/**
 * User Profile Type Definition
 * Path: src/entities/user/model/types.ts
 */
export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
}