// Path: src/features/profile/edit-profile/ui/ProfileSettings.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ProfileTab } from './ProfileTab';
import { PreferencesTab } from './PreferencesTab';
import { SecurityTab } from './SecurityTab';
import { StatsTab } from './StatsTab';

interface ProfileSettingsProps {
  userId: string;
  onClose: () => void;
}

type SettingsTab = 'profile' | 'preferences' | 'security' | 'stats';

export const ProfileSettings = ({ userId, onClose }: ProfileSettingsProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Account Settings</h2>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Manage your presence</p>
        </div>
        <button onClick={onClose} title="Close Settings" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 gap-6 overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('profile')} className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Profile</button>
        <button onClick={() => setActiveTab('preferences')} className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'preferences' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Library</button>
        <button onClick={() => setActiveTab('security')} className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Security</button>
        <button onClick={() => setActiveTab('stats')} className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === 'stats' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Stats</button>
      </div>

      {/* Content Area */}
      <div className="p-8 max-h-[75vh] overflow-y-auto scrollbar-hide relative">
        {activeTab === 'profile' && <ProfileTab userId={userId} />}
        {activeTab === 'preferences' && <PreferencesTab userId={userId} />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'stats' && <StatsTab userId={userId} />}
      </div>
    </div>
  );
};