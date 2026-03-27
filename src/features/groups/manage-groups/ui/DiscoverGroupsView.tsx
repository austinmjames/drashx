// Path: src/features/groups/manage-groups/ui/DiscoverGroupsView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Users, ChevronRight, Hash, Book, ArrowLeft, Info, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { ICON_OPTIONS, COLOR_OPTIONS } from './CreateGroupView';

interface PublicGroup {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  icon_url?: string;
  color_theme?: string;
  group_members?: { count: number }[];
}

interface DiscoverGroupsViewProps {
  userId: string;
  onSuccess: (groupId: string) => void;
}

export const DiscoverGroupsView = ({ userId, onSuccess }: DiscoverGroupsViewProps) => {
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  
  // Selection State for Detail View
  const [selectedGroup, setSelectedGroup] = useState<PublicGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicGroups = async () => {
      const { data } = await supabase
        .from('groups')
        .select('*, group_members(count)')
        .eq('visibility', 'open')
        .limit(30);
        
      setPublicGroups((data as unknown as PublicGroup[]) || []);
      setIsLoading(false);
    };
    fetchPublicGroups();
  }, []);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return publicGroups;
    return publicGroups.filter(g => 
      g.name.toLowerCase().includes(q) || 
      g.description?.toLowerCase().includes(q) || 
      g.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [searchQuery, publicGroups]);

  const handleJoinGroup = async (group: PublicGroup) => {
    setIsJoining(true);
    setError(null);

    try {
      // 1. Check if user is already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        throw new Error("You are already a member of this community.");
      }

      // 2. Insert new membership
      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({ 
          group_id: group.id, 
          user_id: userId, 
          role: 'member' 
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

  // --- DETAIL VIEW RENDER ---
  if (selectedGroup) {
    const GroupIcon = ICON_OPTIONS.find(o => o.id === selectedGroup.icon_url)?.icon || Book;
    const ThemeColor = COLOR_OPTIONS.find(o => o.id === selectedGroup.color_theme) || COLOR_OPTIONS[0];

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
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                <Users size={10} />
                <span>{(selectedGroup.group_members?.[0]?.count || 1).toLocaleString()} Members</span>
              </div>
              <div className={`px-2 py-0.5 rounded-full ${ThemeColor.bg} ${ThemeColor.darkBg} ${ThemeColor.text} text-[10px] font-black uppercase tracking-tighter`}>
                Public Group
              </div>
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
            isJoining ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {isJoining ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {isJoining ? 'Joining...' : 'Join Community'}
        </button>
      </div>
    );
  }

  // --- LIST VIEW RENDER ---
  return (
    <div className="flex flex-col animate-in fade-in duration-300 relative">
      <div className="sticky -top-px z-30 bg-white dark:bg-slate-950 pt-2 pb-5 border-b border-transparent">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public Communities</p>
        </div>

        <div className="relative group px-1">
          <Search size={16} className={`absolute left-4 top-3 transition-colors z-10 ${searchQuery ? 'text-indigo-500' : 'text-slate-400'}`} />
          <input 
            aria-label="Search open groups"
            placeholder="Search communities..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:border-indigo-300 transition-all placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-950 shadow-sm" 
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
          <p className="text-xs font-medium">Scanning groups...</p>
        </div>
      ) : (
        <div className="space-y-3 pb-10 pt-2">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">No groups found.</p>
            </div>
          ) : (
            filteredGroups.map(group => {
              const isHovered = hoveredGroupId === group.id;
              const truncatedDesc = group.description && group.description.length > 120 
                ? `${group.description.substring(0, 120)}...` 
                : group.description;

              const GroupIcon = ICON_OPTIONS.find(o => o.id === group.icon_url)?.icon || Book;
              const ThemeColor = COLOR_OPTIONS.find(o => o.id === group.color_theme) || COLOR_OPTIONS[0];

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
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm ${ThemeColor.hex}`}>
                            <GroupIcon size={14} />
                          </div>
                          <h4 className={`font-black text-base transition-colors ${isHovered ? ThemeColor.text : 'text-slate-900 dark:text-white'}`}>
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
                    
                    <div className={`mt-2 transition-all ${isHovered ? 'translate-x-1 opacity-100' : 'opacity-0'}`}>
                      <ChevronRight size={20} className={ThemeColor.text} />
                    </div>
                  </div>
                  
                  <div className={`absolute -right-4 -bottom-6 opacity-[0.03] transition-opacity duration-500 ${isHovered ? 'opacity-[0.08]' : ''} ${ThemeColor.text}`}>
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