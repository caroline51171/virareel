'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Translations } from '@/lib/i18n';
import { copyText } from '@/lib/clipboard';

const ADMIN_EMAILS = [
  'caroline51171@hotmail.fr',
];

interface ReelResult {
  hook: string;
  script: string[];
  screenText: string[];
  caption: string;
  bestTime: string;
  duration?: string;
  soundTrend?: string | null;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

interface AllPlatformsResult {
  instagram: ReelResult;
  tiktok: ReelResult;
  facebook: ReelResult;
  youtube: ReelResult;
}

interface Props {
  t: Translations;
  lang: string;
  region: string;
}

const FREE_LIMIT = 12;
const STORAGE_KEY = 'virareel_gens';

function getRemaining() {
  if (typeof window === 'undefined') return FREE_LIMIT;
  const used = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  return Math.max(0, FREE_LIMIT - used);
}

function useGeneration() {
  const [remaining, setRemaining] = useState(FREE_LIMIT);
  const consume = (count = 1) => {
    const used = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) + count;
    localStorage.setItem(STORAGE_KEY, String(used));
    setRemaining(Math.max(0, FREE_LIMIT - used));
  };
  const init = () => setRemaining(getRemaining());
  return { remaining, consume, init };
}

interface UserStats {
  plan: string;
  generationsUsed: number;
  generationsLimit: number;
  resetDate: string | null;
}

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-xs px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition font-medium min-h-[36px]">
      {copied ? copiedLabel : label}
    </button>
  );
}

