// Compteur d'essais anonymes PAR JOUR, pour l'admin — stocké dans Upstash
// (Redis gratuit via Vercel Marketplace) car le site n'a pas de base de données.
// Si les variables d'env ne sont pas configurées, tout reste silencieusement inactif.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }); // YYYY-MM-DD
}

export async function recordAnonTrial(): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    const key = `anon_trials:${dayKey()}`;
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, 60 * 60 * 24 * 90], // 90 jours, pas besoin de garder plus
      ]),
    });
  } catch {
    // Non bloquant : ne jamais faire échouer une génération pour une stat.
  }
}

export async function getAnonTrialsByDay(days: number): Promise<{ date: string; count: number }[]> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return [];
  const dates = Array.from({ length: days }, (_, i) => dayKey(-i));
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify(dates.map(d => ['GET', `anon_trials:${d}`])),
    });
    const results: { result: string | null }[] = await res.json();
    return dates.map((date, i) => ({ date, count: Number(results[i]?.result) || 0 }));
  } catch {
    return [];
  }
}
