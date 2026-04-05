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
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X
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
  impressions: number;
  clicks: number;
  responses: { label: string; count: number }[];
}

// --- Component ---

export const BroadcastWidget = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  
  // Local state for response pagination: Record<broadcastId, currentPageNumber>
  const [responsePages, setResponsePages] = useState<Record<string, number>>({});
  const RESPONSES_PER_PAGE = 5;

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
  const [showSuccess, setShowSuccess] = useState(false);
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

        const safeResp = resp || [];
        const impressions = safeResp.filter(r => r.interaction_type === 'impression').length;
        const clicks = safeResp.filter(r => r.interaction_type === 'click').length;
        
        const responseMap: Record<string, number> = {};
        safeResp.filter(r => r.interaction_type === 'response').forEach(r => {
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

  const globalStats = useMemo(() => {
    if (!history.length) return { reach: 0, clicks: 0, responses: 0 };
    return history.reduce((acc, curr) => ({
      reach: acc.reach + curr.impressions,
      clicks: acc.clicks + curr.clicks,
      responses: acc.responses + curr.responses.reduce((a, b) => a + b.count, 0)
    }), { reach: 0, clicks: 0, responses: 0 });
  }, [history]);

  const canDeploy = useMemo(() => {
    if (!title.trim() || !content.trim()) return false;
    if (broadcastType === 'poll') {
      const validOptions = pollOptions.filter(o => o.trim() !== '');
      return validOptions.length >= 2;
    }
    return true;
  }, [title, content, broadcastType, pollOptions]);

  const handleDeploy = async () => {
    if (!canDeploy) return;
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
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      fetchHistory();
    } catch (err) {
      console.error("Failed to deploy broadcast:", err);
    } finally {
      setIsDeploying(false);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) return; // Keep at least 2 input fields
    setPollOptions(prev => prev.filter((_, i) => i !== index));
  };

  const toggleBroadcastStatus = async (id: string, currentStatus: boolean) => {
    setProcessingId(id);
    try {
      const { error } = await supabase.from('broadcasts').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      setHistory(prev => prev.map(item => item.id === id ? { ...item, is_active: !currentStatus } : item));
    } catch (err) { console.error(err); } finally { setProcessingId(null); }
  };

  const deleteBroadcast = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase.from('broadcasts').delete().eq('id', id);
      if (error) throw error;
      setHistory(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
    } catch (err) { console.error(err); } finally { setProcessingId(null); }
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
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Create New Broadcast
            </h4>
            {showSuccess && (
              <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in slide-in-from-right-2">
                <CheckCircle2 size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Campaign Launched</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Campaign Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    type="button" 
                    onClick={() => setBroadcastType('announcement')} 
                    title="Announcement Campaign"
                    aria-label="Set campaign type to announcement"
                    className={`flex flex-col items-center p-2 rounded-lg border transition-all ${broadcastType === 'announcement' ? 'bg-white border-violet-500 text-violet-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <Info className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold uppercase">Update</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setBroadcastType('donation')} 
                    title="Donation Campaign"
                    aria-label="Set campaign type to donation"
                    className={`flex flex-col items-center p-2 rounded-lg border transition-all ${broadcastType === 'donation' ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <DollarSign className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold uppercase">Donate</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setBroadcastType('poll')} 
                    title="Poll Campaign"
                    aria-label="Set campaign type to poll"
                    className={`flex flex-col items-center p-2 rounded-lg border transition-all ${broadcastType === 'poll' ? 'bg-white border-teal-500 text-teal-600 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <BarChart3 className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-bold uppercase">Poll</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Audience</label>
                  <select 
                    value={targetAudience} 
                    title="Target Audience" 
                    onChange={(e) => setTargetAudience(e.target.value as 'all' | 'new' | 'returning')} 
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="all">Everyone</option>
                    <option value="new">New Users</option>
                    <option value="returning">Returning</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Duration</label>
                  <select 
                    value={duration} 
                    title="Campaign Duration" 
                    onChange={(e) => setDuration(e.target.value)} 
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Frequency</label>
                <select 
                  value={frequency} 
                  title="Display Frequency" 
                  onChange={(e) => setFrequency(e.target.value)} 
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="once">Once Per Account</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <input type="text" placeholder="Campaign Title..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea placeholder="Message body..." value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-4">
              {broadcastType === 'poll' ? (
                <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100 h-full flex flex-col">
                  <p className="text-xs font-bold text-teal-800 uppercase mb-3 px-1">Poll Options</p>
                  <div className="space-y-2 grow max-h-48 overflow-y-auto pr-1 scrollbar-hide">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="text" placeholder={`Option ${i+1}`} value={opt} onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} className="w-full p-2 text-xs border border-teal-200 rounded-lg outline-none focus:border-teal-500" />
                        {pollOptions.length > 2 && (
                          <button 
                            type="button" 
                            onClick={() => removePollOption(i)} 
                            title="Remove option"
                            aria-label={`Remove option ${i + 1}`}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setPollOptions([...pollOptions, ''])} className="text-[10px] font-bold text-teal-600 flex items-center gap-1 mt-1 hover:text-teal-700 transition-colors"><Plus size={12}/>Add Option</button>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-teal-100/50">
                    <input type="checkbox" id="allow-custom" checked={allowCustom} onChange={(e) => setAllowCustom(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500" />
                    <label htmlFor="allow-custom" className="text-[10px] font-bold text-gray-500 uppercase cursor-pointer">Allow Custom Feedback</label>
                  </div>
                </div>
              ) : (
                <div className="bg-white/50 p-4 rounded-xl border border-gray-200 h-full flex flex-col items-center justify-center text-center">
                  <Megaphone className="w-8 h-8 mb-2 text-violet-200" />
                  <p className="text-xs text-gray-400 italic">Static content ready for launch.</p>
                </div>
              )}
              <button disabled={isDeploying || !canDeploy} onClick={handleDeploy} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:grayscale transition-all active:scale-[0.98]">
                {isDeploying ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Launch Campaign'}
              </button>
            </div>
          </div>
        </section>

        {/* Analytics Grid */}
        {!loading && history.length > 0 && (
          <section className="grid grid-cols-3 gap-4 border-y border-gray-100 py-6">
            <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Total Reach</p><p className="text-xl font-black text-gray-900">{globalStats.reach.toLocaleString()}</p></div>
            <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Total Clicks</p><p className="text-xl font-black text-gray-900">{globalStats.clicks.toLocaleString()}</p></div>
            <div className="p-3 bg-gray-50 rounded-xl"><p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Responses</p><p className="text-xl font-black text-gray-900">{globalStats.responses.toLocaleString()}</p></div>
          </section>
        )}

        {/* History List with Paginated Poll Results */}
        <section>
          <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Recent Campaigns
          </h4>
          <div className="space-y-4">
            {history.map(item => {
              const currPage = responsePages[item.id] || 1;
              const totalRespPages = Math.ceil(item.responses.length / RESPONSES_PER_PAGE) || 1;
              const paginatedResponses = item.responses.slice((currPage - 1) * RESPONSES_PER_PAGE, currPage * RESPONSES_PER_PAGE);

              return (
                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-blue-100 transition-all group relative overflow-hidden">
                  {deleteConfirmId === item.id && (
                    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                      <AlertTriangle className="text-red-500 w-8 h-8 mb-2" />
                      <p className="text-sm font-bold">Delete campaign?</p>
                      <div className="flex gap-2 mt-4">
                        <button type="button" onClick={() => deleteBroadcast(item.id)} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors">Confirm</button>
                        <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 bg-gray-100 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.type === 'poll' ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'}`}>
                        {item.type === 'poll' ? <BarChart3 size={18} /> : item.type === 'announcement' ? <FileText size={18} /> : <DollarSign size={18} />}
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-gray-800">{item.title}</h5>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{item.target_audience} audience • {new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => toggleBroadcastStatus(item.id, item.is_active)} 
                        title={item.is_active ? "Deactivate" : "Activate"}
                        aria-label={item.is_active ? "Deactivate campaign" : "Activate campaign"}
                        className={`p-2 rounded-lg border transition-colors ${item.is_active ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                      >
                        {processingId === item.id ? <Loader2 size={14} className="animate-spin" /> : item.is_active ? <PowerOff size={14}/> : <Power size={14}/>}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)} 
                        title="Delete"
                        aria-label="Delete campaign"
                        className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 flex flex-col justify-center text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reach</p>
                      <p className="text-xl font-black text-gray-800">{item.impressions.toLocaleString()}</p>
                    </div>

                    {item.type === 'poll' ? (
                      <div className="bg-teal-50/30 p-3 rounded-xl col-span-3 border border-teal-100/50 relative">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-[9px] font-black uppercase text-teal-700 tracking-widest">Responses ({item.responses.length})</p>
                          {totalRespPages > 1 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-bold text-gray-400">Pg {currPage}/{totalRespPages}</span>
                              <div className="flex bg-white rounded-md border border-teal-100">
                                <button 
                                  type="button"
                                  disabled={currPage === 1}
                                  onClick={() => setResponsePages(prev => ({ ...prev, [item.id]: currPage - 1 }))}
                                  title="Previous response page"
                                  className="p-1 hover:bg-teal-50 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronLeft size={10} />
                                </button>
                                <button 
                                  type="button"
                                  disabled={currPage === totalRespPages}
                                  onClick={() => setResponsePages(prev => ({ ...prev, [item.id]: currPage + 1 }))}
                                  title="Next response page"
                                  className="p-1 border-l border-teal-100 hover:bg-teal-50 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronRight size={10} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1.5 min-h-25">
                          {paginatedResponses.map((res, i) => (
                            <div key={i} className="flex items-center justify-between gap-4 animate-in fade-in duration-200">
                              <span className="text-[10px] font-bold text-gray-700 truncate max-w-[60%]">{res.label}</span>
                              <div className="flex items-center gap-2 grow justify-end">
                                <div className="h-1.5 bg-white rounded-full overflow-hidden w-16 border border-teal-100">
                                  <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${(res.count / Math.max(item.responses.reduce((a, b) => a + b.count, 0), 1)) * 100}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-teal-600 min-w-6 text-right">{res.count}</span>
                              </div>
                            </div>
                          ))}
                          {item.responses.length === 0 && (
                            <div className="py-6 text-center">
                              <p className="text-[10px] text-gray-400 italic">No responses recorded yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50/30 p-3 rounded-xl col-span-3 border border-blue-100/50 flex flex-col justify-center text-center">
                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Clicks / Engagement</p>
                        <p className="text-xl font-black text-blue-600">
                          {item.clicks.toLocaleString()} 
                          <span className="text-[10px] font-bold ml-1 opacity-60">
                            ({((item.clicks / Math.max(item.impressions, 1)) * 100).toFixed(1)}%)
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Card>
  );
};