'use client';

import { useSwipe } from '@/lib/useSwipe';
import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { copyText } from '@/lib/clipboard';
import {
  LocalHistoryEntry,
  getLocalHistory,
  deleteLocalHistoryEntries,
  clearLocalHistory,
  saveTranslationToEntry,
} from '@/lib/localHistory';
import { exportEntry, exportAll, reelToText, entryToText } from '@/lib/exportHistory';
import ExportMenu from '@/components/ExportMenu';
import Icon, { type IconName } from '@/components/Icon';
import {
  CreditContext,
  CreditHelpers,
  useReelTranslation,
  TranslateBar,
  ReelResult,
  PersistedTranslation,
} from '@/components/Transcreation';

const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/8x28wP6URfPU02keds9AA00';

// Logos de marque officiels (simple-icons) ; `all` = les 4 plateformes -> LayoutGrid.
const PLATFORM_ICONS: Record<string, IconName> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  youtube: 'youtube',
  all: 'layout-grid',
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

interface ReelData {
  hook?: string;
  script?: string[];
  screenText?: string[];
  visualInspo?: string[];
  caption?: string;
  bestTime?: string;
  duration?: string;
  soundTrend?: string | null;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

// Bloc repliable « 💡 Inspiration visuelle » dans l'historique (idées de plans/tournage).
function VisualInspoBlock({ items, lang }: { items?: string[]; lang: string }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  const fr = lang === 'fr';
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-violet-400 text-xs font-bold flex items-center gap-1 touch-manipulation"
      >
        <Icon name="lightbulb" size={16} />
        {fr ? 'Inspiration visuelle' : 'Visual inspiration'}
        <span className="text-slate-500"><Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} /></span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {items.map((v, i) => (
            <li key={i} className="text-slate-200 text-sm flex gap-2"><Icon name="clapperboard" size={16} /><span>{v}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReelBlock({ reel, lang }: { reel: ReelData; lang: string }) {
  const fr = lang === 'fr';
  return (
    <div className="space-y-3 text-sm">
      {reel.hook && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="magnet" size={16} /> HOOK</div>
          <p className="text-white italic">"{reel.hook}"</p>
        </div>
      )}
      {reel.script && reel.script.length > 0 && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="clapperboard" size={16} /> SCRIPT</div>
          <ul className="space-y-1.5">
            {reel.script.map((s, i) => (
              <li key={i} className="text-slate-200 bg-slate-900/60 rounded-lg px-3 py-2">{s}</li>
            ))}
          </ul>
        </div>
      )}
      {reel.screenText && reel.screenText.length > 0 && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="pencil" size={16} /> {fr ? 'TEXTE ÉCRAN' : 'SCREEN TEXT'}</div>
          <div className="flex flex-wrap gap-2">
            {reel.screenText.map((w, i) => (
              <span key={i} className="bg-white/10 px-3 py-1 rounded-lg text-white text-xs font-bold">{w}</span>
            ))}
          </div>
        </div>
      )}
      <VisualInspoBlock items={reel.visualInspo} lang={lang} />
      {reel.caption && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="file-text" size={16} /> {fr ? 'LÉGENDE' : 'CAPTION'}</div>
          <p className="text-slate-200 whitespace-pre-line">{reel.caption}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
        {reel.bestTime && <span className="inline-flex items-center gap-1"><Icon name="clock" size={16} /> {reel.bestTime}</span>}
        {reel.duration && <span className="inline-flex items-center gap-1"><Icon name="timer" size={16} /> {reel.duration}</span>}
        {reel.soundTrend && <span className="inline-flex items-center gap-1"><Icon name="music" size={16} /> {reel.soundTrend}</span>}
      </div>
      {reel.ytTitle && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="play" size={16} /> {fr ? 'TITRE YOUTUBE' : 'YOUTUBE TITLE'}</div>
          <p className="text-slate-200">{reel.ytTitle}</p>
        </div>
      )}
      {reel.seoDescription && (
        <div>
          <div className="text-violet-400 text-xs font-bold mb-1 flex items-center gap-1.5"><Icon name="search" size={16} /> {fr ? 'DESCRIPTION SEO' : 'SEO DESCRIPTION'}</div>
          <p className="text-slate-300 whitespace-pre-line text-xs">{reel.seoDescription}</p>
        </div>
      )}
      {reel.keywords && reel.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reel.keywords.map((k, i) => (
            <span key={i} className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Bouton « Copier » d'un seul reel — suit l'onglet actif (original ou traduction).
function CopyReelButton({ reel, lang, uiLang }: { reel: ReelData; lang: string; uiLang: string }) {
  const [copied, setCopied] = useState(false);
  const fr = uiLang === 'fr';
  const copy = async () => {
    await copyText(reelToText(reel, lang));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition touch-manipulation"
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? (fr ? 'Copié !' : 'Copied!') : (fr ? 'Copier' : 'Copy')}
      </span>
    </button>
  );
}

// Un reel affiché dans l'historique, avec bouton Traduire + onglets + copie suivant l'onglet.
// La langue source est celle de la génération (entry.lang) ; la traduction est persistée.
function TranslatableReel({
  reel, platform, transKey, entry, userId, uiLang, onSaved,
}: {
  reel: ReelData;
  platform: string;
  transKey: string;
  entry: LocalHistoryEntry;
  userId: string;
  uiLang: string;
  onSaved: (entries: LocalHistoryEntry[]) => void;
}) {
  const saved = entry.translations?.[transKey];
  const initial: PersistedTranslation | null = saved
    ? { region: saved.region, targetLang: saved.targetLang === 'en' ? 'en' : 'fr', reel: saved.reel as ReelResult }
    : null;
  const tr = useReelTranslation(reel as ReelResult, platform, {
    sourceLang: entry.lang === 'en' ? 'en' : 'fr',
    initial,
    onTranslated: t => onSaved(saveTranslationToEntry(userId, entry.id, transKey, t)),
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TranslateBar tr={tr} />
        <CopyReelButton reel={tr.activeReel} lang={tr.activeLang} uiLang={uiLang} />
      </div>
      <ReelBlock reel={tr.activeReel} lang={tr.activeLang} />
    </div>
  );
}

// Une seule variation affichée à la fois — mêmes pastilles que dans le générateur.
function VariationsDetails({ entry, lang, common }: {
  entry: LocalHistoryEntry;
  lang: string;
  common: {
    entry: LocalHistoryEntry;
    userId: string;
    uiLang: string;
    onSaved: (entries: LocalHistoryEntry[]) => void;
  };
}) {
  const [active, setActive] = useState(0);
  const vars = ((entry.data as Record<string, unknown>).variations as ReelData[]) || [];
  if (vars.length === 0) return null;
  const i = Math.min(active, vars.length - 1);
  const label = lang === 'fr' ? 'Variation' : 'Variation';
  const swipe = useSwipe(
    () => setActive(n => Math.max(0, n - 1)),
    () => setActive(n => Math.min(vars.length - 1, n + 1)),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {vars.map((_, n) => (
          <button
            key={n}
            onClick={() => setActive(n)}
            aria-pressed={n === i}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
              n === i
                ? 'bg-slate-300 text-slate-900'
                : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label} {n + 1}
          </button>
        ))}
      </div>
      <div className="border border-slate-700 rounded-xl p-4" {...swipe}>
        <div className="text-white font-bold mb-3 flex items-center gap-2">
          <Icon name="sparkles" size={20} /> {label} {i + 1}
        </div>
        <TranslatableReel key={i} reel={vars[i]} platform={entry.platform} transKey={`v${i}`} {...common} />
      </div>
    </div>
  );
}

// Un lot « 4 idees » : onglets Idee 1-4, une seule affichee — le miroir exact de ce
// que montre le generateur. A l'interieur d'une idee, les plateformes restent
// empilees, la aussi comme le resultat. 2026-08-19.
function IdeasDetails({ entry, lang, common }: {
  entry: LocalHistoryEntry;
  lang: string;
  common: {
    entry: LocalHistoryEntry;
    userId: string;
    uiLang: string;
    onSaved: (entries: LocalHistoryEntry[]) => void;
  };
}) {
  const [active, setActive] = useState(0);
  const ideas = ((entry.data as Record<string, unknown>).ideas as { label: string; data: unknown }[]) || [];
  if (ideas.length === 0) return null;
  const i = Math.min(active, ideas.length - 1);
  const label = lang === 'fr' ? 'Idée' : 'Idea';
  const swipe = useSwipe(
    () => setActive(n => Math.max(0, n - 1)),
    () => setActive(n => Math.min(ideas.length - 1, n + 1)),
  );
  const cur = ideas[i].data as Record<string, ReelData>;
  const isAll = !!(cur.instagram || cur.tiktok || cur.facebook || cur.youtube);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ideas.map((_, n) => (
          <button
            key={n}
            onClick={() => setActive(n)}
            aria-pressed={n === i}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
              n === i
                ? 'bg-slate-300 text-slate-900'
                : 'bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label} {n + 1}
          </button>
        ))}
      </div>
      <div className="border border-slate-700 rounded-xl p-4 space-y-4" {...swipe}>
        <div className="text-white font-bold flex items-center gap-2">
          <Icon name="sparkles" size={20} /> {label} {i + 1}
          {ideas[i].label && <span className="font-normal text-slate-400 text-sm">— {ideas[i].label}</span>}
        </div>
        {isAll ? (
          (['instagram', 'tiktok', 'facebook', 'youtube'] as const).filter(p => cur[p]).map(p => (
            <div key={p} className="border border-slate-700 rounded-xl p-4">
              <div className="text-white font-bold mb-3">{PLATFORM_ICONS[p]} {PLATFORM_NAMES[p]}</div>
              <TranslatableReel key={`${i}-${p}`} reel={cur[p]} platform={p} transKey={`i${i}-${p}`} {...common} />
            </div>
          ))
        ) : (
          <TranslatableReel key={i} reel={cur as unknown as ReelData} platform={entry.platform} transKey={`i${i}`} {...common} />
        )}
      </div>
    </div>
  );
}

function EntryDetails({ entry, lang, userId, onSaved }: {
  entry: LocalHistoryEntry;
  lang: string;
  userId: string;
  onSaved: (entries: LocalHistoryEntry[]) => void;
}) {
  const d = entry.data as Record<string, unknown>;
  const common = { entry, userId, uiLang: lang, onSaved };
  if (entry.mode === 'all') {
    return (
      <div className="space-y-5">
        {(['instagram', 'tiktok', 'facebook', 'youtube'] as const).filter(p => d[p]).map(p => (
          <div key={p} className="border border-slate-700 rounded-xl p-4">
            <div className="text-white font-bold mb-3">{PLATFORM_ICONS[p]} {PLATFORM_NAMES[p]}</div>
            <TranslatableReel reel={d[p] as ReelData} platform={p} transKey={p} {...common} />
          </div>
        ))}
      </div>
    );
  }
  if (entry.mode === 'variations') {
    return <VariationsDetails entry={entry} lang={lang} common={common} />;
  }
  if (entry.mode === 'ideas') {
    return <IdeasDetails entry={entry} lang={lang} common={common} />;
  }
  return <TranslatableReel reel={d as ReelData} platform={entry.platform} transKey="single" {...common} />;
}

export default function History({ lang }: { lang: string }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [plan, setPlan] = useState<string>('free');
  const isPaid = plan === 'creator' || plan === 'pro' || plan === 'solo';
  const [history, setHistory] = useState<LocalHistoryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const fr = lang === 'fr';

  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/user/stats').then(r => r.json()).then(d => setPlan(d.plan || 'free')).catch(() => {});
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn && user && open) {
      setHistory(getLocalHistory(user.id));
    }
  }, [isSignedIn, user, open]);

