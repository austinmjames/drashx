// Filepath: src/widgets/admin/ui/UserStatsWidget.tsx
import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { Card } from '@/shared/ui/Card';

export interface UserStat {
  period: string;
  new_users: number;
  total_users: number;
}

interface UserStatsWidgetProps {
  userStats: UserStat[];
}

export const UserStatsWidget = ({ userStats }: UserStatsWidgetProps) => {
  const [viewMode, setViewMode] = useState<'new' | 'total'>('total');
  
  // Calculate max values to scale the bars properly (prevent dividing by zero)
  const maxVal = Math.max(...userStats.map(s => viewMode === 'total' ? s.total_users : s.new_users), 1);

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users className="text-blue-500 w-5 h-5" />
          <h3 className="font-semibold text-gray-800">User Growth</h3>
        </div>
        
        {/* Toggle Controls */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('new')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            New Users
          </button>
          <button 
            onClick={() => setViewMode('total')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'total' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Total Users
          </button>
        </div>
      </div>
      
      <div className="p-5 flex items-end gap-2 h-64">
        {userStats.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data available for this period.</div>
        ) : (
          userStats.slice().reverse().map((stat, i) => {
            const val = viewMode === 'total' ? stat.total_users : stat.new_users;
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div 
                  className="w-full bg-blue-100 rounded-t-sm relative flex items-end justify-center transition-all duration-300 hover:bg-blue-200"
                  style={{ height: `${(val / maxVal) * 100}%` }}
                >
                  <div 
                    className="w-full bg-blue-500 rounded-t-sm absolute bottom-0"
                    style={{ height: '100%' }} // Since we split the view, the colored bar is full height of its container
                  ></div>
                  
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                    {viewMode === 'total' ? `Total: ${stat.total_users}` : `New: ${stat.new_users}`}
                  </div>
                </div>
                <span className="text-xs text-gray-400 mt-2 truncate w-full text-center">
                  {new Date(stat.period).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};