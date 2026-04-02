// Path: src/features/groups/manage-groups/ui/GroupManagementModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowLeft, Loader2, Settings, Book } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { CreateGroupView, ICON_OPTIONS, COLOR_OPTIONS } from './CreateGroupView';
import { JoinGroupView } from './JoinGroupView';
import { DiscoverGroupsView } from './DiscoverGroupsView';
import { ManageGroupView } from './ManageGroupView';
import { useSearchParams } from 'next/navigation';

interface GroupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onGroupsChange?: () => void; 
  onGroupCreated?: (groupId: string) => void; 
}

export interface GroupData {
  id: string;
  name: string;
  description?: string;
  visibility: 'open' | 'unlisted' | 'invite-only';
  default_access_level?: 'view-only' | 'reply-only' | 'full-access';
  tags?: string[];
  invite_code?: string;
  owner_id: string;
  icon_url?: string;
  color_theme?: string;
}

export interface GroupMemberData {
  role: 'owner' | 'admin' | 'member';
  access_level?: 'view-only' | 'reply-only' | 'full-access';
  groups: GroupData;
}

type ModalMode = 'create' | 'join' | 'discover' | 'manage';

export const GroupManagementModal = ({ 
  isOpen, 
  onClose, 
  userId, 
  onGroupsChange,
  onGroupCreated 
}: GroupManagementModalProps) => {
  const searchParams = useSearchParams();
  const inviteParam = searchParams.get('invite');
  
  // Default to the join tab if an invite code is present in the URL
  const [mode, setMode] = useState<ModalMode>(inviteParam ? 'join' : 'manage');
  
  const [managingGroup, setManagingGroup] = useState<GroupMemberData | null>(null);
  const [myGroups, setMyGroups] = useState<GroupMemberData[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  /**
   * Fetches groups where the current user is a member.
   */
  const fetchMyGroups = useCallback(async () => {
    if (!userId) return;
    setIsLoadingGroups(true);
    
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, access_level, groups(*)')
        .eq('user_id', userId);
        
      if (error) throw error;
      
      const formattedData = (data as unknown as GroupMemberData[]) || [];
      setMyGroups(formattedData);
      
      // Update the main Reader UI
      if (onGroupsChange) onGroupsChange();
    } catch (err) {
      console.error("Error fetching groups:", err);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [userId, onGroupsChange]);

  // Sync data when modal opens or shifts to manage mode
  useEffect(() => {
    if (isOpen) {
      fetchMyGroups();
    }
  }, [isOpen, fetchMyGroups]);

  const handleSuccess = (groupId: string) => {
    fetchMyGroups(); 
    if (onGroupCreated) onGroupCreated(groupId);
    onClose();
  };

  /**
   * Handles the UI transition back to the group list.
   */
  const handleReturnFromManage = () => {
    setManagingGroup(null);
    fetchMyGroups(); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-slate-50 dark:border-slate-900">
          {!managingGroup ? (
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Communities</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collaborative Learning</p>
            </div>
          ) : (
            <button 
              onClick={handleReturnFromManage} 
              title="Return to group list" 
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <button 
            onClick={onClose} 
            title="Close modal"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {managingGroup ? (
          <ManageGroupView 
            group={managingGroup} 
            userId={userId} 
            onBack={handleReturnFromManage}
            onRefresh={fetchMyGroups}
          />
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 gap-8 bg-slate-50/30">
              {(['create', 'join', 'discover', 'manage'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  title={`Switch to ${m} view`}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
                    mode === m ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Modal Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide">
              {mode === 'create' && <CreateGroupView userId={userId} onSuccess={handleSuccess} />}
              {mode === 'join' && <JoinGroupView userId={userId} onSuccess={handleSuccess} />}
              {mode === 'discover' && <DiscoverGroupsView userId={userId} onSuccess={handleSuccess} />}
              {mode === 'manage' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {isLoadingGroups ? (
                    <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
                      <Loader2 className="animate-spin text-indigo-500" size={24} />
                      <p className="text-xs font-bold uppercase tracking-widest">Syncing groups...</p>
                    </div>
                  ) : myGroups.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto text-slate-200">
                        <Book size={32}/>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-400">You aren&rsquo;t in any groups yet.</p>
                        <button onClick={() => setMode('discover')} title="Discover communities" className="text-xs text-indigo-600 font-bold hover:underline mt-1">Discover communities</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {myGroups.map(mg => {
                        const isHovered = hoveredGroupId === mg.groups.id;
                        const GroupIcon = ICON_OPTIONS.find(o => o.id === mg.groups.icon_url)?.icon || Book;
                        const ThemeColor = COLOR_OPTIONS.find(o => o.id === mg.groups.color_theme) || COLOR_OPTIONS[0];

                        return (
                          <button 
                            key={mg.groups.id} 
                            onClick={() => setManagingGroup(mg)} 
                            onMouseEnter={() => setHoveredGroupId(mg.groups.id)}
                            onMouseLeave={() => setHoveredGroupId(null)}
                            title={`Manage ${mg.groups.name}`}
                            className={`p-4 rounded-2xl transition-all cursor-pointer border flex items-center justify-between text-left w-full ${
                              isHovered 
                                ? 'bg-white dark:bg-slate-900 shadow-xl border-slate-200 dark:border-slate-800 -translate-y-0.5' 
                                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-all ${ThemeColor.hex}`}>
                                <GroupIcon size={20} />
                              </div>
                              <div>
                                <h4 className={`font-black text-sm transition-colors ${isHovered ? ThemeColor.text : 'text-slate-900 dark:text-white'}`}>
                                  {mg.groups.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                  {mg.role} {mg.access_level && mg.access_level !== 'full-access' && `• ${mg.access_level.replace('-', ' ')}`}
                                </p>
                              </div>
                            </div>
                            <Settings className={`text-slate-300 transition-all ${isHovered ? 'rotate-90 text-indigo-500' : 'opacity-0'}`} size={16} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};