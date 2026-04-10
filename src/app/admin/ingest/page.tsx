// Path: app/admin/ingest/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseZap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// FSD Imports
import { supabase } from '@/shared/api/supabase';
import { SefariaIngestView } from '@/features/admin/ingest/ui/SefariaIngestView';

export default function AdminIngestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Authenticate and Verify Admin
  const verifyAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', authData.user.id)
        .single();

      if (!profile?.is_admin) {
        router.push('/');
        return;
      }
    } catch (err) {
      console.error("Admin verification failed", err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans p-6 md:p-10">
      <div className="max-w-350 mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mb-4"
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <DatabaseZap className="w-8 h-8 text-indigo-500" />
              Ingestion Relay
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Targeted Sefaria Database synchronization. Warning: Modifies production schemas.
            </p>
          </div>
        </header>

        {/* The 3-Panel FSD Module */}
        <SefariaIngestView />
        
      </div>
    </div>
  );
}