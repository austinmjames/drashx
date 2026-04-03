// Path: src/features/profile/edit-profile/ui/ProfileTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Check, User, Palette, AtSign, BookOpen } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import { PROFILE_COLORS, PROFILE_ICONS, HEBREW_ICONS, ALL_AVATAR_ICONS } from '../config/avatarOptions';

interface ProfileTabProps {
  userId: string;
}

export const ProfileTab = ({ userId }: ProfileTabProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarMode, setAvatarMode] = useState<'icon' | 'url'>('icon');
  const [legacyUrl, setLegacyUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState('indigo');
  const [selectedIcon, setSelectedIcon] = useState('user');
  const [extendedLibraryEnabled, setExtendedLibraryEnabled] = useState(false);
  
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) setIsAvatarMenuOpen(false);
    };
    if (isAvatarMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarMenuOpen]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, extended_library_enabled')
          .eq('id', userId)
          .single();

        if (fetchError) throw fetchError;
        
        if (data) {
          setUsername(data.username || '');
          setDisplayName(data.display_name || '');
          setExtendedLibraryEnabled(data.extended_library_enabled || false);
          
          if (data.avatar_url) {
            if (data.avatar_url.startsWith('http')) {
              setAvatarMode('url'); setLegacyUrl(data.avatar_url);
            } else {
              const [color, icon] = data.avatar_url.split(':');
              if (color) setSelectedColor(color);
              if (icon) setSelectedIcon(icon);
              setAvatarMode('icon');
            }
          }
        }
      } catch (err) {
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
    setSaving(true); setError(null); setSuccess(false);

    try {
      if (username.length > 0 && !/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error("Username can only contain letters, numbers, and underscores.");
      }
      const finalAvatarUrl = avatarMode === 'icon' ? `${selectedColor}:${selectedIcon}` : legacyUrl;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase() || null,
          display_name: displayName,
          avatar_url: finalAvatarUrl,
          extended_library_enabled: extendedLibraryEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        if (updateError.message.includes('unique constraint')) throw new Error("This username is already taken.");
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

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  const ActiveColorObj = PROFILE_COLORS.find(c => c.id === selectedColor) || PROFILE_COLORS[0];
  const ActiveIconComp = ALL_AVATAR_ICONS.find(i => i.id === selectedIcon)?.icon || User;

  return (
    <form onSubmit={handleSaveProfile} className="space-y-8 animate-in fade-in">
      {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-start gap-2"><AlertCircle size={14} /><p>{error}</p></div>}
      {success && <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl border border-emerald-100 flex items-start gap-2"><Check size={14} /><p>Profile updated successfully.</p></div>}

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
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Customize Avatar</p>

        {isAvatarMenuOpen && (
          <div className="absolute top-28 z-50 w-85 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
            <div className="max-h-80 overflow-y-auto scrollbar-hide">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Theme Color</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                  {PROFILE_COLORS.map(color => (
                    <button
                      key={color.id} type="button" onClick={() => { setSelectedColor(color.id); setAvatarMode('icon'); }}
                      className={`w-6 h-6 shrink-0 rounded-full transition-transform ${color.hex} ${color.hover} ${selectedColor === color.id && avatarMode === 'icon' ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-950 scale-110' : 'opacity-80 hover:opacity-100'}`}
                      title={`Select ${color.id} color`}
                      aria-label={`Select ${color.id} color`}
                    />
                  ))}
                </div>
              </div>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Hebrew Letters</p>
                <div className="grid grid-cols-6 gap-2">
                  {HEBREW_ICONS.map(iconOpt => {
                    const isSelected = selectedIcon === iconOpt.id && avatarMode === 'icon';
                    return (
                      <button
                        key={iconOpt.id} type="button" onClick={() => { setSelectedIcon(iconOpt.id); setAvatarMode('icon'); }}
                        title={`Select ${iconOpt.id} icon`}
                        aria-label={`Select ${iconOpt.id} icon`}
                        className={`aspect-square flex items-center justify-center rounded-xl transition-all ${isSelected ? `${ActiveColorObj.hex} text-white shadow-md scale-105` : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100'}`}
                      ><iconOpt.icon size={20} strokeWidth={isSelected ? 2.5 : 2} /></button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Symbols</p>
                <div className="grid grid-cols-6 gap-2">
                  {PROFILE_ICONS.map(iconOpt => {
                    const isSelected = selectedIcon === iconOpt.id && avatarMode === 'icon';
                    return (
                      <button
                        key={iconOpt.id} type="button" onClick={() => { setSelectedIcon(iconOpt.id); setAvatarMode('icon'); }}
                        title={`Select ${iconOpt.id} icon`}
                        aria-label={`Select ${iconOpt.id} icon`}
                        className={`aspect-square flex items-center justify-center rounded-xl transition-all ${isSelected ? `${ActiveColorObj.hex} text-white shadow-md scale-105` : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100'}`}
                      ><iconOpt.icon size={20} strokeWidth={isSelected ? 2.5 : 2} /></button>
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
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1"><AtSign size={10} /> Unique Username</label>
          <input
            value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="username" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Display Name</label>
          <input
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Adam Cohn" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Study Preferences Section */}
      <div className="pt-2">
        <div className="space-y-1.5 mb-2">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1">
            <BookOpen size={10} /> Study Preferences
          </label>
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
          <div className="pr-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Extended Library</h4>
            <p className="text-xs text-slate-500 mt-0.5">Enable access to the Brit Chadashah (Gospels, Epistles, Revelation) across the platform.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Toggle Extended Library">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={extendedLibraryEnabled}
              onChange={(e) => setExtendedLibraryEnabled(e.target.checked)}
              aria-label="Toggle Extended Library"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer dark:bg-slate-900 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      <button type="submit" disabled={saving} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/20 disabled:opacity-50">
        {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
      </button>
    </form>
  );
};