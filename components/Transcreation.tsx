
// ─── Traduction / transcréation à la demande (reel bilingue) ──────────────────
// Brique PARTAGÉE entre le générateur (résultats frais) et l'historique.
// Chaque reel affiché peut être transcréé dans l'autre langue via /api/transcreate
// (= 1 génération de plus). Le contexte transmet les infos de quota/crédit depuis
// le composant hôte (Generator ou History) jusqu'aux cartes, sans prop drilling.

import { useWakeLock } from '@/lib/useWakeLock';
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

// Tous les marchés, les deux langues confondues. Un script québécois peut viser la
// France ou la Belgique : le serveur réécrit dans la langue ET le marché demandés,
// il n'a jamais exigé de changer de langue.
const TOUS_MARCHES = [...TRANSLATE_TARGETS.fr, ...TRANSLATE_TARGETS.en];

function langueDuMarche(key: string): 'fr' | 'en' {
  return TRANSLATE_TARGETS.fr.some(m => m.key === key) ? 'fr' : 'en';
}

export function nomDuMarche(key: string, uiFr: boolean): string {
  const m = TOUS_MARCHES.find(x => x.key === key);
  return m ? (uiFr ? m.fr : m.en) : key;
}

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
  // Traductions déjà enregistrées à charger au montage (historique), dans l'ordre.
  initial?: PersistedTranslation[] | null;
  // Appelé après une traduction réussie → l'hôte peut la persister.
  onTranslated?: (t: PersistedTranslation) => void;
}

export function useReelTranslation(original: ReelResult, platform: string, opts?: TranslationOpts) {
  const credit = useContext(CreditContext);
  // Plusieurs marchés par script : une agence traduit pour les États-Unis, puis pour le
  // Royaume-Uni, et garde les deux. L'ordre d'ajout est l'ordre des pastilles.
  const [versions, setVersions] = useState<PersistedTranslation[]>(opts?.initial ?? []);
  // 0 = l'original, sinon versions[tab - 1].
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const wake = useWakeLock();
  const [error, setError] = useState('');

  const sourceLang: 'fr' | 'en' = opts?.sourceLang ?? (credit?.sourceLang === 'en' ? 'en' : 'fr');

  // `skipLocalCheck` : relance automatique après le courriel. Le compteur affiché date
  // d'avant le déblocage, donc on laisse le serveur trancher plutôt que de bloquer à tort.
  const translate = async (targetRegion: string, skipLocalCheck = false) => {
    if (!credit || loading) return;
    if (!skipLocalCheck && !credit.ensureCredits(1)) return;
    setLoading(true);
    wake.acquire();
    setError('');
    try {
      const res = await fetch('/api/transcreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reel: original, targetLang: langueDuMarche(targetRegion), targetRegion, platform }),
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
      const version: PersistedTranslation = { region: targetRegion, targetLang: langueDuMarche(targetRegion), reel: data };
      setVersions(l => [...l, version]);
      setTab(versions.length + 1);
      credit.afterConsume(1);
      opts?.onTranslated?.(version);
    } catch {
      setError(credit.uiLang === 'fr' ? 'Traduction échouée, réessaie.' : 'Translation failed, try again.');
    } finally {
      setLoading(false);
      wake.release();
    }
  };

  const active = tab > 0 ? versions[tab - 1] : null;
  const activeReel = active ? active.reel : original;
  const activeLang: 'fr' | 'en' = active ? active.targetLang : sourceLang;
  // Bornes aux extrémités, comme les variations et les 4 idées : arrivé au bout,
  // glisser ne ramène pas au début.
  const prev = () => setTab(i => Math.max(0, i - 1));
  const next = () => setTab(i => Math.min(versions.length, i + 1));
  return { activeReel, activeLang, versions, tab, setTab, translate, loading, error, prev, next };
}

export type ReelTranslation = ReturnType<typeof useReelTranslation>;

// Bouton « Traduire » + menu de région, ou onglets Original | Traduction une fois traduit.
export function TranslateBar({ tr }: { tr: ReelTranslation }) {
  const credit = useContext(CreditContext);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!credit) return null;
  const fr = credit.uiLang === 'fr';
  const faits = new Set(tr.versions.map(v => v.region));

  // Menu des marchés, en deux groupes. Les marchés déjà faits en sont retirés :
  // on ne peut pas payer deux fois pour le même.
  const menu = menuOpen && !tr.loading ? (
    <div className="absolute right-0 z-20 mt-1 w-56 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-2 text-left">
      {!credit.isAdmin && (
        <p className="text-amber-300 text-[11px] px-2 py-1 flex items-center gap-1"><Icon name="alert-triangle" size={16} /> {fr ? 'Traduire = 1 génération de votre pack.' : 'Translating = 1 generation from your pack.'}</p>
      )}
      <p className="text-slate-400 text-[11px] px-2 pb-1">{fr ? 'Choisis le marché cible :' : 'Choose the target market:'}</p>
      {(['fr', 'en'] as const).map(l => {
        const dispo = TRANSLATE_TARGETS[l].filter(tg => !faits.has(tg.key));
        if (dispo.length === 0) return null;
        return (
          <div key={l}>
            <p className="text-slate-500 text-[11px] font-semibold px-2 pt-1">
              {l === 'fr' ? (fr ? 'Français' : 'French') : (fr ? 'Anglais' : 'English')}
            </p>
            {dispo.map(tg => (
              <button
                key={tg.key}
                onClick={() => { setMenuOpen(false); tr.translate(tg.key); }}
                className="block w-full text-left text-sm text-slate-200 hover:bg-slate-700 rounded-lg px-2 py-2"
              >
                {fr ? tg.fr : tg.en}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  ) : null;

  // Déjà traduit → une pastille par version, comme les variations et les 4 idées.
  // Recliquer la pastille ACTIVE rouvre le menu : aucun bouton de plus à l'écran.
  if (tr.versions.length > 0) {
    const tabBtn = (active: boolean) =>
      `text-xs px-3 py-1.5 rounded-full font-semibold transition ${active ? 'bg-white text-slate-900' : 'bg-white/20 text-white hover:bg-white/30'}`;
    const choisir = (i: number) => (i === tr.tab ? setMenuOpen(o => !o) : (setMenuOpen(false), tr.setTab(i)));
    return (
      <div className="relative">
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => choisir(0)} aria-pressed={tr.tab === 0} className={tabBtn(tr.tab === 0)}>{fr ? 'Original' : 'Original'}</button>
          {tr.versions.map((v, i) => (
            <button key={v.region} onClick={() => choisir(i + 1)} aria-pressed={tr.tab === i + 1} className={tabBtn(tr.tab === i + 1)}>
              <span className="inline-flex items-center gap-1.5"><Icon name="languages" size={16} /> {nomDuMarche(v.region, fr)}</span>
            </button>
          ))}
          {tr.loading && <Icon name="loader" size={16} className="animate-spin text-white" />}
        </div>
        {menu}
        {tr.error && <p className="text-red-400 text-xs mt-1 text-right">{tr.error}</p>}
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
            <><Icon name="languages" size={16} />{fr ? 'Traduire' : 'Translate'}</>
          )}
        </span>
      </button>
      {!credit.isAdmin && !tr.loading && !menuOpen && (
        <p className="text-amber-300/90 text-[11px] mt-1 flex items-center justify-end gap-1"><Icon name="alert-triangle" size={16} /> {fr ? '1 génération de votre pack' : '1 generation from your pack'}</p>
      )}
      {menu}
      {tr.error && <p className="text-red-400 text-xs mt-1 text-right">{tr.error}</p>}
    </div>
  );
}
