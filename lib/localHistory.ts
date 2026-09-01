// Historique complet des générations, sauvegardé dans le navigateur du client
// (localStorage). Clé par utilisateur Clerk pour supporter plusieurs comptes
// sur un même appareil. Les plus vieilles entrées sont effacées automatiquement
// au-delà de la limite du plan.

// 'ideas' = un lot « 4 idees » enregistre EN UNE SEULE entree, pour que l'historique
// s'ouvre avec les onglets Idee 1-4 comme le resultat. Avant, chaque idee etait une
// entree separee et le lot apparaissait en 4 lignes empilees. 2026-08-19.
// Forme des donnees pour ce mode : { ideas: [{ label, data }] }.
export type HistoryMode = 'single' | 'variations' | 'all' | 'ideas';

// Une traduction transcréée sauvegardée pour un reel de l'entrée.
// Clé : 'single' | 'v<index>' (variation) | '<plateforme>' (mode 4 plateformes).
export interface SavedTranslation {
  region: string;
  targetLang: string;
  reel: unknown; // ReelResult transcréé
}

export interface LocalHistoryEntry {
  id: number;
  date: string;
  topic: string;
  platform: string;
  tone: string;
  lang: string;
  mode: HistoryMode;
  // Réponse complète de /api/generate (ReelResult, { variations } ou AllPlatformsResult)
  data: unknown;
  // Traductions à la demande enregistrées (persistées entre les réouvertures)
  translations?: Record<string, SavedTranslation>;
}

// Limite d'entrées selon le plan (≈ une semaine au rythme maximum du plan)
export function historyLimitForPlan(plan: string | undefined, isAdmin: boolean): number {
  if (isAdmin) return 150;
  if (plan === 'pro') return 150;
  if (plan === 'creator') return 40;
  if (plan === 'solo') return 20;
  return 10; // plan gratuit
}

function storageKey(userId: string): string {
  return `virareel_history_${userId}`;
}

export function getLocalHistory(userId: string): LocalHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Accroches deja produites par ce compte, envoyees a l'IA avec l'ordre de ne pas
// les repeter. C'est ce qui permet a une agence d'enchainer plusieurs series sans
// recevoir deux fois la meme chose.
// L'historique vit dans le NAVIGATEUR : cette memoire est donc par appareil, pas
// par compte — deux postes d'une meme agence ne partagent pas leurs accroches.
//
// Fenetre = 50 (etait 25, releve le 2026-09-01) : une seule generation
// « 4 idees x 4 plateformes » produit 16 accroches et remplissait a elle seule les
// deux tiers de l'ancienne fenetre — a la 2e serie, l'IA avait deja tout oublie.
//
// DEDOUBLONNAGE : en mode 4 plateformes, la meme idee est declinee 4 fois et donne
// des accroches quasi identiques. Sans filtre, elles mangent 4 places pour UNE idee.
// On compare sur une forme normalisee (minuscules, sans ponctuation ni accents) pour
// que la fenetre porte le maximum d'idees DIFFERENTES.
function cleNormalisee(hook: string): string {
  return hook
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRecentHooks(userId: string, max = 50): string[] {
  const hooks: string[] = [];
  const vues = new Set<string>();
  const ajouter = (h: unknown): boolean => {
    if (typeof h !== 'string' || !h.trim()) return false;
    const texte = h.trim().slice(0, 120);
    const cle = cleNormalisee(texte);
    if (!cle || vues.has(cle)) return false;
    vues.add(cle);
    hooks.push(texte);
    return hooks.length >= max;
  };
  // Un reel isole, ou un conteneur de reels (mode 4 plateformes).
  const depuisReel = (v: unknown): boolean => {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    if (typeof o.hook === 'string') return ajouter(o.hook);
    for (const sous of Object.values(o)) {
      if (sous && typeof sous === 'object' && typeof (sous as Record<string, unknown>).hook === 'string') {
        if (ajouter((sous as Record<string, unknown>).hook)) return true;
      }
    }
    return false;
  };
  for (const entry of getLocalHistory(userId)) {
    const data = entry.data as Record<string, unknown> | null;
    if (!data) continue;
    // 4 formes : { hook }, { variations: [...] }, { instagram: {...}, ... }
    // et — oublie jusqu'au 09-01 — { ideas: [{ label, data }] }, la forme d'un lot
    // « 4 idees » depuis le 08-19. Ses accroches n'atteignaient JAMAIS l'IA : une
    // agence enchainant 5 series pouvait recevoir 5 fois la meme chose.
    if (Array.isArray(data.ideas)) {
      for (const it of data.ideas as Record<string, unknown>[]) {
        if (depuisReel(it?.data)) return hooks;
      }
      continue;
    }
    if (Array.isArray(data.variations)) {
      for (const v of data.variations as unknown[]) if (depuisReel(v)) return hooks;
      continue;
    }
    if (depuisReel(data)) return hooks;
  }
  return hooks;
}

// Signal emis a chaque enregistrement. Le panneau d'historique lisait sa liste
// SEULEMENT a l'ouverture : laisse ouvert, il restait sur son affichage d'avant et
// une generation fraiche n'y apparaissait pas. Emis ici plutot qu'aux appelants,
// pour qu'aucun futur enregistrement ne puisse l'oublier. 2026-08-19.
export const HISTORY_EVENT = 'virareel:historique';

export function saveLocalHistory(userId: string, entry: LocalHistoryEntry, limit: number): void {
  if (typeof window === 'undefined') return;
  let entries = [entry, ...getLocalHistory(userId)].slice(0, limit);
  // Si le stockage du navigateur est plein, on retire les plus vieilles jusqu'à ce que ça rentre
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(entries));
      window.dispatchEvent(new Event(HISTORY_EVENT));
      return;
    } catch {
      if (entries.length <= 1) return;
      entries = entries.slice(0, Math.ceil(entries.length / 2));
    }
  }
}

// Enregistre une traduction transcréée dans le bon reel d'une entrée existante.
// Renvoie l'historique mis à jour (pour rafraîchir l'état React).
export function saveTranslationToEntry(
  userId: string,
  entryId: number,
  key: string,
  translation: SavedTranslation,
): LocalHistoryEntry[] {
  const updated = getLocalHistory(userId).map(e =>
    e.id === entryId
      ? { ...e, translations: { ...(e.translations || {}), [key]: translation } }
      : e,
  );
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(updated));
    // Émis ICI, pas chez les appelants (même règle que saveLocalHistory) : le
    // générateur enregistre maintenant ses traductions lui aussi, et le panneau
    // historique ouvert doit les voir arriver.
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // Stockage plein → on n'empile pas la traduction (non critique, elle reste en session)
  }
  return updated;
}

export function deleteLocalHistoryEntries(userId: string, ids: number[]): LocalHistoryEntry[] {
  const remaining = getLocalHistory(userId).filter(e => !ids.includes(e.id));
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(remaining));
  } catch {
    // ignore
  }
  return remaining;
}

export function clearLocalHistory(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(userId));
}
