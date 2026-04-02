// Path: src/features/groups/manage-groups/ui/ManageGroupMembers.tsx
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, Users, Crown, Settings2, Eye, MessageCircle, MessageSquare, AlertTriangle, LogOut, UserMinus, Shield, User } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { GroupMemberData, GroupData } from './GroupManagementModal';
import { COLOR_OPTIONS } from './CreateGroupView';
import { PROFILE_COLORS, ALL_AVATAR_ICONS } from '../../../profile/edit-profile/config/avatarOptions';

interface ManageGroupMembersProps {
  group: GroupMemberData;
  userId: string;
  onBack: () => void;
  onRefresh: () => void;
}

interface MemberProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  access_level: 'view-only' | 'reply-only' | 'full-access';
  profiles: MemberProfile;
}

const MemberAvatar = ({ profile }: { profile: MemberProfile }) => {
  const [imgError, setImgError] = useState(false);
  
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const initial = displayName.substring(0, 2).toUpperCase();

  const avatarUrl = profile?.avatar_url;
  let isSystemAvatar = false;
  let CustomIconComp: React.ElementType = User;
  let avatarBgClass = ''; 
  let avatarTextClass = 'text-indigo-600 dark:text-indigo-400 font-black';

  if (avatarUrl && avatarUrl.includes(':') && !avatarUrl.startsWith('http')) {
    isSystemAvatar = true;
    const [colorId, iconId] = avatarUrl.split(':');
    const colorObj = PROFILE_COLORS.find(c => c.id === colorId);
    if (colorObj) {
      avatarBgClass = colorObj.hex; 
      avatarTextClass = 'text-white';
    }
    const foundIcon = ALL_AVATAR_ICONS.find(i => i.id === iconId)?.icon;
    if (foundIcon) CustomIconComp = foundIcon;
  }

  const isExternalImage = avatarUrl && avatarUrl.startsWith('http') && !imgError;

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white dark:border-slate-800 transition-colors ${avatarBgClass || 'bg-indigo-100 dark:bg-indigo-900/50'} ${avatarTextClass}`}>
      {isExternalImage ? (
        <Image src={avatarUrl as string} alt={displayName} width={40} height={40} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : isSystemAvatar ? (
        <CustomIconComp size={20} strokeWidth={2.5} />
      ) : (
        <span className="text-sm font-black select-none">{initial}</span>
      )}
    </div>
  );
};

export const ManageGroupMembers = ({ group, userId, onBack, onRefresh }: ManageGroupMembersProps) => {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Danger Actions State
  const [confirmAction, setConfirmAction] = useState<{type: 'leave' | 'kick', payload?: string} | null>(null);
  const [deleteCommentsFlag, setDeleteCommentsFlag] = useState(false);
  
  const isOwner = group.role === 'owner';
  const isAdmin = group.role === 'admin' || isOwner;
  const groupData = (Array.isArray(group.groups) ? group.groups[0] : group.groups) as GroupData;

  const SelectedColor = COLOR_OPTIONS.find(o => o.id === groupData.color_theme) || COLOR_OPTIONS[0];

  useEffect(() => {
    const fetchMembers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Two-Step Fetch: Get members first to bypass ambiguous schema join errors
        const { data: membersData, error: membersError } = await supabase
          .from('group_members')
          .select('id, user_id, role, access_level')
          .eq('group_id', groupData.id);

        if (membersError) throw membersError;

        if (!membersData || membersData.length === 0) {
          setMembers([]);
          setIsLoading(false);
          return;
        }

        // 2. Fetch corresponding profiles using the extracted user IDs
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // 3. Map the data together in memory securely
        const profileMap = new Map();
        profilesData?.forEach(p => profileMap.set(p.id, p));

        const formatted = membersData.map(m => {
          const prof = profileMap.get(m.user_id) || { username: 'Unknown', display_name: 'Unknown User', avatar_url: null };
          return {
            id: m.id,
            user_id: m.user_id,
            role: m.role as 'owner' | 'admin' | 'member',
            access_level: m.access_level as 'view-only' | 'reply-only' | 'full-access',
            profiles: prof
          };
        });

        // 4. Sort: owner > admin > member
        const sorted = formatted.sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (b.role === 'admin' && a.role !== 'admin') return 1;
          return 0;
        });
        
        setMembers(sorted);
      } catch (err: unknown) {
        console.error("Failed to load members:", err);
        let errMsg = "Failed to load members.";
        if (err instanceof Error) {
          errMsg = err.message;
        } else if (typeof err === 'object' && err !== null) {
          const dbErr = err as Record<string, unknown>;
          errMsg = (dbErr.message as string) || (dbErr.details as string) || JSON.stringify(err);
          if (dbErr.hint) errMsg += ` (Hint: ${dbErr.hint as string})`;
        } else if (typeof err === 'string') {
          errMsg = err;
        }
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [groupData.id]);

  const updateMember = async (memberId: string, updates: Partial<MemberRow>) => {
    setUpdatingId(memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...updates } : m));
    
    const { error } = await supabase.from('group_members').update(updates).eq('id', memberId);
    if (error) {
      console.error("Failed to update member:", error);
      onRefresh(); 
    }
    setUpdatingId(null);
  };

  const executeDangerAction = async () => {
    setIsLoading(true); setError(null);
    try {
      const groupId = groupData.id;
      if (confirmAction?.type === 'leave') {
        if (isOwner) {
          const successor = members.find(m => m.user_id !== userId);
          if (successor) {
            await supabase.from('groups').update({ owner_id: successor.user_id }).eq('id', groupId);
            await supabase.from('group_members').update({ role: 'owner' }).eq('group_id', groupId).eq('user_id', successor.user_id);
          } else {
            await supabase.from('groups').delete().eq('id', groupId);
            onRefresh(); onBack(); return;
          }
        }
        if (deleteCommentsFlag) {
          await supabase.from('comments').delete().eq('group_id', groupId).eq('user_id', userId);
        }
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
        onRefresh(); onBack();
      } 
      else if (confirmAction?.type === 'kick' && confirmAction.payload) {
        const targetId = confirmAction.payload;
        if (deleteCommentsFlag) await supabase.from('comments').delete().eq('group_id', groupId).eq('user_id', targetId);
        await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId);
        setMembers(prev => prev.filter(m => m.user_id !== targetId));
      }
      setConfirmAction(null);
      setDeleteCommentsFlag(false);
    } catch (err: unknown) { 
      setError(err instanceof Error ? err.message : String(err)); 
    } finally { setIsLoading(false); }
  };

  const getRoleBadge = (accessLevel: 'view-only' | 'reply-only' | 'full-access') => {
    switch(accessLevel) {
      case 'view-only': return { icon: Eye, label: 'View Only' };
      case 'reply-only': return { icon: MessageCircle, label: 'Reply Only' };
      default: return { icon: MessageSquare, label: 'Full Access' };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide animate-in slide-in-from-left-2 duration-300">
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 shadow-sm flex items-start gap-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> 
          <p className="leading-snug">{error}</p>
        </div>
      )}

      {confirmAction ? (
        <div className="p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-2xl space-y-4 animate-in zoom-in-95 duration-200 shadow-sm mb-6">
          <div className="flex gap-3 text-red-600 dark:text-red-400">
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-bold">{confirmAction.type === 'leave' ? 'Leave Group?' : 'Remove Member?'}</p>
              <p className="text-[11px] opacity-80 mt-1">This will remove access to shared commentary.</p>
            </div>
          </div>
          <div className="bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={deleteCommentsFlag} 
                onChange={(e) => setDeleteCommentsFlag(e.target.checked)} 
                title="Delete comments flag"
                aria-label="Delete comments flag"
                className="mt-1 w-4 h-4 border-red-200 rounded text-red-600 focus:ring-red-500" 
              />
              <span className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                {confirmAction.type === 'leave' ? 'Delete all my insights and replies in this group permanently.' : 'Delete all insights and replies authored by this member in this group.'}
              </span>
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={executeDangerAction} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
              Confirm
            </button>
            <button onClick={() => setConfirmAction(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Users size={14} /> Group Members ({members.length})
            </h4>
          </div>

          {isLoading ? (
            <div className="py-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" size={24}/></div>
          ) : (
            <div className="space-y-3">
              {members.length === 0 && !error && (
                <div className="text-center py-6 text-slate-400 italic text-sm">
                  Members are hidden or none exist.
                </div>
              )}
              {members.map(member => {
                const isMe = member.user_id === userId;
                const isTargetOwner = member.role === 'owner';
                const canEditThisMember = isAdmin && !isTargetOwner && !isMe;
                const Badge = getRoleBadge(member.access_level);
                
                // Safely extract names without crashing if fields are missing
                const safeName = member.profiles?.display_name || member.profiles?.username || '?';

                return (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <MemberAvatar profile={member.profiles} />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {safeName}
                          {isMe && <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-[9px] rounded-md uppercase tracking-wider">You</span>}
                          {isTargetOwner && <Shield size={12} className={SelectedColor.text} />}
                        </p>
                        <p className="text-xs text-slate-500">@{member.profiles?.username || 'unknown'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isTargetOwner ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                          <Crown size={14} /> Owner
                        </span>
                      ) : canEditThisMember ? (
                        <div className="flex items-center gap-2">
                          {updatingId === member.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                          <div className="relative">
                            <Settings2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <select 
                              value={member.access_level}
                              onChange={(e) => updateMember(member.id, { access_level: e.target.value as 'view-only' | 'reply-only' | 'full-access' })}
                              title="Change member access level"
                              aria-label="Change member access level"
                              className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-lg pl-7 pr-8 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                            >
                              <option value="full-access">Full Access</option>
                              <option value="reply-only">Reply Only</option>
                              <option value="view-only">View Only</option>
                            </select>
                          </div>
                          <button 
                            onClick={() => setConfirmAction({ type: 'kick', payload: member.user_id })} 
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove Member"
                          >
                            <UserMinus size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700">
                          <Badge.icon size={14} /> {Badge.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-8">
            <button 
              onClick={() => setConfirmAction({ type: 'leave' })} 
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <LogOut size={16} /> Leave Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
};