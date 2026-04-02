// Path: src/features/groups/manage-groups/ui/ManageGroupDetails.tsx
import React, { useState, useEffect } from 'react';
import { Info, Check, Copy, Hash, PencilLine, X } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { GroupMemberData, GroupData } from './GroupManagementModal';

interface ManageGroupDetailsProps {
  group: GroupMemberData;
  onRefresh: () => void;
}

export const ManageGroupDetails = ({ group, onRefresh }: ManageGroupDetailsProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const isOwner = group.role === 'owner';
  
  // Strongly type the group data and handle potential arrays from Supabase joins
  const groupData = (Array.isArray(group.groups) ? group.groups[0] : group.groups) as GroupData;

  // Group Details State
  const [name, setName] = useState(groupData.name);
  const [description, setDescription] = useState(groupData.description || '');
  const [tags, setTags] = useState([...(groupData.tags || []), '', '', ''].slice(0, 3));
  
  // Invite Code Edit State
  const [inviteCode, setInviteCode] = useState(groupData.invite_code || '');
  const [isEditingCode, setIsEditingCode] = useState(false);

  // Re-sync local invite code if the external prop changes
  useEffect(() => {
    setInviteCode(groupData.invite_code || '');
    setIsEditingCode(false);
  }, [groupData.invite_code]);

  const handleCopyCode = () => {
    if (!groupData.invite_code) return;
    const el = document.createElement('textarea');
    el.value = groupData.invite_code;
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
      const finalInviteCode = inviteCode.trim() || groupData.invite_code;

      // Check uniqueness if the user is attempting to change it
      if (finalInviteCode !== groupData.invite_code) {
        const { data: existing } = await supabase.from('groups').select('id').eq('invite_code', finalInviteCode).maybeSingle();
        if (existing) throw new Error(`Invite code "${finalInviteCode}" is already taken.`);
      }

      const { error: updateErr } = await supabase.from('groups').update({ 
        name, 
        description, 
        tags: tags.filter(t => t.trim() !== ''),
        invite_code: finalInviteCode
      }).eq('id', groupData.id);

      if (updateErr) throw updateErr;

      setSuccessMsg("Details updated successfully.");
      setIsEditingCode(false);
      onRefresh();
    } catch (err: unknown) { 
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg); 
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-8 pb-24 scrollbar-hide animate-in slide-in-from-right-2 duration-300">
      {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl border border-red-100 flex items-center gap-2"><Info size={14} /> {error}</div>}
      {successMsg && <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-xl border border-emerald-100 flex items-center gap-2"><Check size={14} /> {successMsg}</div>}

      <form onSubmit={handleUpdateGroup} className="space-y-6">
        
        {/* Invite Code Display & Editing */}
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
          <div className="flex-1 mr-4 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Invite Code</p>
            {isEditingCode ? (
              <div className="flex items-center mt-1">
                <span className="text-indigo-400 dark:text-indigo-500 font-mono text-[10px] uppercase mr-1 shrink-0">drashx.com/</span>
                <input 
                  title="Custom Invite Code"
                  aria-label="Custom Invite Code"
                  placeholder="CUSTOM-CODE"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                  className="bg-transparent border-b border-indigo-300 dark:border-indigo-700 focus:border-indigo-600 outline-none font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300 w-full uppercase pb-0.5 min-w-0"
                  autoFocus
                />
              </div>
            ) : (
              <code className="text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300 block truncate">{inviteCode}</code>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
               <button
                 type="button"
                 onClick={() => {
                   if (isEditingCode) {
                     setIsEditingCode(false);
                     setInviteCode(groupData.invite_code || ''); // Revert changes
                   } else {
                     setIsEditingCode(true);
                   }
                 }}
                 title={isEditingCode ? "Cancel editing" : "Edit invite code"}
                 aria-label={isEditingCode ? "Cancel editing" : "Edit invite code"}
                 className="p-2 rounded-lg text-indigo-500 bg-white/50 dark:bg-slate-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
               >
                 {isEditingCode ? <X size={14} /> : <PencilLine size={14} />}
               </button>
            )}
            {!isEditingCode && groupData.invite_code && (
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
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="group-name-input">Name</label>
          <input id="group-name-input" title="Group Name" aria-label="Group Name" disabled={!isOwner} value={name} onChange={(e) => setName(e.target.value)} placeholder="Group Name" className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 py-2 text-sm font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white" />
        </div>
        
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest" htmlFor="group-desc-input">Description</label>
          <textarea id="group-desc-input" title="Group Description" aria-label="Group Description" disabled={!isOwner} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Group Description" rows={2} className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 py-2 text-sm outline-none focus:border-indigo-500 resize-none text-slate-900 dark:text-white" />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Topic Tags</label>
          <div className="flex flex-col gap-2 pt-1">
            {tags.map((tag, idx) => (
              <div key={idx} className="flex items-center border-b border-slate-100 dark:border-slate-800 focus-within:border-indigo-400">
                <Hash size={10} className="text-slate-300 mr-1 shrink-0" />
                <input 
                  title={`Topic tag ${idx + 1}`}
                  aria-label={`Topic tag ${idx + 1}`}
                  disabled={!isOwner} 
                  value={tag} 
                  onChange={(e) => handleTagChange(idx, e.target.value)} 
                  placeholder="tag" 
                  className="w-full bg-transparent py-1 text-xs outline-none text-slate-900 dark:text-white" 
                />
              </div>
            ))}
          </div>
        </div>

        {isOwner && (
          <button 
            type="submit" 
            disabled={isLoading} 
            onMouseEnter={() => setHoveredBtn('save')} 
            onMouseLeave={() => setHoveredBtn(null)} 
            title="Save Details"
            aria-label="Save Details"
            className={`w-full mt-4 text-xs font-black uppercase py-3.5 rounded-xl transition-all shadow-lg ${hoveredBtn === 'save' ? 'bg-indigo-700 shadow-indigo-500/30' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}
          >
            {isLoading ? 'Processing...' : 'Save Details'}
          </button>
        )}
      </form>
    </div>
  );
};