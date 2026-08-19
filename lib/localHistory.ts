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

// Les accroches déjà produites pour cet utilisateur, de la plus récente à la plus
// ancienne. Envoyées à la génération pour que l'IA ne se répète pas d'une semaine
// à l'autre sur un même client. L'historique vit dans le navigateur : la mémoire
// est donc par appareil, pas par compte.
export function getRecentHooks(userId: string, max = 25): string[] {
  const hooks: string[] = [];
  for (const entry of getLocalHistory(userId)) {
    const data = entry.data as Record<string, unknown> | null;
    if (!data) continue;
    // 3 formes possibles selon le mode : { hook }, { variations: [...] }, { instagram: {...}, ... }
    const reels = Array.isArray(data.variations)
      ? (data.variations as Record<string, unknown>[])
      : typeof data.hook === 'string'
        ? [data]
        : Object.values(data).filter(v => v && typeof v === 'object') as Record<string, unknown>[];
    for (const reel of reels) {
      const hook = reel?.hook;
      if (typeof hook === 'string' && hook.trim()) hooks.push(hook.trim().slice(0, 120));
      if (hooks.length >= max) return hooks;
    }
  }
  return hooks;
}

export function saveLocalHistory(userId: string, entry: LocalHistoryEntry, limit: number): void {
  if (typeof window === 'undefined') return;
  let entries = [entry, ...getLocalHistory(userId)].slice(0, limit);
  // Si le stockage du navigateur est plein, on retire les plus vieilles jusqu'à ce que ça rentre
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(entries));
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
