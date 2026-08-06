'use client';

import { useEffect, useState } from 'react';
import Icon, { type IconName } from '@/components/Icon';

type Client = {
  email: string;
  plan: string;
  generationsUsed: number | null;
  generationsLimit: number | null;
  atMax: boolean;
  source: 'compte' | 'essai';
};

type Stats = {
  clients: Client[];
  totalGenerations: number;
  estimatedCost: number;
  mrr: number;
  estimatedProfit: number;
  anonTrialsByDay: { date: string; count: number }[];
};

function formatDay(dateStr: string, index: number): string {
  if (index === 0) return "Aujourd'hui";
  if (index === 1) return 'Hier';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

const money = (n: number) => `${n.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

function Card({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
        <Icon name={icon} size={16} />
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 md:py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Tableau de bord admin</h1>
        <p className="text-slate-400 text-sm mb-8">Vue d&apos;ensemble — revenu, coût, usage par client.</p>

        {error && <p className="text-red-400">Erreur de chargement.</p>}
        {!stats && !error && <p className="text-slate-400">Chargement…</p>}

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card icon="coins" label="Revenu (MRR)" value={money(stats.mrr)} />
              <Card icon="zap" label="Coût estimé" value={money(stats.estimatedCost)} />
              <Card icon="sparkles" label="Profit estimé" value={money(stats.estimatedProfit)} />
              <Card icon="briefcase" label="Générations totales" value={String(stats.totalGenerations)} />
            </div>

            <a
              href="https://vercel.com/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200 mb-8"
            >
              <Icon name="link" size={16} />
              Voir les visiteurs du site (Vercel Analytics)
            </a>

            {stats.anonTrialsByDay.length > 0 && (
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 mb-8">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                  <Icon name="mail" size={16} />
                  Essais sans courriel, par jour
                </div>
                <div className="flex flex-wrap gap-3">
                  {stats.anonTrialsByDay.map((d, i) => (
                    <div key={d.date} className="text-center min-w-[52px]">
                      <div className="text-lg font-bold text-white">{d.count}</div>
                      <div className="text-xs text-slate-500">{formatDay(d.date, i)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Courriel</th>
                    <th className="text-left font-semibold px-4 py-3">Forfait</th>
                    <th className="text-left font-semibold px-4 py-3">Générations</th>
                    <th className="text-left font-semibold px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.clients.map(c => (
                    <tr key={c.email} className="border-t border-white/5">
                      <td className="px-4 py-3 text-white">{c.email}</td>
                      <td className="px-4 py-3 text-slate-300 capitalize">{c.plan}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {c.source === 'essai'
                          ? '—'
                          : `${c.generationsUsed} / ${c.generationsLimit === -1 ? '∞' : c.generationsLimit}`}
                      </td>
                      <td className="px-4 py-3">
                        {c.source === 'essai' ? (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Icon name="mail" size={14} /> Courriel donné (sans compte)
                          </span>
                        ) : c.atMax ? (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <Icon name="lock" size={14} /> Maximum atteint
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <Icon name="check" size={14} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
