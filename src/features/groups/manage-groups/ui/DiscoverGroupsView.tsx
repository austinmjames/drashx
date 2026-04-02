// Path: src/features/groups/manage-groups/ui/DiscoverGroupsView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Users, ChevronRight, Hash, Book, ArrowLeft, Info, CheckCircle2, Eye, MessageCircle, MessageSquare } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { ICON_OPTIONS, COLOR_OPTIONS } from './CreateGroupView';

interface PublicGroup {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  icon_url?: string;
  color_theme?: string;
  default_access_level?: 'view-only' | 'reply-only' | 'full-access';
  group_members?: { count: number }[];
}

interface DiscoverGroupsViewProps {
  userId: string;
  onSuccess: (groupId: string) => void;
}

type AccessFilter = 'all' | 'full' | 'limited';

export const DiscoverGroupsView = ({ userId, onSuccess }: DiscoverGroupsViewProps) => {
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  
  // Selection State for Detail View
  const [selectedGroup, setSelectedGroup] = useState<PublicGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all open groups and the user's current memberships concurrently
        const [groupsResponse, membersResponse] = await Promise.all([
          supabase
            .from('groups')
            .select('*, group_members(count)')
            .eq('visibility', 'open')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId)
        ]);

        if (groupsResponse.error) throw groupsResponse.error;

        setPublicGroups((groupsResponse.data as unknown as PublicGroup[]) || []);
        
        if (membersResponse.data) {
          setJoinedGroupIds(new Set(membersResponse.data.map(m => m.group_id)));
        }
      } catch (err) {
        console.error("Error fetching discover data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [userId]);

  const filteredGroups = useMemo(() => {
    let result = publicGroups;

    // Apply Access Level Filter
    if (accessFilter === 'full') {
      result = result.filter(g => !g.default_access_level || g.default_access_level === 'full-access');
    } else if (accessFilter === 'limited') {
      result = result.filter(g => g.default_access_level === 'view-only' || g.default_access_level === 'reply-only');
    }

    // Apply Text Search Filter
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(g => 
        g.name.toLowerCase().includes(q) || 
        g.description?.toLowerCase().includes(q) || 
        g.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [searchQuery, accessFilter, publicGroups]);

  const handleJoinGroup = async (group: PublicGroup) => {
    setIsJoining(true);
    setError(null);

    try {
      // Safety check: if already joined (state-wise), just open it
      if (joinedGroupIds.has(group.id)) {
        onSuccess(group.id);
        return;
      }

      // 1. Check if user is already a member (DB source of truth)
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        // Update local state to reflect membership and open it
        setJoinedGroupIds(prev => new Set(prev).add(group.id));
        onSuccess(group.id);
        return;
      }

      // 2. Insert new membership, inheriting the group's default access level
      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({ 
          group_id: group.id, 
          user_id: userId, 
          role: 'member',
          access_level: group.default_access_level || 'full-access'
        });

      if (joinErr) throw joinErr;

      // 3. Callback to parent (closes modal/refreshes state)
      onSuccess(group.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsJoining(false);
    }
  };

  const getRoleBadge = (accessLevel?: 'view-only' | 'reply-only' | 'full-access') => {
    switch(accessLevel) {
      case 'view-only': return { icon: Eye, label: 'View Only', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' };
      case 'reply-only': return { icon: MessageCircle, label: 'Reply Only', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50' };
      default: return { icon: MessageSquare, label: 'Full Access', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50' };
    }
  };

  // --- DETAIL VIEW RENDER ---
  if (selectedGroup) {
    const GroupIcon = ICON_OPTIONS.find(o => o.id === selectedGroup.icon_url)?.icon || Book;
    const ThemeColor = COLOR_OPTIONS.find(o => o.id === selectedGroup.color_theme) || COLOR_OPTIONS[0];
    const isAlreadyMember = joinedGroupIds.has(selectedGroup.id);
    const RoleBadge = getRoleBadge(selectedGroup.default_access_level);

    return (
      <div className="animate-in slide-in-from-right-4 duration-300">
        <button 
          onClick={() => setSelectedGroup(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Discover
        </button>

        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-xl ${ThemeColor.hex} rotate-3`}>
            <GroupIcon size={40} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{selectedGroup.name}</h3>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                <Users size={10} />
                <span>{(selectedGroup.group_members?.[0]?.count || 1).toLocaleString()} Members</span>
              </div>
              <div className={`px-2 py-0.5 rounded-full ${ThemeColor.bg} ${ThemeColor.darkBg} ${ThemeColor.text} text-[10px] font-black uppercase tracking-tighter`}>
                Public Group
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-tighter ${RoleBadge.cls}`}>
                <RoleBadge.icon size={10} /> {RoleBadge.label}
              </div>
              {isAlreadyMember && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 uppercase tracking-tighter">
                  <CheckCircle2 size={10} /> Joined
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 mb-8">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">About this community</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {selectedGroup.description || "No description provided for this community."}
            </p>
          </div>

          {selectedGroup.tags && selectedGroup.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedGroup.tags.map(t => (
                <span key={t} className={`px-2 py-1 ${ThemeColor.bg} ${ThemeColor.darkBg} ${ThemeColor.text} rounded-lg text-[10px] font-bold border ${ThemeColor.border}`}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100 flex items-center gap-2">
            <Info size={14} /> {error}
          </div>
        )}

        <button
          onClick={() => handleJoinGroup(selectedGroup)}
          disabled={isJoining}
          className={`w-full py-4 rounded-2xl text-white font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 ${
            isJoining 
              ? 'bg-slate-400' 
              : isAlreadyMember 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 active:scale-[0.98]'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 active:scale-[0.98]'
          }`}
        >
          {isJoining ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {isJoining ? 'Processing...' : isAlreadyMember ? 'Open Community' : 'Join Community'}
        </button>
      </div>
    );
  }

  // --- LIST VIEW RENDER ---
  return (
    <div className="flex flex-col animate-in fade-in duration-300 relative">
      <div className="sticky -top-px z-30 bg-white dark:bg-slate-950 pt-2 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
        <div className="relative group">
          <Search size={16} className={`absolute left-4 top-3 transition-colors z-10 ${searchQuery ? 'text-indigo-500' : 'text-slate-400'}`} />
          <input 
            aria-label="Search open groups"
            placeholder="Search communities..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-indigo-300 transition-all placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 shadow-sm" 
          />
        </div>

        {/* Access Level Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {(['all', 'full', 'limited'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setAccessFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                accessFilter === filter 
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {filter === 'all' ? 'All Groups' : filter === 'full' ? 'Full Access' : 'Limited Access'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
          <p className="text-xs font-medium">Scanning groups...</p>
        </div>
      ) : (
        <div className="space-y-3 pb-10 pt-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-slate-400 text-sm">No groups found.</p>
            </div>
          ) : (
            filteredGroups.map(group => {
              const isHovered = hoveredGroupId === group.id;
              const isAlreadyMember = joinedGroupIds.has(group.id);
              const truncatedDesc = group.description && group.description.length > 120 
                ? `${group.description.substring(0, 120)}...` 
                : group.description;

              const GroupIcon = ICON_OPTIONS.find(o => o.id === group.icon_url)?.icon || Book;
              const ThemeColor = COLOR_OPTIONS.find(o => o.id === group.color_theme) || COLOR_OPTIONS[0];
              const RoleBadge = getRoleBadge(group.default_access_level);

              return (
                <div 
                  key={group.id} 
                  onMouseEnter={() => setHoveredGroupId(group.id)}
                  onMouseLeave={() => setHoveredGroupId(null)}
                  onClick={() => setSelectedGroup(group)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                    isHovered 
                      ? 'bg-white dark:bg-slate-800 shadow-xl border-slate-200 dark:border-slate-700 -translate-y-0.5' 
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center mb-2 gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm ${ThemeColor.hex}`}>
                            <GroupIcon size={14} />
                          </div>
                          <h4 className={`font-black text-base transition-colors mr-2 ${isHovered ? ThemeColor.text : 'text-slate-900 dark:text-white'}`}>
                            {group.name}
                          </h4>
                        </div>
                        
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border transition-all ${
                          isHovered 
                            ? `${ThemeColor.bg} ${ThemeColor.text} ${ThemeColor.border} ${ThemeColor.darkBg}` 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent'
                        }`}>
                           <Users size={10} />
                           <span>{(group.group_members?.[0]?.count || 1).toLocaleString()}</span>
                        </div>

                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${RoleBadge.cls} ${!isHovered ? 'opacity-60' : ''}`}>
                          <RoleBadge.icon size={10} /> {RoleBadge.label}
                        </div>

                        {isAlreadyMember && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[9px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 uppercase tracking-tighter">
                            <CheckCircle2 size={10} /> Joined
                          </div>
                        )}
                      </div>
                      
                      {group.description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{truncatedDesc}</p>}

                      <div className="flex flex-wrap gap-2">
                        {group.tags?.map((t: string) => (
                          <span key={t} className={`flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest ${ThemeColor.text} ${ThemeColor.bg} ${ThemeColor.darkBg} px-2 py-1 rounded-lg`}>
                            <Hash size={9} />{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className={`mt-2 transition-all shrink-0 ${isHovered ? 'translate-x-1 opacity-100' : 'opacity-0'}`}>
                      <ChevronRight size={20} className={ThemeColor.text} />
                    </div>
                  </div>
                  
                  <div className={`absolute -right-4 -bottom-6 opacity-[0.03] transition-opacity duration-500 pointer-events-none ${isHovered ? 'opacity-[0.08]' : ''} ${ThemeColor.text}`}>
                    <GroupIcon size={112} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};