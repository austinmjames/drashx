// Filepath: src/widgets/admin/ui/BroadcastWidget.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Megaphone, 
  DollarSign, 
  BarChart3, 
  Plus,
  Clock,
  Info,
  FileText,
  Loader2,
  Trash2,
  Power,
  PowerOff,
  AlertTriangle,
  TrendingUp,
  Target
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
  
  // Action States
  const [isDeploying, setIsDeploying] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: broadcasts, error: bErr } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

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

  // Aggregated charts data
  const globalStats = useMemo(() => {
    if (!history.length) return { reach: 0, clicks: 0, responses: 0 };
    return history.reduce((acc, curr) => ({
      reach: acc.reach + curr.impressions,
      clicks: acc.clicks + curr.clicks,
      responses: acc.responses + curr.responses.reduce((a, b) => a + b.count, 0)
    }), { reach: 0, clicks: 0, responses: 0 });
  }, [history]);

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

  const toggleBroadcastStatus = async (id: string, currentStatus: boolean) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('broadcasts')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      setHistory(prev => prev.map(item => item.id === id ? { ...item, is_active: !currentStatus } : item));
    } catch (err) {
      console.error("Failed to toggle status:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const deleteBroadcast = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('broadcasts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setHistory(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Failed to delete broadcast:", err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card className="mb-8 overflow-visible">
      <div className="p-5 border-b border-gray-100 bg-blue-50/20">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-blue-600" />
          Broadcast Center
        </h3>
        <p className="text-xs text-gray-500 mt-1">Deploy global modals, polls, and announcements.</p>
      </div>

      <div className="p-6 space-y-10">
        {/* Create Section */}
        <section className="bg-gray-50 rounded-xl p-6 border border-gray-100">
          <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Create New Broadcast
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Campaign Type</label>
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
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Audience</label>
                  <select 
                    value={targetAudience} 
                    title="Audience" 
                    onChange={(e) => setTargetAudience(e.target.value as 'all' | 'new' | 'returning')} 
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none"
                  >
                    <option value="all">Everyone</option>
                    <option value="new">New Users Only</option>
                    <option value="returning">Returning Only</option>
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
                  <option value="once">Once Per Account</option>
                  <option value="daily">Once Per Day</option>
                  <option value="weekly">Once Per Week</option>
                </select>
              </div>

              <input 
                type="text" 
                placeholder="Campaign Title..." 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
              <textarea 
                placeholder="Broadcast message body content..." 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                rows={3}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-4">
              {broadcastType === 'poll' ? (
                <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 h-full flex flex-col">
                  <p className="text-xs font-bold text-teal-800 uppercase mb-3">Poll Options</p>
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
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-teal-100">
                      <input type="checkbox" id="allow-custom" checked={allowCustom} onChange={(e) => setAllowCustom(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500" />
                      <label htmlFor="allow-custom" className="text-[10px] font-bold text-gray-500 uppercase cursor-pointer">Allow Custom Feedback</label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/50 p-4 rounded-xl border border-gray-200 h-full flex flex-col items-center justify-center text-center">
                  <Megaphone className={`w-8 h-8 mb-2 ${broadcastType === 'donation' ? 'text-blue-200' : 'text-violet-200'}`} />
                  <p className="text-xs text-gray-400 italic">No complex configuration needed for {broadcastType}s.</p>
                </div>
              )}
              
              <button 
                disabled={isDeploying || !title || !content}
                onClick={handleDeploy}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Launch Campaign
              </button>
            </div>
          </div>
        </section>

        {/* Global Analytics Overview (The "Charts at the top") */}
        {!loading && history.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 border-y border-gray-100 py-8">
            <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Target size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Reach</p>
                <p className="text-2xl font-black text-gray-900">{globalStats.reach.toLocaleString()}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Clicks</p>
                <p className="text-2xl font-black text-gray-900">{globalStats.clicks.toLocaleString()}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Responses</p>
                <p className="text-2xl font-black text-gray-900">{globalStats.responses.toLocaleString()}</p>
              </div>
            </div>
          </section>
        )}

        {/* History / Management Section */}
        <section>
          <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Active & Recent Campaigns
          </h4>
          
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
              <p className="text-gray-400 text-sm">No campaign history found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map(item => (
                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-blue-100 transition-all group relative overflow-hidden">
                  
                  {/* Delete Confirmation Overlay */}
                  {deleteConfirmId === item.id && (
                    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 animate-in fade-in duration-200">
                      <AlertTriangle className="text-red-500 w-8 h-8 mb-2" />
                      <p className="text-sm font-bold text-gray-900">Delete campaign & analytics?</p>
                      <p className="text-xs text-gray-500 mt-1 mb-4">This action cannot be undone.</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => deleteBroadcast(item.id)}
                          className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${item.type === 'poll' ? 'bg-teal-50 text-teal-600' : item.type === 'donation' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                        {item.type === 'poll' && <BarChart3 className="w-5 h-5" />}
                        {item.type === 'donation' && <DollarSign className="w-5 h-5" />}
                        {item.type === 'announcement' && <FileText className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-gray-800 text-sm truncate max-w-[200px] sm:max-w-md">{item.title}</h5>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.is_active ? 'Active' : 'Stopped'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()} • {item.target_audience} audience</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button 
                        disabled={processingId === item.id}
                        onClick={() => toggleBroadcastStatus(item.id, item.is_active)}
                        className={`p-2 rounded-lg border transition-all ${item.is_active ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                        title={item.is_active ? "Deactivate / Stop" : "Activate / Resume"}
                      >
                        {processingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : item.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button 
                        disabled={processingId === item.id}
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-50/50 p-3 rounded-xl text-center border border-gray-100/50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reach</p>
                      <p className="text-xl font-black text-gray-800">{item.impressions.toLocaleString()}</p>
                    </div>
                    {item.type === 'donation' ? (
                      <div className="bg-blue-50/30 p-3 rounded-xl text-center col-span-3 border border-blue-100/50 flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Click-through Rate</p>
                        <div className="flex items-center justify-center gap-2">
                           <p className="text-xl font-black text-blue-600">{item.clicks.toLocaleString()} Clicks</p>
                           <span className="text-[10px] font-bold text-blue-400">({((item.clicks / Math.max(item.impressions, 1)) * 100).toFixed(1)}%)</span>
                        </div>
                      </div>
                    ) : item.type === 'poll' ? (
                      <div className="bg-teal-50/30 p-3 rounded-xl col-span-3 border border-teal-100/50">
                        <div className="flex gap-1 h-2.5 bg-white rounded-full overflow-hidden mb-2 border border-teal-100/50">
                          {item.responses.length > 0 ? (
                            item.responses.map((res, i) => (
                              <div 
                                key={i} 
                                className={`h-full min-w-[2px] ${['bg-teal-500', 'bg-teal-400', 'bg-teal-300', 'bg-teal-200'][i % 4]}`}
                                style={{ width: `${(res.count / Math.max(item.responses.reduce((a, b) => a + b.count, 0), 1)) * 100}%` }}
                                title={`${res.label}: ${res.count}`}
                              />
                            ))
                          ) : (
                            <div className="w-full bg-gray-100 h-full" />
                          )}
                        </div>
                        <div className="flex justify-between items-center px-1">
                           <div className="flex gap-2 overflow-hidden">
                              {item.responses.length > 0 ? item.responses.slice(0, 2).map((r, i) => (
                                <span key={i} className="text-[9px] text-teal-700 font-bold uppercase truncate max-w-[80px]">
                                  {r.label} ({Math.round((r.count / Math.max(item.responses.reduce((a, b) => a + b.count, 0), 1)) * 100)}%)
                                </span>
                              )) : (
                                <span className="text-[9px] text-gray-400 italic">No responses yet</span>
                              )}
                           </div>
                           <span className="text-[9px] text-gray-500 font-black uppercase tracking-tighter shrink-0 ml-4">
                             {item.responses.reduce((a, b) => a + b.count, 0)} Total Votes
                           </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-violet-50/30 p-3 rounded-xl text-center col-span-3 border border-violet-100/50 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Informational Campaign Tracking Active</span>
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