'use client';

import { useState, useEffect, useRef, useContext } from 'react';
import { useUser } from '@clerk/nextjs';
import { Translations } from '@/lib/i18n';
import { copyText } from '@/lib/clipboard';
import { saveLocalHistory, historyLimitForPlan, getRecentHooks, LocalHistoryEntry } from '@/lib/localHistory';
import { exportEntry, entryToText, reelToText } from '@/lib/exportHistory';
import ExportMenu from '@/components/ExportMenu';
import Icon, { type IconName } from '@/components/Icon';
import {
  ReelResult,
  CreditHelpers,
  CreditContext,
  useReelTranslation,
  TranslateBar,
} from '@/components/Transcreation';

const ADMIN_EMAILS = [
  'caroline51171@gmail.com',
  'caroline51171@hotmail.fr',
];

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

function CopyButton({ text, label, copiedLabel, icon = 'copy', copiedIcon = 'check' }: {
  text: string; label: string; copiedLabel: string;
  icon?: IconName; copiedIcon?: IconName;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-xs px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition font-medium min-h-[36px] inline-flex items-center gap-1.5">
      <Icon name={copied ? copiedIcon : icon} size={16} />
      {copied ? copiedLabel : label}
    </button>
  );
}

function ResultCard({ color, icon, title, sub, children, copyText, t }: {
  color: string; icon: IconName; title: string; sub: string;
  children: React.ReactNode; copyText?: string;
  t: Translations['generator']['results'];
}) {
  return (
    <div className={`${color} rounded-2xl p-5 text-white shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-bold text-lg flex items-center gap-2">
            <Icon name={icon} size={20} />
            {title}
          </div>
          <div className="text-white/70 text-sm">{sub}</div>
        </div>
        {copyText && <CopyButton text={copyText} label={t.copyBtn} copiedLabel={t.copied} />}
      </div>
      {children}
    </div>
  );
}

// Carte repliable « 💡 Inspiration visuelle » — fermée par défaut, on clique pour l'ouvrir.
// Bonus compact pour les débutants : idées de plans/tournage. N'apparaît que si le champ existe.
function VisualInspoCard({ items, label, sub }: { items?: string[]; label: string; sub: string }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-black/20 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left touch-manipulation"
      >
        <span className="font-bold text-sm text-white flex items-center gap-2">
          <Icon name="lightbulb" size={16} />
          {label}
        </span>
        <span className="text-white/60"><Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} /></span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-white/50 text-xs">{sub}</p>
          <ul className="space-y-1.5">
            {items.map((v, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/90">
                <Icon name="clapperboard" size={16} /><span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VariationCard({ v, idx, t, platform }: {
  v: ReelResult; idx: number; t: Translations; platform: string;
}) {
  const r = t.generator.results;
  const tr = useReelTranslation(v, platform);
  const reel = tr.activeReel;
  const colors = [
    'from-violet-500 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-orange-400 to-amber-500',
  ];
  return (
    <div className={`bg-gradient-to-br ${colors[idx]} rounded-2xl p-5 text-white shadow-xl`}>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="font-bold text-xl">{r.variation} {idx + 1}</div>
        <TranslateBar tr={tr} />
      </div>
      <div className="space-y-4">
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.hook}</div>
          <div className="text-lg font-bold">"{reel.hook}"</div>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.script}</div>
          <ol className="space-y-1">
            {reel.script.map((s, i) => <li key={i} className="text-sm">• {s}</li>)}
          </ol>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.screenText}</div>
          <div className="flex flex-wrap gap-2">
            {reel.screenText.map((w, i) => (
              <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{w}</span>
            ))}
          </div>
        </div>
        <VisualInspoCard items={reel.visualInspo} label={r.visualInspo} sub={r.visualInspoSub} />
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.caption}</div>
          <div className="text-sm bg-white/10 rounded-xl p-3">{reel.caption}</div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5"><Icon name="clock" size={16} /> {reel.bestTime}</span>
          {platform === 'tiktok' && reel.duration && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5"><Icon name="timer" size={16} /> {reel.duration}</span>
          )}
          {platform === 'tiktok' && reel.soundTrend && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5"><Icon name="music" size={16} /> {reel.soundTrend}</span>
          )}
        </div>
        {platform === 'youtube' && reel.ytTitle && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.ytTitle}</div>
            <div className="text-sm bg-white/10 rounded-xl p-3 font-bold">{reel.ytTitle}</div>
          </div>
        )}
        {platform === 'youtube' && reel.seoDescription && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.seoDescription}</div>
            <div className="text-sm bg-white/10 rounded-xl p-3">{reel.seoDescription}</div>
          </div>
        )}
        {platform === 'youtube' && reel.keywords && reel.keywords.length > 0 && (
          <div>
            <div className="font-semibold text-sm text-white/80 mb-1">{r.keywords}</div>
            <div className="flex flex-wrap gap-2">
              {reel.keywords.map((kw, i) => (
                <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end pt-1">
          <CopyButton text={reelToText(reel, tr.activeLang)} label={r.copyBtn} copiedLabel={r.copied} />
        </div>
      </div>
    </div>
  );
}

// `icon` = LOGO DE MARQUE officiel (simple-icons), pas une icone generique.
const PLATFORM_CONFIGS: Record<string, { icon: IconName; name: string; color: string }> = {
  instagram: { icon: 'instagram', name: 'Instagram Reels', color: 'from-pink-500 to-rose-600' },
  tiktok:    { icon: 'tiktok',    name: 'TikTok',          color: 'from-slate-700 to-slate-900' },
  facebook:  { icon: 'facebook',  name: 'Facebook Reels',  color: 'from-blue-600 to-blue-800' },
  youtube:   { icon: 'youtube',   name: 'YouTube Shorts',  color: 'from-red-600 to-rose-700' },
};

function AllPlatformSection({ platformKey, data, r }: {
  platformKey: keyof typeof PLATFORM_CONFIGS;
  data: ReelResult;
  r: Translations['generator']['results'];
}) {
  const cfg = PLATFORM_CONFIGS[platformKey];
  const tr = useReelTranslation(data, platformKey);
  const reel = tr.activeReel;
  return (
    <div className="rounded-2xl overflow-hidden shadow-xl border border-white/10">
      <div className={`bg-gradient-to-r ${cfg.color} px-5 py-4 flex flex-wrap justify-between items-center gap-2`}>
        <h3 className="text-white font-black text-xl flex items-center gap-2">
          <Icon name={cfg.icon} size={24} />
          {cfg.name}
        </h3>
        <TranslateBar tr={tr} />
      </div>
      <div className="bg-slate-800/80 p-4 space-y-3">
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-1">{r.hook}</div>
          <p className="text-white font-black text-lg">"{reel.hook}"</p>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-2">{r.script}</div>
          <ol className="space-y-1">
            {reel.script.map((s, i) => (
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
            {reel.screenText.map((w, i) => (
              <span key={i} className="bg-white/20 px-3 py-1 rounded-lg text-white font-black">{w}</span>
            ))}
          </div>
        </div>
        <VisualInspoCard items={reel.visualInspo} label={r.visualInspo} sub={r.visualInspoSub} />
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-1">{r.caption}</div>
          <p className="text-sm text-white leading-relaxed">{reel.caption}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="bg-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5"><Icon name="clock" size={16} /> {reel.bestTime}</span>
          {platformKey === 'tiktok' && reel.duration && (
            <span className="bg-red-500/30 text-red-300 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5"><Icon name="timer" size={16} /> {reel.duration}</span>
          )}
          {platformKey === 'tiktok' && reel.soundTrend && (
            <span className="bg-fuchsia-500/30 text-fuchsia-300 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5"><Icon name="music" size={16} /> {reel.soundTrend}</span>
          )}
        </div>
        {platformKey === 'youtube' && reel.ytTitle && (
          <div className="bg-slate-700/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold mb-1">{r.ytTitle}</div>
            <p className="text-white font-bold">{reel.ytTitle}</p>
          </div>
        )}
        {platformKey === 'youtube' && reel.seoDescription && (
          <div className="bg-slate-700/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold mb-1">{r.seoDescription}</div>
            <p className="text-sm text-white leading-relaxed">{reel.seoDescription}</p>
          </div>
        )}
        {platformKey === 'youtube' && reel.keywords && reel.keywords.length > 0 && (
          <div className="bg-slate-700/60 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-semibold mb-2">{r.keywords}</div>
            <div className="flex flex-wrap gap-2">
              {reel.keywords.map((kw, i) => (
                <span key={i} className="bg-green-500/30 text-green-300 px-3 py-1 rounded-full text-sm">{kw}</span>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <CopyButton text={reelToText(reel, tr.activeLang)} label={r.copyBtn} copiedLabel={r.copied} />
        </div>
      </div>
    </div>
  );
}

// Barre d'actions au-dessus d'un résultat frais : Tout copier + Exporter (menu de format).
function ResultsToolbar({ entry, lang, copiedLabel }: {
  entry: LocalHistoryEntry;
  lang: string;
  copiedLabel: string;
}) {
  const fr = lang === 'fr';
  return (
    <div className="flex flex-wrap items-center gap-2 justify-end bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
      <CopyButton
        text={entryToText(entry, lang)}
        label={fr ? 'Tout copier' : 'Copy all'}
        copiedLabel={copiedLabel}
      />
      <ExportMenu onExport={f => exportEntry(entry, f, lang)} lang={lang} />
    </div>
  );
}

// Résultat en mode simple : cartes + barre de traduction (onglets FR|EN).
// La copie, l'export et le « Tout copier » suivent l'onglet actif via `tr.activeReel`.
function SingleResult({ result, platform, t }: { result: ReelResult; platform: string; t: Translations }) {
  const credit = useContext(CreditContext);
  const tr = useReelTranslation(result, platform);
  const reel = tr.activeReel;
  const r = t.generator.results;
  const entry: LocalHistoryEntry = {
    id: 0,
    date: new Date().toISOString(),
    topic: credit?.topic || '',
    platform,
    tone: credit?.tone || '',
    lang: tr.activeLang,
    mode: 'single',
    data: reel,
  };
  return (
    <>
      <ResultsToolbar entry={entry} lang={tr.activeLang} copiedLabel={r.copied} />
      <div className="flex justify-end"><TranslateBar tr={tr} /></div>

      <ResultCard color="bg-gradient-to-br from-violet-600 to-purple-700" icon={r.hookIcon} title={r.hook} sub={r.hookSub} t={r}>
        <p className="text-2xl font-black">"{reel.hook}"</p>
      </ResultCard>

      <ResultCard color="bg-gradient-to-br from-blue-600 to-cyan-600" icon={r.scriptIcon} title={r.script} sub={r.scriptSub} t={r}>
        <ol className="space-y-2">
          {reel.script.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
              <span className="text-sm">{step}</span>
            </li>
          ))}
        </ol>
      </ResultCard>

      <ResultCard color="bg-gradient-to-br from-emerald-500 to-teal-600" icon={r.screenTextIcon} title={r.screenText} sub={r.screenTextSub} t={r}>
        <div className="flex flex-wrap gap-3">
          {reel.screenText.map((w, i) => (
            <span key={i} className="bg-white/20 px-4 py-2 rounded-xl font-black text-xl">{w}</span>
          ))}
        </div>
      </ResultCard>

      <VisualInspoCard items={reel.visualInspo} label={r.visualInspo} sub={r.visualInspoSub} />

      <ResultCard color="bg-gradient-to-br from-pink-500 to-rose-600" icon={r.captionIcon} title={r.caption} sub={r.captionSub} t={r}>
        <p className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{reel.caption}</p>
      </ResultCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard color="bg-gradient-to-br from-amber-500 to-orange-600" icon={r.bestTimeIcon} title={r.bestTime} sub={r.bestTimeSub} t={r}>
          <p className="text-xl font-bold">{reel.bestTime}</p>
        </ResultCard>

        {platform === 'tiktok' && (
          <>
            {reel.duration && (
              <ResultCard color="bg-gradient-to-br from-red-500 to-rose-700" icon={r.durationIcon} title={r.duration} sub={r.durationSub} t={r}>
                <p className="text-3xl font-black">{reel.duration}</p>
              </ResultCard>
            )}
            {reel.soundTrend && (
              <ResultCard color="bg-gradient-to-br from-fuchsia-500 to-violet-700" icon={r.trendIcon} title={r.trend} sub={r.trendSub} t={r}>
                <p className="text-lg font-bold">{reel.soundTrend}</p>
              </ResultCard>
            )}
          </>
        )}
      </div>

      {platform === 'youtube' && (
        <div className="space-y-4">
          {reel.ytTitle && (
            <ResultCard color="bg-gradient-to-br from-red-600 to-rose-700" icon={r.ytTitleIcon} title={r.ytTitle} sub={r.ytTitleSub} t={r}>
              <p className="text-lg font-bold">{reel.ytTitle}</p>
            </ResultCard>
          )}
          {reel.seoDescription && (
            <ResultCard color="bg-gradient-to-br from-sky-600 to-blue-700" icon={r.seoDescriptionIcon} title={r.seoDescription} sub={r.seoDescriptionSub} t={r}>
              <p className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{reel.seoDescription}</p>
            </ResultCard>
          )}
          {reel.keywords && reel.keywords.length > 0 && (
            <ResultCard color="bg-gradient-to-br from-green-600 to-emerald-700" icon={r.keywordsIcon} title={r.keywords} sub={r.keywordsSub} t={r}>
              <div className="flex flex-wrap gap-2">
                {reel.keywords.map((kw, i) => (
                  <span key={i} className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">{kw}</span>
                ))}
              </div>
            </ResultCard>
          )}
        </div>
      )}
    </>
  );
}

export default function Generator({ t, lang, region }: Props) {
  const [topic, setTopic] = useState('');
  // Plateformes cochées. Une seule = comportement d'avant. Plusieurs = un appel
  // par plateforme, en parallèle (voir app/api/generate/route.ts).
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram']);
  // Plateforme « courante » pour les affichages qui n'en attendent qu'une seule.
  const platform = selectedPlatforms.length === 1 ? selectedPlatforms[0] : 'all';
  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev =>
      prev.includes(p)
        ? (prev.length === 1 ? prev : prev.filter(x => x !== p))  // jamais zéro coché
        : [...prev, p],
    );
  const [tone, setTone] = useState('educational');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<{ icon: IconName; text: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<ReelResult | null>(null);
  const [variations, setVariations] = useState<ReelResult[] | null>(null);
  // Une seule idée affichée à la fois (pastilles, comme Original / Traduction)
  const [activeVar, setActiveVar] = useState(0);
  // Etape 2 du chantier "N idees" : zone reveelee sous le grand champ, une fois le bouton clique
  const [showIdeas, setShowIdeas] = useState(false);
  const [ideaTopics, setIdeaTopics] = useState(['', '', '', '']);
  const [activeIdeaTab, setActiveIdeaTab] = useState(0);
  const topicFieldRef = useRef<HTMLDivElement>(null);
  const [ideaResults, setIdeaResults] = useState<{ label: string; data: unknown }[] | null>(null);
  const [allResults, setAllResults] = useState<AllPlatformsResult | null>(null);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const { remaining, consume, init } = useGeneration();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = !!userEmail && ADMIN_EMAILS.includes(userEmail);

  const isPaidPlan = userStats && (userStats.plan === 'creator' || userStats.plan === 'pro' || userStats.plan === 'solo');
  // Solo = forfait « lite » : pas de 4 plateformes, pas de 3 variations, pas de traduction
  const isSolo = !isAdmin && userStats?.plan === 'solo';
  const goPricing = () => { window.location.hash = '#pricing'; };
  const serverRemaining = isPaidPlan
    ? Math.max(0, (userStats!.generationsLimit || 0) - (userStats!.generationsUsed || 0))
    : null;

  // Avertissement : 3 générations restantes pour les abonnés payants
  const showWarning = isPaidPlan && serverRemaining !== null
    && serverRemaining <= 3
    && serverRemaining > 0;

  const g = t.generator;

  // Messages rotatifs pendant le chargement
  useEffect(() => {
    if (!loading) { setLoadingMessage(null); return; }
    const messages: { icon: IconName; text: string }[] = lang === 'fr'
      ? [
          { icon: 'sparkles', text: 'Analyse du sujet...' },
          { icon: 'magnet', text: 'Rédaction du hook...' },
          { icon: 'file-text', text: 'Création du script...' },
          { icon: 'tag', text: 'Ajout des hashtags...' },
          { icon: 'rocket', text: 'Finalisation...' },
        ]
      : [
          { icon: 'sparkles', text: 'Analyzing topic...' },
          { icon: 'magnet', text: 'Writing the hook...' },
          { icon: 'file-text', text: 'Creating the script...' },
          { icon: 'tag', text: 'Adding hashtags...' },
          { icon: 'rocket', text: 'Finalizing...' },
        ];
    let i = 0;
    setLoadingMessage(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMessage(messages[i]);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading, lang]);

  // Scroll automatique vers le résultat
  useEffect(() => {
    if ((result || variations || allResults) && resultRef.current) {
      setTimeout(() => {
        const el = resultRef.current;
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [result, variations, allResults]);

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

  const upgradeCheckout = async (plan: 'creator' | 'pro') => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billing: 'monthly', lang }),
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
  const upgradeToProCheckout = () => upgradeCheckout('pro');
  const upgradeToCreatorCheckout = () => upgradeCheckout('creator');

  const generate = async (withVariations = false) => {
    // Coût en essais/générations : 4 plateformes = 4, 3 variations = 3, sinon 1
    const cost = selectedPlatforms.length > 1 ? selectedPlatforms.length : (withVariations ? 3 : 1);
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
      // Délai selon le mode : les contenus 2026 plus denses prennent plus de temps à générer
      const timeoutMs = selectedPlatforms.length > 1 ? 180000 : withVariations ? 120000 : 90000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // recentHooks : les accroches déjà reçues, pour que l'IA ne se répète pas
          body: JSON.stringify({ topic, platform, platforms: selectedPlatforms, tone,
            variations: withVariations, lang, region,
            recentHooks: user ? getRecentHooks(user.id) : [] }),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setError(lang === 'fr'
            ? "La génération a été interrompue. Cela arrive quand la page est quittée pendant le travail, ou quand l'IA est très sollicitée. Réessayer dans un moment."
            : 'The generation was interrupted. This happens when the page is left during the work, or when the AI is very busy. Please try again in a moment.');
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

      // Solo bridé côté serveur (filet de sécurité si le bouton verrouillé a été contourné)
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'solo_locked') {
          setError(lang === 'fr'
            ? 'Le mode 4 plateformes et les 3 variations sont réservés au forfait Creator. Passe à Creator pour les débloquer.'
            : 'The 4-platform mode and 3-variation mode are reserved for the Creator plan. Upgrade to Creator to unlock them.');
          return;
        }
      }

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      // Décrémenter localStorage pour les non-payants
      if (!isAdmin && !isPaidPlan) consume(cost);

      // Rafraîchir les stats serveur pour les abonnés payants
      if (isPaidPlan) {
        fetch('/api/user/stats').then(r => r.json()).then(setUserStats).catch(() => {});
      }

      if (selectedPlatforms.length > 1 && (data.instagram || data.tiktok || data.facebook || data.youtube)) {
        setAllResults(data);
      } else if (withVariations && data.variations) {
        setVariations(data.variations);
        setActiveVar(0);
      } else {
        setResult(data);
      }

      // Historique complet sauvegardé sur l'appareil du client (rotation automatique selon le plan)
      if (user) {
        const histLimit = historyLimitForPlan(userStats?.plan, isAdmin);
        saveLocalHistory(user.id, {
          id: Date.now(),
          date: new Date().toISOString(),
          topic: topic.slice(0, 120),
          platform,
          tone,
          lang,
          mode: platform === 'all' && data.instagram ? 'all' : (withVariations && data.variations ? 'variations' : 'single'),
          data,
        }, histLimit);
      }
    } catch {
      setError(lang === 'fr' ? 'Erreur lors de la génération. Réessaie !' : 'Generation error. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  // Etape 4 : une idee = un appel a la route existante (meme moteur, meme facturation),
  // le sujet précis de l'idée est ajouté au grand champ. Séquentiel pour que chaque idée
  // connaisse les accroches déjà utilisées par les précédentes (anti-répétition).
  const generateIdeas = async () => {
    const cost = ideaTopics.length * selectedPlatforms.length;
    if (!isAdmin) {
      const limitReached = (!isPaidPlan && remaining < cost) ||
                           (isPaidPlan && serverRemaining !== null && serverRemaining < cost);
      if (limitReached) { setShowPaywall(true); return; }
    }
    setLoading(true);
    setError('');
    setIdeaResults(null);
    const results: { label: string; data: unknown }[] = [];
    let hooks: string[] = user ? getRecentHooks(user.id) : [];
    try {
      for (const ideaTopic of ideaTopics) {
        const combinedTopic = `${topic}\n\nSujet précis de cette idée : ${ideaTopic}`.slice(0, 480);
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: combinedTopic, platform, platforms: selectedPlatforms, tone,
            lang, region, recentHooks: hooks }),
        });
        if (res.status === 429) {
          setError(lang === 'fr' ? 'Limite mensuelle atteinte.' : 'Monthly limit reached.');
          break;
        }
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        results.push({ label: ideaTopic, data });
        const newHooks: string[] = data.hook
          ? [data.hook]
          : Object.values(data as Record<string, { hook?: string }>).map(p => p?.hook).filter((h): h is string => !!h);
        hooks = [...hooks, ...newHooks].slice(0, 25);
      }
      setIdeaResults(results);
      if (!isAdmin && !isPaidPlan) consume(results.length * selectedPlatforms.length);
      if (isPaidPlan) fetch('/api/user/stats').then(r => r.json()).then(setUserStats).catch(() => {});
    } catch {
      setError(lang === 'fr' ? 'Erreur lors de la génération. Réessaie !' : 'Generation error. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  const r = g.results;

  // Reconstruit une entrée (même forme que l'historique) à partir du résultat affiché
  const buildEntry = (mode: LocalHistoryEntry['mode'], data: unknown): LocalHistoryEntry => ({
    id: Date.now(),
    date: new Date().toISOString(),
    topic: topic.slice(0, 120) || (lang === 'fr' ? 'Génération' : 'Generation'),
    platform,
    tone,
    lang,
    mode,
    data,
  });

  // Helpers de crédit transmis aux cartes (via CreditContext) pour la traduction à la demande.
  const ensureCredits = (cost: number): boolean => {
    if (isAdmin) return true;
    const limitReached = (!isPaidPlan && remaining < cost) ||
      (isPaidPlan && serverRemaining !== null && serverRemaining < cost);
    if (limitReached) { setShowPaywall(true); return false; }
    return true;
  };
  const afterConsume = (cost: number) => {
    if (!isAdmin && !isPaidPlan) consume(cost);
    if (isPaidPlan) fetch('/api/user/stats').then(res => res.json()).then(setUserStats).catch(() => {});
  };
  const creditHelpers: CreditHelpers = {
    isAdmin, isSolo, uiLang: lang, sourceLang: lang, topic, tone,
    ensureCredits, afterConsume, openPaywall: () => setShowPaywall(true),
  };

  return (
    <CreditContext.Provider value={creditHelpers}>
    <section id="generator" className="scroll-mt-16 md:scroll-mt-20 py-14 md:pt-8 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-2">{g.title}</h2>
          <p className="text-slate-400 text-sm md:text-base">{g.subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-4 md:p-8 shadow-2xl border border-slate-700 mb-6">
          <div className="space-y-5">
            <div ref={topicFieldRef}>
              <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.topicLabel}</label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value.slice(0, 400))}
                placeholder={g.topicPlaceholder}
                rows={3}
                maxLength={400}
                className="w-full bg-slate-900 text-white rounded-xl p-3 md:p-4 border border-slate-600 focus:border-violet-500 focus:outline-none resize-none placeholder-slate-500 text-sm md:text-base min-h-44 md:min-h-0"
              />
              <div className="flex justify-between items-center mt-1.5">
                {topic.trim().length > 0 && topic.trim().length < 20 ? (
                  <p className="text-amber-400/80 text-xs flex items-center gap-1.5">
                    <Icon name="lightbulb" size={16} />
                    {lang === 'fr'
                      ? 'Plus l\'idée est détaillée, meilleur sera le script !'
                      : 'The more you describe your idea, the better your Reel will be!'}
                  </p>
                ) : <span />}
                <p className={`text-xs ml-auto ${topic.length >= 360 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {topic.length}/400
                </p>
              </div>
              {showIdeas && (
                <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {ideaTopics.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdeaTab(i)}
                        aria-pressed={i === activeIdeaTab}
                        className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                          i === activeIdeaTab
                            ? 'bg-slate-300 text-slate-900'
                            : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {lang === 'fr' ? 'Idée' : 'Idea'} {i + 1}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={ideaTopics[activeIdeaTab]}
                    onChange={e => setIdeaTopics(prev => prev.map((v, i) => i === activeIdeaTab ? e.target.value.slice(0, 80) : v))}
                    placeholder={lang === 'fr' ? 'Sujet précis de cette idée...' : 'Specific topic for this idea...'}
                    maxLength={80}
                    className="w-full bg-slate-900 text-white rounded-xl p-3 border border-slate-600 focus:border-violet-500 focus:outline-none placeholder-slate-500 text-sm"
                  />
                  <button
                    onClick={generateIdeas}
                    disabled={loading || ideaTopics.some(t => t.trim().length === 0)}
                    className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-sm md:text-base min-h-[44px] cursor-pointer touch-manipulation"
                  >
                    {loading
                      ? (lang === 'fr' ? 'Génération...' : 'Generating...')
                      : (lang === 'fr' ? 'Confirmer et générer' : 'Confirm and generate')}
                  </button>
                  {ideaResults && (
                    <p className="text-center text-emerald-400 text-xs">
                      {lang === 'fr' ? `${ideaResults.length}/${ideaTopics.length} idées générées.` : `${ideaResults.length}/${ideaTopics.length} ideas generated.`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2 text-sm md:text-base">{g.platformLabel}</label>
                <div className="flex flex-col gap-2">
                  {(['instagram', 'tiktok', 'facebook', 'youtube'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        if (isSolo && !selectedPlatforms.includes(p)) { setSelectedPlatforms([p]); return; }
                        togglePlatform(p);
                      }}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation ${
                        selectedPlatforms.includes(p)
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-violet-500'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon name={g.platformsIcons[p]} size={20} />
                        {g.platforms[p]}
                      </span>
                    </button>
                  ))}
                  {/* Raccourci « tout cocher » : c'est une action, pas un choix —
                      il ne s'allume donc jamais. Seules les 4 plateformes s'allument. */}
                  <button
                    onClick={() => { if (isSolo) { goPricing(); return; } setSelectedPlatforms(['instagram', 'tiktok', 'facebook', 'youtube']); }}
                    className="px-4 py-3 rounded-xl border text-sm font-bold transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation bg-slate-900 border-slate-600 text-slate-300 hover:border-violet-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      {isSolo && <Icon name="lock" size={20} />}
                      <Icon name={g.platformsIcons.all} size={20} />
                      {g.platforms.all}
                    </span>
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
                      <span className="inline-flex items-center gap-2">
                        <Icon name={g.tonesIcons[tk]} size={20} />
                        {g.tones[tk]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Avertissement limite proche pour abonnés payants */}
            {showWarning && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 text-center">
                <p className="text-amber-400 font-semibold text-sm flex items-center justify-center gap-1.5">
                  <Icon name="alert-triangle" size={16} />
                  {lang === 'fr'
                    ? `Il reste seulement ${serverRemaining} génération${(serverRemaining as number) > 1 ? 's' : ''} (${userStats!.generationsUsed}/${userStats!.generationsLimit} utilisées)`
                    : `Only ${serverRemaining} generation${(serverRemaining as number) > 1 ? 's' : ''} left (${userStats!.generationsUsed}/${userStats!.generationsLimit} used)`}
                </p>
              </div>
            )}

            {platform === 'all' && !isAdmin && !loading && (
              <p className="text-center text-amber-400/80 text-xs flex items-center justify-center gap-1.5">
                <Icon name="alert-triangle" size={16} />
                {lang === 'fr'
                  ? `Note : ${selectedPlatforms.length} plateformes sélectionnées = ${selectedPlatforms.length} essais de votre pack.`
                  : `Note: ${selectedPlatforms.length} platforms selected = ${selectedPlatforms.length} trials from your pack.`}
              </p>
            )}

            <div className="flex flex-col gap-3">
                <button
                  onClick={() => generate(false)}
                  disabled={loading || !topic.trim()}
                  className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {loading
                      ? <><Icon name="loader" size={20} className="animate-spin" />{g.generating}</>
                      : <><Icon name={g.generateBtnIcon} size={20} />{g.generateBtn}</>}
                  </span>
                </button>
                {platform !== 'all' && (
                  <>
                    <button
                      onClick={() => { if (isSolo) { goPricing(); return; } generate(true); }}
                      disabled={loading || !topic.trim()}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {loading ? (
                          <><Icon name="loader" size={20} className="animate-spin" />{g.generating}</>
                        ) : (
                          <>
                            <Icon name={isSolo ? 'lock' : g.variationsBtnIcon} size={20} />
                            {g.variationsBtn}
                          </>
                        )}
                      </span>
                    </button>
                    {!isAdmin && !loading && (
                      <p className="text-center text-amber-400/80 text-xs flex items-center justify-center gap-1.5">
                        <Icon name={isSolo ? 'lock' : 'alert-triangle'} size={16} />
                        {isSolo
                          ? (lang === 'fr'
                              ? 'Les 3 variations sont réservées au forfait Creator.'
                              : 'The 3 variations are reserved for the Creator plan.')
                          : (lang === 'fr'
                              ? 'Note : cette action utilise 3 essais de votre pack.'
                              : 'Note: this action uses 3 trials from your pack.')}
                      </p>
                    )}
                  </>
                )}
                {!isSolo && !isAdmin && (
                  <button
                    onClick={() => {
                      setShowIdeas(true);
                      topicFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    disabled={loading}
                    className="w-full bg-transparent border border-white/40 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg min-h-[52px] cursor-pointer touch-manipulation"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <Icon name={g.ideasBtnIcon} size={20} />{g.ideasBtn}
                    </span>
                  </button>
                )}
                {loading && loadingMessage && (
                  <p className="text-center text-violet-300 text-sm font-medium animate-pulse flex items-center justify-center gap-2">
                    <Icon name={loadingMessage.icon} size={16} />
                    {loadingMessage.text}
                  </p>
                )}
                {/* ── PHRASE D'ATTENTE — supprimer ce bloc entier pour l'enlever ── */}
                {loading && (
                  <p className="text-center text-slate-500 text-xs">
                    {lang === 'fr'
                      ? "Garder cette page ouverte jusqu'à la fin de la génération."
                      : 'Keep this page open until the generation is done.'}
                  </p>
                )}
                {/* ── fin de la phrase d'attente ── */}
              </div>

            <p className="text-center text-slate-500 text-sm">
              {isAdmin
                ? <span className="inline-flex items-center justify-center gap-1.5"><Icon name="infinity" size={16} /> Admin</span>
                : isPaidPlan && serverRemaining !== null
                  ? `${serverRemaining} ${g.remaining} · ${userStats!.plan}`
                  : `${remaining} ${g.remaining}`}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 rounded-xl p-4 mb-6 text-center flex items-center justify-center gap-2">
            <Icon name="alert-triangle" size={20} />
            {error}
          </div>
        )}

        {/* Single Result */}
        {result && (
          <div ref={resultRef} className="space-y-4 animate-fadeIn select-text">
            <SingleResult result={result} platform={platform} t={t} />
          </div>
        )}

        {/* All Platforms */}
        {allResults && (
          <div ref={resultRef} className="space-y-6 animate-fadeIn select-text">
            <ResultsToolbar entry={buildEntry('all', allResults)} lang={lang} copiedLabel={r.copied} />
            {(Object.keys(allResults) as (keyof AllPlatformsResult)[]).map(pk => (
              <AllPlatformSection key={pk} platformKey={pk} data={allResults[pk]} r={r} />
            ))}
          </div>
        )}

        {/* Variations */}
        {variations && (
          <div ref={resultRef} className="space-y-6 animate-fadeIn select-text">
            <ResultsToolbar entry={buildEntry('variations', { variations })} lang={lang} copiedLabel={r.copied} />
            {/* Pastilles : une idée à la fois, même style que Original / Traduction */}
            <div className="flex flex-wrap gap-2">
              {variations.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveVar(i)}
                  aria-pressed={i === activeVar}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                    i === activeVar
                      ? 'bg-slate-300 text-slate-900'
                      : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {r.variation} {i + 1}
                </button>
              ))}
            </div>
            <VariationCard
              key={activeVar}
              v={variations[activeVar]}
              idx={activeVar}
              t={t}
              platform={platform}
            />
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
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
              aria-label={lang === 'fr' ? 'Fermer' : 'Close'}
            ><Icon name="x" size={20} /></button>

            {userStats?.plan === 'solo' ? (
              <>
                <p className="text-xl md:text-2xl font-black text-white mb-4 flex items-center justify-center gap-2">
                  <Icon name="rocket" size={24} />
                  {lang === 'fr'
                    ? 'Tu carbures — le forfait Solo est à fond !'
                    : 'You\'re on fire — your Solo plan is maxed out!'}
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  {lang === 'fr'
                    ? 'Les 60 générations du mois sont utilisées. Tu produis assez pour passer à la vitesse supérieure.'
                    : 'You\'ve used all 60 generations this month. You\'re producing enough to move up a gear.'}
                </p>
                <p className="text-white font-semibold mb-3 flex items-center justify-center gap-2">
                  <Icon name="sparkles" size={20} />
                  {lang === 'fr'
                    ? 'Creator débloque tes super-pouvoirs :'
                    : 'Creator unlocks your superpowers:'}
                </p>
                <ul className="text-slate-300 text-sm mb-6 text-left space-y-1 px-4">
                  <li className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5" /> {lang === 'fr' ? '160 générations par mois' : '160 generations per month'}</li>
                  <li className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5" /> {lang === 'fr' ? 'Les 4 plateformes d\'un coup' : 'All 4 platforms at once'}</li>
                  <li className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5" /> {lang === 'fr' ? 'Les 3 variations par génération' : '3 variations per generation'}</li>
                  <li className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5" /> {lang === 'fr' ? 'Le bilingue (traduction FR ⇄ EN)' : 'Bilingual (FR ⇄ EN translation)'}</li>
                </ul>
                <button
                  onClick={upgradeToCreatorCheckout}
                  disabled={checkoutLoading}
                  className="block w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-70"
                >
                  {checkoutLoading
                    ? <span className="inline-flex items-center justify-center gap-2"><Icon name="loader" size={20} className="animate-spin" /> ...</span>
                    : (lang === 'fr' ? 'Passer à Creator' : 'Upgrade to Creator')}
                </button>
              </>
            ) : userStats?.plan === 'creator' ? (
              <>
                <p className="text-xl md:text-2xl font-black text-white mb-4 flex items-center justify-center gap-2">
                  <Icon name="rocket" size={24} />
                  {lang === 'fr'
                    ? 'Passage à la vitesse supérieure !'
                    : 'You\'re leveling up!'}
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  {lang === 'fr'
                    ? 'Les 160 générations du mois sont rentabilisées. La constance est la meilleure arme pour dominer l\'algorithme sur TikTok, Instagram, YouTube et Facebook.'
                    : 'You\'ve used all 160 of your generations this month. Your consistency is your best weapon to dominate the algorithm on TikTok, Instagram, YouTube and Facebook.'}
                </p>
                <p className="text-slate-300 text-sm mb-4">
                  {lang === 'fr'
                    ? 'Quand l\'ambition grandit, les outils doivent suivre. Pas le moment de freiner l\'élan.'
                    : 'If your ambition is growing, your tools need to grow with you. Don\'t slow down your momentum now.'}
                </p>
                <p className="text-white font-semibold mb-3 flex items-center justify-center gap-2">
                  <Icon name="flame" size={20} />
                  {lang === 'fr'
                    ? 'Débloquer la puissance maximale avec le Plan Agency :'
                    : 'Unlock maximum power with the Agency Plan:'}
                </p>
                <ul className="text-slate-300 text-sm mb-6 text-left space-y-1 px-4">
                  <li className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5" /> {lang === 'fr' ? 'Passer à 1000 générations par mois' : 'Get 1000 generations per month'}</li>
                  <li className="flex items-start gap-2"><Icon name="check" size={16} className="mt-0.5" /> {lang === 'fr' ? 'Historique complet conservé 30 jours au lieu de 7' : 'Keep your full history for 30 days instead of 7'}</li>
                </ul>
                <button
                  onClick={upgradeToProCheckout}
                  disabled={checkoutLoading}
                  className="block w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-70"
                >
                  {checkoutLoading
                    ? <span className="inline-flex items-center justify-center gap-2"><Icon name="loader" size={20} className="animate-spin" /> ...</span>
                    : (lang === 'fr' ? 'Passer au Plan Agency' : 'Upgrade to Agency Plan')}
                </button>
              </>
            ) : isPaidPlan ? (
              <>
                <p className="text-xl md:text-2xl font-black text-white mb-4 flex items-center justify-center gap-2">
                  <Icon name="party-popper" size={24} />
                  {lang === 'fr'
                    ? 'Quel rythme ! Le quota du mois est atteint.'
                    : 'What a pace! You\'ve reached this month\'s quota.'}
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  {lang === 'fr'
                    ? 'Les 1000 générations du mois sont utilisées — bravo pour la constance.'
                    : 'You\'ve used all 1000 generations this month — great consistency.'}
                </p>
                <p className="text-slate-300 text-sm mb-6">
                  {lang === 'fr'
                    ? 'Ton quota se réinitialise le 1er du mois prochain. À très vite !'
                    : 'Your quota resets on the 1st of next month. See you soon!'}
                </p>
                <button
                  onClick={() => setShowPaywall(false)}
                  className="block w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition shadow-lg"
                >
                  {lang === 'fr' ? 'Compris' : 'Got it'}
                </button>
              </>
            ) : (
              <>
                <p className="text-xl md:text-2xl font-black text-white mb-4 flex items-center justify-center gap-2">
                  <Icon name="lightbulb" size={24} />
                  {lang === 'fr'
                    ? 'Le prochain script est à portée de main.'
                    : 'You\'re almost there! Your next Viral Reel is ready.'}
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  {lang === 'fr'
                    ? 'Les 12 générations gratuites sont utilisées. Les créateurs qui réussissent n\'attendent pas l\'inspiration : ils publient régulièrement.'
                    : 'You\'ve used your 12 free generations. Successful creators don\'t wait for inspiration — they post regularly.'}
                </p>
                <p className="text-slate-300 text-sm mb-6">
                  {lang === 'fr'
                    ? 'La page blanche ne doit plus freiner la croissance sur TikTok, Instagram, YouTube et Facebook.'
                    : 'Don\'t let a blank page block your growth on TikTok, Instagram, YouTube and Facebook.'}
                </p>
                <p className="text-white font-semibold mb-6 flex items-center justify-center gap-2">
                  <Icon name="rocket" size={20} />
                  {lang === 'fr'
                    ? 'Continuer à créer des scripts dès maintenant'
                    : 'Keep creating your Viral Reels right now'}
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
    </CreditContext.Provider>
  );
}
