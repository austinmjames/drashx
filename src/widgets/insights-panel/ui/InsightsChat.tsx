// Path: src/widgets/insights-panel/ui/InsightsChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Mail, Send, Loader2, AtSign } from 'lucide-react';
import { supabase } from '../../../shared/api/supabase';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  has_mention?: boolean;
}

interface InsightsChatProps {
  groupId: string;
  user: SupabaseUser | null;
  groupName: string;
  onMentionReceived: () => void;
  onChatOpened: () => void;
}

export const InsightsChat = ({ groupId, user, groupName, onMentionReceived, onChatOpened }: InsightsChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    
    // Notify parent on open without triggering immediate render cycle
    const timer = setTimeout(() => onChatOpened(), 0);

    const fetchMessages = async () => {
      if (!supabase || !groupId) return;
      const { data } = await supabase
        .from('group_messages')
        .select('*, profiles:user_id(username, display_name, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (isMounted) {
        if (data) setMessages(data as unknown as Message[]);
        setIsLoading(false);
      }
    };

    fetchMessages();
    
    const channel = supabase?.channel(`chat-${groupId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'group_messages', 
        filter: `group_id=eq.${groupId}` 
      }, (payload) => {
        if (payload.new.has_mention) onMentionReceived();
        fetchMessages();
      })
      .subscribe();

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [groupId, onMentionReceived, onChatOpened]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !user || !supabase) return;
    
    setIsSending(true);
    const hasMention = newMessage.includes('@everyone') || newMessage.includes('@here') || newMessage.includes('@');
    
    const { error } = await supabase.from('group_messages').insert({
      content: newMessage,
      group_id: groupId,
      user_id: user.id,
      has_mention: hasMention
    });

    if (!error) {
      setNewMessage('');
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
        <p className="text-xs font-bold uppercase tracking-widest">Loading Messages...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 animate-in slide-in-from-top-4 duration-300 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-10 gap-3">
            <Mail size={40} className="opacity-10" />
            <p className="text-sm font-medium italic">Start a conversation with {groupName}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.user_id === user?.id ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[10px] font-bold text-slate-400">{msg.profiles.display_name || msg.profiles.username}</span>
                <span className="text-[9px] text-slate-300">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.user_id === user?.id 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
      
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="relative flex items-center">
          <input 
            aria-label={`Message ${groupName}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${groupName}...`}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
          <button 
            type="submit"
            title="Send Message"
            disabled={!newMessage.trim() || isSending}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-md shadow-indigo-600/20"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 px-1">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
            <AtSign size={10} /> Use @here or @everyone to alert the group
          </p>
        </div>
      </form>
    </div>
  );
};