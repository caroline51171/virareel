'use client';

// ─── Traduction / transcréation à la demande (reel bilingue) ──────────────────
// Brique PARTAGÉE entre le générateur (résultats frais) et l'historique.
// Chaque reel affiché peut être transcréé dans l'autre langue via /api/transcreate
// (= 1 génération de plus). Le contexte transmet les infos de quota/crédit depuis
// le composant hôte (Generator ou History) jusqu'aux cartes, sans prop drilling.

import { useState, useContext, createContext } from 'react';
import Icon from './Icon';

export interface ReelResult {
  hook: string;
  script: string[];
  screenText: string[];
  visualInspo?: string[];
  caption: string;
  bestTime: string;
  duration?: string;
  soundTrend?: string | null;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

export interface CreditHelpers {
  isAdmin: boolean;
  isSolo: boolean;     // forfait « lite » : transcréation bilingue verrouillée (Creator+)
  uiLang: string;      // langue de l'interface
  sourceLang: string;  // langue par défaut des reels (surchargée par reel via opts)
  topic: string;
  tone: string;
  ensureCredits: (cost: number) => boolean; // false + ouvre le paywall si quota insuffisant
  afterConsume: (cost: number) => void;      // met à jour les compteurs après un succès
  openPaywall: () => void;
  // Mur du courriel (essai anonyme, cf Generator.tsx). `retry` est rappelée une fois le
  // courriel donné, pour relancer la demande interrompue au lieu de faire recliquer.
  openEmailGate: (retry?: () => void) => void;
}
export const CreditContext = createContext<CreditHelpers | null>(null);

// Marchés cibles proposés selon la langue de destination.
// Code pays en texte : les emoji drapeaux ne s'affichent pas sur Windows.
export const TRANSLATE_TARGETS: Record<'fr' | 'en', { key: string; fr: string; en: string }[]> = {
  en: [
    { key: 'us', fr: 'US · États-Unis', en: 'US · United States' },
    { key: 'uk', fr: 'UK · Royaume-Uni', en: 'UK · United Kingdom' },
    { key: 'au', fr: 'AU · Australie', en: 'AU · Australia' },
    { key: 'ca-en', fr: 'CA · Canada', en: 'CA · Canada' },
    { key: 'other-en', fr: 'Anglais international', en: 'International English' },
  ],
  fr: [
    { key: 'qc', fr: 'QC · Québec', en: 'QC · Québec' },
    { key: 'fr', fr: 'FR · France', en: 'FR · France' },
    { key: 'be', fr: 'BE · Belgique', en: 'BE · Belgium' },
    { key: 'other-fr', fr: 'Français international', en: 'International French' },
  ],
};

// Traduction persistée (historique) : reel transcréé + marché cible choisi
export interface PersistedTranslation {
  region: string;
  targetLang: 'fr' | 'en';
  reel: ReelResult;
}

interface TranslationOpts {
  // Langue source de CE reel (l'historique la fixe par génération via entry.lang).
  // Si absente, on retombe sur credit.sourceLang.
  sourceLang?: 'fr' | 'en';
  // Traduction déjà enregistrée à charger au montage (historique).
  initial?: PersistedTranslation | null;
  // Appelé après une traduction réussie → l'hôte peut la persister.
  onTranslated?: (t: PersistedTranslation) => void;
}

export function useReelTranslation(original: ReelResult, platform: string, opts?: TranslationOpts) {
  const credit = useContext(CreditContext);
  const [translated, setTranslated] = useState<ReelResult | null>(opts?.initial?.reel ?? null);
  const [tab, setTab] = useState<'orig' | 'trad'>('orig');
  const [region, setRegion] = useState<string | null>(opts?.initial?.region ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sourceLang: 'fr' | 'en' = opts?.sourceLang ?? (credit?.sourceLang === 'en' ? 'en' : 'fr');
  const targetLang: 'fr' | 'en' = sourceLang === 'fr' ? 'en' : 'fr';

  // `skipLocalCheck` : relance automatique après le courriel. Le compteur affiché date
  // d'avant le déblocage, donc on laisse le serveur trancher plutôt que de bloquer à tort.
  const translate = async (targetRegion: string, skipLocalCheck = false) => {
    if (!credit || loading) return;
    if (!skipLocalCheck && !credit.ensureCredits(1)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/transcreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reel: original, targetLang, targetRegion, platform }),
      });
      if (res.status === 428) {
        credit.openEmailGate(() => translate(targetRegion, true));
        return;
      }
      if (res.status === 429) {
        credit.openPaywall();
        setError(credit.uiLang === 'fr' ? 'Limite atteinte.' : 'Limit reached.');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTranslated(data);
      setRegion(targetRegion);
      setTab('trad');
      credit.afterConsume(1);
      opts?.onTranslated?.({ region: targetRegion, targetLang, reel: data });
    } catch {
      setError(credit.uiLang === 'fr' ? 'Traduction échouée, réessaie.' : 'Translation failed, try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeReel = tab === 'trad' && translated ? translated : original;
  const activeLang: 'fr' | 'en' = tab === 'trad' && translated ? targetLang : sourceLang;
  return { activeReel, activeLang, translated, tab, setTab, translate, loading, error, targetLang, region };
}

export type ReelTranslation = ReturnType<typeof useReelTranslation>;

// Bouton « Traduire » + menu de région, ou onglets Original | Traduction une fois traduit.
export function TranslateBar({ tr }: { tr: ReelTranslation }) {
  const credit = useContext(CreditContext);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!credit) return null;
  const fr = credit.uiLang === 'fr';
  const targets = TRANSLATE_TARGETS[tr.targetLang];
  const langWord = tr.targetLang === 'en' ? (fr ? "l'anglais" : 'English') : (fr ? 'le français' : 'French');

  // Déjà traduit → onglets pour basculer entre l'original et la version transcréée
  if (tr.translated) {
    const target = targets.find(x => x.key === tr.region);
    const tradLabel = target ? (fr ? target.fr : target.en) : (fr ? 'Traduction' : 'Translation');
    const tabBtn = (active: boolean) =>
      `text-xs px-3 py-1.5 rounded-full font-semibold transition ${active ? 'bg-white text-slate-900' : 'bg-white/20 text-white hover:bg-white/30'}`;
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => tr.setTab('orig')} className={tabBtn(tr.tab === 'orig')}>{fr ? 'Original' : 'Original'}</button>
        <button onClick={() => tr.setTab('trad')} className={tabBtn(tr.tab === 'trad')}>
          <span className="inline-flex items-center gap-1.5"><Icon name="languages" size={16} /> {tradLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(o => !o)}
        disabled={tr.loading}
        className="text-xs px-3 py-2 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition font-medium min-h-[36px] disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-1.5">
          {tr.loading ? (
            <><Icon name="loader" size={16} className="animate-spin" />{fr ? 'Traduction…' : 'Translating…'}</>
          ) : (
            <><Icon name="languages" size={16} />{fr ? 'Traduire vers ' + langWord : 'Translate to ' + langWord}</>
          )}
        </span>
      </button>
      {!credit.isAdmin && !tr.loading && !menuOpen && (
        <p className="text-amber-300/90 text-[11px] mt-1 flex items-center justify-end gap-1"><Icon name="alert-triangle" size={16} /> {fr ? '1 génération de votre pack' : '1 generation from your pack'}</p>
      )}
      {menuOpen && !tr.loading && (
        <div className="absolute right-0 z-20 mt-1 w-56 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-2 text-left">
          {!credit.isAdmin && (
            <p className="text-amber-300 text-[11px] px-2 py-1 flex items-center gap-1"><Icon name="alert-triangle" size={16} /> {fr ? 'Traduire = 1 génération de votre pack.' : 'Translating = 1 generation from your pack.'}</p>
          )}
          <p className="text-slate-400 text-[11px] px-2 pb-1">{fr ? 'Choisis le marché cible :' : 'Choose the target market:'}</p>
          {targets.map(tg => (
            <button
              key={tg.key}
              onClick={() => { setMenuOpen(false); tr.translate(tg.key); }}
              className="block w-full text-left text-sm text-slate-200 hover:bg-slate-700 rounded-lg px-2 py-2"
            >
              {fr ? tg.fr : tg.en}
            </button>
          ))}
        </div>
      )}
      {tr.error && <p className="text-red-400 text-xs mt-1 text-right">{tr.error}</p>}
    </div>
  );
}
