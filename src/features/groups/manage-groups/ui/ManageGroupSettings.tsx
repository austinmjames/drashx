// Path: src/features/groups/manage-groups/ui/ManageGroupSettings.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Info, Check, ChevronDown, Book } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { GroupMemberData, GroupData } from './GroupManagementModal';
import { ICON_OPTIONS, COLOR_OPTIONS } from './CreateGroupView';

interface ManageGroupSettingsProps {
  group: GroupMemberData;
  onRefresh: () => void;
}

export const ManageGroupSettings = ({ group, onRefresh }: ManageGroupSettingsProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const isOwner = group.role === 'owner';
  const groupData = (Array.isArray(group.groups) ? group.groups[0] : group.groups) as GroupData;

  const [visibility, setVisibility] = useState<'open' | 'unlisted' | 'invite-only'>(groupData.visibility);
  const [defaultAccess, setDefaultAccess] = useState<'view-only' | 'reply-only' | 'full-access'>(groupData.default_access_level || 'full-access');

  // Icon & Theme Settings
  const [selectedIconId, setSelectedIconId] = useState(groupData.icon_url || 'book');
  const [selectedColorId, setSelectedColorId] = useState(groupData.color_theme || 'indigo');
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

  const iconRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) setIsIconDropdownOpen(false);
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setIsColorDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setError(null); setSuccessMsg(null);
    try {
      const { error: updateErr } = await supabase.from('groups').update({ 
        visibility, 
        default_access_level: defaultAccess,
        icon_url: selectedIconId, 
        color_theme: selectedColorId
      }).eq('id', groupData.id);

      if (updateErr) throw updateErr;
      setSuccessMsg("Settings updated successfully.");
      onRefresh();
    } catch (err: unknown) { 
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg); 
    } finally { setIsLoading(false); }
  };

  const SelectedIconComp = ICON_OPTIONS.find(o => o.id === selectedIconId)?.icon || Book;
  const SelectedColor = COLOR_OPTIONS.find(o => o.id === selectedColorId) || COLOR_OPTIONS[0];

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-8 pb-24 scrollbar-hide animate-in slide-in-from-right-2 duration-300">
      {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl border border-red-100 flex items-center gap-2"><Info size={14} /> {error}</div>}
      {successMsg && <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-xl border border-emerald-100 flex items-center gap-2"><Check size={14} /> {successMsg}</div>}

      <form onSubmit={handleUpdateSettings} className="space-y-6">
        
        {/* Branding Options */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2" ref={iconRef}>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="icon-picker">Group Icon</label>
            <div className="relative">
              <button 
                id="icon-picker"
                type="button" 
                disabled={!isOwner} 
                onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)} 
                title="Change group icon"
                aria-label="Change group icon"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all disabled:opacity-50"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${SelectedColor.hex}`}>
                    <SelectedIconComp size={16} />
                </div>
                {isOwner && <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {isIconDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 grid grid-cols-4 gap-1 overflow-y-auto max-h-48">
                  {ICON_OPTIONS.map((opt) => (
                    <button 
                      key={opt.id} 
                      type="button" 
                      onClick={() => { setSelectedIconId(opt.id); setIsIconDropdownOpen(false); }} 
                      title={`Select ${opt.id} icon`}
                      aria-label={`Select ${opt.id} icon`}
                      className={`aspect-square flex items-center justify-center rounded-xl transition-all ${selectedIconId === opt.id ? `${SelectedColor.bg} ${SelectedColor.text}` : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                    >
                      <opt.icon size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2" ref={colorRef}>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="color-picker">Theme Color</label>
            <div className="relative">
              <button 
                id="color-picker"
                type="button" 
                disabled={!isOwner} 
                onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)} 
                title="Change group color theme"
                aria-label="Change group color theme"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all"
              >
                <div className={`w-6 h-6 rounded-full ${SelectedColor.hex} shadow-inner transition-all`} />
                {isOwner && <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {isColorDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 py-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button 
                      key={opt.id} 
                      type="button" 
                      onClick={() => { setSelectedColorId(opt.id); setIsColorDropdownOpen(false); }} 
                      title={`Select ${opt.id} color`}
                      aria-label={`Select ${opt.id} color`}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-all ${selectedColorId === opt.id ? opt.bg : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                    >
                      <div className={`w-4 h-4 rounded-full ${opt.hex}`} /><span className={`capitalize ${selectedColorId === opt.id ? opt.text : 'text-slate-600 dark:text-slate-300'}`}>{opt.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visibility Dropdown */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="visibility-select">Group Visibility</label>
          <div className="relative">
            <select 
              id="visibility-select"
              title="Group Visibility"
              aria-label="Group Visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'open' | 'unlisted' | 'invite-only')}
              disabled={!isOwner}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer transition-colors hover:border-slate-200 dark:hover:border-slate-700"
            >
              <option value="open">Open to Public</option>
              <option value="unlisted">Unlisted (Link Only)</option>
              <option value="invite-only">Private (Invite Only)</option>
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Default Role Dropdown */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1" htmlFor="role-select">
            Default Member Role
            <span className="group relative cursor-help hidden sm:inline-block">
              <Info size={12} className="text-slate-300 hover:text-indigo-500" />
              <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 normal-case tracking-normal">
                Determines what new members can do. You can change this per-member later.
              </div>
            </span>
          </label>
          <div className="relative">
            <select 
              id="role-select"
              title="Default Member Role"
              aria-label="Default Member Role"
              value={defaultAccess}
              onChange={(e) => setDefaultAccess(e.target.value as 'view-only' | 'reply-only' | 'full-access')}
              disabled={!isOwner}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer transition-colors hover:border-slate-200 dark:hover:border-slate-700"
            >
              <option value="full-access">Full Access (Can start threads)</option>
              <option value="reply-only">Reply Only (Cannot start threads)</option>
              <option value="view-only">View Only (Read-only access)</option>
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {isOwner && (
          <button 
            type="submit" 
            disabled={isLoading} 
            onMouseEnter={() => setHoveredBtn('save')} 
            onMouseLeave={() => setHoveredBtn(null)} 
            title="Save Settings"
            aria-label="Save Settings"
            className={`w-full mt-6 text-xs font-black uppercase py-3.5 rounded-xl transition-all shadow-lg ${hoveredBtn === 'save' ? 'bg-indigo-700 shadow-indigo-500/30' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}
          >
            {isLoading ? 'Processing...' : 'Save Settings'}
          </button>
        )}
      </form>
    </div>
  );
};