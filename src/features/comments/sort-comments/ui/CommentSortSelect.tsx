// Path: src/features/comments/sort-comments/ui/CommentSortSelect.tsx
import React from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';

export type CommentSortOption = 'newest' | 'oldest' | 'most_liked' | 'recent_reply' | 'most_activity';

interface CommentSortSelectProps {
  value: CommentSortOption;
  onChange: (value: CommentSortOption) => void;
}

export const CommentSortSelect = ({ value, onChange }: CommentSortSelectProps) => {
  return (
    <div className="flex items-center gap-2">
      <ArrowDownWideNarrow size={14} className="text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CommentSortOption)}
        className="text-[11px] font-bold uppercase tracking-wider bg-transparent border-none text-slate-500 hover:text-indigo-600 focus:ring-0 cursor-pointer outline-none appearance-none pr-4"
        title="Sort Comments"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="recent_reply">Recent Replies</option>
        <option value="most_liked">Most Liked</option>
        <option value="most_activity">Most Activity</option>
      </select>
    </div>
  );
};