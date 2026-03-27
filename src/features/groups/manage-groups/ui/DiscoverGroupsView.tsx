// Path: src/features/groups/manage-groups/ui/DiscoverGroupsView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Users, ChevronRight, Hash, Book } from 'lucide-react';
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

export const DiscoverGroupsView = () => {
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col animate-in fade-in duration-300 relative">
      {/* Sticky Header - top-[-1px] and extra padding-top 
          ensures no sub-pixel gaps allow content to bleed through.
      */}
      <div className="sticky -top-px z-30 bg-white dark:bg-slate-950 pt-2 pb-5 border-b border-transparent">
        {/* Header Row */}
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public Communities</p>
        </div>

        {/* Search Input Container */}
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
              const truncatedDesc = group.description && group.description.length > 160 
                ? `${group.description.substring(0, 160)}...` 
                : group.description;

              const GroupIcon = ICON_OPTIONS.find(o => o.id === group.icon_url)?.icon || Book;
              const ThemeColor = COLOR_OPTIONS.find(o => o.id === group.color_theme) || COLOR_OPTIONS[0];

              return (
                <div 
                  key={group.id} 
                  onMouseEnter={() => setHoveredGroupId(group.id)}
                  onMouseLeave={() => setHoveredGroupId(null)}
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