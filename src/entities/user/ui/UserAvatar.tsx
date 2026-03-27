import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { Profile } from '../model/types';

/**
 * UserAvatar Entity Component
 * Path: src/entities/user/ui/UserAvatar.tsx
 * * Updated to use Next.js Image component for optimization.
 */
interface UserAvatarProps {
  profile?: Profile;
  size?: 'sm' | 'md' | 'lg';
}

export const UserAvatar = ({ profile, size = 'md' }: UserAvatarProps) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-base'
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-600`}>
      {profile?.avatar_url ? (
        <Image 
          src={profile.avatar_url} 
          alt={profile.username || 'User avatar'} 
          fill 
          className="object-cover" 
        />
      ) : (
        <User className="text-slate-400" size={size === 'sm' ? 14 : 20} />
      )}
    </div>
  );
};