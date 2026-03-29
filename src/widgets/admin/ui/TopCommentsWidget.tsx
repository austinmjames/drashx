// Filepath: src/widgets/admin/ui/TopCommentsWidget.tsx
import React, { useState } from 'react';
import { MessageSquare, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/shared/ui/Card';

// Removed the FSD-violating import from the app layer. 
// We define and export the type directly here.
export interface TopComment {
  comment_id: string;
  content: string;
  created_at: string;
  author_username: string;
  book_name: string;
  chapter_number: number;
  verse_number: number;
  reply_count: number;
}

interface TopCommentsWidgetProps {
  topComments: TopComment[];
  timegrain: string;
  setTimegrain: (tg: string) => void;
}

export const TopCommentsWidget = ({ topComments, timegrain, setTimegrain }: TopCommentsWidgetProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.max(Math.ceil(topComments.length / itemsPerPage), 1);
  const paginatedComments = topComments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filter changes
  React.useEffect(() => { setCurrentPage(1); }, [timegrain]);

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h3 className="font-semibold text-gray-800">Most Engaging Content</h3>
        
        {/* Time Filter Pills */}
        <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
          {[
            { id: 'week', label: '7 Days' },
            { id: 'month', label: '30 Days' },
            { id: 'year', label: '1 Year' },
            { id: 'all', label: 'All Time' }
          ].map((tg) => (
            <button
              key={tg.id}
              onClick={() => setTimegrain(tg.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timegrain === tg.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Updated min-h-[400px] to min-h-100 */}
      <div className="divide-y divide-gray-100 min-h-100">
        {paginatedComments.length === 0 ? (
           <div className="p-8 text-center text-gray-400">No comments found for this period.</div>
        ) : (
          paginatedComments.map((comment) => (
            <div key={comment.comment_id} className="p-5 hover:bg-gray-50 transition-colors flex gap-4 items-start">
              <div className="shrink-0 bg-blue-50 text-blue-600 p-2 rounded-lg text-center min-w-12">
                <MessageSquare className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-bold">{comment.reply_count}</div>
              </div>
              <div className="grow">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-medium text-sm text-gray-900">@{comment.author_username}</span>
                  <span className="text-gray-300">•</span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    <BookOpen className="w-3 h-3" />
                    {comment.book_name} {comment.chapter_number}:{comment.verse_number}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
                {/* Render Rich Text securely.
                    Removed Tailwind's 'prose' class so custom <font> and <b> tags aren't overridden/normalized! */}
                <div 
                  className="text-sm text-gray-700 wrap-break-word"
                  dangerouslySetInnerHTML={{ __html: comment.content }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <span className="text-sm text-gray-500">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex gap-2">
          {/* Added aria-label for screen reader accessibility */}
          <button 
            aria-label="Previous page"
            title="Previous page"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Added aria-label for screen reader accessibility */}
          <button 
            aria-label="Next page"
            title="Next page"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};