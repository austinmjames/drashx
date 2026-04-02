// Path: src/features/groups/manage-groups/ui/JoinGroupView.tsx
"use client";

import React, { useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface JoinGroupViewProps {
  userId: string;
  onSuccess: (groupId: string) => void;
}

export const JoinGroupView = ({ userId, onSuccess }: JoinGroupViewProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inviteParam = searchParams.get('invite');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pre-fill the invite code if it exists in the URL
  const [joinCode, setJoinCode] = useState(inviteParam || '');

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch the group AND its default access level
      const { data: group, error: fErr } = await supabase
        .from('groups')
        .select('id, default_access_level')
        .eq('invite_code', joinCode.toUpperCase())
        .single();
        
      if (fErr || !group) throw new Error("Invalid or expired invite code.");

      // 2. Insert member and explicitly apply the inherited access level
      const { error: jErr } = await supabase.from('group_members').insert({ 
        group_id: group.id, 
        user_id: userId, 
        role: 'member',
        access_level: group.default_access_level || 'full-access'
      });
      
      if (jErr) {
        if (jErr.code === '23505') throw new Error("You are already a member of this group.");
        throw jErr;
      }

      // Clear the invite param from URL so the modal doesn't re-open indefinitely
      if (inviteParam) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('invite');
        router.replace(`${pathname}?${newParams.toString()}`);
      }

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

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // Smart Parsing: If a user pastes the full URL, extract just the code
    if (val.includes('drashx.com/')) {
      val = val.split('drashx.com/')[1] || val;
    } else if (val.includes('/')) {
      val = val.split('/').pop() || val;
    }
    
    // Strip any lingering query params
    if (val.includes('?')) {
      val = val.split('?')[0];
    }
    
    setJoinCode(val.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
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
        <p className="text-xs text-slate-500">Enter the unique code or paste the URL below.</p>
      </div>

      <form onSubmit={handleJoinByCode} className="space-y-8 max-w-sm mx-auto">
        <input 
          aria-label="Invite code"
          value={joinCode}
          onChange={handleCodeChange}
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