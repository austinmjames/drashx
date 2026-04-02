// Filepath: src/widgets/admin/ui/ActivityStatsWidget.tsx
import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Card } from '@/shared/ui/Card';

export interface ActivityStat { period: string; total_comments: number; total_replies: number; total_likes: number; }

interface ActivityStatsWidgetProps { activityStats: ActivityStat[]; }

export const ActivityStatsWidget = ({ activityStats }: ActivityStatsWidgetProps) => {
  // We work with chronological order for the line graph
  const data = useMemo(() => [...activityStats].reverse(), [activityStats]);
  
  const maxVal = useMemo(() => {
    const highest = Math.max(
      ...data.map(s => Math.max(Number(s.total_comments), Number(s.total_replies), Number(s.total_likes))),
      1
    );
    // Highest number represents 75% of the range
    return highest / 0.75;
  }, [data]);

  const getPath = (key: keyof Omit<ActivityStat, 'period'>) => {
    if (data.length < 2) return "";
    return data.map((stat, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((Number(stat[key]) / maxVal) * 100);
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Activity className="text-indigo-500 w-5 h-5" />
          <h3 className="font-semibold text-gray-800">Global Activity</h3>
        </div>
        {/* Legend */}
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Comments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Replies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Likes</span>
          </div>
        </div>
      </div>

      <div className="p-8 relative h-72">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs italic">No activity logs found.</div>
        ) : (
          <div className="relative w-full h-full">
            {/* Y-Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 25, 50, 75, 100].map((tick) => (
                <div key={tick} className="w-full border-t border-gray-100 relative">
                  {tick === 75 && (
                    <span className="absolute -top-2 -left-6 text-[8px] font-black text-indigo-300 uppercase">Peak</span>
                  )}
                </div>
              ))}
            </div>

            {/* Lines Layer */}
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={getPath('total_comments')} className="opacity-20" />
              <polyline fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={getPath('total_replies')} className="opacity-20" />
              <polyline fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={getPath('total_likes')} className="opacity-20" />
            </svg>

            {/* Interaction Dots Layer */}
            <div className="absolute inset-0">
              {data.map((stat, i) => {
                const xPos = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
                
                return (
                  <div 
                    key={i} 
                    className="absolute top-0 bottom-0 flex justify-center group"
                    style={{ left: `${xPos}%`, width: '0px' }}
                  >
                    <div className="absolute inset-y-0 w-px bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors pointer-events-none" />
                    
                    {/* Comments Dot (Blue) */}
                    <div 
                      className="absolute w-2 h-2 bg-blue-500 border border-white dark:border-slate-900 rounded-full shadow-sm z-30 hover:scale-150 transition-transform cursor-help group/dot"
                      style={{ bottom: `${(Number(stat.total_comments) / maxVal) * 100}%`, transform: 'translate(0, 50%)' }}
                    >
                      <div className="opacity-0 group-hover/dot:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap pointer-events-none shadow-xl z-50">
                        {stat.total_comments} Comments
                      </div>
                    </div>

                    {/* Replies Dot (Green) */}
                    <div 
                      className="absolute w-2 h-2 bg-green-500 border border-white dark:border-slate-900 rounded-full shadow-sm z-20 hover:scale-150 transition-transform cursor-help group/dot"
                      style={{ bottom: `${(Number(stat.total_replies) / maxVal) * 100}%`, transform: 'translate(0, 50%)' }}
                    >
                      <div className="opacity-0 group-hover/dot:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap pointer-events-none shadow-xl z-50">
                        {stat.total_replies} Replies
                      </div>
                    </div>

                    {/* Likes Dot (Red) */}
                    <div 
                      className="absolute w-2 h-2 bg-red-500 border border-white dark:border-slate-900 rounded-full shadow-sm z-10 hover:scale-150 transition-transform cursor-help group/dot"
                      style={{ bottom: `${(Number(stat.total_likes) / maxVal) * 100}%`, transform: 'translate(0, 50%)' }}
                    >
                      <div className="opacity-0 group-hover/dot:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap pointer-events-none shadow-xl z-50">
                        {stat.total_likes} Likes
                      </div>
                    </div>

                    {/* Date Label */}
                    <div className="absolute -bottom-10 whitespace-nowrap text-center transform -translate-x-1/2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                        {new Date(stat.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};