// Path: src/features/groups/manage-groups/ui/JoinGroupView.tsx
import React, { useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

interface JoinGroupViewProps {
  userId: string;
  onSuccess: (groupId: string) => void;
}

export const JoinGroupView = ({ userId, onSuccess }: JoinGroupViewProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: group, error: fErr } = await supabase.from('groups').select('id').eq('invite_code', joinCode.toUpperCase()).single();
      if (fErr || !group) throw new Error("Invalid or expired invite code.");

      const { error: jErr } = await supabase.from('group_members').insert({ group_id: group.id, user_id: userId, role: 'member' });
      if (jErr) throw new Error("You are already a member of this group.");

      onSuccess(group.id);
    } catch (err: unknown) { 
      if (err instanceof Error) {
        setError(err.message); 
      } else {
        setError(String(err));
      }
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="py-6 animate-in fade-in duration-300">
      {error && (
        <div className="mb-8 p-3 max-w-sm mx-auto bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" /> <p>{error}</p>
        </div>
      )}

      <div className="text-center space-y-1 mb-8">
        <h3 className="text-base font-medium text-slate-900 dark:text-white">Have an invite code?</h3>
        <p className="text-xs text-slate-500">Enter the unique code below.</p>
      </div>

      <form onSubmit={handleJoinByCode} className="space-y-8 max-w-sm mx-auto">
        <input 
          aria-label="Invite code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
          placeholder="ENTER-CODE"
          className="w-full bg-transparent border-b border-slate-200 py-3 text-center text-3xl font-mono tracking-[0.5em] outline-none focus:border-slate-900 dark:focus:border-white transition-colors uppercase"
        />
        <button 
          type="submit"
          disabled={isLoading || joinCode.length < 3}
          className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-50 text-sm font-medium py-3.5 rounded-xl transition-all flex items-center justify-center shadow-sm"
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Join Group"}
        </button>
      </form>
    </div>
  );
};