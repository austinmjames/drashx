import React, { useState, useRef, useEffect } from 'react';
import { Users, User as UserIcon, Plus, Check } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface Props {
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  myGroups: { id: string, name: string }[];
  user: SupabaseUser | null;
  onOpenManagement: () => void;
}

export const GroupSelector = ({ activeGroupId, setActiveGroupId, myGroups, user, onOpenManagement }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentGroupName = activeGroupId === user?.id ? "Personal" : myGroups.find(g => g.id === activeGroupId)?.name || "Select Group";

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-200/50 transition-colors">
        {activeGroupId === user?.id ? <UserIcon size={14} className="text-slate-400" /> : <Users size={14} className="text-slate-400" />}
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{currentGroupName}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="p-2 border-b text-[10px] font-black uppercase text-slate-400 bg-slate-50">Context</div>
          
          <div className="max-h-64 overflow-y-auto">
            <button onClick={() => { setActiveGroupId(user?.id || null); setIsOpen(false); }} className={`w-full flex justify-between px-4 py-3 text-sm hover:bg-slate-50 ${activeGroupId === user?.id ? 'text-indigo-600 bg-indigo-50/30 font-bold' : ''}`}>
              <div className="flex gap-3 items-center"><UserIcon size={16} /> Personal</div>
              {activeGroupId === user?.id && <Check size={14} />}
            </button>

            {myGroups.length > 0 && (
              <div className="p-2 border-t">
                <p className="px-2 py-1 text-[10px] font-black uppercase text-slate-400">My Groups</p>
                {myGroups.map(group => (
                  <button key={group.id} onClick={() => { setActiveGroupId(group.id); setIsOpen(false); }} className={`w-full flex justify-between px-2 py-2 text-sm rounded-lg hover:bg-slate-50 ${activeGroupId === group.id ? 'text-indigo-600 font-bold' : ''}`}>
                    <div className="flex gap-3 items-center"><Users size={16} /> {group.name}</div>
                    {activeGroupId === group.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t bg-slate-50">
            <button onClick={() => { onOpenManagement(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-2 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg">
              <Plus size={14} /> Manage Groups
            </button>
          </div>
        </div>
      )}
    </div>
  );
};