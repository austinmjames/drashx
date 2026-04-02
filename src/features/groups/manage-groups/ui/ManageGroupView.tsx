// Path: src/features/groups/manage-groups/ui/ManageGroupView.tsx
import React, { useState } from 'react';
import { GroupMemberData } from './GroupManagementModal';
import { ManageGroupDetails } from './ManageGroupDetails';
import { ManageGroupSettings } from './ManageGroupSettings';
import { ManageGroupMembers } from './ManageGroupMembers';

interface ManageGroupViewProps {
  group: GroupMemberData;
  userId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export const ManageGroupView = ({ group, userId, onBack, onRefresh }: ManageGroupViewProps) => {
  const [manageTab, setManageTab] = useState<'details' | 'settings' | 'members'>('details');

  const groupData = Array.isArray(group.groups) ? group.groups[0] : group.groups;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      
      {/* Header Info */}
      <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">{groupData.name}</h3>
        <p className="text-sm text-slate-500 mt-1">
          You are {group.role === 'owner' || group.role === 'admin' ? 'an' : 'a'} <strong className="text-indigo-600 dark:text-indigo-400 capitalize">{group.role}</strong> in this group.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 gap-8 bg-slate-50/30 dark:bg-slate-900/20 shadow-sm z-10 relative shrink-0">
        {(['details', 'settings', 'members'] as const).map((t) => (
          <button 
            key={t} 
            onClick={() => setManageTab(t)} 
            className={`py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${
              manageTab === t 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Dynamic Content Routing - Wrapped in a flexible container to fix overflow/clipping */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {manageTab === 'details' ? (
          <ManageGroupDetails group={group} onRefresh={onRefresh} />
        ) : manageTab === 'settings' ? (
          <ManageGroupSettings group={group} onRefresh={onRefresh} />
        ) : (
          <ManageGroupMembers group={group} userId={userId} onBack={onBack} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
};