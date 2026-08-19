'use client';

import { useState, useEffect, useRef, useContext } from 'react';
import { useUser } from '@clerk/nextjs';
import { Translations } from '@/lib/i18n';
import { copyText } from '@/lib/clipboard';
import { saveLocalHistory, historyLimitForPlan, getRecentHooks, LocalHistoryEntry } from '@/lib/localHistory';
import { exportEntry, entryToText, reelToText } from '@/lib/exportHistory';
import { EMAIL_GATE_LIMIT, ANON_LIMIT, MULTI_BONUS_CREDITS } from '@/lib/limits';
import ExportMenu from '@/components/ExportMenu';
import Icon, { type IconName } from '@/components/Icon';
import {
  ReelResult,
  CreditHelpers,
  CreditContext,
  useReelTranslation,
  TranslateBar,
} from '@/components/Transcreation';

import { isUnlimitedEmail } from '@/lib/access';

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
  // Compteur incrémenté par l'accueil pour ouvrir LA fenêtre paywall d'ici (jamais une copie :
  // un seul texte à maintenir). Chaque incrément = une demande d'ouverture.
  openPaywallSignal?: number;
  // La bannière promo (h-9) décale la barre du site : la barre d'outils collante des
  // résultats doit connaître cet état pour se coller juste en dessous.
  founderOpen?: boolean;
}

// Le compteur d'essais et la disponibilité du bonus 4×4 viennent du SERVEUR
// (`/api/anon-status`, qui lit le cookie signé). Ils vivaient avant dans localStorage :
// quand le navigateur et le serveur se contredisaient, le navigateur refusait la
// génération sans même demander — c'est ce qui cassait le bonus 4 idées × 4 plateformes.
// Ne jamais réintroduire de compteur d'essais côté navigateur.

// Filet « demande trop chère » : il reste des essais/générations, mais pas assez pour CETTE
// demande. On montre le chemin gratuit encore ouvert au lieu du paywall (qui, lui, est réservé
// au vrai zéro). Les deux nombres sont dynamiques : coût = idées × plateformes, ou 3 variations.
function tooExpensiveMsg(
  lang: string,
  left: number,
  cost: number,
  mode: 'platforms' | 'variations' | 'ideas',
  paid: boolean,
): string {
  if (lang === 'fr') {
    const unit = paid ? (left > 1 ? 'générations' : 'génération') : (left > 1 ? 'essais' : 'essai');
    const way = mode === 'variations'
      ? 'Générez sans les 3 variations et c’est gratuit.'
      : mode === 'ideas'
        ? `Réduisez le nombre d’idées ou de plateformes : chaque idée coûte 1 ${paid ? 'génération' : 'essai'} par plateforme.`
        : left > 1
          ? `Choisissez ${left} plateformes et c’est gratuit.`
          : 'Choisissez une seule plateforme et c’est gratuit.';
    return `Il vous reste ${left} ${unit} : cette demande en coûte ${cost}. ${way}`;
  }
  const unit = paid ? (left > 1 ? 'generations' : 'generation') : (left > 1 ? 'trials' : 'trial');
  const way = mode === 'variations'
    ? 'Generate without the 3 variations and it’s free.'
    : mode === 'ideas'
      ? `Lower the number of ideas or platforms: each idea costs 1 ${paid ? 'generation' : 'trial'} per platform.`
      : left > 1
        ? `Pick ${left} platforms and it’s free.`
        : 'Pick a single platform and it’s free.';
  return `You have ${left} ${unit} left: this request costs ${cost}. ${way}`;
}

interface AnonStatus {
  used: number;
  emailGiven: boolean;
  remaining: number;
  bonusLeft: number;
}

