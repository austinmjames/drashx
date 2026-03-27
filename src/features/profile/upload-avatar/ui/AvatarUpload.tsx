import React, { useState } from 'react';
import Image from 'next/image';
import { Upload, Loader2, User, ImageIcon, Palette, Check } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';
import styles from './AvatarUpload.module.css';

/**
 * AvatarUpload Feature
 * Path: src/features/profile/upload-avatar/ui/AvatarUpload.tsx
 * * Handles uploading custom images OR generating preset SVG avatars
 * and saving them to the Supabase 'avatars' storage bucket.
 * * Now dynamically includes the user's first initial as a preset option.
 * * Refactored to use an external CSS module instead of inline styles.
 */
interface AvatarUploadProps {
  uid: string;
  url: string | null;
  username?: string;
  displayName?: string;
  onUpload: (url: string) => void;
}

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#10b981', 
  '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899', 
  '#a855f7', '#8b5cf6', '#64748b', '#78716c', '#0f172a'
];

const PRESET_ICONS = [
  '🕊️', '🦁', '🌿', '🍇', '🌟', '👑', '📜', '🏔️', 
  '⛺', '🔥', '💧', '☀️', '🌙', '🏺', '🍞'
];

export const AvatarUpload = ({ uid, url, username, displayName, onUpload }: AvatarUploadProps) => {
  // Extract the first initial from the display name or username
  const initial = (displayName || username || 'U').charAt(0).toUpperCase();
  const availableIcons = [initial, ...PRESET_ICONS];

  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(url);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'upload' | 'preset'>('preset');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(availableIcons[0]);

  // Core upload logic that accepts either a File or a generated Blob
  const uploadAndSave = async (fileOrBlob: Blob, ext: string) => {
    try {
      setUploading(true);
      setErrorMsg(null);

      // Randomize filename to bypass aggressive browser caching on avatar updates
      const fileName = `${uid}-${Math.random().toString(36).substring(2)}.${ext}`;
      const filePath = `${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileOrBlob, { 
          upsert: true,
          contentType: ext === 'svg' ? 'image/svg+xml' : undefined 
        });

      if (uploadError) throw uploadError;

      // 2. Get the public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newAvatarUrl = data.publicUrl;

      // 3. Update the Profile table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', uid);

      if (updateError) throw updateError;

      // 4. Update local state and trigger parent callback
      setAvatarUrl(newAvatarUrl);
      onUpload(newAvatarUrl);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error saving avatar.';
      setErrorMsg(message);
    } finally {
      setUploading(false);
    }
  };

  // Handler for traditional file uploads
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop() || 'png';
    await uploadAndSave(file, fileExt);
  };

  // Handler for generating and saving the preset SVG
  const handleSavePreset = async () => {
    // Note: The fill="#ffffff" and font styling only affect standard text (like initials). 
    // Emojis will retain their native colors across most operating systems.
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100%" height="100%" fill="${selectedColor}" />
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="50" font-family="system-ui, sans-serif" font-weight="bold" fill="#ffffff">${selectedIcon}</text>
      </svg>
    `.trim();

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    await uploadAndSave(blob, 'svg');
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Current Avatar Display */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-md flex items-center justify-center">
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          ) : avatarUrl ? (
            <Image src={avatarUrl} alt="User avatar" fill className="object-cover" />
          ) : (
            <User className="w-10 h-10 text-slate-400" />
          )}
        </div>
        {errorMsg && (
          <p className="text-xs font-medium text-rose-500 max-w-62.5 text-center bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Editor Controls */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
        
        {/* Tabs */}
        <div className="flex bg-slate-200 dark:bg-slate-900/50 p-1 rounded-lg mb-4">
          <button
            onClick={() => setActiveTab('preset')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'preset' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Palette size={14} /> Design
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'upload' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ImageIcon size={14} /> Upload
          </button>
        </div>

        {/* Preset Builder */}
        {activeTab === 'preset' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Live Preview */}
            <div className="flex items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
              <div 
                className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold font-sans shadow-inner transition-colors duration-300 ${styles.previewTextWhite} ${styles[`presetBg${PRESET_COLORS.indexOf(selectedColor)}`]}`}
              >
                {selectedIcon}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Background</label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((color, idx) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-full aspect-square rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none ${styles[`presetBg${idx}`]}`}
                  >
                    {selectedColor === color && <Check size={14} className="text-white drop-shadow-md" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Symbol</label>
              <div className="grid grid-cols-5 gap-2">
                {availableIcons.map((icon, idx) => (
                  <button
                    key={`${icon}-${idx}`}
                    onClick={() => setSelectedIcon(icon)}
                    className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${
                      selectedIcon === icon 
                        ? 'bg-slate-200 dark:bg-slate-700 shadow-sm scale-105' 
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                    } ${icon === initial ? 'text-xl font-bold font-sans text-slate-700 dark:text-slate-200' : 'text-xl'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSavePreset}
              disabled={uploading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Preset Avatar
            </button>
          </div>
        )}

        {/* Custom Upload */}
        {activeTab === 'upload' && (
          <div className="py-8 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">Click to upload</span></p>
                <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG or GIF (MAX. 2MB)</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        )}

      </div>
    </div>
  );
};