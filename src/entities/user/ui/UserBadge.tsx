// Path: src/entities/user/ui/UserBadge.tsx
import React from 'react';
import { BookOpen, Shield, GraduationCap, Award, Crown } from 'lucide-react';

interface UserBadgeProps {
  score: number;
}

export const UserBadge = ({ score }: UserBadgeProps) => {
  let RankIcon = BookOpen;
  let colorClass = "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
  let rankName = "Layman";

  // Tier 5: Authority (150-200)
  if (score >= 150) {
    RankIcon = Crown;
    colorClass = "text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-600";
    rankName = "Authority";
  } 
  // Tier 4: Scholar (100-149)
  else if (score >= 100) {
    RankIcon = Award;
    colorClass = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50";
    rankName = "Scholar";
  } 
  // Tier 3: Researcher (50-99)
  else if (score >= 50) {
    RankIcon = GraduationCap;
    colorClass = "text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50";
    rankName = "Researcher";
  } 
  // Tier 2: Contributor (10-49)
  else if (score >= 10) {
    RankIcon = Shield;
    colorClass = "text-sky-500 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800/50";
    rankName = "Contributor";
  }

  return (
    <div 
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-widest cursor-help transition-all hover:scale-105 shadow-sm ${colorClass}`}
      title={`${rankName} • Scholarly Score: ${score}`}
    >
      <RankIcon size={10} strokeWidth={2.5} />
      <span className="tabular-nums">{score}</span>
    </div>
  );
};