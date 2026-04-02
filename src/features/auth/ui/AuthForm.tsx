// Path: src/features/auth/ui/AuthForm.tsx
import React, { useState } from 'react';
import { supabase } from '../../../shared/api/supabase';
import { Mail, Lock, User, AtSign, Loader2, AlertCircle, CheckCircle2, Users, Plus, ArrowLeft, Hash } from 'lucide-react';

type OnboardingStep = 'none' | 'choose' | 'join' | 'create' | 'done';

export const AuthForm = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // Login State
  const [identifier, setIdentifier] = useState(''); 
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up State
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('none');
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [onboardingInput, setOnboardingInput] = useState(''); // Reused for invite code OR group name

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // --- SIGN UP LOGIC ---
        if (!displayName.trim()) throw new Error("Display name is required.");
        if (signupPassword !== confirmPassword) throw new Error("Passwords do not match.");
        if (signupPassword.length < 6) throw new Error("Password must be at least 6 characters.");
        if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new Error("Username can only contain letters, numbers, and underscores.");

        const cleanUsername = username.toLowerCase();

        const { data, error } = await supabase.auth.signUp({
          email,
          password: signupPassword,
          options: {
            data: {
              username: cleanUsername,
              display_name: displayName.trim()
            }
          }
        });

        if (error) throw error;
        
        // Fallback: Manually upsert profile to guarantee the row is created with the exact schema mapping
        if (data?.user) {
          await supabase.from('profiles').upsert({ 
            id: data.user.id,
            username: cleanUsername,
            display_name: displayName.trim()
          }, { onConflict: 'id' });
          
          setNewUserId(data.user.id);
        }

        // Transition to Onboarding instead of just clearing the form
        setOnboardingStep('choose');

      } else {
        // --- SIGN IN LOGIC ---
        if (!identifier || !loginPassword) throw new Error("Please enter your credentials.");
        
        let loginEmail = identifier;
        
        if (!identifier.includes('@')) {
          const { data, error: rpcError } = await supabase.rpc('get_email_by_username', { 
            p_username: identifier.toLowerCase() 
          });
          
          if (rpcError || !data) {
            throw new Error("Invalid username or password.");
          }
          loginEmail = data;
        }

        const { error } = await supabase.auth.signInWithPassword({ 
          email: loginEmail, 
          password: loginPassword 
        });

        if (error) throw error;
      }
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId || !onboardingInput.trim()) return;
    
    setLoading(true);
    setMessage(null);

    try {
      if (onboardingStep === 'join') {
        const { data: group, error: fetchErr } = await supabase
          .from('groups')
          .select('id')
          .ilike('invite_code', onboardingInput.trim())
          .single();

        if (fetchErr || !group) throw new Error("Invalid invite code. Please check and try again.");

        const { error: joinErr } = await supabase.from('group_members').insert({
          group_id: group.id,
          user_id: newUserId,
          role: 'member'
        });

        if (joinErr) {
          if (joinErr.code === '23505') throw new Error("You are already a member of this group.");
          throw joinErr;
        }

      } else if (onboardingStep === 'create') {
        const { data: group, error: createErr } = await supabase
          .from('groups')
          .insert({
            name: onboardingInput.trim(),
            owner_id: newUserId,
            visibility: 'invite-only',
            icon_url: 'book',
            color_theme: 'indigo',
            invite_code: generateInviteCode()
          })
          .select('id')
          .single();

        if (createErr || !group) throw new Error("Failed to create group. Please try again.");

        const { error: joinErr } = await supabase.from('group_members').insert({
          group_id: group.id,
          user_id: newUserId,
          role: 'owner'
        });

        if (joinErr) throw joinErr;
      }

      setOnboardingStep('done');
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: ONBOARDING FLOW
  // ---------------------------------------------------------------------------
  if (onboardingStep !== 'none') {
    return (
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative">
        {onboardingStep === 'choose' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mb-2 shadow-inner">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Account Created!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 px-4">
                Welcome to TorahBuilder. To get the most out of your study, we recommend joining or creating a community.
              </p>
            </div>
            
            <div className="space-y-3 pt-4 text-left">
              <button 
                onClick={() => { setOnboardingStep('join'); setOnboardingInput(''); setMessage(null); }} 
                className="w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Join a Group</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">I have an invite code</p>
                </div>
              </button>

              <button 
                onClick={() => { setOnboardingStep('create'); setOnboardingInput(''); setMessage(null); }} 
                className="w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Create a Group</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Start a new study community</p>
                </div>
              </button>
            </div>

            <button onClick={() => setOnboardingStep('done')} className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-4 transition-colors">
              Skip for now
            </button>
          </div>
        )}

        {(onboardingStep === 'join' || onboardingStep === 'create') && (
          <div className="animate-in slide-in-from-right-8 duration-300">
            <button 
              onClick={() => { setOnboardingStep('choose'); setMessage(null); }} 
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
            
            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {onboardingStep === 'join' ? 'Join Group' : 'Create Group'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {onboardingStep === 'join' 
                  ? 'Enter the 6-character invite code provided by your group admin.' 
                  : 'Give your new study community a name.'}
              </p>
            </div>
            
            <form onSubmit={handleOnboardingAction} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  {onboardingStep === 'join' ? <Hash size={18} /> : <Users size={18} />}
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={onboardingStep === 'join' ? 6 : 50}
                  value={onboardingInput}
                  onChange={(e) => setOnboardingInput(onboardingStep === 'join' ? e.target.value.toUpperCase() : e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-bold"
                  placeholder={onboardingStep === 'join' ? "e.g. A1B2C3" : "e.g. Genesis Study Group"}
                />
              </div>
              
              {message && (
                <div className="p-3 rounded-xl text-xs font-medium flex items-start gap-2 border bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <p>{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !onboardingInput.trim()}
                className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {onboardingStep === 'done' && (
          <div className="text-center space-y-6 animate-in zoom-in-95 duration-300 py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mb-2 shadow-inner">
              <Mail size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Check your email</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 px-4 leading-relaxed">
                You&apos;re all set! We&apos;ve sent a verification link to <br/><span className="font-bold text-slate-700 dark:text-slate-200">{email}</span>.<br/><br/>Please verify your email to log in and start reading.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: STANDARD AUTH FLOW
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 mb-4">
          <User size={24} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {isSignUp ? 'Create an account' : 'Welcome back'}
        </h2>
        <p className="text-sm text-slate-500 mt-2 font-medium">
          {isSignUp ? 'Join the community of Tanakh commentators' : 'Sign in to continue your reading journey'}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        
        {isSignUp ? (
          // --- SIGN UP FIELDS ---
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="How others see you"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <AtSign size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="Unique username"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        ) : (
          // --- SIGN IN FIELDS ---
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email or Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="Email or Username"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        )}

        {message && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${
            message.type === 'error' 
              ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20 dark:text-rose-400' 
              : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/20 dark:text-emerald-400'
          }`}>
            {message.type === 'error' ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
            <p>{message.text}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : (isSignUp ? 'Create Account' : 'Sign In')}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage(null);
          }}
          className="text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
};