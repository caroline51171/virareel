'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import { regrouper, type Granularite, type Point } from '@/lib/croissance';

type Client = {
  email: string;
  plan: string;
  generationsUsed: number | null;
  generationsLimit: number | null;
  atMax: boolean;
  source: 'compte' | 'essai';
};

type Message = {
  id: string;
  date: string;
  type: string;
  nom: string;
  courriel: string;
  message: string;
  courrielEnvoye: boolean;
};

type Stats = {
  clients: Client[];
  totalGenerations: number;
  estimatedCost: number;
  betaCost: number;
  mrr: number;
  estimatedProfit: number;
  anonTrialsByDay: { date: string; count: number }[];
  messages: Message[];
  nonLus: number;
  croissance: {
    inscriptions: string[];
    courriels: string[];
    abonnements: string[];
  };
};

// Combien de périodes afficher selon la granularité. 30 jours = le mois de recul
// demandé pour juger une campagne ; 12 semaines et 12 mois pour la tendance longue.
const NB_PERIODES: Record<Granularite, number> = { jour: 30, semaine: 12, mois: 12 };

const SERIES = [
  { cle: 'inscriptions', label: 'Inscriptions', couleur: '#a78bfa' },
  { cle: 'courriels', label: 'Courriels captés', couleur: '#38bdf8' },
  { cle: 'abonnements', label: 'Abonnements', couleur: '#34d399' },
] as const;

function etiquettePeriode(periode: string, granularite: Granularite): string {
  if (granularite === 'mois') {
    const [a, m] = periode.split('-');
    return `${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][Number(m) - 1]} ${a.slice(2)}`;
  }
  const [, m, j] = periode.split('-');
  return `${j}/${m}`;
}

// Courbe en SVG, sans librairie : quelques dizaines de points, aucune interaction —
// une dépendance de graphique coûterait plus cher que ce qu'elle apporterait ici.
function Courbe({ series, granularite }: { series: { label: string; couleur: string; points: Point[] }[]; granularite: Granularite }) {
  const L = 720, H = 200, MG = 8;
  const n = series[0]?.points.length ?? 0;
  if (n === 0) return null;
  // Échelle commune aux 3 séries : sinon 1 abonnement paraîtrait aussi haut que
  // 40 inscriptions et la comparaison serait mensongère.
  const max = Math.max(1, ...series.flatMap(s => s.points.map(p => p.count)));
  const x = (i: number) => MG + (i * (L - 2 * MG)) / Math.max(1, n - 1);
  const y = (v: number) => H - MG - (v / max) * (H - 2 * MG);

  const points = series[0].points;
  const pas = Math.ceil(n / 6);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${L} ${H + 22}`} className="w-full min-w-[520px]" role="img" aria-label="Courbe de croissance">
        {[0, 0.5, 1].map(f => (
          <line key={f} x1={MG} x2={L - MG} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.08)" strokeWidth="1" />
        ))}
        {series.map(s => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.couleur}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.points.map((p, i) => `${x(i)},${y(p.count)}`).join(' ')}
          />
        ))}
        {points.map((p, i) =>
          i % pas === 0 || i === n - 1 ? (
            <text key={p.periode} x={x(i)} y={H + 14} fontSize="11" fill="#64748b" textAnchor="middle">
              {etiquettePeriode(p.periode, granularite)}
            </text>
          ) : null,
        )}
        <text x={MG} y={y(max) - 3} fontSize="11" fill="#64748b">{max}</text>
      </svg>
    </div>
  );
}

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
  const [granularite, setGranularite] = useState<Granularite>('jour');
  const [messagesOuverts, setMessagesOuverts] = useState(false);
  const [nonLus, setNonLus] = useState(0);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((s: Stats) => { setStats({ ...s, messages: s.messages ?? [] }); setNonLus(s.nonLus ?? 0); })
      .catch(() => setError(true));
  }, []);

  // Recalculé dans le navigateur : changer de granularité ne rappelle pas le serveur.
  const series = useMemo(() => {
    if (!stats) return [];
    const nb = NB_PERIODES[granularite];
    return SERIES.map(s => ({
      label: s.label,
      couleur: s.couleur,
      // `?? []` : si une réponse arrivait sans ce bloc (ancienne version en cache),
      // la courbe se vide au lieu de faire planter TOUT le tableau de bord.
      points: regrouper(stats.croissance?.[s.cle] ?? [], granularite, nb),
    }));
  }, [stats, granularite]);

  const ouvrirMessages = () => {
    setMessagesOuverts(o => !o);
    if (!messagesOuverts && nonLus > 0) {
      setNonLus(0);
      fetch('/api/admin/messages-lus', { method: 'POST' }).catch(() => {});
    }
  };

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
              {/* Compris dans le coût estimé ci-dessus ; isolé ici pour voir ce que coûtent les tests. */}
              <Card icon="lightbulb" label="Coût bêta testeurs" value={money(stats.betaCost || 0)} />
            </div>

            {/* Messages EN HAUT : c'est la seule chose ici qui demande une réponse
                à quelqu'un. Le reste peut attendre demain, pas un client qui écrit. */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl mb-8 overflow-hidden">
              <button
                onClick={ouvrirMessages}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/5 transition"
              >
                <span className="flex items-center gap-2 text-white font-semibold">
                  <Icon name="mail" size={20} />
                  Messages
                  {nonLus > 0 && (
                    <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {nonLus} non lu{nonLus > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="text-slate-400 text-sm">
                  {stats.messages.length === 0 ? 'Aucun' : `${stats.messages.length} au total`}
                </span>
              </button>

              {messagesOuverts && stats.messages.length > 0 && (
                <div className="border-t border-white/10 divide-y divide-white/5 max-h-96 overflow-y-auto">
                  {stats.messages.map(m => (
                    <div key={m.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                        <span className="text-white font-semibold">{m.nom}</span>
                        <a href={`mailto:${m.courriel}`} className="text-violet-300 text-sm hover:underline">
                          {m.courriel}
                        </a>
                        <span className="text-slate-500 text-xs">
                          {new Date(m.date).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        {/* Le message est en sécurité malgré tout : c'est la notification
                            par courriel qui a échoué, pas la réception. */}
                        {!m.courrielEnvoye && (
                          <span className="text-amber-400 text-xs">⚠ courriel non envoyé</span>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap">{m.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Icon name="sparkles" size={16} />
                  Croissance
                </div>
                <div className="flex gap-1 bg-slate-800 rounded-full p-1">
                  {(['jour', 'semaine', 'mois'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGranularite(g)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                        granularite === g ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-3">
                {series.map(s => (
                  <span key={s.label} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-3 h-0.5 rounded" style={{ background: s.couleur }} />
                    {s.label}
                    <span className="text-white font-semibold">
                      {s.points.reduce((t, p) => t + p.count, 0)}
                    </span>
                  </span>
                ))}
              </div>

              <Courbe series={series} granularite={granularite} />
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