  const toggleSelect = (id: number) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };

  const deleteSelected = () => {
    if (!user || selected.length === 0) return;
    const msg = fr
      ? `Supprimer ${selected.length} génération${selected.length > 1 ? 's' : ''} ? Cette action est définitive.`
      : `Delete ${selected.length} generation${selected.length > 1 ? 's' : ''}? This cannot be undone.`;
    if (!confirm(msg)) return;
    setHistory(deleteLocalHistoryEntries(user.id, selected));
    setSelected([]);
    setExpandedId(null);
  };

  const clearAll = () => {
    if (!user) return;
    if (!confirm(fr ? "Effacer tout l'historique ? Cette action est définitive." : 'Clear all history? This cannot be undone.')) return;
    clearLocalHistory(user.id);
    setHistory([]);
    setSelected([]);
    setExpandedId(null);
  };

  const copyEntry = async (entry: LocalHistoryEntry) => {
    await copyText(entryToText(entry, lang));
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helpers de crédit pour la traduction à la demande dans l'historique.
  // Le quota réel est appliqué côté serveur (/api/transcreate → 429) : on reste
  // optimiste ici et on renvoie vers les forfaits si la limite est atteinte.
  const isAdmin = plan === 'admin';
  const creditHelpers: CreditHelpers = {
    isAdmin,
    isSolo: plan === 'solo',
    uiLang: lang,
    sourceLang: lang, // repli ; la vraie source est fixée par reel (entry.lang)
    topic: '',
    tone: '',
    ensureCredits: () => true,
    afterConsume: () => {
      if (isSignedIn) {
        fetch('/api/user/stats').then(r => r.json()).then(d => setPlan(d.plan || 'free')).catch(() => {});
      }
    },
    openPaywall: () => { if (typeof window !== 'undefined') window.location.hash = '#pricing'; },
    // Historique = utilisateurs connectés seulement (voir garde plus bas) → jamais anonyme,
    // ce mur ne se déclenche donc jamais ici. Fourni seulement pour satisfaire le type.
    openEmailGate: () => {},
  };

  if (!isSignedIn) return null;

  return (
    <CreditContext.Provider value={creditHelpers}>
    <section className="py-10 px-4 bg-slate-900/50">
      <div className="max-w-4xl mx-auto space-y-3">

        {/* Bouton gérer abonnement — Creator et Pro seulement */}
        {isPaid && (
          <a
            href={STRIPE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl p-4 transition text-slate-300 hover:text-white font-semibold text-sm"
          >
            <Icon name="settings" size={20} />
            {fr ? 'Gérer mon abonnement' : 'Manage my subscription'}
          </a>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl p-4 transition touch-manipulation"
        >
          <span className="text-white font-bold text-lg flex items-center gap-2">
            <Icon name="copy" size={20} />
            {fr ? 'Historique de mes générations' : 'My generation history'}
          </span>
          <span className="text-slate-400"><Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} /></span>
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            <p className="text-slate-500 text-xs text-center flex items-center justify-center gap-1.5">
              <Icon name="save" size={16} />
              {fr
                ? "L'historique est sauvegardé sur cet appareil. Penser à copier les scripts favoris avant d'en changer."
                : 'Your history is saved on this device. Remember to copy your favorite Reels before switching devices.'}
            </p>

            {history.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                {fr ? 'Aucune génération encore.' : 'No generations yet.'}
              </p>
            ) : (
              <>
                {/* flex-wrap + ml-auto : sur téléphone les 2 boutons descendent sur
                    leur propre ligne, alignés à droite (sans ça « Effacer l'historique »
                    sortait de l'écran). Sur portable, la ligne est large : rien ne passe
                    à la ligne et ml-auto donne exactement le même résultat que justify-between. */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {selected.length > 0 ? (
                    <button
                      onClick={deleteSelected}
                      className="bg-red-500/15 border border-red-500/40 text-red-300 hover:text-red-200 text-sm font-semibold rounded-lg px-3 py-1.5 transition touch-manipulation"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="trash" size={16} />
                        {fr ? `Supprimer la sélection (${selected.length})` : `Delete selected (${selected.length})`}
                      </span>
                    </button>
                  ) : (
                    <span className="text-slate-500 text-xs">
                      {fr ? 'Coche des générations pour faire du ménage.' : 'Check generations to clean up.'}
                    </span>
                  )}
                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <ExportMenu
                      onExport={f => exportAll(history, f, lang)}
                      lang={lang}
                      label={fr ? 'Exporter tout' : 'Export all'}
                      className="text-violet-300 hover:text-violet-200 text-sm font-semibold transition touch-manipulation"
                    />
                    <button
                      onClick={clearAll}
                      className="text-red-400 hover:text-red-300 text-sm transition touch-manipulation"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="trash" size={16} />
                        {fr ? "Effacer l'historique" : 'Clear history'}
                      </span>
                    </button>
                  </div>
                </div>

                {history.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const firstHook =
                    (entry.data as Record<string, ReelData>)?.instagram?.hook ||
                    ((entry.data as { variations?: ReelData[] })?.variations?.[0]?.hook) ||
                    (entry.data as ReelData)?.hook || '';
                  return (
                    <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                      <div className="flex items-start gap-3 p-4">
                        <input
                          type="checkbox"
                          checked={selected.includes(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          onClick={e => e.stopPropagation()}
                          className="mt-1 h-5 w-5 shrink-0 accent-violet-500 cursor-pointer touch-manipulation"
                        />
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="flex-1 text-left touch-manipulation"
                        >
                          <span className="text-slate-400 text-xs inline-flex items-center gap-1.5 flex-wrap">
                            <Icon name={PLATFORM_ICONS[entry.platform] || 'clapperboard'} size={16} />
                            {new Date(entry.date).toLocaleDateString(
                              fr ? 'fr-CA' : 'en-US',
                              { day: 'numeric', month: 'short', year: 'numeric' }
                            )}
                            {entry.mode === 'variations' && <span className="ml-2 inline-flex items-center gap-1"><Icon name="sparkles" size={16} /> x3</span>}
                            {entry.mode === 'all' && (
                              <span className="ml-2 inline-flex items-center gap-1">
                                <Icon name="layout-grid" size={16} /> 4
                              </span>
                            )}
                          </span>
                          <p className="text-white font-semibold text-sm mt-0.5">{entry.topic}</p>
                          {firstHook && <p className="text-violet-300 text-sm italic mt-1">"{firstHook}"</p>}
                          <span className="inline-flex items-center gap-1 mt-2 text-violet-400 text-xs font-semibold">
                            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} />
                            {isExpanded ? (fr ? 'Fermer' : 'Close') : (fr ? 'Ouvrir' : 'Open')}
                          </span>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-slate-700 p-4 space-y-4 select-text">
                          <div className="flex justify-end gap-2">
                            <ExportMenu onExport={f => exportEntry(entry, f, lang)} lang={lang} />
                            <button
                              onClick={() => copyEntry(entry)}
                              className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition touch-manipulation"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon name={copiedId === entry.id ? 'check' : 'copy'} size={16} />
                                {copiedId === entry.id ? (fr ? 'Copié !' : 'Copied!') : (fr ? 'Tout copier' : 'Copy all')}
                              </span>
                            </button>
                          </div>
                          <EntryDetails entry={entry} lang={lang} userId={user?.id || ''} onSaved={setHistory} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </section>
    </CreditContext.Provider>
  );
}
