// Filepath: src/widgets/admin/ui/StatsOverviewWidget.tsx
import React from 'react';
import { UserStatsWidget, UserStat } from './UserStatsWidget';
import { ActivityStatsWidget, ActivityStat } from './ActivityStatsWidget';

interface StatsOverviewWidgetProps {
  userStats: UserStat[];
  activityStats: ActivityStat[];
}

export const StatsOverviewWidget = ({ userStats, activityStats }: StatsOverviewWidgetProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <UserStatsWidget userStats={userStats} />
      <ActivityStatsWidget activityStats={activityStats} />
    </div>
  );
};