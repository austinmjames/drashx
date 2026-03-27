// Path: src/features/groups/manage-groups/ui/ManageGroupView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Info, Check, AlertTriangle, UserMinus, LogOut, Copy, Hash, Shield, ChevronDown, Book } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { ICON_OPTIONS, COLOR_OPTIONS } from './CreateGroupView';

interface GroupData {
  id: string;
  name: string;
  description?: string;
  visibility: 'open' | 'unlisted' | 'invite-only';
  tags?: string[];
  invite_code?: string;
  icon_url?: string;
  color_theme?: string;
}

interface ManageGroupViewProps {
  group: {
    role: 'owner' | 'admin' | 'member';
    groups: GroupData;
  };
  userId: string;
  onBack: () => void;
  onRefresh: () => void;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
}

export const ManageGroupView = ({ group, userId, onBack, onRefresh }: ManageGroupViewProps) => {
  const [manageTab, setManageTab] = useState<'details' | 'members'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // React-managed Hover States
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Group Settings
  const [name, setName] = useState(group.groups.name);
  const [description, setDescription] = useState(group.groups.description || '');
  const [visibility, setVisibility] = useState<'open' | 'unlisted' | 'invite-only'>(group.groups.visibility);
  const [tags, setTags] = useState([...(group.groups.tags || []), '', '', ''].slice(0, 3));
  
  // Icon & Theme Settings - Derived from database values
  const [selectedIconId, setSelectedIconId] = useState(group.groups.icon_url || 'book');
  const [selectedColorId, setSelectedColorId] = useState(group.groups.color_theme || 'indigo');
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

  const iconRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [confirmAction, setConfirmAction] = useState<{type: 'leave' | 'kick', payload?: string} | null>(null);
  const [deleteCommentsFlag, setDeleteCommentsFlag] = useState(false);

  const isOwner = group.role === 'owner';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) setIsIconDropdownOpen(false);
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setIsColorDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchGroupMembers = async () => {
      const { data } = await supabase.from('group_members').select('*').eq('group_id', group.groups.id).order('created_at', { ascending: true });
      setGroupMembers(data as GroupMember[] || []);
    };
    fetchGroupMembers();
  }, [group.groups.id]);

  const handleCopyCode = () => {
    if (!group.groups.invite_code) return;
    const el = document.createElement('textarea');
    el.value = group.groups.invite_code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleTagChange = (index: number, value: string) => {
    const newTags = [...tags];
    newTags[index] = value.slice(0, 15).replace(/\s/g, '');
    setTags(newTags);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setError(null); setSuccessMsg(null);
    try {
      const { error: updateErr } = await supabase.from('groups').update({ 
        name, 
        description, 
        visibility, 
        tags: tags.filter(t => t.trim() !== ''),
        icon_url: selectedIconId, 
        color_theme: selectedColorId
      }).eq('id', group.groups.id);

      if (updateErr) throw updateErr;
      setSuccessMsg("Settings updated.");
      onRefresh();
    } catch (err: unknown) { 
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg); 
    } finally { setIsLoading(false); }
  };

  const executeDangerAction = async () => {
    setIsLoading(true); setError(null);
    try {
      const groupId = group.groups.id;
      if (confirmAction?.type === 'leave') {
        if (isOwner) {
          const successor = groupMembers.find(m => m.user_id !== userId);
          if (successor) {
            await supabase.from('groups').update({ owner_id: successor.user_id }).eq('id', groupId);
            await supabase.from('group_members').update({ role: 'owner' }).eq('group_id', groupId).eq('user_id', successor.user_id);
          } else {
            const { error: dErr } = await supabase.from('groups').delete().eq('id', groupId);
            if (dErr) throw dErr;
            onRefresh(); 
            onBack(); 
            return;
          }
        }
        
        if (deleteCommentsFlag) {
          await supabase.from('comments').delete().eq('group_id', groupId).eq('user_id', userId);
        }
        
        const { error: leaveErr } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
        if (leaveErr) throw leaveErr;
        
        onRefresh(); 
        onBack();
      } 
      else if (confirmAction?.type === 'kick' && confirmAction.payload) {
        const targetId = confirmAction.payload;
        if (deleteCommentsFlag) await supabase.from('comments').delete().eq('group_id', groupId).eq('user_id', targetId);
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId);
        const { data } = await supabase.from('group_members').select('*').eq('group_id', groupId);
        setGroupMembers(data as GroupMember[] || []);
      }
      setConfirmAction(null);
      setDeleteCommentsFlag(false);
    } catch (err: unknown) { 
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg); 
    } finally { setIsLoading(false); }
  };

  // Find the icon and color from the global definitions
  const SelectedIconComp = ICON_OPTIONS.find(o => o.id === selectedIconId)?.icon || Book;
  const SelectedColor = COLOR_OPTIONS.find(o => o.id === selectedColorId) || COLOR_OPTIONS[0];

  return (
    <>
      <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 gap-8 bg-slate-50/50">
        {(['details', 'members'] as const).map((t) => (
          <button 
            key={t} 
            onClick={() => setManageTab(t)} 
            onMouseEnter={() => setHoveredBtn(`tab-${t}`)}
            onMouseLeave={() => setHoveredBtn(null)}
            title={`View ${t} tab`}
            aria-label={`View ${t} tab`}
            className={`py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${manageTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide animate-in slide-in-from-right-2 duration-300">
        {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl border border-red-100 flex items-center gap-2"><Info size={14} /> {error}</div>}
        {successMsg && <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-xl border border-emerald-100 flex items-center gap-2"><Check size={14} /> {successMsg}</div>}

        {manageTab === 'details' && (
          <form onSubmit={handleUpdateGroup} className="space-y-6">
            
            {/* Invite Code Display */}
            {group.groups.invite_code && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Invite Code</p>
                  <code className="text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300">{group.groups.invite_code}</code>
                </div>
                <button 
                  type="button"
                  onClick={handleCopyCode}
                  onMouseEnter={() => setHoveredBtn('copy')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  title="Copy invite code"
                  aria-label="Copy invite code"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    copyFeedback ? 'bg-emerald-500 text-white' : 
                    hoveredBtn === 'copy' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-indigo-600 border border-indigo-200 shadow-sm'
                  }`}
                >
                  {copyFeedback ? <Check size={14} /> : <Copy size={14} />}
                  {copyFeedback ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2" ref={iconRef}>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="icon-btn">Icon</label>
                <div className="relative">
                  <button 
                    type="button" 
                    id="icon-btn" 
                    disabled={!isOwner} 
                    onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)} 
                    title="Change icon"
                    aria-label="Change icon"
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all disabled:opacity-50"
                  >
                    {/* White-on-Color Branding Preview */}
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
                          title={`Select ${opt.id} icon`}
                          aria-label={`Select ${opt.id} icon`}
                          onClick={() => { setSelectedIconId(opt.id); setIsIconDropdownOpen(false); }} 
                          className={`aspect-square flex items-center justify-center rounded-xl transition-all ${selectedIconId === opt.id ? `${SelectedColor.bg} ${SelectedColor.text}` : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          <opt.icon size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2" ref={colorRef}>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="color-btn">Color</label>
                <div className="relative">
                  <button 
                    type="button" 
                    id="color-btn" 
                    disabled={!isOwner} 
                    onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)} 
                    title="Change theme color"
                    aria-label="Change theme color"
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
                          title={`Select ${opt.id} color`}
                          aria-label={`Select ${opt.id} color`}
                          onClick={() => { setSelectedColorId(opt.id); setIsColorDropdownOpen(false); }} 
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-all ${selectedColorId === opt.id ? opt.bg : 'hover:bg-slate-50'}`}
                        >
                          <div className={`w-4 h-4 rounded-full ${opt.hex}`} /><span className={`capitalize ${selectedColorId === opt.id ? opt.text : 'text-slate-600'}`}>{opt.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="name-in">Name</label>
              <input id="name-in" title="Group Name" aria-label="Group Name" disabled={!isOwner} value={name} onChange={(e) => setName(e.target.value)} placeholder="Group Name" className="w-full bg-transparent border-b border-slate-200 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="desc-in">Description</label>
              <textarea id="desc-in" title="Group Description" aria-label="Group Description" disabled={!isOwner} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Group Description" rows={2} className="w-full bg-transparent border-b border-slate-200 py-2 text-sm outline-none focus:border-indigo-500 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Visibility</label>
                <div className="flex flex-col gap-2">
                  {([{ id: 'open', label: 'Open' }, { id: 'unlisted', label: 'Unlisted' }, { id: 'invite-only', label: 'Private' }] as const).map((v) => (
                    <button 
                      key={v.id} 
                      type="button" 
                      disabled={!isOwner} 
                      onClick={() => setVisibility(v.id)} 
                      title={`Set visibility to ${v.label}`}
                      aria-label={`Set visibility to ${v.label}`}
                      className={`py-1.5 px-3 rounded-md text-xs transition-all text-left disabled:cursor-default ${visibility === v.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tags</label>
                 <div className="flex flex-col gap-2 pt-1">
                   {tags.map((tag, idx) => (
                     <div key={idx} className="flex items-center border-b border-slate-100 focus-within:border-indigo-400">
                       <Hash size={10} className="text-slate-300 mr-1" />
                       <input 
                        aria-label={`Tag ${idx + 1}`} 
                        disabled={!isOwner} 
                        value={tag} 
                        onChange={(e) => handleTagChange(idx, e.target.value)} 
                        placeholder="tag" 
                        className="w-full bg-transparent py-1 text-xs outline-none" 
                       />
                     </div>
                   ))}
                 </div>
              </div>
            </div>

            {isOwner && (
              <button 
                type="submit" 
                disabled={isLoading} 
                onMouseEnter={() => setHoveredBtn('save')} 
                onMouseLeave={() => setHoveredBtn(null)} 
                title="Save changes"
                aria-label="Save changes"
                className={`w-full text-xs font-black uppercase py-3.5 rounded-xl transition-all shadow-lg ${hoveredBtn === 'save' ? 'bg-indigo-700 shadow-indigo-500/30' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}
              >
                {isLoading ? 'Processing...' : 'Save Settings'}
              </button>
            )}
          </form>
        )}

        {manageTab === 'members' && (
          <div className="space-y-6 pb-12">
            {confirmAction && (
              <div className="p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-2xl space-y-4 animate-in zoom-in-95 duration-200 shadow-sm">
                <div className="flex gap-3 text-red-600 dark:text-red-400">
                  <AlertTriangle size={20} className="shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{confirmAction.type === 'leave' ? 'Leave Group?' : 'Remove Member?'}</p>
                    <p className="text-[11px] opacity-80 mt-1">This will remove access to shared commentary.</p>
                  </div>
                </div>
                <div className="bg-white/50 p-3 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={deleteCommentsFlag} 
                      onChange={(e) => setDeleteCommentsFlag(e.target.checked)} 
                      className="mt-1 w-4 h-4 border-red-200 rounded text-red-600" 
                      aria-label="Delete my comments"
                    />
                    <span className="text-[11px] text-red-700 font-medium">Delete all my insights and replies in this group permanently.</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={executeDangerAction} 
                    title="Confirm action"
                    aria-label="Confirm action"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={() => setConfirmAction(null)} 
                    title="Cancel"
                    aria-label="Cancel"
                    className="flex-1 bg-slate-100 text-slate-600 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!confirmAction && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Current Members</h4>
                {groupMembers.map(member => {
                  return (
                    <div key={member.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-900 last:border-0">
                      <div className="flex items-center gap-4">
                        {/* Member item icons also reflect group branding */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${SelectedColor.hex}`}>
                            <SelectedIconComp size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {member.user_id === userId ? 'You' : `User ${member.user_id.substring(0, 5)}`}
                            {member.role === 'owner' && <Shield size={10} className={SelectedColor.text} />}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{member.role}</p>
                        </div>
                      </div>
                      {isOwner && member.user_id !== userId && (
                        <button 
                          onClick={() => setConfirmAction({ type: 'kick', payload: member.user_id })} 
                          title="Remove member"
                          aria-label="Remove member"
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button 
                  onClick={() => setConfirmAction({ type: 'leave' })} 
                  title="Leave this group"
                  aria-label="Leave this group"
                  className="mt-10 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut size={14} /> Leave Group
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};