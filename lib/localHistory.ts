// Historique complet des générations, sauvegardé dans le navigateur du client
// (localStorage). Clé par utilisateur Clerk pour supporter plusieurs comptes
// sur un même appareil. Les plus vieilles entrées sont effacées automatiquement
// au-delà de la limite du plan.

export type HistoryMode = 'single' | 'variations' | 'all';

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
