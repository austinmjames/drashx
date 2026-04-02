// Path: src/features/profile/edit-profile/ui/StatsTab.tsx
import React, { useState, useEffect } from 'react';
import { 
  Loader2, AlertCircle, Crown, Award, GraduationCap, 
  Shield, BookOpen, BarChart3, MessageSquare, Reply, Heart 
} from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

interface StatsTabProps {
  userId: string;
}

export const StatsTab = ({ userId }: StatsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scholarlyScore, setScholarlyScore] = useState(0);
  const [stats, setStats] = useState({ insights: 0, replies: 0, likesReceived: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('scholarly_score')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;
        if (profile) setScholarlyScore(profile.scholarly_score || 0);

        const { data: userComments } = await supabase
          .from('comments')
          .select('id, parent_id')
          .eq('user_id', userId);

        let insights = 0;
        let replies = 0;
        let likesReceived = 0;

        if (userComments && userComments.length > 0) {
          insights = userComments.filter(c => c.parent_id === null).length;
          replies = userComments.filter(c => c.parent_id !== null).length;
          
          const commentIds = userComments.map(c => c.id);
          const chunkSize = 200;
          for (let i = 0; i < commentIds.length; i += chunkSize) {
            const chunk = commentIds.slice(i, i + chunkSize);
            const { count } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .in('comment_id', chunk);
            if (count) likesReceived += count;
          }
        }
        
        setStats({ insights, replies, likesReceived });
      } catch (err: unknown) {
        console.error("Error fetching stats:", err);
        setError("Failed to load statistics.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  const getRankDetails = (score: number) => {
    if (score >= 150) return { name: 'Authority', nextName: 'Max Rank', min: 150, max: 200, icon: Crown, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-200 dark:bg-slate-800', bar: 'bg-slate-900 dark:bg-slate-100' };
    if (score >= 100) return { name: 'Scholar', nextName: 'Authority', min: 100, max: 150, icon: Award, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', bar: 'bg-amber-500' };
    if (score >= 50) return { name: 'Researcher', nextName: 'Scholar', min: 50, max: 100, icon: GraduationCap, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', bar: 'bg-blue-500' };
    if (score >= 10) return { name: 'Contributor', nextName: 'Researcher', min: 10, max: 50, icon: Shield, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/40', bar: 'bg-sky-500' };
    return { name: 'Layman', nextName: 'Contributor', min: 0, max: 10, icon: BookOpen, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', bar: 'bg-slate-400' };
  };

  const rank = getRankDetails(scholarlyScore);
  const progressPct = scholarlyScore >= 150 ? 100 : Math.max(0, Math.min(100, ((scholarlyScore - rank.min) / (rank.max - rank.min)) * 100));

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (error) {
    return <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2"><AlertCircle size={14} /><p>{error}</p></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-colors ${rank.bg} ${rank.color}`}>
          <rank.icon size={44} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
            {rank.name}
          </h3>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
            <BarChart3 size={12} className="text-indigo-500" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Level {scholarlyScore}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3 shadow-inner">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className={rank.color}>{rank.name}</span>
          <span className="text-slate-400">{rank.nextName}</span>
        </div>
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden ring-1 ring-inset ring-slate-900/5 dark:ring-white/5">
          <div className={`h-full ${rank.bar} transition-all duration-1000 ease-out`} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-bold text-slate-400">
          <span>{rank.min} XP</span>
          <span>{scholarlyScore >= 150 ? 'MAX' : `${rank.max} XP`}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-indigo-100 dark:border-indigo-800/30">
          <MessageSquare size={20} className="text-indigo-500 mb-2" />
          <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{stats.insights.toLocaleString()}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mt-1">Insights</span>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-emerald-100 dark:border-emerald-800/30">
          <Reply size={20} className="text-emerald-500 mb-2" />
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.replies.toLocaleString()}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mt-1">Replies</span>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-rose-100 dark:border-rose-800/30">
          <Heart size={20} className="text-rose-500 mb-2" />
          <span className="text-2xl font-black text-rose-700 dark:text-rose-300">{stats.likesReceived.toLocaleString()}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-rose-400 mt-1">Likes Rcvd</span>
        </div>
      </div>
    </div>
  );
};