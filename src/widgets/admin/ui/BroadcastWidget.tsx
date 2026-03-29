// Filepath: src/widgets/admin/ui/BroadcastWidget.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Megaphone, 
  DollarSign, 
  BarChart3, 
  Plus,
  Clock,
  Info,
  FileText,
  Loader2
} from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { supabase } from '@/shared/api/supabase';

// --- Types ---

interface BroadcastHistoryItem {
  id: string;
  type: 'donation' | 'poll' | 'announcement';
  title: string;
  target_audience: 'all' | 'new' | 'returning';
  is_active: boolean;
  created_at: string;
  expires_at: string;
  // Aggregated Stats
  impressions: number;
  clicks: number;
  responses: { label: string; count: number }[];
}

// --- Component ---

export const BroadcastWidget = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  
  // Form State
  const [broadcastType, setBroadcastType] = useState<'donation' | 'poll' | 'announcement'>('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [duration, setDuration] = useState('30');
  const [frequency, setFrequency] = useState('once');
  const [targetAudience, setTargetAudience] = useState<'all' | 'new' | 'returning'>('all');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [allowCustom, setAllowCustom] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: broadcasts, error: bErr } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (bErr) throw bErr;

      const historyWithStats = await Promise.all((broadcasts || []).map(async (b) => {
        const { data: resp, error: rErr } = await supabase
          .from('broadcast_responses')
          .select('interaction_type, response_value')
          .eq('broadcast_id', b.id);

        if (rErr) throw rErr;

        const impressions = resp.filter(r => r.interaction_type === 'impression').length;
        const clicks = resp.filter(r => r.interaction_type === 'click').length;
        
        const responseMap: Record<string, number> = {};
        resp.filter(r => r.interaction_type === 'response').forEach(r => {
          if (r.response_value) {
            responseMap[r.response_value] = (responseMap[r.response_value] || 0) + 1;
          }
        });

        const formattedResponses = Object.entries(responseMap).map(([label, count]) => ({
          label,
          count
        })).sort((a, b) => b.count - a.count);

        return {
          ...b,
          impressions,
          clicks,
          responses: formattedResponses
        } as BroadcastHistoryItem;
      }));

      setHistory(historyWithStats);
    } catch (err) {
      console.error("Failed to fetch broadcast history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDeploy = async () => {
    if (!title || !content) return;
    setIsDeploying(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(duration));

      const { error } = await supabase.from('broadcasts').insert({
        type: broadcastType,
        title,
        content,
        target_audience: targetAudience,
        duration_days: parseInt(duration),
        frequency,
        poll_options: broadcastType === 'poll' ? pollOptions.filter(o => o.trim() !== '') : [],
        allow_custom_responses: allowCustom,
        expires_at: expiresAt.toISOString(),
        is_active: true
      });

      if (error) throw error;

      setTitle('');
      setContent('');
      setPollOptions(['', '']);
      fetchHistory();
    } catch (err) {
      console.error("Failed to deploy broadcast:", err);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Card className="mb-8">
      <div className="p-5 border-b border-gray-100 bg-blue-50/20">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-blue-600" />
          Broadcast Center
        </h3>
        <p className="text-xs text-gray-500 mt-1">Deploy global modals, polls, and announcements.</p>
      </div>

      <div className="p-6 space-y-8">
        <section className="bg-gray-50 rounded-xl p-5 border border-gray-100">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Create New Broadcast
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setBroadcastType('announcement')} className={`flex flex-col items-center p-2 rounded-lg border transition-all ${broadcastType === 'announcement' ? 'bg-white border-violet-500 text-violet-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <Info className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold uppercase">Update</span>
                  </button>
                  <button onClick={() => setBroadcastType('donation')} className={`flex flex-col items-center p-2 rounded-lg border transition-all ${broadcastType === 'donation' ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <DollarSign className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold uppercase">Donate</span>
                  </button>
                  <button onClick={() => setBroadcastType('poll')} className={`flex flex-col items-center p-2 rounded-lg border transition-all ${broadcastType === 'poll' ? 'bg-white border-teal-500 text-teal-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <BarChart3 className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold uppercase">Poll</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target</label>
                  <select 
                    value={targetAudience} 
                    title="Audience" 
                    onChange={(e) => setTargetAudience(e.target.value as 'all' | 'new' | 'returning')} 
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none"
                  >
                    <option value="all">All</option>
                    <option value="new">New</option>
                    <option value="returning">Returning</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Duration</label>
                  <select value={duration} title="Days" onChange={(e) => setDuration(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none">
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Frequency</label>
                <select 
                  value={frequency} 
                  title="Broadcast Frequency" 
                  onChange={(e) => setFrequency(e.target.value)} 
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none"
                >
                  <option value="once">Once Total</option>
                  <option value="daily">Once Per Day</option>
                  <option value="weekly">Once Per Week</option>
                  {/* "Every X Sessions" removed per request */}
                </select>
              </div>

              <input 
                type="text" 
                placeholder="Title..." 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <textarea 
                placeholder="Message content..." 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                rows={3}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-4">
              {broadcastType === 'poll' ? (
                <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 h-full flex flex-col">
                  <p className="text-xs font-bold text-teal-800 uppercase mb-3">Options</p>
                  <div className="space-y-2 mb-4 grow">
                    {pollOptions.map((opt, i) => (
                      <input 
                        key={i}
                        type="text"
                        placeholder={`Option ${i+1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...pollOptions];
                          newOpts[i] = e.target.value;
                          setPollOptions(newOpts);
                        }}
                        className="w-full p-2 text-xs border border-teal-200 rounded-lg outline-none"
                      />
                    ))}
                    <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-[10px] font-bold text-teal-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                    <div className="flex items-center gap-2 mt-4">
                      <input type="checkbox" id="allow-custom" checked={allowCustom} onChange={(e) => setAllowCustom(e.target.checked)} />
                      <label htmlFor="allow-custom" className="text-[10px] font-bold text-gray-500 uppercase">Allow Custom</label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100/50 p-4 rounded-xl border border-gray-200 h-full flex items-center justify-center text-center">
                  <p className="text-xs text-gray-400 italic">No additional config needed for {broadcastType}.</p>
                </div>
              )}
              
              <button 
                disabled={isDeploying || !title || !content}
                onClick={handleDeploy}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Blast Broadcast
              </button>
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Recent Broadcast Performance
          </h4>
          
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : (
            <div className="space-y-4">
              {history.map(item => (
                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.type === 'poll' ? 'bg-teal-50 text-teal-600' : item.type === 'donation' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                        {item.type === 'poll' && <BarChart3 className="w-4 h-4" />}
                        {item.type === 'donation' && <DollarSign className="w-4 h-4" />}
                        {item.type === 'announcement' && <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-800 text-sm truncate max-w-50">{item.title}</h5>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(item.created_at).toLocaleDateString()} • {item.target_audience}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_active ? 'Active' : 'Expired'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Imps</p>
                      <p className="text-lg font-extrabold text-gray-800">{item.impressions}</p>
                    </div>
                    {item.type === 'donation' ? (
                      <div className="bg-blue-50 p-2 rounded-lg text-center col-span-3">
                        <p className="text-[10px] font-bold text-blue-400 uppercase">Clicks</p>
                        <p className="text-lg font-extrabold text-blue-600">{item.clicks}</p>
                      </div>
                    ) : item.type === 'poll' ? (
                      <div className="bg-teal-50 p-2 rounded-lg text-center col-span-3">
                        <div className="flex gap-1 h-2 bg-white rounded-full overflow-hidden mb-1.5 border border-teal-100">
                          {item.responses.map((res, i) => (
                            <div 
                              key={i} 
                              className="h-full bg-teal-500" 
                              style={{ width: `${(res.count / Math.max(item.responses.reduce((a, b) => a + b.count, 0), 1)) * 100}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between px-1 text-[9px] text-gray-500 font-bold uppercase">
                           <span>{item.responses.length > 0 ? item.responses[0].label : 'No data'}</span>
                           <span>{item.responses.reduce((a, b) => a + b.count, 0)} Responses</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-violet-50 p-2 rounded-lg text-center col-span-3 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-violet-400 uppercase">General Broadcast Engagement</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Card>
  );
};