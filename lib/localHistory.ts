// Historique complet des générations, sauvegardé dans le navigateur du client
// (localStorage). Clé par utilisateur Clerk pour supporter plusieurs comptes
// sur un même appareil. Les plus vieilles entrées sont effacées automatiquement
// au-delà de la limite du plan.

export type HistoryMode = 'single' | 'variations' | 'all';

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
