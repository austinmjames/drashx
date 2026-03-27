// Path: src/pages/home/ui/HomePage.tsx
import React, { useState } from 'react';
import { BookOpen, MessageSquare, ArrowRight, Sparkles, Globe, Lock } from 'lucide-react';
import { AuthForm } from '../../../features/auth/ui/AuthForm';

export const HomePage = () => {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500/30">
      
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <BookOpen size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">DrashX</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAuth(true)}
            className="text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Sign In
          </button>
          <button 
            onClick={() => setShowAuth(true)}
            className="text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-full hover:scale-105 transition-transform shadow-md"
          >
            Join Free
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center overflow-hidden">
        
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8 border border-indigo-100 dark:border-indigo-800/50">
          <Sparkles size={14} />
          <span>The Collaborative Torah Platform</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8 max-w-4xl">
          Discover the Tanakh <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-sky-500 dark:from-indigo-400 dark:to-sky-300">
            Through Community.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-12 max-w-2xl leading-relaxed">
          Read, study, and share insights on the sacred texts with a bilingual reader, modernized translations, and private study groups tailored to your community.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => setShowAuth(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold transition-all hover:shadow-xl hover:shadow-indigo-600/20 active:scale-95 text-lg"
          >
            Start Reading <ArrowRight size={20} />
          </button>
        </div>
      </main>

      {/* Features Grid */}
      <section className="bg-white dark:bg-slate-900 py-24 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tight mb-4">A Modern Study Experience</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Everything you need to deeply engage with the text, whether you are studying solo or with a congregation.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Globe}
              title="Bilingual Mastery"
              description="Seamlessly toggle between vocalized Hebrew, consonantal texts, and modern English translations side-by-side."
            />
            <FeatureCard 
              icon={MessageSquare}
              title="Inline Commentary"
              description="Leave your drash directly on specific verses. Reply, like, and discuss insights with other readers in real-time."
            />
            <FeatureCard 
              icon={Lock}
              title="Private Groups"
              description="Create invite-only spaces for your synagogue, study partner, or youth group to share private commentary."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center border-t border-slate-100 dark:border-slate-900">
        <div className="flex items-center justify-center gap-2 text-slate-300 dark:text-slate-700 mb-4">
          <BookOpen size={24} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">DrashX &copy; {new Date().getFullYear()}</p>
      </footer>

      {/* Authentication Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md">
            <button 
              onClick={() => setShowAuth(false)} 
              className="absolute -top-12 right-0 text-white/70 hover:text-white font-bold transition-colors"
            >
              Close
            </button>
            <AuthForm />
          </div>
        </div>
      )}
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 transition-colors group">
    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 mb-6 shadow-sm group-hover:scale-110 transition-transform">
      <Icon size={24} strokeWidth={2} />
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">{description}</p>
  </div>
);