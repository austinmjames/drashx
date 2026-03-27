import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

/**
 * LikeButton Feature with Optimistic Updates
 * Path: src/features/comments/like-comment/ui/LikeButton.tsx
 * * Fixed import path to reach shared/api/supabase.
 */
interface LikeButtonProps {
  commentId: string;
  initialLikes: number;
  initialHasLiked: boolean;
}

export const LikeButton = ({ commentId, initialLikes, initialHasLiked }: LikeButtonProps) => {
  const [likes, setLikes] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleLike = async () => {
    if (isProcessing) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // OPTIMISTIC UPDATE
    const prevLikes = likes;
    const prevHasLiked = hasLiked;
    
    setLikes(prevHasLiked ? prevLikes - 1 : prevLikes + 1);
    setHasLiked(!prevHasLiked);
    setIsProcessing(true);

    if (prevHasLiked) {
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .match({ user_id: user.id, comment_id: commentId });
      
      if (error) {
        setLikes(prevLikes);
        setHasLiked(prevHasLiked);
      }
    } else {
      // Like
      const { error } = await supabase
        .from('likes')
        .insert([{ user_id: user.id, comment_id: commentId }]);
      
      if (error) {
        setLikes(prevLikes);
        setHasLiked(prevHasLiked);
      }
    }
    
    setIsProcessing(false);
  };

  return (
    <button 
      onClick={toggleLike}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${
        hasLiked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
      }`}
    >
      <Heart size={14} fill={hasLiked ? 'currentColor' : 'none'} />
      {likes}
    </button>
  );
};