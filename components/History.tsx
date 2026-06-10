'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

interface HistoryEntry {
  id: number;
  date: string;
  topic: string;
  platform: string;
  lang: string;
  hook: string;
  caption: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  tiktok: '🎵',
  facebook: '👥',
};

export default function History({ lang }: { lang: string }) {
  const { isSignedIn } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isSignedIn && open) {
      fetchHistory();
    }
  }, [isSignedIn, open]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm(lang === 'fr' ? "Effacer tout l'historique ?" : 'Clear all history?')) return;
    await fetch('/api/history', { method: 'DELETE' });
    setHistory([]);
  };

  if (!isSignedIn) return null;

  return (
    <section className="py-10 px-4 bg-slate-900/50">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl p-4 transition touch-manipulation"
        >
          <span className="text-white font-bold text-lg">
            📋 {lang === 'fr' ? 'Historique de mes générations' : 'My generation history'}
          </span>
          <span className="text-slate-400 text-xl">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-slate-400 text-center py-8">⏳</p>
            ) : history.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                {lang === 'fr' ? 'Aucune génération encore.' : 'No generations yet.'}
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={clearHistory}
                    className="text-red-400 hover:text-red-300 text-sm transition touch-manipulation"
                  >
                    🗑️ {lang === 'fr' ? "Effacer l'historique" : 'Clear history'}
                  </button>
                </div>
                {history.map(entry => (
                  <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="text-slate-400 text-xs">
                          {PLATFORM_ICONS[entry.platform] || '🎬'}{' '}
                          {new Date(entry.date).toLocaleDateString(
                            lang === 'fr' ? 'fr-CA' : 'en-US',
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )}
                        </span>
                        <p className="text-white font-semibold text-sm mt-0.5">{entry.topic}</p>
                      </div>
                    </div>
                    <p className="text-violet-300 text-sm italic">"{entry.hook}"</p>
                    <p className="text-slate-400 text-xs mt-2 line-clamp-2">{entry.caption}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
