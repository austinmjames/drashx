// Path: src/features/profile/edit-profile/ui/ProfileSettings.tsx
import React, { useState, useEffect, useRef } from 'react';
import { User, Loader2, Check, AlertCircle, X, AtSign, Shield, Mail, Key, ChevronRight, Palette, BarChart3 } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { PROFILE_COLORS, PROFILE_ICONS, HEBREW_ICONS, ALL_AVATAR_ICONS } from '../config/avatarOptions';

interface ProfileSettingsProps {
  userId: string;
  onClose: () => void;
}

type SettingsTab = 'profile' | 'security' | 'stats';

export const ProfileSettings = ({ userId, onClose }: ProfileSettingsProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Profile Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Avatar Selection State
  const [avatarMode, setAvatarMode] = useState<'icon' | 'url'>('icon');
  const [legacyUrl, setLegacyUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [selectedIcon, setSelectedIcon] = useState('user');
  
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Security Form State
  const [newEmail, setNewEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Close avatar menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    if (isAvatarMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarMenuOpen]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;
        
        if (data) {
          setUsername(data.username || '');
          setDisplayName(data.display_name || '');
          
          // Parse avatar_url (Handles legacy image URLs OR our new 'color:icon' format)
          if (data.avatar_url) {
            if (data.avatar_url.startsWith('http')) {
              setAvatarMode('url');
              setLegacyUrl(data.avatar_url);
            } else {
              const [color, icon] = data.avatar_url.split(':');
              if (color) setSelectedColor(color);
              if (icon) setSelectedIcon(icon);
              setAvatarMode('icon');
            }
          }
        }
      } catch (err: unknown) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile details.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (username.length > 0 && !/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error("Username can only contain letters, numbers, and underscores.");
      }

      // Format the avatar string. If they modified the icon, it overrides legacy URLs.
      const finalAvatarUrl = avatarMode === 'icon' ? `${selectedColor}:${selectedIcon}` : legacyUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase() || null,
          display_name: displayName,
          avatar_url: finalAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        if (updateError.message.includes('unique constraint')) {
          throw new Error("This username is already taken.");
        }
        throw updateError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSecurity = async (type: 'email' | 'password') => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: { email?: string; password?: string } = {};
      
      if (type === 'email') {
        if (!newEmail.includes('@')) throw new Error("Please enter a valid email address.");
        updateData.email = newEmail;
      } else {
        if (!oldPassword) throw new Error("Please enter your current password.");
        if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
        if (newPassword !== confirmPassword) throw new Error("New passwords do not match.");

        // Verify the old password by attempting to sign in
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

      setSuccess(true);
      if (type === 'email') {
        setNewEmail('');
      } else {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-2xl">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-slate-400 font-medium">Loading profile...</p>
      </div>
    );
  }

  // Resolve Active Branding
  const ActiveColorObj = PROFILE_COLORS.find(c => c.id === selectedColor) || PROFILE_COLORS[0];
  const ActiveIconComp = ALL_AVATAR_ICONS.find(i => i.id === selectedIcon)?.icon || User;

  return (
    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Account Settings</h2>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Manage your presence</p>
        </div>
        <button 
          onClick={onClose} 
          title="Close Settings"
          aria-label="Close Settings"
          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-slate-100 dark:border-slate-800 gap-6">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Profile
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Security
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'stats' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Stats
        </button>
      </div>

      <div className="p-8 max-h-[75vh] overflow-y-auto scrollbar-hide relative">
        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
            <Check size={14} className="mt-0.5 shrink-0" />
            <p>{activeTab === 'profile' ? 'Profile updated successfully.' : 'Security update initiated. Check your email if applicable.'}</p>
          </div>
        )}

        {activeTab === 'stats' ? (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 rounded-full flex items-center justify-center shadow-sm">
              <BarChart3 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reading Stats</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Coming soon</p>
            </div>
          </div>
        ) : activeTab === 'profile' ? (
          <form onSubmit={handleSaveProfile} className="space-y-8 animate-in fade-in">
            
            {/* Custom Avatar Selector Section */}
            <div className="flex flex-col items-center gap-4 relative" ref={avatarMenuRef}>
              <div className="relative group">
                <div className={`w-24 h-24 rounded-full border-4 border-white dark:border-slate-900 shadow-md overflow-hidden flex items-center justify-center text-white transition-colors duration-300 ${avatarMode === 'icon' ? ActiveColorObj.hex : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {avatarMode === 'url' && legacyUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={legacyUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <ActiveIconComp size={44} strokeWidth={2.5} />
                  )}
                </div>
                
                <button 
                  type="button"
                  onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                  title="Customize Avatar"
                  aria-label="Customize Avatar"
                  className={`absolute bottom-0 right-0 p-2.5 rounded-full text-white shadow-lg transition-all ${isAvatarMenuOpen ? 'bg-slate-900 dark:bg-white dark:text-slate-900 scale-110' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                >
                  <Palette size={16} />
                </button>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                Customize Avatar
              </p>

              {/* Mega Dropdown for Avatar Customization */}
              {isAvatarMenuOpen && (
                <div className="absolute top-28 z-50 w-85 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
                  <div className="max-h-80 overflow-y-auto scrollbar-hide">
                    {/* Colors Row */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Theme Color</p>
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                        {PROFILE_COLORS.map(color => (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => { setSelectedColor(color.id); setAvatarMode('icon'); }}
                            className={`w-6 h-6 shrink-0 rounded-full transition-transform ${color.hex} ${color.hover} ${selectedColor === color.id && avatarMode === 'icon' ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-950 scale-110' : 'opacity-80 hover:opacity-100'}`}
                            title={color.id}
                            aria-label={`Select ${color.id} color`}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Hebrew Icons Grid */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Hebrew Letters</p>
                      <div className="grid grid-cols-6 gap-2">
                        {HEBREW_ICONS.map(iconOpt => {
                          const isSelected = selectedIcon === iconOpt.id && avatarMode === 'icon';
                          return (
                            <button
                              key={iconOpt.id}
                              type="button"
                              onClick={() => { setSelectedIcon(iconOpt.id); setAvatarMode('icon'); }}
                              title={iconOpt.id}
                              aria-label={`Select ${iconOpt.id} icon`}
                              className={`aspect-square flex items-center justify-center rounded-xl transition-all ${
                                isSelected 
                                  ? `${ActiveColorObj.hex} text-white shadow-md scale-105` 
                                  : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <iconOpt.icon size={20} strokeWidth={isSelected ? 2.5 : 2} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* General Icons Grid */}
                    <div className="p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Symbols</p>
                      <div className="grid grid-cols-6 gap-2">
                        {PROFILE_ICONS.map(iconOpt => {
                          const isSelected = selectedIcon === iconOpt.id && avatarMode === 'icon';
                          return (
                            <button
                              key={iconOpt.id}
                              type="button"
                              onClick={() => { setSelectedIcon(iconOpt.id); setAvatarMode('icon'); }}
                              title={iconOpt.id}
                              aria-label={`Select ${iconOpt.id} icon`}
                              className={`aspect-square flex items-center justify-center rounded-xl transition-all ${
                                isSelected 
                                  ? `${ActiveColorObj.hex} text-white shadow-md scale-105` 
                                  : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <iconOpt.icon size={20} strokeWidth={isSelected ? 2.5 : 2} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="username-input" className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1">
                  <AtSign size={10} /> Unique Username
                </label>
                <input
                  id="username-input"
                  title="Unique Username"
                  aria-label="Unique Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="display-name-input" className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                  Display Name
                </label>
                <input
                  id="display-name-input"
                  title="Display Name"
                  aria-label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Adam Cohn"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
            </button>
          </form>
        ) : (
          <div className="space-y-10 animate-in fade-in">
            {/* Change Email Section */}
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
                  title="New Email Address"
                  aria-label="New Email Address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  onClick={() => handleUpdateSecurity('email')}
                  title="Update Email"
                  aria-label="Update Email"
                  disabled={saving || !newEmail}
                  className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">Verification links will be sent to your old and new email addresses.</p>
            </section>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            {/* Change Password Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Key size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">Update Password</h3>
              </div>
              
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="old-password-input" className="sr-only">Current Password</label>
                  <input
                    id="old-password-input"
                    type="password"
                    title="Current Password"
                    aria-label="Current Password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-password-input" className="sr-only">New Password</label>
                  <input
                    id="new-password-input"
                    type="password"
                    title="New Password"
                    aria-label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password-input" className="sr-only">Confirm New Password</label>
                  <input
                    id="confirm-password-input"
                    type="password"
                    title="Confirm New Password"
                    aria-label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button 
                  onClick={() => handleUpdateSecurity('password')}
                  title="Update Password"
                  aria-label="Update Password"
                  disabled={saving || !oldPassword || !newPassword || !confirmPassword}
                  className="mt-1 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl py-3 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-30 flex justify-center items-center gap-2"
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
        )}
      </div>
    </div>
  );
};