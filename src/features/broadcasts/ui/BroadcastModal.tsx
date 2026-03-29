// Filepath: src/features/broadcasts/ui/BroadcastModal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, BarChart3, Info, Send } from 'lucide-react';
import { supabase } from '@/shared/api/supabase';

interface Broadcast {
  id: string;
  type: 'donation' | 'poll' | 'announcement';
  title: string;
  content: string;
  poll_options?: string[];
  allow_custom_responses: boolean;
  frequency: 'once' | 'daily' | 'weekly';
  target_audience: 'all' | 'new' | 'returning';
}

export const BroadcastModal = () => {
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [pollValue, setPollValue] = useState('');
  const [customResponse, setCustomResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logInteraction = useCallback(async (broadcastId: string, type: 'impression' | 'click' | 'response', value?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('broadcast_responses').insert({
      broadcast_id: broadcastId,
      user_id: user.id,
      interaction_type: type,
      response_value: value
    });
  }, []);

  const checkActiveBroadcasts = useCallback(async (isMounted: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isMounted) return;

    // 1. Global Throttle: Ensure user sees at most 1 broadcast per 24 hours across all campaigns
    const { data: globalInteractions } = await supabase
      .from('broadcast_responses')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('interaction_type', 'impression')
      .order('created_at', { ascending: false })
      .limit(1);

    if (globalInteractions && globalInteractions.length > 0) {
      const lastGlobalSeen = new Date(globalInteractions[0].created_at).getTime();
      const msSinceLastBroadcast = new Date().getTime() - lastGlobalSeen;
      
      // If any broadcast was seen less than 24 hours ago, exit early
      if (msSinceLastBroadcast < 86400000) {
        return;
      }
    }

    // 2. Fetch the user's profile to determine if they are "new" or "returning"
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .single();

    const isNewUser = profile ? (new Date().getTime() - new Date(profile.created_at).getTime()) < 86400000 : false; // < 24h

    // 3. Fetch active broadcasts
    const { data: broadcasts } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!broadcasts || broadcasts.length === 0) return;

    for (const broadcast of broadcasts) {
      if (!isMounted) break;

      // 4. Filter by Audience
      if (broadcast.target_audience === 'new' && !isNewUser) continue;
      if (broadcast.target_audience === 'returning' && isNewUser) continue;

      // 5. Filter by specific Broadcast Frequency (re-check for safety)
      const { data: interactions } = await supabase
        .from('broadcast_responses')
        .select('created_at')
        .eq('broadcast_id', broadcast.id)
        .eq('user_id', user.id)
        .eq('interaction_type', 'impression')
        .order('created_at', { ascending: false });

      let shouldShow = false;
      const lastSeenThisBroadcast = interactions && interactions.length > 0 ? new Date(interactions[0].created_at).getTime() : null;

      if (!lastSeenThisBroadcast) {
        shouldShow = true;
      } else if (broadcast.frequency === 'daily') {
        shouldShow = (new Date().getTime() - lastSeenThisBroadcast) > 86400000;
      } else if (broadcast.frequency === 'weekly') {
        shouldShow = (new Date().getTime() - lastSeenThisBroadcast) > 604800000;
      }

      if (shouldShow && isMounted) {
        setActiveBroadcast(broadcast);
        setIsVisible(true);
        // Log the impression now that we've decided to show it
        logInteraction(broadcast.id, 'impression');
        break; // Only show one modal at a time
      }
    }
  }, [logInteraction]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) checkActiveBroadcasts(isMounted);
    });
    return () => { isMounted = false; };
  }, [checkActiveBroadcasts]);

  const handleSubmit = async () => {
    if (!activeBroadcast) return;
    setIsSubmitting(true);
    const finalValue = pollValue === 'other' ? customResponse : pollValue;
    await logInteraction(activeBroadcast.id, 'response', finalValue);
    setIsSubmitting(false);
    setIsVisible(false);
  };

  const handleDonateClick = () => {
    if (!activeBroadcast) return;
    logInteraction(activeBroadcast.id, 'click');
    window.open('https://paypal.me/austin@jenisan.com', '_blank');
    setIsVisible(false);
  };

  if (!isVisible || !activeBroadcast) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border border-gray-100">
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close modal"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="mb-6 flex justify-center">
            <div className={`p-4 rounded-2xl ${
              activeBroadcast.type === 'poll' ? 'bg-teal-50 text-teal-600' : 
              activeBroadcast.type === 'donation' ? 'bg-blue-50 text-blue-600' : 
              'bg-violet-50 text-violet-600'
            }`}>
              {activeBroadcast.type === 'poll' && <BarChart3 className="w-8 h-8" />}
              {activeBroadcast.type === 'donation' && <DollarSign className="w-8 h-8" />}
              {activeBroadcast.type === 'announcement' && <Info className="w-8 h-8" />}
            </div>
          </div>

          <div className="text-center space-y-3 mb-8">
            <h2 className="text-2xl font-black text-gray-900 leading-tight">{activeBroadcast.title}</h2>
            <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
              {activeBroadcast.content}
            </div>
          </div>

          <div className="space-y-4">
            {activeBroadcast.type === 'donation' && (
              <button 
                onClick={handleDonateClick}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                Support the Project
                <DollarSign className="w-4 h-4" />
              </button>
            )}

            {activeBroadcast.type === 'poll' && (
              <div className="space-y-2">
                {activeBroadcast.poll_options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPollValue(option)}
                    className={`w-full p-4 rounded-xl border-2 text-left font-semibold transition-all ${
                      pollValue === option ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 hover:border-gray-200 text-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
                
                {activeBroadcast.allow_custom_responses && (
                  <div className="space-y-2">
                    <button
                      onClick={() => setPollValue('other')}
                      className={`w-full p-4 rounded-xl border-2 text-left font-semibold transition-all ${
                        pollValue === 'other' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 hover:border-gray-200 text-gray-700'
                      }`}
                    >
                      Other Response...
                    </button>
                    {pollValue === 'other' && (
                      <textarea
                        value={customResponse}
                        onChange={(e) => setCustomResponse(e.target.value)}
                        placeholder="Type your response here..."
                        className="w-full p-4 rounded-xl border-2 border-teal-200 outline-none focus:ring-2 focus:ring-teal-500 animate-in slide-in-from-top-2 duration-200"
                        rows={3}
                        title="Custom Response"
                      />
                    )}
                  </div>
                )}

                <button 
                  disabled={!pollValue || isSubmitting}
                  onClick={handleSubmit}
                  className="w-full mt-4 py-4 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Response'}
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeBroadcast.type === 'announcement' && (
              <button 
                onClick={() => setIsVisible(false)}
                className="w-full py-4 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-all"
              >
                Got it, thanks!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};