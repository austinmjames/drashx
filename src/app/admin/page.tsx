// Filepath: app/admin/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, ChevronDown, ChevronRight, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

// FSD Imports
import { supabase } from '@/shared/api/supabase';
import { TimegrainSelector } from '@/features/admin/ui/TimegrainSelector';
import { StatsOverviewWidget } from '@/widgets/admin/ui/StatsOverviewWidget';
import { UserListWidget } from '@/widgets/admin/ui/UserListWidget';
import { TopCommentsWidget } from '@/widgets/admin/ui/TopCommentsWidget';
import { BroadcastWidget } from '@/widgets/admin/ui/BroadcastWidget';

// --- Types ---
interface UserStat {
  period: string;
  new_users: number;
  total_users: number;
}

interface ActivityStat {
  period: string;
  total_comments: number;
  total_replies: number;
  total_likes: number;
}

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

export default function AdminDashboardController() {
  const router = useRouter();
  const [timegrain, setTimegrain] = useState('month');
  const [topCommentsTimegrain, setTopCommentsTimegrain] = useState('all'); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBroadcasts, setShowBroadcasts] = useState(false); 
  
  const [userStats, setUserStats] = useState<UserStat[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStat[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [topComments, setTopComments] = useState<TopComment[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        router.push('/');
        return;
      }

      const uStatsPromise = supabase.rpc('admin_get_user_stats', { timegrain });
      const aStatsPromise = supabase.rpc('admin_get_activity_stats', { timegrain });
      const uListPromise = supabase
        .from('admin_user_list_view')
        .select('*')
        .order('total_interactions', { ascending: false })
        .limit(100);

      let topQuery = supabase.from('admin_top_replied_comments_view').select('*');
      if (topCommentsTimegrain !== 'all') {
        const d = new Date();
        if (topCommentsTimegrain === 'week') d.setDate(d.getDate() - 7);
        if (topCommentsTimegrain === 'month') d.setDate(d.getDate() - 30);
        if (topCommentsTimegrain === 'year') d.setDate(d.getDate() - 365);
        topQuery = topQuery.gte('created_at', d.toISOString());
      }
      
      // FIX: Changed limit from 100 to 5 for Top Comments
      const tCommentsPromise = topQuery.order('reply_count', { ascending: false }).limit(5); 

      const [uStats, aStats, uList, tComments] = await Promise.all([
        uStatsPromise, aStatsPromise, uListPromise, tCommentsPromise
      ]);

      if (uStats.error) throw uStats.error;
      if (aStats.error) throw aStats.error;
      if (uList.error) throw uList.error;
      if (tComments.error) throw tComments.error;

      setUserStats((uStats.data as UserStat[]) || []);
      setActivityStats((aStats.data as ActivityStat[]) || []);
      setUsers((uList.data as AdminUser[]) || []);
      setTopComments((tComments.data as TopComment[]) || []);

    } catch (err: unknown) {
      console.error("Failed to fetch admin data", err);
      let errMsg = "An unexpected error occurred.";
      if (err instanceof Error) { errMsg = err.message; } 
      else if (typeof err === 'object' && err !== null) {
        const dbErr = err as Record<string, unknown>;
        errMsg = (dbErr.message as string) || (dbErr.details as string) || JSON.stringify(err);
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [timegrain, topCommentsTimegrain, router]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_comment: !currentStatus } : u));
    const { error } = await supabase.from('profiles').update({ can_comment: !currentStatus }).eq('id', userId);
    if (error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, can_comment: currentStatus } : u));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-blue-600" />
              Platform Admin
            </h1>
            <p className="text-gray-500 mt-1">Manage users, content, and global broadcasts.</p>
          </div>
          <TimegrainSelector timegrain={timegrain} setTimegrain={setTimegrain} />
        </header>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 text-center shadow-sm">
            <h3 className="font-bold text-lg mb-2">Error Loading Dashboard</h3>
            <p className="text-sm mb-4 font-mono bg-red-100 p-2 rounded inline-block">{error}</p>
            <div className="mt-4">
              <button onClick={fetchDashboardData} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-medium transition-colors">Try Again</button>
            </div>
          </div>
        ) : (
          <>
            <StatsOverviewWidget userStats={userStats} activityStats={activityStats} />
            
            <div className="mb-8">
              <button 
                type="button"
                onClick={() => setShowBroadcasts(!showBroadcasts)}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-bold transition-all group"
              >
                <div className="bg-white p-1 rounded border border-gray-200 shadow-sm group-hover:border-blue-200 transition-all">
                  {showBroadcasts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
                <Megaphone className={`w-4 h-4 ${showBroadcasts ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'}`} />
                <span>Broadcast Center</span>
              </button>
              
              {showBroadcasts && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <BroadcastWidget />
                </div>
              )}
            </div>
            
            {/* STACKED LAYOUT: Platform Moderation then Top Comments */}
            <div className="space-y-8">
              <UserListWidget users={users} toggleUserStatus={handleToggleUserStatus} />
              
              <TopCommentsWidget 
                topComments={topComments} 
                timegrain={topCommentsTimegrain} 
                setTimegrain={setTopCommentsTimegrain} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}