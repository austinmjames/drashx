// Filepath: src/widgets/admin/ui/ActivityStatsWidget.tsx
import React from 'react';
import { Activity } from 'lucide-react';
import { Card } from '@/shared/ui/Card';

export interface ActivityStat {
  period: string;
  total_comments: number;
  total_replies: number;
  total_likes: number;
}

interface ActivityStatsWidgetProps {
  activityStats: ActivityStat[];
}

export const ActivityStatsWidget = ({ activityStats }: ActivityStatsWidgetProps) => {
  const maxInteractions = Math.max(...activityStats.map(s => s.total_comments + s.total_replies + s.total_likes), 1);

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="text-green-500 w-5 h-5" />
          <h3 className="font-semibold text-gray-800">Global Activity</h3>
        </div>
      </div>
      <div className="p-5 flex items-end gap-2 h-64">
        {activityStats.slice().reverse().map((stat, i) => {
          const total = stat.total_comments + stat.total_replies + stat.total_likes;
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div 
                className="w-full bg-gray-100 rounded-t-sm flex flex-col justify-end transition-all duration-300 hover:bg-gray-200"
                style={{ height: `${(total / maxInteractions) * 100}%` }}
              >
                <div className="w-full bg-green-400" style={{ height: `${(stat.total_likes / total) * 100}%` }}></div>
                <div className="w-full bg-emerald-500" style={{ height: `${(stat.total_replies / total) * 100}%` }}></div>
                <div className="w-full bg-teal-600 rounded-t-sm" style={{ height: `${(stat.total_comments / total) * 100}%` }}></div>
                
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 absolute -top-16 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                  Likes: {stat.total_likes} <br/>
                  Replies: {stat.total_replies} <br/>
                  Comments: {stat.total_comments}
                </div>
              </div>
              <span className="text-xs text-gray-400 mt-2 truncate w-full text-center">
                {new Date(stat.period).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};