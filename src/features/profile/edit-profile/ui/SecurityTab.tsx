// Path: src/features/profile/edit-profile/ui/SecurityTab.tsx
import React, { useState } from 'react';
import { Loader2, AlertCircle, Check, Mail, Key, ChevronRight, Shield } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

export const SecurityTab = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateSecurity = async (type: 'email' | 'password') => {
    setSaving(true); setError(null); setSuccessMsg(null);
    try {
      const updateData: { email?: string; password?: string } = {};
      
      if (type === 'email') {
        if (!newEmail.includes('@')) throw new Error("Please enter a valid email address.");
        updateData.email = newEmail;
      } else {
        if (!oldPassword) throw new Error("Please enter your current password.");
        if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
        if (newPassword !== confirmPassword) throw new Error("New passwords do not match.");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) throw new Error("Active session not found.");
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: oldPassword,
        });

        if (signInError) throw new Error("Incorrect current password.");
        updateData.password = newPassword;
      }

      const { error: updateError } = await supabase.auth.updateUser(updateData);
      if (updateError) throw updateError;

      setSuccessMsg(type === 'email' ? 'Security update initiated. Check your email.' : 'Password updated successfully.');
      if (type === 'email') setNewEmail('');
      else { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in">
      {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2"><AlertCircle size={14} /><p>{error}</p></div>}
      {successMsg && <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl border border-emerald-100 flex items-start gap-2"><Check size={14} /><p>{successMsg}</p></div>}

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Mail size={14} />
          <h3 className="text-[10px] font-bold uppercase tracking-widest">Change Email</h3>
        </div>
        <div className="flex gap-2">
          <label htmlFor="new-email-input" className="sr-only">New Email Address</label>
          <input
            id="new-email-input"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@email.com"
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={() => handleUpdateSecurity('email')}
            disabled={saving || !newEmail}
            title="Update Email Address"
            aria-label="Update Email Address"
            className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed italic">Verification links will be sent to your old and new email addresses.</p>
      </section>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Key size={14} />
          <h3 className="text-[10px] font-bold uppercase tracking-widest">Update Password</h3>
        </div>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Current password"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={() => handleUpdateSecurity('password')}
            disabled={saving || !oldPassword || !newPassword || !confirmPassword}
            className="mt-1 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl py-3 text-sm font-bold hover:opacity-90 disabled:opacity-30 flex justify-center items-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Update Password'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">Ensure your new password is at least 6 characters long for security.</p>
      </section>

      <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
        <Shield size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium">
          DrashX uses end-to-end authentication powered by Supabase. We never store your passwords in plain text.
        </p>
      </div>
    </div>
  );
};