function ResultCard({ color, icon, title, sub, children, copyText, t }: {
  color: string; icon: string; title: string; sub: string;
  children: React.ReactNode; copyText?: string;
  t: Translations['generator']['results'];
}) {
  return (
    <div className={`${color} rounded-2xl p-5 text-white shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-bold text-lg">{icon} {title}</div>
          <div className="text-white/70 text-sm">{sub}</div>
        </div>
        {copyText && <CopyButton text={copyText} label={t.copyBtn} copiedLabel={t.copied} />}
      </div>
      {children}
    </div>
  );
}

function VariationCard({ v, idx, t, platform, lang }: {
  v: ReelResult; idx: number; t: Translations; platform: string; lang: string;
}) {
  const r = t.generator.results;
  const colors = [
    'from-violet-500 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-orange-400 to-amber-500',
  ];
  return (
    <div className={`bg-gradient-to-br ${colors[idx]} rounded-2xl p-5 text-white shadow-xl`}>
      <div className="font-bold text-xl mb-4">{r.variation} {idx + 1}</div>
      <div className="space-y-4">
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.hook}</div>
          <div className="text-lg font-bold">"{v.hook}"</div>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.script}</div>
          <ol className="space-y-1">
            {v.script.map((s, i) => <li key={i} className="text-sm">• {s}</li>)}
          </ol>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.screenText}</div>
          <div className="flex flex-wrap gap-2">
            {v.screenText.map((w, i) => (
              <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{w}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.caption}</div>
          <div className="text-sm bg-white/10 rounded-xl p-3">{v.caption}</div>
          <CopyButton text={v.caption} label={r.copyBtn} copiedLabel={r.copied} />
        </div>
        <div className="flex gap-3 flex-wrap">
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm">🕐 {v.bestTime}</span>
          {platform === 'tiktok' && v.duration && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">⏱️ {v.duration}</span>
          )}
          {platform === 'tiktok' && v.soundTrend && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">🎵 {v.soundTrend}</span>
          )}
        </div>
        {platform === 'youtube' && v.ytTitle && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.ytTitle}</div>
            <div className="text-sm bg-white/10 rounded-xl p-3 font-bold">{v.ytTitle}</div>
            <CopyButton text={v.ytTitle} label={r.copyBtn} copiedLabel={r.copied} />
          </div>
        )}
        {platform === 'youtube' && v.seoDescription && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.seoDescription}</div>
            <div className="text-sm bg-white/10 rounded-xl p-3">{v.seoDescription}</div>
            <CopyButton text={v.seoDescription} label={r.copyBtn} copiedLabel={r.copied} />
          </div>
        )}
        {platform === 'youtube' && v.keywords && v.keywords.length > 0 && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.keywords}</div>
            <div className="flex flex-wrap gap-2">
              {v.keywords.map((kw, i) => (
                <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PLATFORM_CONFIGS = {
  instagram: { icon: '📸', name: 'Instagram Reels', color: 'from-pink-500 to-rose-600' },
  tiktok:    { icon: '🎵', name: 'TikTok',          color: 'from-slate-700 to-slate-900' },
  facebook:  { icon: '👥', name: 'Facebook Reels',  color: 'from-blue-600 to-blue-800' },
  youtube:   { icon: '▶️', name: 'YouTube Shorts',  color: 'from-red-600 to-rose-700' },
};

function AllPlatformSection({ platformKey, data, r }: {
  platformKey: keyof typeof PLATFORM_CONFIGS;
  data: ReelResult;
  r: Translations['generator']['results'];
}) {
  const cfg = PLATFORM_CONFIGS[platformKey];
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-white/10">
      <div className={`bg-gradient-to-r ${cfg.color} px-5 py-4`}>
        <h3 className="text-white font-black text-xl">{cfg.icon} {cfg.name}</h3>
      </div>
      <div className="bg-slate-800/80 p-4 space-y-3">
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-1">{r.hook}</div>
          <p className="text-white font-black text-lg">"{data.hook}"</p>
          <div className="mt-2"><CopyButton text={data.hook} label={r.copyBtn} copiedLabel={r.copied} /></div>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-2">{r.script}</div>
          <ol className="space-y-1">
            {data.script.map((s, i) => (
              <li key={i} className="flex gap-2 items-start text-sm text-white">
                <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-2">{r.screenText}</div>
          <div className="flex flex-wrap gap-2">
            {data.screenText.map((w, i) => (
              <span key={i} className="bg-white/20 px-3 py-1 rounded-lg text-white font-black">{w}</span>
            ))}
          </div>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-1">{r.caption}</div>
          <p className="text-sm text-white leading-relaxed">{data.caption}</p>
          <div className="mt-2"><CopyButton text={data.caption} label={r.copyBtn} copiedLabel={r.copied} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="bg-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-sm">🕐 {data.bestTime}</span>
          {platformKey === 'tiktok' && data.duration && (
            <span className="bg-red-500/30 text-red-300 px-3 py-1 rounded-full text-sm">⏱️ {data.duration}</span>
          )}
          {platformKey === 'tiktok' && data.soundTrend && (
            <span className="bg-fuchsia-500/30 text-fuchsia-300 px-3 py-1 rounded-full text-sm">🎵 {data.soundTrend}</span>
          )}
        </div>
        {platformKey === 'youtube' && data.ytTitle && (
          <div className="bg-slate-700/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold mb-1">{r.ytTitle}</div>
            <p className="text-white font-bold">{data.ytTitle}</p>
            <div className="mt-2"><CopyButton text={data.ytTitle} label={r.copyBtn} copiedLabel={r.copied} /></div>
          </div>
        )}
        {platformKey === 'youtube' && data.seoDescription && (
          <div className="bg-slate-700/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold mb-1">{r.seoDescription}</div>
            <p className="text-sm text-white leading-relaxed">{data.seoDescription}</p>
            <div className="mt-2"><CopyButton text={data.seoDescription} label={r.copyBtn} copiedLabel={r.copied} /></div>
          </div>
        )}
        {platformKey === 'youtube' && data.keywords && data.keywords.length > 0 && (
          <div className="bg-slate-700/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold mb-2">{r.keywords}</div>
            <div className="flex flex-wrap gap-2">
              {data.keywords.map((kw, i) => (
                <span key={i} className="bg-green-500/30 text-green-300 px-3 py-1 rounded-full text-sm">{kw}</span>
              ))}
            </div>
            <div className="mt-2"><CopyButton text={data.keywords.join(', ')} label={r.copyBtn} copiedLabel={r.copied} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Generator({ t, lang, region }: Props) {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [tone, setTone] = useState('inspirational');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReelResult | null>(null);
  const [variations, setVariations] = useState<ReelResult[] | null>(null);
  const [allResults, setAllResults] = useState<AllPlatformsResult | null>(null);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const { remaining, consume, init } = useGeneration();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = !!userEmail && ADMIN_EMAILS.includes(userEmail);

  const isPaidPlan = userStats && (userStats.plan === 'creator' || userStats.plan === 'pro');
  const serverRemaining = isPaidPlan
    ? Math.max(0, (userStats!.generationsLimit || 0) - (userStats!.generationsUsed || 0))
    : null;
  const cost = platform === 'all' ? 4 : 1;

  // Avertissement : 3 générations restantes pour les abonnés payants
  const showWarning = isPaidPlan && serverRemaining !== null
    && serverRemaining <= 3
    && serverRemaining > 0;

  const g = t.generator;

  // init remaining on mount
  useEffect(() => { init(); }, []);

  // Fetch stats serveur si connecté
  useEffect(() => {
    if (user) {
      fetch('/api/user/stats')
        .then(r => r.json())
        .then(setUserStats)
        .catch(() => {});
    }
  }, [user]);

  const upgradeToProCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro', billing: 'monthly', lang }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // fallback : scroll vers pricing
      setShowPaywall(false);
      window.location.href = '#pricing';
    } finally {
      setCheckoutLoading(false);
    }
  };

  const generate = async (withVariations = false) => {
    // Si limite atteinte → afficher le paywall au lieu de bloquer silencieusement
    if (!isAdmin) {
      const limitReached = (!isPaidPlan && remaining < cost) ||
                           (isPaidPlan && serverRemaining !== null && serverRemaining < cost);
      if (limitReached) { setShowPaywall(true); return; }
    }
    if (!topic.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setVariations(null);
    setAllResults(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let res: Response;
      try {
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, platform, tone, variations: withVariations, lang, region }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setError(lang === 'fr'
            ? "⏱️ L'IA est très demandée en ce moment, réessaie dans 2 minutes. Ta génération de Reel n'a pas été décomptée."
            : "⏱️ AI is very busy right now, try again in 2 minutes. Your Reel generation was not counted.");
          return;
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      // Limite atteinte côté serveur
      if (res.status === 429) {
        const errData = await res.json();
        setError(lang === 'fr'
          ? `Limite mensuelle atteinte (${errData.generationsUsed}/${errData.generationsLimit}). Réinitialisation le 1er du mois prochain.`
          : `Monthly limit reached (${errData.generationsUsed}/${errData.generationsLimit}). Resets on the 1st of next month.`
        );
        return;
      }

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      // Décrémenter localStorage pour les non-payants
      if (!isAdmin && !isPaidPlan) consume(cost);

      // Rafraîchir les stats serveur pour les abonnés payants
      if (isPaidPlan) {
        fetch('/api/user/stats').then(r => r.json()).then(setUserStats).catch(() => {});
      }

      if (platform === 'all' && data.instagram) {
        setAllResults(data);
      } else if (withVariations && data.variations) {
        setVariations(data.variations);
      } else {
        setResult(data);
      }
    } catch {
      setError(lang === 'fr' ? 'Erreur lors de la génération. Réessaie !' : 'Generation error. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  const r = g.results;

  return (
    <section id="generator" className="py-14 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-2">{g.title}</h2>
          <p className="text-slate-400 text-sm md:text-base">{g.subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-4 md:p-8 shadow-2xl border border-slate-700 mb-6">
          <div className="space-y-5">
            <div>
              <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.topicLabel}</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={g.topicPlaceholder}
                rows={3}
                className="w-full bg-slate-900 text-white rounded-xl p-3 md:p-4 border border-slate-600 focus:border-violet-500 focus:outline-none resize-none placeholder-slate-500 text-sm md:text-base"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.platformLabel}</label>
                <div className="flex flex-col gap-2">
                  {(['instagram', 'tiktok', 'facebook', 'youtube'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation ${
                        platform === p
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-violet-500'
                      }`}
                    >
                      {g.platforms[p]}
                    </button>
                  ))}
                  <button
                    onClick={() => setPlatform('all')}
                    className={`px-4 py-3 rounded-xl border text-sm font-bold transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation ${
                      platform === 'all'
                        ? 'bg-gradient-to-r from-violet-600 to-pink-600 border-violet-500 text-white'
                        : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-violet-500'
                    }`}
                  >
                    {g.platforms.all}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.toneLabel}</label>
                <div className="flex flex-col gap-2">
                  {(Object.keys(g.tones) as (keyof typeof g.tones)[]).map(tk => (
                    <button
                      key={tk}
                      onClick={() => setTone(tk)}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation ${
                        tone === tk
                          ? 'bg-pink-600 border-pink-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-pink-500'
                      }`}
                    >
                      {g.tones[tk]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Avertissement limite proche pour abonnés payants */}
            {showWarning && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 text-center">
                <p className="text-amber-400 font-semibold text-sm">
                  ⚠️ {lang === 'fr'
                    ? `Il te reste seulement ${serverRemaining} génération${(serverRemaining as number) > 1 ? 's' : ''} (${userStats!.generationsUsed}/${userStats!.generationsLimit} utilisées)`
                    : `Only ${serverRemaining} generation${(serverRemaining as number) > 1 ? 's' : ''} left (${userStats!.generationsUsed}/${userStats!.generationsLimit} used)`}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
                <button
                  onClick={() => generate(false)}
                  disabled={loading || !topic.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                >
                  {loading ? g.generating : g.generateBtn}
                </button>
                {platform !== 'all' && (
                  <button
                    onClick={() => generate(true)}
                    disabled={loading || !topic.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                  >
                    {loading ? g.generating : g.variationsBtn}
                  </button>
                )}
                {platform === 'all' && !isAdmin && (
                  <p className="text-center text-amber-400/80 text-xs">
                    {lang === 'fr'
                      ? '⚡ Ce bouton génère 4 plateformes = compte pour 4 générations'
                      : '⚡ This button generates 4 platforms = counts as 4 generations'}
                  </p>
                )}
              </div>

            <p className="text-center text-slate-500 text-sm">
              {isAdmin
                ? '∞ Admin'
                : isPaidPlan && serverRemaining !== null
                  ? `${serverRemaining} ${g.remaining} · ${userStats!.plan}`
                  : `${remaining} ${g.remaining}`}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 rounded-xl p-4 mb-6 text-center">
            {error}
          </div>
        )}

        {/* Single Result */}
        {result && (
          <div className="space-y-4 animate-fadeIn">
            <ResultCard color="bg-gradient-to-br from-violet-600 to-purple-700" icon="🎯" title={r.hook} sub={r.hookSub} copyText={result.hook} t={r}>
              <p className="text-2xl font-black">"{result.hook}"</p>
            </ResultCard>

            <ResultCard color="bg-gradient-to-br from-blue-600 to-cyan-600" icon="📝" title={r.script} sub={r.scriptSub} t={r}>
              <ol className="space-y-2">
                {result.script.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </ResultCard>

            <ResultCard color="bg-gradient-to-br from-emerald-500 to-teal-600" icon="✏️" title={r.screenText} sub={r.screenTextSub} t={r}>
              <div className="flex flex-wrap gap-3">
                {result.screenText.map((w, i) => (
                  <span key={i} className="bg-white/20 px-4 py-2 rounded-xl font-black text-xl">{w}</span>
                ))}
              </div>
            </ResultCard>

            <ResultCard color="bg-gradient-to-br from-pink-500 to-rose-600" icon="💬" title={r.caption} sub={r.captionSub} copyText={result.caption} t={r}>
              <p className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{result.caption}</p>
            </ResultCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResultCard color="bg-gradient-to-br from-amber-500 to-orange-600" icon="🕐" title={r.bestTime} sub={r.bestTimeSub} t={r}>
                <p className="text-xl font-bold">{result.bestTime}</p>
              </ResultCard>

              {platform === 'tiktok' && (
                <>
                  {result.duration && (
                    <ResultCard color="bg-gradient-to-br from-red-500 to-rose-700" icon="⏱️" title={r.duration} sub={r.durationSub} t={r}>
                      <p className="text-3xl font-black">{result.duration}</p>
                    </ResultCard>
                  )}
                  {result.soundTrend && (
                    <ResultCard color="bg-gradient-to-br from-fuchsia-500 to-violet-700" icon="🎵" title={r.trend} sub={r.trendSub} t={r}>
                      <p className="text-lg font-bold">{result.soundTrend}</p>
                    </ResultCard>
                  )}
                </>
              )}
            </div>

            {platform === 'youtube' && (
              <div className="space-y-4">
                {result.ytTitle && (
                  <ResultCard color="bg-gradient-to-br from-red-600 to-rose-700" icon="🏷️" title={r.ytTitle} sub={r.ytTitleSub} copyText={result.ytTitle} t={r}>
                    <p className="text-lg font-bold">{result.ytTitle}</p>
                  </ResultCard>
                )}
                {result.seoDescription && (
                  <ResultCard color="bg-gradient-to-br from-sky-600 to-blue-700" icon="🔍" title={r.seoDescription} sub={r.seoDescriptionSub} copyText={result.seoDescription} t={r}>
                    <p className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{result.seoDescription}</p>
                  </ResultCard>
                )}
                {result.keywords && result.keywords.length > 0 && (
                  <ResultCard color="bg-gradient-to-br from-green-600 to-emerald-700" icon="🔑" title={r.keywords} sub={r.keywordsSub} copyText={result.keywords.join(', ')} t={r}>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw, i) => (
                        <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
                      ))}
                    </div>
                  </ResultCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* All Platforms */}
        {allResults && (
          <div className="space-y-6 animate-fadeIn">
            {(Object.keys(allResults) as (keyof AllPlatformsResult)[]).map(pk => (
              <AllPlatformSection key={pk} platformKey={pk} data={allResults[pk]} r={r} />
            ))}
          </div>
        )}

        {/* Variations */}
        {variations && (
          <div className="space-y-6 animate-fadeIn">
            {variations.map((v, i) => (
              <VariationCard key={i} v={v} idx={i} t={t} platform={platform} lang={lang} />
            ))}
          </div>
        )}
      </div>

      {/* Paywall modal */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md bg-slate-800 border border-violet-500/40 rounded-2xl p-8 text-center shadow-2xl">
            <button
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xl"
            >✕</button>

            {userStats?.plan === 'creator' ? (
              <>
                <p className="text-xl md:text-2xl font-black text-white mb-4">
                  {lang === 'fr'
                    ? '🚀 Tu passes à la vitesse supérieure !'
                    : '🚀 You\'re leveling up!'}
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  {lang === 'fr'
                    ? 'Tu as rentabilisé tes 160 générations ce mois-ci. Ta constance est ta meilleure arme pour dominer l\'algorithme sur TikTok, Instagram, YouTube et Facebook.'
                    : 'You\'ve used all 160 of your generations this month. Your consistency is your best weapon to dominate the algorithm on TikTok, Instagram, YouTube and Facebook.'}
                </p>
                <p className="text-slate-300 text-sm mb-4">
                  {lang === 'fr'
                    ? 'Si ton ambition grandit, tes outils doivent grandir avec toi. Ne freine pas ton élan maintenant.'
                    : 'If your ambition is growing, your tools need to grow with you. Don\'t slow down your momentum now.'}
                </p>
                <p className="text-white font-semibold mb-3">
                  {lang === 'fr'
                    ? '🔥 Débloque la puissance maximale avec le Plan PRO :'
                    : '🔥 Unlock maximum power with the PRO Plan:'}
                </p>
                <ul className="text-slate-300 text-sm mb-6 text-left space-y-1 px-4">
                  <li>✓ {lang === 'fr' ? 'Passe à 600 générations par mois' : 'Get 600 generations per month'}</li>
                  <li>✓ {lang === 'fr' ? 'Garde ton historique complet pendant 30 jours au lieu de 7' : 'Keep your full history for 30 days instead of 7'}</li>
                </ul>
                <button
                  onClick={upgradeToProCheckout}
                  disabled={checkoutLoading}
                  className="block w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-70"
                >
                  {checkoutLoading ? '⏳ ...' : (lang === 'fr' ? 'Passer au Plan PRO' : 'Upgrade to PRO Plan')}
                </button>
              </>
            ) : (
              <>
                <p className="text-xl md:text-2xl font-black text-white mb-4">
                  {lang === 'fr'
                    ? '💡 Tu y es presque ! Ton prochain Reel Viral est prêt.'
                    : '💡 You\'re almost there! Your next Viral Reel is ready.'}
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  {lang === 'fr'
                    ? 'Tu as utilisé tes 12 générations gratuites. Les créateurs qui réussissent n\'attendent pas l\'inspiration : ils publient régulièrement.'
                    : 'You\'ve used your 12 free generations. Successful creators don\'t wait for inspiration — they post regularly.'}
                </p>
                <p className="text-slate-300 text-sm mb-6">
                  {lang === 'fr'
                    ? 'Ne laisse pas la page blanche bloquer ta croissance sur TikTok, Instagram, YouTube et Facebook.'
                    : 'Don\'t let a blank page block your growth on TikTok, Instagram, YouTube and Facebook.'}
                </p>
                <p className="text-white font-semibold mb-6">
                  {lang === 'fr'
                    ? '🚀 Continue à créer tes Reels Viraux dès maintenant'
                    : '🚀 Keep creating your Viral Reels right now'}
                </p>
                <a
                  href="#pricing"
                  onClick={() => setShowPaywall(false)}
                  className="block w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition shadow-lg"
                >
                  {lang === 'fr' ? 'Voir les abonnements' : 'See plans'}
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
