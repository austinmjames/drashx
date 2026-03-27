// Path: src/widgets/insights-panel/ui/InsightsPanel.tsx
"use client";

import React, { useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { 
  Plus, MessageSquarePlus, Bell, ArrowLeft, X, Mail
} from 'lucide-react';

import { GroupSelector } from '../../group-selector/ui/GroupSelector';
import { AddCommentForm } from '../../../features/comments/add-comment/ui/AddCommentForm';
import { CommentThread } from '../../comment-threads/ui/CommentThread';
import { Verse } from '../../../entities/verse/ui/VerseCard';

// Internal Components (FSD Sub-modules)
import { InsightsChat } from './InsightsChat';
import { InsightsActivity } from './InsightsActivity';

const getBookAbbreviation = (name: string): string => {
  const map: Record<string, string> = {
    'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
    'Joshua': 'Jos', 'Judges': 'Jud', 'I Samuel': '1 Sam', 'II Samuel': '2 Sam', 'I Kings': '1 Kin', 'II Kings': '2 Kin',
    'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Ezekiel': 'Eze', 'Hosea': 'Hos', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Oba',
    'Jonah': 'Jon', 'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zep', 'Haggai': 'Hag', 'Zechariah': 'Zec', 'Malachi': 'Mal',
    'Psalms': 'Psa', 'Proverbs': 'Pro', 'Job': 'Job', 'Song of Songs': 'Song', 'Ruth': 'Rut', 'Lamentations': 'Lam',
    'Ecclesiastes': 'Ecc', 'Esther': 'Est', 'Daniel': 'Dan', 'Ezra': 'Ezr', 'Nehemiah': 'Neh', 'I Chronicles': '1 Chr', 'II Chronicles': '2 Chr'
  };
  return map[name] || name.slice(0, 3);
};

export type ViewMode = 'thread' | 'notifications' | 'chat';

interface InsightsPanelProps {
  user: SupabaseUser | null;
  activeBook: string;
  activeChapter: number;
  selectedVerse: Verse | null;
  isLoading: boolean;
  onSelectVerse?: (verse: Verse) => void;
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  myGroups: { id: string, name: string }[];
  setIsManageGroupsOpen: (isOpen: boolean) => void;
  setShowAuth: (show: boolean) => void;
  onCloseMobile?: () => void;
}

export const InsightsPanel = (props: InsightsPanelProps) => {
  const {
    user, activeBook, activeChapter, selectedVerse, isLoading, onSelectVerse,
    activeGroupId, setActiveGroupId, myGroups, onCloseMobile, setShowAuth, setIsManageGroupsOpen
  } = props;

  const [viewMode, setViewMode] = useState<ViewMode>('thread');
  const [isAddingInsight, setIsAddingInsight] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);

  const activeVerseId = selectedVerse?.verse_id || selectedVerse?.id;
  const isPersonal = activeGroupId === user?.id;
  const currentGroupName = isPersonal ? "Personal" : myGroups.find(g => g.id === activeGroupId)?.name || "Select Group";

  return (
    <section className="w-full md:w-112.5 flex-none bg-slate-50 dark:bg-slate-950/40 flex flex-col relative overflow-hidden md:border-l border-slate-200 dark:border-slate-800 pointer-events-auto h-full">
      
      {/* Header Navigation */}
      <header className="flex-none px-4 md:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {viewMode !== 'thread' && (
            <button 
              onClick={() => setViewMode('thread')} 
              title="Back to insights"
              className="p-1 -ml-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          
          {selectedVerse && viewMode === 'thread' ? (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 whitespace-nowrap">
              {getBookAbbreviation(decodeURIComponent(activeBook))} {activeChapter}:{selectedVerse.verse_number || selectedVerse.verse_num}
            </h3>
          ) : (
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {viewMode === 'chat' ? 'Messages' : viewMode === 'notifications' ? 'Activity' : 'Insights'}
            </h3>
          )}

          {/* Integrated Context Selector Widget */}
          <div className="ml-2">
            <GroupSelector 
              activeGroupId={activeGroupId} 
              setActiveGroupId={setActiveGroupId} 
              myGroups={myGroups} 
              user={user} 
              onOpenManagement={() => setIsManageGroupsOpen(true)} 
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Group Messaging Toggle */}
          {activeGroupId && !isPersonal && (
            <button 
              onClick={() => {
                if (!user) return setShowAuth(true);
                setViewMode(viewMode === 'chat' ? 'thread' : 'chat');
              }}
              className={`p-2 rounded-full transition-all relative ${viewMode === 'chat' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Group Messages"
            >
              <Mail size={18} />
              {unreadMentions > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-indigo-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-bounce">
                  {unreadMentions}
                </span>
              )}
            </button>
          )}

          <button 
            onClick={() => {
              if (!user) return setShowAuth(true);
              setViewMode(viewMode === 'notifications' ? 'thread' : 'notifications');
            }}
            className={`p-2 rounded-full transition-all ${viewMode === 'notifications' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
            title="Activity"
          >
            <Bell size={18} />
          </button>

          {onCloseMobile && (
            <button 
              onClick={onCloseMobile} 
              title="Close Panel"
              className="md:hidden p-2 rounded-full text-slate-400 hover:bg-slate-200"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'chat' && activeGroupId ? (
          <InsightsChat 
            groupId={activeGroupId} 
            user={user} 
            groupName={currentGroupName}
            onMentionReceived={() => viewMode !== 'chat' && setUnreadMentions(prev => prev + 1)}
            onChatOpened={() => setUnreadMentions(0)}
          />
        ) : viewMode === 'notifications' && user ? (
          <InsightsActivity 
            user={user} 
            onSelectVerse={onSelectVerse} 
            setViewMode={setViewMode} 
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-2">
                {selectedVerse && activeVerseId !== undefined ? (
                  <CommentThread 
                    verseId={activeVerseId as string} 
                    groupId={activeGroupId || undefined} 
                    referenceLabel={`${getBookAbbreviation(decodeURIComponent(activeBook))} ${activeChapter}:${selectedVerse.verse_number || selectedVerse.verse_num}`}
                  />
                ) : !isLoading && (
                  <div className="h-full py-32 flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center opacity-40">
                    <MessageSquarePlus size={40} />
                    <p className="text-sm font-medium italic">Select a verse to view insights or open group messages.</p>
                  </div>
                )}
             </div>
             {selectedVerse && (
               <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50">
                 <button 
                  onClick={() => user ? setIsAddingInsight(true) : setShowAuth(true)} 
                  title="Add your commentary"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:border-indigo-300 shadow-sm active:scale-[0.98]"
                 >
                    <Plus size={14} className="text-indigo-500" /> Add Commentary
                 </button>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Global Form Overlays */}
      {selectedVerse && isAddingInsight && activeVerseId && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom-8 duration-300">
           <AddCommentForm 
             verseId={activeVerseId as string} 
             groupId={activeGroupId || undefined}
             onSuccess={() => setIsAddingInsight(false)} 
             onCancel={() => setIsAddingInsight(false)}
             fullHeight
             referenceLabel={`${getBookAbbreviation(decodeURIComponent(activeBook))} ${activeChapter}:${selectedVerse.verse_number || selectedVerse.verse_num}`}
           />
        </div>
      )}
    </section>
  );
};