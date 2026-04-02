// Filepath: src/widgets/admin/ui/UserStatsWidget.tsx
import React, { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import { Card } from '@/shared/ui/Card';

export interface UserStat { period: string; new_users: number; total_users: number; }

interface UserStatsWidgetProps { userStats: UserStat[]; }

export const UserStatsWidget = ({ userStats }: UserStatsWidgetProps) => {
  const [viewMode, setViewMode] = useState<'new' | 'total'>('total');
  // Chronological order for the graph
  const data = useMemo(() => [...userStats].reverse(), [userStats]);
  
  const maxVal = useMemo(() => {
    const highest = Math.max(...data.map(s => viewMode === 'total' ? s.total_users : s.new_users), 1);
    // SCALE: Highest number represents 75% of the range (100% height from bottom 0)
    return highest / 0.75;
  }, [data, viewMode]);

  const pathPoints = useMemo(() => {
    if (data.length < 2) return "";
    return data.map((stat, i) => {
      const val = viewMode === 'total' ? stat.total_users : stat.new_users;
      // Map x strictly from 0 to 100
      const x = (i / (data.length - 1)) * 100;
      // Map y (0 is top, 100 is bottom)
      const y = 100 - ((val / maxVal) * 100);
      return `${x},${y}`;
    }).join(" ");
  }, [data, viewMode, maxVal]);

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users className="text-blue-500 w-5 h-5" />
          <h3 className="font-semibold text-gray-800">User Growth</h3>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setViewMode('new')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>New</button>
          <button onClick={() => setViewMode('total')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'total' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Total</button>
        </div>
      </div>
      
      <div className="p-8 relative h-72">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs italic">No data found.</div>
        ) : (
          <div className="relative w-full h-full">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 25, 50, 75, 100].map((tick) => (
                <div key={tick} className="w-full border-t border-gray-100 relative">
                   {tick === 75 && <span className="absolute -top-2 -left-6 text-[8px] font-black text-indigo-300 uppercase">Peak</span>}
                </div>
              ))}
            </div>

            {/* Line Path */}
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline 
                fill="none" 
                stroke="#3b82f6" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                points={pathPoints} 
                className="drop-shadow-sm opacity-30"
              />
            </svg>

            {/* Points Layer - Absolute positioning to match SVG coordinates */}
            <div className="absolute inset-0">
              {data.map((stat, i) => {
                const val = viewMode === 'total' ? stat.total_users : stat.new_users;
                const xPos = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
                
                return (
                  <div 
                    key={i} 
                    className="absolute top-0 bottom-0 flex justify-center group"
                    style={{ left: `${xPos}%`, width: '0px' }}
                  >
                    {/* Vertical hover guide */}
                    <div className="absolute inset-y-0 w-px bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors pointer-events-none" />
                    
                    {/* The Dot */}
                    <div 
                      className="absolute w-3 h-3 bg-blue-600 border-2 border-white dark:border-slate-900 rounded-full shadow-md z-10 transition-transform group-hover:scale-150 cursor-help"
                      style={{ bottom: `${(val / maxVal) * 100}%`, transform: 'translate(0, 50%)' }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap pointer-events-none shadow-xl z-50">
                        {viewMode === 'total' ? 'Total' : 'New'}: {val}
                      </div>
                    </div>

                    {/* Date label */}
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