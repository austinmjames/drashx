// Filepath: src/widgets/admin/ui/UserListWidget.tsx
import React, { useState } from 'react';
import { 
  Ban, 
  CheckCircle2, 
  Search, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import Image from 'next/image';

// --- Types ---

export interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  can_comment: boolean;
  is_admin: boolean;
  total_comments: number;
  total_likes: number;
  total_interactions: number;
}

interface UserListWidgetProps {
  users: AdminUser[];
  toggleUserStatus: (userId: string, currentStatus: boolean) => void;
}

// --- Component ---

export const UserListWidget = ({ users, toggleUserStatus }: UserListWidgetProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 5;

  // --- Helpers ---

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) || 
      (u.display_name && u.display_name.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.max(Math.ceil(filteredUsers.length / itemsPerPage), 1);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const getAvatarData = (avatarUrl: string | null, username: string, displayName: string | null) => {
    const fallbackChar = (displayName || username).charAt(0).toUpperCase();
    if (!avatarUrl) return { isImage: false, bgColor: 'bg-linear-to-tr from-blue-500 to-teal-400', content: fallbackChar };
    const isImagePath = avatarUrl.startsWith('http') || avatarUrl.startsWith('/') || avatarUrl.startsWith('data:');
    if (isImagePath) return { isImage: true, bgColor: '', content: avatarUrl };

    if (avatarUrl.includes(':')) {
      const [color] = avatarUrl.split(':');
      const colorMap: Record<string, string> = {
        red: 'bg-red-500', orange: 'bg-orange-500', amber: 'bg-amber-500', yellow: 'bg-yellow-400',
        green: 'bg-green-500', emerald: 'bg-emerald-500', teal: 'bg-teal-500', cyan: 'bg-cyan-500',
        blue: 'bg-blue-500', indigo: 'bg-indigo-500', violet: 'bg-violet-500', purple: 'bg-purple-500',
        fuchsia: 'bg-fuchsia-500', pink: 'bg-pink-500', rose: 'bg-rose-500',
      };
      return { isImage: false, bgColor: colorMap[color] || 'bg-gray-500', content: fallbackChar };
    }
    return { isImage: false, bgColor: 'bg-linear-to-tr from-blue-500 to-teal-400', content: fallbackChar };
  };

  return (
    <Card className="mb-8">
      {/* Header & Search */}
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">Platform Moderation</h3>
          <span className="text-xs text-gray-500 block">Managing {filteredUsers.length} of {users.length} total users</span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search name or username..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 transition-all"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="overflow-x-auto min-h-75">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium hidden md:table-cell">Joined</th>
              <th className="p-4 font-medium text-center">Interactions</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedUsers.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">No users found matching your search.</td></tr>
            ) : (
              paginatedUsers.map((user) => {
                const avatar = getAvatarData(user.avatar_url, user.username, user.display_name);
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 shrink-0 rounded-full ${avatar.bgColor} flex items-center justify-center text-white font-bold text-sm shadow-sm relative overflow-hidden`}>
                          {avatar.isImage ? (
                            <Image src={avatar.content} alt={user.username} fill sizes="40px" className="object-cover" />
                          ) : avatar.content}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 leading-tight">{user.display_name || user.username}</div>
                          <div className="text-xs text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600 hidden md:table-cell">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col text-sm">
                        <span className="font-semibold text-blue-600">{user.total_interactions}</span>
                        <span className="text-[10px] uppercase text-gray-400 font-bold tracking-tighter">Activity</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-2 rounded-full hover:bg-gray-200 text-gray-400 group-hover:text-gray-600 transition-colors"
                          title="Open actions menu"
                          aria-label="Open actions menu"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === user.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-xl z-20 overflow-hidden ring-1 ring-black/5">
                              <button
                                onClick={() => { toggleUserStatus(user.id, user.can_comment); setOpenMenuId(null); }}
                                className={`w-full text-left flex items-center gap-2 px-4 py-3 text-sm transition-colors ${user.can_comment ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                              >
                                {user.can_comment ? <><Ban className="w-4 h-4" /> Disable Commenting</> : <><CheckCircle2 className="w-4 h-4" /> Enable Commenting</>}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
        <span className="text-xs font-medium text-gray-500">Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};