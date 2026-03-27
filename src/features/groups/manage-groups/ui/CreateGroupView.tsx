// Path: src/features/groups/manage-groups/ui/CreateGroupView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  Globe, EyeOff, Lock, Loader2, Info, Book, MessageSquare, Users, 
  Star, Flame, Compass, Heart, Hash, ChevronDown, Scroll, Sun, 
  Moon, Cloud, Mountain, Trees, Anchor, Award, Bell, Briefcase, 
  Calendar, Camera, Coffee, Database, Gift, Home, Key, Map, 
  Music, Rocket, Target, Terminal, Zap, Shield,
  // New Additions: Religious/Symbolic/Spiritual (non-cross)
  Hand, Tent, Waves, Grape, Wheat, Bird, Crown, Gem, Feather, 
  Sprout, Scale, Fingerprint, Flower2, Rainbow, TreePalm, Wind, 
  Apple, Milk, Library, HeartHandshake, Infinity, LifeBuoy, Trophy, 
  Hourglass, ShieldCheck, Sunrise, Sparkles, MapPin, Lamp
} from 'lucide-react';
import { supabase } from '../../../../shared/api/supabase';

interface CreateGroupViewProps {
  userId: string;
  onSuccess: (groupId: string) => void;
}

type VisibilityType = 'open' | 'unlisted' | 'invite-only';

const generateRandomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Expanded ICON_OPTIONS
 * Added ~30 new icons focusing on community, nature, symbols of Israel, 
 * justice, and spiritual growth.
 */
export const ICON_OPTIONS = [
  // Original Set
  { id: 'book', icon: Book },
  { id: 'msg', icon: MessageSquare },
  { id: 'users', icon: Users },
  { id: 'star', icon: Star },
  { id: 'flame', icon: Flame },
  { id: 'compass', icon: Compass },
  { id: 'heart', icon: Heart },
  { id: 'hash', icon: Hash },
  { id: 'scroll', icon: Scroll },
  { id: 'sun', icon: Sun },
  { id: 'moon', icon: Moon },
  { id: 'cloud', icon: Cloud },
  { id: 'mountain', icon: Mountain },
  { id: 'trees', icon: Trees },
  { id: 'anchor', icon: Anchor },
  { id: 'award', icon: Award },
  { id: 'bell', icon: Bell },
  { id: 'briefcase', icon: Briefcase },
  { id: 'calendar', icon: Calendar },
  { id: 'camera', icon: Camera },
  { id: 'coffee', icon: Coffee },
  { id: 'database', icon: Database },
  { id: 'gift', icon: Gift },
  { id: 'home', icon: Home },
  { id: 'key', icon: Key },
  { id: 'map', icon: Map },
  { id: 'music', icon: Music },
  { id: 'rocket', icon: Rocket },
  { id: 'target', icon: Target },
  { id: 'terminal', icon: Terminal },
  { id: 'zap', icon: Zap },
  { id: 'shield', icon: Shield },
  
  // New Expanded Set (Spiritual/Biblical context)
  { id: 'hand', icon: Hand },           // Blessing/Priestly
  { id: 'tent', icon: Tent },           // Tabernacle/Ohel
  { id: 'waves', icon: Waves },         // Water/Mikvah
  { id: 'grape', icon: Grape },         // Vineyard/Israel
  { id: 'wheat', icon: Wheat },         // Harvest/Shavuot
  { id: 'bird', icon: Bird },           // Dove/Peace
  { id: 'crown', icon: Crown },         // Kingship
  { id: 'gem', icon: Gem },             // Breastplate/Valuable
  { id: 'feather', icon: Feather },     // Scribe/Torah
  { id: 'sprout', icon: Sprout },       // Growth
  { id: 'scale', icon: Scale },         // Justice/Mishpat
  { id: 'fingerprint', icon: Fingerprint }, // Creation/Identity
  { id: 'flower', icon: Flower2 },      // Nature
  { id: 'rainbow', icon: Rainbow },     // Covenant
  { id: 'palm', icon: TreePalm },       // Lulav/Victory
  { id: 'wind', icon: Wind },           // Ruach
  { id: 'apple', icon: Apple },         // Garden/Rosh Hashanah
  { id: 'milk', icon: Milk },           // Land of Promise
  { id: 'library', icon: Library },     // Study/Beit Midrash
  { id: 'covenant', icon: HeartHandshake }, // Chessed
  { id: 'eternal', icon: Infinity },    // Eternal
  { id: 'salvation', icon: LifeBuoy },  // Help
  { id: 'victory', icon: Trophy },      // Triumph
  { id: 'history', icon: Hourglass },   // Time/Generations
  { id: 'protection', icon: ShieldCheck }, // Magen
  { id: 'nations', icon: Globe },       // Universal
  { id: 'dawn', icon: Sunrise },        // Awakening
  { id: 'holiness', icon: Sparkles },   // Kadosh
  { id: 'location', icon: MapPin },     // Land
  { id: 'lamp', icon: Lamp }            // Ner Tamid/Wisdom
];