// Compteur en deux temps : 12 → 0 sans courriel, puis 6 → 0 après. C'est le serveur qui
// calcule `remaining`, le navigateur ne fait que l'afficher. `refresh()` est rappelé après
// chaque génération et après le courriel donné.
function useGeneration() {
  const [status, setStatus] = useState<AnonStatus>({
    used: 0, emailGiven: false, remaining: EMAIL_GATE_LIMIT, bonusLeft: MULTI_BONUS_CREDITS,
  });
  const refresh = async () => {
    try {
      const res = await fetch('/api/anon-status', { cache: 'no-store' });
      if (res.ok) setStatus(await res.json());
    } catch {
      // Sans réponse on garde l'affichage précédent : le serveur reste seul juge à la
      // génération suivante, un compteur affiché en retard n'accorde aucun droit.
    }
  };
  return { status, refresh };
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

// Copier en 1 clic SANS bouton : on clique le texte, il part au presse-papiers et
// « Copié ✓ » s'affiche 1,5 s. Si l'utilisateur a sélectionné des mots à la main,
// le clic ne copie rien — sa sélection reste intacte (Ctrl+C / Copier du téléphone).
function CopyOnClick({ text, copiedLabel, tag: Tag = 'div', className = '', children }: {
  text: string; copiedLabel: string;
  tag?: 'div' | 'li' | 'p' | 'span';
  className?: string; children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = () => {
    if (typeof window !== 'undefined' && (window.getSelection()?.toString() ?? '').length > 0) return;
    void copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tag
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg transition hover:bg-white/10 active:bg-white/20 ${className}`}
    >
      {children}
      {copied && (
        <span className="absolute -top-2 right-0 z-10 bg-black/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 pointer-events-none">
          <Icon name="check" size={14} />
          {copiedLabel}
        </span>
      )}
    </Tag>
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
          <CopyOnClick text={reel.hook} copiedLabel={r.copied} className="text-lg font-bold">"{reel.hook}"</CopyOnClick>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.script}</div>
          <ol className="space-y-1">
            {reel.script.map((s, i) => (
              <CopyOnClick key={i} tag="li" text={s} copiedLabel={r.copied} className="text-sm">• {s}</CopyOnClick>
            ))}
          </ol>
        </div>
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.screenText}</div>
          <div className="flex flex-wrap gap-2">
            {reel.screenText.map((w, i) => (
              <CopyOnClick key={i} tag="span" text={w} copiedLabel={r.copied} className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{w}</CopyOnClick>
            ))}
          </div>
        </div>
        <VisualInspoCard items={reel.visualInspo} label={r.visualInspo} sub={r.visualInspoSub} />
        <div>
          <div className="font-semibold text-sm text-white/80 mb-1">{r.caption}</div>
          <CopyOnClick text={reel.caption} copiedLabel={r.copied} className="text-sm bg-white/10 rounded-xl p-3">{reel.caption}</CopyOnClick>
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
          <CopyOnClick tag="p" text={reel.hook} copiedLabel={r.copied} className="text-white font-black text-lg">"{reel.hook}"</CopyOnClick>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-2">{r.script}</div>
          <ol className="space-y-1">
            {reel.script.map((s, i) => (
              <CopyOnClick key={i} tag="li" text={s} copiedLabel={r.copied} className="flex gap-2 items-start text-sm text-white">
                <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                {s}
              </CopyOnClick>
            ))}
          </ol>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-2">{r.screenText}</div>
          <div className="flex flex-wrap gap-2">
            {reel.screenText.map((w, i) => (
              <CopyOnClick key={i} tag="span" text={w} copiedLabel={r.copied} className="bg-white/20 px-3 py-1 rounded-lg text-white font-black">{w}</CopyOnClick>
            ))}
          </div>
        </div>
        <VisualInspoCard items={reel.visualInspo} label={r.visualInspo} sub={r.visualInspoSub} />
        <div className="bg-slate-700/60 rounded-xl p-4">
          <div className="text-slate-400 text-xs font-semibold mb-1">{r.caption}</div>
          <CopyOnClick tag="p" text={reel.caption} copiedLabel={r.copied} className="text-sm text-white leading-relaxed">{reel.caption}</CopyOnClick>
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
// COLLANTE : elle reste accrochée sous la barre du site pendant qu'on défile dans les
// résultats (--sticky-top posée sur la racine du générateur selon l'état de la promo),
// pour que les onglets et l'export restent découvrables sans remonter. Fond opacifié
// (900/90 + blur) sinon le texte défile au travers. `children` = pastilles (Variation 1-3).
function ResultsToolbar({ entry, lang, copiedLabel, children }: {
  entry: LocalHistoryEntry;
  lang: string;
  copiedLabel: string;
  children?: React.ReactNode;
}) {
  const fr = lang === 'fr';
  return (
    <div className={`sticky top-[var(--sticky-top)] z-20 flex flex-wrap items-center gap-2 ${children ? 'justify-between' : 'justify-end'} bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-3 py-2`}>
      {children}
      <div className="flex items-center gap-2">
        <CopyButton
          text={entryToText(entry, lang)}
          label={fr ? 'Tout copier' : 'Copy all'}
          copiedLabel={copiedLabel}
        />
        <ExportMenu onExport={f => exportEntry(entry, f, lang)} lang={lang} />
      </div>
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
        <CopyOnClick tag="p" text={reel.hook} copiedLabel={r.copied} className="text-2xl font-black">"{reel.hook}"</CopyOnClick>
      </ResultCard>

      <ResultCard color="bg-gradient-to-br from-blue-600 to-cyan-600" icon={r.scriptIcon} title={r.script} sub={r.scriptSub} t={r}>
        <ol className="space-y-2">
          {reel.script.map((step, i) => (
            <CopyOnClick key={i} tag="li" text={step} copiedLabel={r.copied} className="flex gap-3 items-start">
              <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
              <span className="text-sm">{step}</span>
            </CopyOnClick>
          ))}
        </ol>
      </ResultCard>

      <ResultCard color="bg-gradient-to-br from-emerald-500 to-teal-600" icon={r.screenTextIcon} title={r.screenText} sub={r.screenTextSub} t={r}>
        <div className="flex flex-wrap gap-3">
          {reel.screenText.map((w, i) => (
            <CopyOnClick key={i} tag="span" text={w} copiedLabel={r.copied} className="bg-white/20 px-4 py-2 rounded-xl font-black text-xl">{w}</CopyOnClick>
          ))}
        </div>
      </ResultCard>

      <VisualInspoCard items={reel.visualInspo} label={r.visualInspo} sub={r.visualInspoSub} />

      <ResultCard color="bg-gradient-to-br from-pink-500 to-rose-600" icon={r.captionIcon} title={r.caption} sub={r.captionSub} t={r}>
        <CopyOnClick tag="p" text={reel.caption} copiedLabel={r.copied} className="text-sm leading-relaxed bg-white/10 rounded-xl p-3">{reel.caption}</CopyOnClick>
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

export default function Generator({ t, lang, region, openPaywallSignal = 0, founderOpen = false }: Props) {
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
  // Remonter au champ principal seulement APRÈS la fermeture de la fenêtre : tant qu'elle est
  // ouverte elle couvre l'écran, et le défilement se perdait derrière l'en-tête collant.
  const focusTopicAfterHint = useRef(false);
  const [ideaResults, setIdeaResults] = useState<{ label: string; data: unknown }[] | null>(null);
  const [ideaProgress, setIdeaProgress] = useState(0);
  const [allResults, setAllResults] = useState<AllPlatformsResult | null>(null);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  // Demande d'ouverture venue de l'accueil (0 = état initial, on n'ouvre rien au chargement).
  useEffect(() => {
    if (openPaywallSignal > 0) setShowPaywall(true);
  }, [openPaywallSignal]);
  const [quotaHint, setQuotaHint] = useState('');
  // Fenêtre d'aide « quoi écrire ici » : un seul état pour les deux champs, donc un seul
  // contenant à maintenir ('main' = champ du haut, 'ideas' = les 4 onglets).
  const [helpFor, setHelpFor] = useState<'main' | 'ideas' | 'tone' | null>(null);
  // « Propose-moi 4 angles » : aide a la saisie, ne consomme aucun essai.
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [emailGateValue, setEmailGateValue] = useState('');
  const [emailGateLoading, setEmailGateLoading] = useState(false);
  const [emailGateError, setEmailGateError] = useState('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const { status: anonStatus, refresh: refreshAnon } = useGeneration();
  const multiBonusAvailable = anonStatus.bonusLeft > 0;
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = isUnlimitedEmail(userEmail);

  const isPaidPlan = userStats && (userStats.plan === 'creator' || userStats.plan === 'pro' || userStats.plan === 'solo');
  // Solo = forfait « lite » : pas de 4 plateformes, pas de 3 variations, pas de traduction
  const isSolo = !isAdmin && userStats?.plan === 'solo';
  const goPricing = () => { window.location.hash = '#pricing'; };
  const ideaTimeLabel = selectedPlatforms.length <= 1
    ? (lang === 'fr' ? 'environ 1 minute 30' : 'about 1.5 minutes')
    : (lang === 'fr' ? 'environ 2 minutes' : 'about 2 minutes');
  const serverRemaining = isPaidPlan
    ? Math.max(0, (userStats!.generationsLimit || 0) - (userStats!.generationsUsed || 0))
    : null;

  // Essais restants affichés. Anonyme : compteur en deux temps (12 → 0, puis 6 → 0 après le
  // courriel), calculé par le serveur. Compte gratuit connecté : le mur du courriel ne le
  // concerne pas, son plafond est le total (ANON_LIMIT), donc on repart du nombre utilisé.
  const remaining = user && !isPaidPlan
    ? Math.max(0, ANON_LIMIT - anonStatus.used)
    : anonStatus.remaining;

  // Le mur du courriel est-il encore une porte de sortie ? Tant qu'un visiteur anonyme n'a pas
  // donné son courriel, arriver à 0 n'est PAS la fin du parcours gratuit : il reste les 6 essais
  // à débloquer. On lui repropose donc le courriel à chaque clic, aussi souvent qu'il faut,
  // même s'il quitte le site et revient plus tard. Le paywall est réservé au VRAI zéro.
  const emailGateStillOpen = !user && !anonStatus.emailGiven;

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
    if ((result || variations || allResults || ideaResults) && resultRef.current) {
      setTimeout(() => {
        const el = resultRef.current;
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [result, variations, allResults, ideaResults]);

  // Compteur d'essais et bonus 4×4 : lus au serveur à l'arrivée sur la page.
  useEffect(() => { refreshAnon(); }, []);

  // Le conseil « demande trop chère » ne vaut que pour la demande affichée : dès qu'elle change
  // (plateformes, idées, langue), il devient faux → on l'efface.
  useEffect(() => { setQuotaHint(''); }, [selectedPlatforms.length, ideaTopics.length, showIdeas, lang]);

  // Fetch stats serveur si connecté
  useEffect(() => {
    if (user) {
      fetch('/api/user/stats')
        .then(r => r.json())
        .then(setUserStats)
        .catch(() => {});
    }
  }, [user]);

  // Passe par le portail client Stripe (déjà abonné → changement de forfait avec
  // prorata automatique), PAS par /api/checkout qui créerait un 2e abonnement séparé.
  const upgradeCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setShowPaywall(false); window.location.href = '#pricing'; }
    } catch {
      setShowPaywall(false);
      window.location.href = '#pricing';
    } finally {
      setCheckoutLoading(false);
    }
  };
  const upgradeToProCheckout = () => upgradeCheckout();
  const upgradeToCreatorCheckout = () => upgradeCheckout();

  // Mur du courriel : on retient la demande interrompue pour la relancer toute seule une fois
  // le courriel donné. Sans ça la personne devait recliquer sur Générer.
  const pendingAfterEmail = useRef<(() => void) | null>(null);
  const openEmailGate = (retry?: () => void) => {
    pendingAfterEmail.current = retry ?? null;
    setShowEmailGate(true);
  };

  // Plus aucun essai pour CETTE demande : soit on propose encore le courriel, soit c'est
  // le paywall. Un seul endroit décide, pour que les 3 points d'entrée restent d'accord.
  const blockAtZero = (retry?: () => void) => {
    if (emailGateStillOpen) openEmailGate(retry);
    else setShowPaywall(true);
  };

  const submitEmailGate = async () => {
    setEmailGateLoading(true);
    setEmailGateError('');
    try {
      const res = await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailGateValue.trim() }),
      });
      if (!res.ok) throw new Error();
      setShowEmailGate(false);
      setEmailGateValue('');
      // Le cookie porte maintenant « courriel donné » : le compteur repart de 6.
      await refreshAnon();
      const retry = pendingAfterEmail.current;
      pendingAfterEmail.current = null;
      // `true` = on saute la vérification locale : l'état affiché date d'avant le courriel,
      // et c'est de toute façon le serveur qui autorise ou refuse.
      if (retry) retry();
    } catch {
      setEmailGateError(lang === 'fr'
        ? 'Courriel invalide. Vérifie et réessaie.'
        : 'Invalid email. Please check and try again.');
    } finally {
      setEmailGateLoading(false);
    }
  };

  // `skipLocalCheck` : relance automatique après le courriel. Le compteur affiché date
  // d'avant le déblocage, donc on laisse le serveur trancher plutôt que de bloquer à tort.
  const generate = async (withVariations = false, skipLocalCheck = false) => {
    // Coût en essais/générations : 4 plateformes = 4, 3 variations = 3, sinon 1
    const cost = selectedPlatforms.length > 1 ? selectedPlatforms.length : (withVariations ? 3 : 1);
    // Si limite atteinte → afficher le paywall au lieu de bloquer silencieusement
    if (!isAdmin && !skipLocalCheck) {
      const left = isPaidPlan ? (serverRemaining ?? 0) : remaining;
      if (left < cost) {
        if (left > 0) {
          setQuotaHint(tooExpensiveMsg(lang, left, cost,
            withVariations ? 'variations' : 'platforms', !!isPaidPlan));
          return;
        }
        blockAtZero(() => generate(withVariations, true));
        return;
      }
    }
    if (!topic.trim()) return;
    setQuotaHint('');

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

      // Mur du courriel (essai anonyme, au-delà des 1ers crédits gratuits)
      if (res.status === 428) {
        openEmailGate(() => generate(withVariations, true));
        return;
      }

      // Limite atteinte côté serveur
      if (res.status === 429) {
        const errData = await res.json();
        // Compte gratuit : pas de « limite mensuelle », ses essais sont épuisés →
        // on montre le paywall existant plutôt qu'un message d'erreur sec.
        if (errData.plan === 'free') { setShowPaywall(true); return; }
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

      // Relire le compteur au serveur (il vient d'être décrémenté dans le cookie signé)
      if (!isAdmin && !isPaidPlan) refreshAnon();

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

  // Remplit les 4 champs idee a partir du sujet du haut. Aucun script n'est livre,
  // donc aucun credit ni essai n'est consomme : les champs restent modifiables.
  const proposeAngles = async () => {
    if (!topic.trim()) {
      setError(lang === 'fr'
        ? `Remplissez d'abord le champ « ${g.topicLabel} » en haut.`
        : `Fill in "${g.topicLabel}" at the top first.`);
      return;
    }
    setError('');
    setAnglesLoading(true);
    try {
      const res = await fetch('/api/angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, lang }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (!Array.isArray(data?.angles) || data.angles.length < 4) throw new Error('incomplete');
      setIdeaTopics(data.angles.slice(0, 4).map((a: string) => String(a).slice(0, 80)));
      setActiveIdeaTab(0);
    } catch {
      setError(lang === 'fr'
        ? 'Impossible de proposer des angles pour le moment. Reessayez dans un instant.'
        : 'Could not suggest angles right now. Please try again in a moment.');
    } finally {
      setAnglesLoading(false);
    }
  };

  // Etape 4 : une idee = un appel a la route existante (meme moteur, meme facturation),
  // le sujet précis de l'idée est ajouté au grand champ. Séquentiel pour que chaque idée
  // connaisse les accroches déjà utilisées par les précédentes (anti-répétition).
  // Fermeture de la fenêtre de conseil : si elle demandait de remplir le champ principal,
  // on y remonte ET on y place le curseur, avec une marge pour l'en-tête collant.
  const closeQuotaHint = () => {
    setQuotaHint('');
    if (!focusTopicAfterHint.current) return;
    focusTopicAfterHint.current = false;
    setTimeout(() => {
      const el = topicFieldRef.current;
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' });
      el.querySelector('textarea')?.focus({ preventScroll: true });
    }, 60);
  };

  const generateIdeas = async (skipLocalCheck = false) => {
    // Le champ principal peut être vide si le visiteur descend directement aux 4 idées :
    // le serveur ne le voyait pas (le sujet de l'idée suffisait à la longueur minimale) et
    // l'IA inventait le contexte. On bloque et on le ramène au champ du haut.
    if (!topic.trim()) {
      setQuotaHint(lang === 'fr'
        ? `Remplissez d'abord le champ « ${g.topicLabel} » en haut : les 4 idées servent à le préciser.`
        : `Fill in "${g.topicLabel}" at the top first: the 4 ideas refine it.`);
      focusTopicAfterHint.current = true;
      return;
    }
    const cost = ideaTopics.length * selectedPlatforms.length;
    // L'essai bonus = UN SEUL coup, quelle que soit sa valeur (1 à 16 crédits) : quelqu'un
    // qui essaie 4 idées × 1 plateforme ne doit pas se faire déduire d'essais par surprise.
    // La ligne verte au-dessus du bouton l'invite à prendre les 4 plateformes (16 résultats).
    const isMultiBonus = !isAdmin && !isPaidPlan && multiBonusAvailable;
    if (!isAdmin && !isMultiBonus && !skipLocalCheck) {
      const left = isPaidPlan ? (serverRemaining ?? 0) : remaining;
      if (left < cost) {
        if (left > 0) { setQuotaHint(tooExpensiveMsg(lang, left, cost, 'ideas', !!isPaidPlan)); return; }
        blockAtZero(() => generateIdeas(true));
        return;
      }
    }
    setQuotaHint('');
    setLoading(true);
    setError('');
    setIdeaResults(null);
    setActiveIdeaTab(0);
    setIdeaProgress(0);
    const results: { label: string; data: unknown }[] = [];
    let hooks: string[] = user ? getRecentHooks(user.id) : [];
    try {
      for (let ideaIndex = 0; ideaIndex < ideaTopics.length; ideaIndex++) {
        const ideaTopic = ideaTopics[ideaIndex];
        setIdeaProgress(ideaIndex + 1);
        // Le sujet principal (1200 max) + le separateur + le champ idee (80 max) doivent
        // tenir EN ENTIER. L ancienne coupe a 480 tombait au milieu d un sujet un peu long
        // et faisait disparaitre l idee elle-meme, placee en fin de chaine : les 4 idees
        // sortaient alors identiques. 2026-08-19.
        const combinedTopic = `${topic}\n\nSujet précis de cette idée : ${ideaTopic}`.slice(0, 1400);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000);
        let res: Response;
        try {
          res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: combinedTopic, platform, platforms: selectedPlatforms, tone,
              lang, region, recentHooks: hooks, multiBonus: isMultiBonus,
              // Le mode 4 idées = 4 requêtes : le bonus couvre le lot entier et ne se
              // brûle qu'à la dernière, sinon les idées 2 à 4 seraient facturées.
              multiBonusLast: ideaIndex === ideaTopics.length - 1 }),
            signal: controller.signal,
          });
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            setError(lang === 'fr'
              ? `La génération a été interrompue (idée "${ideaTopic}"). Réessaie dans un moment.`
              : `Generation was interrupted (idea "${ideaTopic}"). Please try again in a moment.`);
            break;
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }
        if (res.status === 428) {
          openEmailGate(() => generateIdeas(true));
          break;
        }
        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          if (errData.plan === 'free') { setShowPaywall(true); break; }
          setError(lang === 'fr' ? 'Limite mensuelle atteinte.' : 'Monthly limit reached.');
          break;
        }
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        results.push({ label: ideaTopic, data });
        if (user) {
          const histLimit = historyLimitForPlan(userStats?.plan, isAdmin);
          saveLocalHistory(user.id, {
            id: Date.now() + ideaIndex,
            date: new Date().toISOString(),
            topic: `${lang === 'fr' ? 'Idée' : 'Idea'} ${ideaIndex + 1} : ${ideaTopic}`.slice(0, 120),
            platform,
            tone,
            lang,
            mode: platform === 'all' && data.instagram ? 'all' : 'single',
            data,
          }, histLimit);
        }
        const newHooks: string[] = data.hook
          ? [data.hook]
          : Object.values(data as Record<string, { hook?: string }>).map(p => p?.hook).filter((h): h is string => !!h);
        hooks = [...hooks, ...newHooks].slice(0, 25);
      }
      setIdeaResults(results);
      // Bonus ou pas, c'est le cookie signé qui a été mis à jour : on le relit.
      if (!isAdmin && !isPaidPlan) refreshAnon();
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
    if (limitReached) { blockAtZero(); return false; }
    return true;
  };
  const afterConsume = (_cost: number) => {
    if (!isAdmin && !isPaidPlan) refreshAnon();
    if (isPaidPlan) fetch('/api/user/stats').then(res => res.json()).then(setUserStats).catch(() => {});
  };
  const creditHelpers: CreditHelpers = {
    isAdmin, isSolo, uiLang: lang, sourceLang: lang, topic, tone,
    ensureCredits, afterConsume, openPaywall: () => setShowPaywall(true),
    openEmailGate,
  };

  return (
    <CreditContext.Provider value={creditHelpers}>
    <section id="generator" className={`scroll-mt-16 md:scroll-mt-20 py-14 md:pt-8 px-4 bg-gradient-to-b from-slate-950 to-slate-900 ${founderOpen ? '[--sticky-top:94px]' : '[--sticky-top:58px]'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-2">{g.title}</h2>
          <p className="text-slate-400 text-sm md:text-base">{g.subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-4 md:p-8 shadow-2xl border border-slate-700 mb-6">
          <div className="space-y-5">
            <div ref={topicFieldRef}>
              <label className="flex items-center gap-1.5 text-white font-semibold mb-2 text-sm md:text-base">
                <span>{g.topicLabel}</span>
                <button
                  type="button"
                  onClick={() => setHelpFor('main')}
                  aria-label={g.helpOpen}
                  className="shrink-0 text-slate-400 hover:text-violet-300 transition cursor-pointer"
                >
                  <Icon name="help-circle" size={20} />
                </button>
              </label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value.slice(0, 1200))}
                placeholder={g.topicPlaceholder}
                rows={3}
                maxLength={1200}
                className="w-full bg-slate-900 text-white rounded-xl p-3 md:p-4 border border-slate-600 focus:border-violet-500 focus:outline-none resize-none placeholder-slate-500 text-sm md:text-base min-h-44 md:min-h-0"
              />
              <div className="flex flex-wrap justify-between items-center gap-y-1 mt-1.5">
                {topic.trim().length > 0 && topic.trim().length < 200 ? (
                  <p className="text-amber-400/80 text-xs flex items-center gap-1.5">
                    <Icon name="lightbulb" size={16} />
                    {lang === 'fr'
                      ? 'Plus l\'idée est détaillée, plus le script sera personnalisé !'
                      : 'The more details you give, the more the script sounds like you!'}
                  </p>
                ) : <span />}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTopic('')}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    <Icon name="refresh-cw" size={14} />
                    {lang === 'fr' ? 'Réinitialiser le contexte' : 'Reset context'}
                  </button>
                  <p className={`text-xs ${topic.length >= 1080 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {topic.length}/1200
                  </p>
                </div>
              </div>
              {showIdeas && (
                <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
                  <p className="text-slate-400 text-xs flex items-start gap-1.5">
                    <span>
                      {lang === 'fr'
                        ? 'Le champ ci-dessus sert maintenant de contexte partagé (à qui, qui parle, le visuel) — indiquez ici 4 sujets précis et différents.'
                        : 'The field above now acts as shared context (who for, who is speaking, the visuals) — enter 4 specific, different topics below.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHelpFor('ideas')}
                      aria-label={g.helpOpen}
                      className="shrink-0 text-slate-400 hover:text-violet-300 transition cursor-pointer"
                    >
                      <Icon name="help-circle" size={16} />
                    </button>
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={proposeAngles}
                      disabled={anglesLoading || loading}
                      className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-200 hover:bg-violet-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <Icon name="sparkles" size={14} />
                      {anglesLoading
                        ? (lang === 'fr' ? 'Recherche des angles...' : 'Finding angles...')
                        : (lang === 'fr' ? 'Propose-moi 4 angles' : 'Suggest 4 angles')}
                    </button>
                    <p className="text-slate-500 text-[11px] mt-1.5">
                      {lang === 'fr'
                        ? "Gratuit, n'utilise aucun essai. Vous pouvez tout modifier ensuite."
                        : 'Free, uses no trial. You can edit everything afterwards.'}
                    </p>
                  </div>
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
                    disabled={anglesLoading}
                    className="w-full bg-slate-900 text-white rounded-xl p-3 border border-slate-600 focus:border-violet-500 focus:outline-none placeholder-slate-500 text-sm disabled:opacity-50"
                  />
                  <div className="flex justify-end items-center gap-2 -mt-1.5">
                    <button
                      type="button"
                      onClick={() => setIdeaTopics(['', '', '', ''])}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <Icon name="refresh-cw" size={14} />
                      {lang === 'fr' ? 'Réinitialiser les idées' : 'Reset ideas'}
                    </button>
                    <p className={`text-xs ${ideaTopics[activeIdeaTab].length >= 72 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {ideaTopics[activeIdeaTab].length}/80
                    </p>
                  </div>
                  {!loading && !isAdmin && !isPaidPlan && multiBonusAvailable && (
                    selectedPlatforms.length === 4 ? (
                      <p className="text-emerald-400/90 text-xs flex items-center justify-center gap-1.5 text-center bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2.5 mt-1 mb-2">
                        <Icon name="gift" size={16} />
                        {lang === 'fr'
                          ? 'Essai bonus hors des essais gratuits : cette génération avec les 4 plateformes est gratuite (une seule fois).'
                          : 'Bonus trial outside your free trials: this generation with all 4 platforms is free (one time only).'}
                      </p>
                    ) : (
                      // Le bonus ne sert qu'une fois : on invite à le dépenser au maximum (16 résultats).
                      <button
                        type="button"
                        onClick={() => setSelectedPlatforms(['instagram', 'tiktok', 'facebook', 'youtube'])}
                        className="w-full text-emerald-400/90 hover:text-emerald-300 text-xs flex items-center justify-center gap-1.5 text-center bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 rounded-xl px-3 py-2.5 mt-1 mb-2 transition cursor-pointer"
                      >
                        <Icon name="gift" size={16} />
                        {lang === 'fr'
                          ? 'Activez les 4 plateformes : vos 16 résultats sont gratuits (essai bonus, une seule fois).'
                          : 'Turn on all 4 platforms: your 16 results are free (bonus trial, one time only).'}
                      </button>
                    )
                  )}
                  {/* Affiché SEULEMENT pendant la génération : « restez sur cette page » n'a de
                      sens qu'à ce moment, et avant le clic il poussait le bouton hors de l'écran
                      sur mobile (sous la barre d'adresse). */}
                  {loading && (
                    <p className="text-amber-400/80 text-xs flex items-center gap-1.5">
                      <Icon name="alert-triangle" size={16} />
                      {lang === 'fr'
                        ? `Cette génération prend ${ideaTimeLabel} (${selectedPlatforms.length} plateforme${selectedPlatforms.length > 1 ? 's' : ''} sélectionnée${selectedPlatforms.length > 1 ? 's' : ''}). Restez sur cette page jusqu'à la fin — vous ne pourrez pas naviguer ailleurs pendant ce temps.`
                        : `This generation takes ${ideaTimeLabel} (${selectedPlatforms.length} platform${selectedPlatforms.length > 1 ? 's' : ''} selected). Stay on this page until it's done — you won't be able to browse elsewhere meanwhile.`}
                    </p>
                  )}
                  <button
                    onClick={() => generateIdeas()}
                    disabled={loading || ideaTopics.some(t => t.trim().length === 0)}
                    className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-sm md:text-base min-h-[44px] cursor-pointer touch-manipulation"
                  >
                    {loading
                      ? (lang === 'fr' ? `Génération... (idée ${ideaProgress}/${ideaTopics.length})` : `Generating... (idea ${ideaProgress}/${ideaTopics.length})`)
                      : (lang === 'fr' ? 'Confirmer et générer' : 'Confirm and generate')}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold text-sm md:text-base">{g.platformLabel}</label>
                <p className="text-slate-400 text-xs mb-2">{g.platformHint}</p>
                <div className="flex flex-col gap-2">
                  {(['instagram', 'tiktok', 'facebook', 'youtube'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
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
                    onClick={() => setSelectedPlatforms(['instagram', 'tiktok', 'facebook', 'youtube'])}
                    className="px-4 py-3 rounded-xl border text-sm font-bold transition text-left min-h-[44px] cursor-pointer select-none touch-manipulation bg-slate-900 border-slate-600 text-slate-300 hover:border-violet-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name={g.platformsIcons.all} size={20} />
                      {g.platforms.all}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-white font-semibold mb-2 text-sm md:text-base">
                  <span>{g.toneLabel}</span>
                  <button
                    type="button"
                    onClick={() => setHelpFor('tone')}
                    aria-label={g.helpToneOpen}
                    className="shrink-0 text-slate-400 hover:text-violet-300 transition cursor-pointer"
                  >
                    <Icon name="help-circle" size={20} />
                  </button>
                </label>
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
                      onClick={() => generate(true)}
                      disabled={loading || !topic.trim()}
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg shadow-lg min-h-[52px] cursor-pointer touch-manipulation"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {loading ? (
                          <><Icon name="loader" size={20} className="animate-spin" />{g.generating}</>
                        ) : (
                          <>
                            <Icon name={g.variationsBtnIcon} size={20} />
                            {g.variationsBtn}
                          </>
                        )}
                      </span>
                    </button>
                    {!isAdmin && !loading && (
                      <p className="text-center text-amber-400/80 text-xs flex items-center justify-center gap-1.5">
                        <Icon name="alert-triangle" size={16} />
                        {lang === 'fr'
                          ? 'Note : cette action utilise 3 essais de votre pack.'
                          : 'Note: this action uses 3 trials from your pack.'}
                      </p>
                    )}
                  </>
                )}
                {!isSolo && (
                  <>
                  {!user && (
                    <p className="text-center text-slate-400 text-xs -mb-1.5">
                      {lang === 'fr'
                        ? 'Fonction des forfaits Créateur et Agence — 1 essai bonus offert, en plus des essais gratuits'
                        : 'Creator & Agency plan feature — 1 bonus trial offered, on top of your free trials'}
                    </p>
                  )}
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
                  </>
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
                    {showIdeas
                      ? (lang === 'fr'
                          ? `Garder cette page ouverte jusqu'à la fin de la génération (${ideaTimeLabel}).`
                          : `Keep this page open until the generation is done (${ideaTimeLabel}).`)
                      : (lang === 'fr'
                          ? "Garder cette page ouverte jusqu'à la fin de la génération."
                          : 'Keep this page open until the generation is done.')}
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
            {/* Pastilles : une idée à la fois, même style que Original / Traduction.
                Dans la barre collante pour rester visibles pendant la lecture d'une carte. */}
            <ResultsToolbar entry={buildEntry('variations', { variations })} lang={lang} copiedLabel={r.copied}>
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
            </ResultsToolbar>
            <VariationCard
              key={activeVar}
              v={variations[activeVar]}
              idx={activeVar}
              t={t}
              platform={platform}
            />
          </div>
        )}

        {/* Idées (étape 5) : pastilles Idée 1-4 en haut, plateformes en dessous */}
        {ideaResults && ideaResults.length > 0 && (
          <div ref={resultRef} className="space-y-6 animate-fadeIn select-text">
            <div className="flex flex-wrap gap-2">
              {ideaResults.map((_, i) => (
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
            {(() => {
              const cur = ideaResults[Math.min(activeIdeaTab, ideaResults.length - 1)];
              if (!cur) return null;
              const d = cur.data as Record<string, ReelResult> & ReelResult;
              const isMulti = !!(d.instagram || d.tiktok || d.facebook || d.youtube);
              return isMulti ? (
                <div className="space-y-6">
                  <ResultsToolbar entry={buildEntry('all', d)} lang={lang} copiedLabel={r.copied} />
                  {(Object.keys(d) as (keyof AllPlatformsResult)[]).map(pk => (
                    <AllPlatformSection key={pk} platformKey={pk} data={d[pk]} r={r} />
                  ))}
                </div>
              ) : (
                <SingleResult result={d} platform={platform} t={t} />
              );
            })()}
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
                    ? 'Le quota se réinitialise le 1er du mois prochain. À très vite !'
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
                    ? `Vos ${ANON_LIMIT} essais gratuits sont utilisés. Les créateurs qui réussissent n'attendent pas l'inspiration : ils publient régulièrement.`
                    : `You've used your ${ANON_LIMIT} free trials. Successful creators don't wait for inspiration — they post regularly.`}
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

      {/* Aide « quoi écrire ici ». Même contenant que les messages bloquants, avec deux
          écarts assumés : texte aligné à GAUCHE (des puces centrées se lisent mal) et
          défilement interne, car à 375 px le contenu dépasse la hauteur de l'écran. */}
      {helpFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setHelpFor(null)} />
          <div className="relative z-10 w-full max-w-md bg-slate-800 border border-violet-500/40 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setHelpFor(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
              aria-label={lang === 'fr' ? 'Fermer' : 'Close'}
            ><Icon name="x" size={20} /></button>

            <p className="text-lg md:text-xl font-black text-white mb-4 flex items-center gap-2 pr-8">
              <Icon name="help-circle" size={24} />
              {helpFor === 'main' ? g.topicHelp.title : helpFor === 'tone' ? g.toneHelp.title : g.ideaHelp.title}
            </p>

            {helpFor === 'main' ? (
              <div className="text-sm text-slate-300 space-y-3">
                <p>{g.topicHelp.intro}</p>
                <ul className="space-y-1.5">
                  {g.topicHelp.bullets.map(b => (
                    <li key={b.k} className="flex gap-2">
                      <span className="text-violet-400 shrink-0">•</span>
                      <span><span className="font-semibold text-white">{b.k}</span> — {b.v}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-slate-400 italic bg-slate-900/60 rounded-xl p-3">{g.topicHelp.exCreator}</p>
                <p className="text-slate-400 italic bg-slate-900/60 rounded-xl p-3">{g.topicHelp.exAgency}</p>
                <p>{g.topicHelp.guard}</p>
                <p className="flex gap-2">
                  <span className="shrink-0 text-amber-400"><Icon name="lightbulb" size={16} /></span>
                  <span>{g.topicHelp.note}</span>
                </p>
              </div>
            ) : helpFor === 'tone' ? (
              <div className="text-sm text-slate-300 space-y-3">
                <p>{g.toneHelp.intro}</p>
                <ul className="space-y-1.5">
                  {g.toneHelp.bullets.map(b => (
                    <li key={b.k} className="flex gap-2">
                      <span className="text-violet-400 shrink-0">•</span>
                      <span><span className="font-semibold text-white">{b.k}</span> — {b.v}</span>
                    </li>
                  ))}
                </ul>
                <p className="flex gap-2">
                  <span className="shrink-0 text-amber-400"><Icon name="lightbulb" size={16} /></span>
                  <span>{g.toneHelp.note}</span>
                </p>
              </div>
            ) : (
              <div className="text-sm text-slate-300 space-y-3">
                <p>{g.ideaHelp.intro}</p>
                <ul className="space-y-1.5">
                  {g.ideaHelp.bullets.map(b => (
                    <li key={b} className="flex gap-2">
                      <span className="text-violet-400 shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-slate-900/60 rounded-xl p-3 space-y-2 text-slate-400">
                  <p className="italic">{g.ideaHelp.exContext}</p>
                  <p>{g.ideaHelp.exIdeasIntro}</p>
                  <ul className="space-y-1 italic">
                    {g.ideaHelp.exIdeas.map(t => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={() => setHelpFor(null)}
              className="block w-full mt-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition shadow-lg cursor-pointer"
            >
              {g.helpClose}
            </button>
          </div>
        </div>
      )}

      {/* Demande trop chère : il reste des essais, mais pas assez pour CELLE-CI. Même fenêtre
          que le mur du courriel et le paywall — un seul contenant pour tous les messages bloquants. */}
      {quotaHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md bg-slate-800 border border-violet-500/40 rounded-2xl p-8 text-center shadow-2xl">
            <button
              onClick={closeQuotaHint}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
              aria-label={lang === 'fr' ? 'Fermer' : 'Close'}
            ><Icon name="x" size={20} /></button>

            <p className="text-xl md:text-2xl font-black text-white mb-4 flex items-center justify-center gap-2">
              <Icon name="lightbulb" size={24} />
              {lang === 'fr' ? 'Une petite adaptation et c\'est parti.' : 'One small tweak and you\'re set.'}
            </p>
            <p className="text-slate-300 text-sm mb-6">{quotaHint}</p>
            <button
              onClick={closeQuotaHint}
              className="block w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition shadow-lg"
            >
              {lang === 'fr' ? 'Ajuster ma demande' : 'Adjust my request'}
            </button>
            <a
              href="#pricing"
              onClick={() => setQuotaHint('')}
              className="block mt-3 text-slate-400 hover:text-slate-200 text-sm underline"
            >
              {lang === 'fr' ? 'Voir les abonnements' : 'See plans'}
            </a>
          </div>
        </div>
      )}

      {/* Mur du courriel : au-delà des 1ers essais gratuits anonymes, avant d'atteindre les 12 */}
      {showEmailGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md bg-slate-800 border border-violet-500/40 rounded-2xl p-8 text-center shadow-2xl">
            <button
              onClick={() => setShowEmailGate(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
              aria-label={lang === 'fr' ? 'Fermer' : 'Close'}
            ><Icon name="x" size={20} /></button>

            <p className="text-xl md:text-2xl font-black text-white mb-4 flex items-center justify-center gap-2">
              <Icon name="sparkles" size={24} />
              {lang === 'fr' ? 'Toute une série de bons scripts à venir.' : 'Looks like you\'re enjoying this!'}
            </p>
            <p className="text-slate-300 text-sm mb-6">
              {lang === 'fr'
                ? `Entrez votre courriel et ${ANON_LIMIT - EMAIL_GATE_LIMIT} essais de plus se débloquent, tout de suite. Aucune carte requise.`
                : `Enter your email and ${ANON_LIMIT - EMAIL_GATE_LIMIT} more trials unlock, right away. No card required.`}
            </p>
            <input
              type="email"
              value={emailGateValue}
              onChange={e => setEmailGateValue(e.target.value)}
              placeholder={lang === 'fr' ? 'nom@courriel.com' : 'your@email.com'}
              className="w-full bg-slate-900 text-white rounded-xl p-3 mb-3 border border-slate-600 focus:border-violet-500 focus:outline-none placeholder-slate-500 text-sm"
            />
            {emailGateError && (
              <p className="text-red-400 text-xs mb-3">{emailGateError}</p>
            )}
            <button
              onClick={submitEmailGate}
              disabled={emailGateLoading || !emailGateValue.trim()}
              className="block w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailGateLoading
                ? <span className="inline-flex items-center justify-center gap-2"><Icon name="loader" size={20} className="animate-spin" /> ...</span>
                : (lang === 'fr' ? 'Débloquer mes essais' : 'Unlock my trials')}
            </button>
          </div>
        </div>
      )}
    </section>
    </CreditContext.Provider>
  );
}