export const COLOR_OPTIONS = [
  { id: 'indigo', hex: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-900/30' },
  { id: 'emerald', hex: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/30' },
  { id: 'rose', hex: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-200', bg: 'bg-rose-50', darkBg: 'dark:bg-rose-900/30' },
  { id: 'amber', hex: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/30' },
  { id: 'violet', hex: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-200', bg: 'bg-violet-50', darkBg: 'dark:bg-violet-900/30' },
  { id: 'sky', hex: 'bg-sky-500', text: 'text-sky-500', border: 'border-sky-200', bg: 'bg-sky-50', darkBg: 'dark:bg-sky-900/30' },
  { id: 'slate', hex: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-200', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-900/30' }
];

export const CreateGroupView = ({ userId, onSuccess }: CreateGroupViewProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VisibilityType>('open');
  const [tags, setTags] = useState<string[]>(['', '', '']);
  const [customInviteCode, setCustomInviteCode] = useState(generateRandomCode());
  
  // Icon & Color Dropdown States
  const [selectedIconId, setSelectedIconId] = useState('book');
  const [selectedColorId, setSelectedColorId] = useState('indigo');
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

  // React-managed Hover States
  const [hoveredIconId, setHoveredIconId] = useState<string | null>(null);
  const [hoveredColorId, setHoveredColorId] = useState<string | null>(null);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);

  const iconRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) setIsIconDropdownOpen(false);
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setIsColorDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagChange = (index: number, value: string) => {
    const newTags = [...tags];
    newTags[index] = value.slice(0, 15).replace(/\s/g, '');
    setTags(newTags);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const finalInviteCode = visibility !== 'invite-only' ? customInviteCode : null;
      if (finalInviteCode) {
        const { data: existing } = await supabase.from('groups').select('id').eq('invite_code', finalInviteCode).maybeSingle();
        if (existing) throw new Error(`Code "${finalInviteCode}" is taken.`);
      }
      
      const { data: group, error: gErr } = await supabase.from('groups')
        .insert({ 
          name, 
          description, 
          visibility, 
          tags: tags.filter(t => t.trim() !== ''), 
          owner_id: userId, 
          invite_code: finalInviteCode,
          icon_url: selectedIconId,
          color_theme: selectedColorId 
        })
        .select().single();

      if (gErr) throw gErr;

      const { error: mErr } = await supabase.from('group_members').insert({ 
        group_id: group.id, 
        user_id: userId, 
        role: 'owner' 
      });

      if (mErr) throw mErr;

      onSuccess(group.id);
    } catch (err: unknown) { 
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setError(String((err as { message: string }).message));
      } else {
        setError(String(err));
      }
    } finally { setIsLoading(false); }
  };

  const SelectedIconComp = ICON_OPTIONS.find(o => o.id === selectedIconId)?.icon || Book;
  const SelectedColor = COLOR_OPTIONS.find(o => o.id === selectedColorId) || COLOR_OPTIONS[0];

  return (
    <form onSubmit={handleCreateGroup} className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" /> 
          <p className="leading-snug">{error}</p>
        </div>
      )}

      {/* Custom Dropdown Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Icon Dropdown */}
        <div className="space-y-2" ref={iconRef}>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]" htmlFor="icon-dropdown">Icon</label>
          <div className="relative">
            <button
              id="icon-dropdown"
              type="button"
              onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)}
              title="Choose group icon"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all hover:border-slate-300"
            >
              <SelectedIconComp size={18} className={SelectedColor.text} />
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {isIconDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-2 grid grid-cols-4 gap-1 max-h-60 overflow-y-auto">
                {ICON_OPTIONS.map((opt) => {
                  const isSelected = selectedIconId === opt.id;
                  const isHovered = hoveredIconId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onMouseEnter={() => setHoveredIconId(opt.id)}
                      onMouseLeave={() => setHoveredIconId(null)}
                      onClick={() => { setSelectedIconId(opt.id); setIsIconDropdownOpen(false); }}
                      title={`Select icon`}
                      className={`aspect-square flex items-center justify-center rounded-lg transition-all ${
                        isSelected 
                          ? `${SelectedColor.bg} ${SelectedColor.darkBg} ${SelectedColor.text} ring-1 ring-inset ${SelectedColor.border}` 
                          : isHovered 
                            ? 'bg-slate-50 dark:bg-slate-900 text-slate-600' 
                            : 'text-slate-400'
                      }`}
                    >
                      <opt.icon size={16} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Color Dropdown */}
        <div className="space-y-2" ref={colorRef}>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]" htmlFor="color-dropdown">Theme</label>
          <div className="relative">
            <button
              id="color-dropdown"
              type="button"
              onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
              title="Choose theme color"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all hover:border-slate-300"
            >
              <div className={`w-4 h-4 rounded-full ${SelectedColor.hex}`} />
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {isColorDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 py-2">
                {COLOR_OPTIONS.map((opt) => {
                  const isSelected = selectedColorId === opt.id;
                  const isHovered = hoveredColorId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onMouseEnter={() => setHoveredColorId(opt.id)}
                      onMouseLeave={() => setHoveredColorId(null)}
                      onClick={() => { setSelectedColorId(opt.id); setIsColorDropdownOpen(false); }}
                      title={`Select color`}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                        isSelected 
                          ? `${opt.bg} ${opt.darkBg} font-bold` 
                          : isHovered 
                            ? 'bg-slate-50 dark:bg-slate-900' 
                            : ''
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${opt.hex}`} />
                      <span className={`capitalize ${isSelected ? opt.text : 'text-slate-600'}`}>{opt.id}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]" htmlFor="group-name">Group Name</label>
        <input 
          id="group-name"
          required 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="e.g. Genesis Study Group" 
          className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 py-2 text-base outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-700" 
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]" htmlFor="group-desc">Description</label>
        <textarea 
          id="group-desc"
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          placeholder="Briefly describe the focus of this group" 
          rows={2} 
          className="w-full bg-transparent border-b border-slate-200 dark:border-slate-800 py-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-700 resize-none" 
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Visibility</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'open', icon: Globe, label: 'Open' }, 
              { id: 'unlisted', icon: EyeOff, label: 'Unlisted' }, 
              { id: 'invite-only', icon: Lock, label: 'Private' }
            ].map((v) => {
              const typedId = v.id as VisibilityType;
              return (
                <button 
                  key={v.id} 
                  type="button" 
                  onClick={() => setVisibility(typedId)} 
                  title={`Set visibility to ${v.label}`}
                  className={`flex items-center gap-3 py-2 px-3 rounded-xl text-xs transition-all ${
                    visibility === typedId 
                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-100 dark:border-indigo-900' 
                      : 'text-slate-500 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  <v.icon size={16} className={visibility === typedId ? 'text-indigo-500' : ''} />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
           <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Topic Tags</label>
           <div className="flex flex-col gap-2 pt-1">
             {tags.map((tag, idx) => (
               <div key={idx} className="flex items-center border-b border-slate-100 dark:border-slate-800 focus-within:border-indigo-500 transition-colors">
                 <span className="text-slate-300 dark:text-slate-600 text-xs mr-1">#</span>
                 <input 
                    aria-label={`Tag ${idx + 1}`} 
                    value={tag} 
                    onChange={(e) => handleTagChange(idx, e.target.value)} 
                    className="w-full bg-transparent py-1 text-sm outline-none" 
                    placeholder="tag" 
                 />
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="space-y-1 pt-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]" htmlFor="invite-code">Custom Invite Code</label>
        <div className="flex items-center">
          <span className="text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 py-2.5 pl-3 pr-1 rounded-l-2xl font-mono text-[10px] border border-r-0 border-slate-100 dark:border-slate-800 uppercase tracking-tighter">drashx.com/</span>
          <input 
            id="invite-code"
            value={customInviteCode} 
            onChange={(e) => setCustomInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} 
            disabled={visibility === 'invite-only'} 
            placeholder="CUSTOM-CODE" 
            className="w-full bg-slate-50 dark:bg-slate-900 border border-l-0 border-slate-100 dark:border-slate-800 py-2 px-3 rounded-r-2xl font-mono text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-400 disabled:opacity-50 transition-colors uppercase" 
          />
        </div>
      </div>

      <div className="pt-4 pb-8">
        <button 
          type="submit" 
          disabled={isLoading || !name} 
          onMouseEnter={() => setIsSubmitHovered(true)}
          onMouseLeave={() => setIsSubmitHovered(false)}
          className={`w-full text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 ${
            isSubmitHovered ? 'bg-indigo-700 shadow-indigo-600/30' : 'bg-indigo-600 shadow-indigo-600/20'
          }`}
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Establish Group'}
        </button>
      </div>
    </form>
  );
};