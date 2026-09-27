import { Resend } from 'resend';

// Courriel d'alerte quand l'IA refuse de travailler pour une raison que SEULE
// Caroline peut régler (crédits vides, limite de dépenses atteinte, clé refusée).
// Sans ça, les clientes voyaient « Beaucoup de monde » ou « Generation failed » et
// personne n'était averti — la nuit en France, ça pouvait durer des heures.
//
// La panne est AUSSI notée dans Redis pour le bandeau rouge de /admin, qui reste
// affiché jusqu'à la prochaine génération réussie (panneIAResolue).
//
// Au plus UN courriel par heure (verrou Redis SET NX EX, partagé entre les serveurs).
// Sans Redis, verrou en mémoire seulement (un courriel par serveur et par heure).
// Jamais bloquant : une alerte ratée ne doit pas changer la réponse à la cliente.

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
const CLE_VERROU = 'alerte-ia:derniere';
const CLE_PANNE = 'alerte-ia:panne';
const UNE_HEURE = 60 * 60;
const SEPT_JOURS = 7 * 24 * UNE_HEURE;

export type CauseIA = 'credits' | 'limite' | 'cle';

export const LIBELLES: Record<CauseIA, { sujet: string; action: string; lien: string }> = {
  credits: {
    sujet: 'Crédits Anthropic épuisés',
    action: 'Ajouter des crédits',
    lien: 'https://platform.claude.com/settings/billing',
  },
  limite: {
    sujet: 'Limite de dépenses Anthropic atteinte',
    action: 'Monter la limite mensuelle',
    lien: 'https://platform.claude.com/settings/limits',
  },
  cle: {
    sujet: 'Clé Anthropic refusée',
    action: 'Vérifier ANTHROPIC_API_KEY dans Vercel (clé révoquée ou expirée ?)',
    lien: 'https://platform.claude.com/settings/keys',
  },
};

/**
 * Reconnaît les pannes que seule Caroline peut régler. null = autre chose
 * (vraie surcharge passagère, bogue…) : pas d'alerte.
 *  - crédits vides     : 400 « Your credit balance is too low… »
 *  - limite perso      : 400 « You have reached your specified API usage limits… »
 *  - plafond du compte : 429 type `enforced_spend_limit_reached` (sans retry-after)
 *  - clé               : 401 (authentification) / 403 (permission)
 */
export function causeIA(err: unknown): CauseIA | null {
  const e = err as { status?: number; message?: string; error?: unknown } | null;
  const st = e?.status;
  const texte = `${e?.message ?? ''} ${JSON.stringify(e?.error ?? '')}`.toLowerCase();
  if (st === 401 || st === 403) return 'cle';
  if (texte.includes('credit balance')) return 'credits';
  if (texte.includes('usage limits') || texte.includes('spend_limit') || texte.includes('spend limit')) return 'limite';
  return null;
}

export type PanneIA = { cause: CauseIA; route: string; depuis: number };

async function upstash(commandes: unknown[][]): Promise<{ result: unknown }[] | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify(commandes),
      cache: 'no-store',
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Panne en cours pour le bandeau de /admin, ou null. */
export async function lirePanneIA(): Promise<PanneIA | null> {
  const r = await upstash([['GET', CLE_PANNE]]);
  const brut = r?.[0]?.result;
  if (typeof brut !== 'string') return null;
  try { return JSON.parse(brut) as PanneIA; } catch { return null; }
}

// Au plus un effacement par minute et par serveur : pas d'appel Redis à chaque
// génération réussie, et le bandeau disparaît au pire une minute après la reprise.
let dernierEffacement = 0;

/** À appeler après une génération réussie : le bandeau de /admin disparaît. */
export async function panneIAResolue(): Promise<void> {
  if (Date.now() - dernierEffacement < 60_000) return;
  dernierEffacement = Date.now();
  await upstash([['DEL', CLE_PANNE]]);
}

let dernierEnvoiLocal = 0;

async function prendreVerrou(): Promise<boolean> {
  const r = await upstash([['SET', CLE_VERROU, String(Date.now()), 'NX', 'EX', UNE_HEURE]]);
  if (r) return r[0]?.result === 'OK';
  // Redis absent ou en panne : on retombe sur le verrou en mémoire.
  if (Date.now() - dernierEnvoiLocal < UNE_HEURE * 1000) return false;
  dernierEnvoiLocal = Date.now();
  return true;
}

// Réveille aussi Claire (bot service client dans Grok) par le même webhook que le
// formulaire Contact : elle ne relève hello@ que 4 fois par jour, une panne du soir
// pouvait attendre des heures. `source` distingue l'alerte des messages clients (il
// n'y a personne à qui répondre). Même rythme que le courriel : au plus 1 par heure.
// Pas d'import de lib/claire.ts : il tire Upstash via '@/', illisible pour node --test.
async function reveillerClaire(panne: PanneIA, detail: string): Promise<void> {
  const url = process.env.CLAIRE_WEBHOOK_URL;
  const cle = process.env.CLAIRE_WEBHOOK_KEY?.trim();
  if (!url || !cle) return;
  try {
    const { sujet, action } = LIBELLES[panne.cause];
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: cle.includes(' ') ? cle : `Bearer ${cle}`,
      },
      body: JSON.stringify({
        source: 'alerte-panne-ia',
        panne: sujet,
        date: new Date(panne.depuis).toISOString(),
        consigne: `Les clients ne peuvent plus générer de scripts. Préviens Caroline tout de suite (à faire de son côté : ${action}). Ne réponds à aucun client au sujet de la panne.`,
        route: panne.route,
        detail,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error('Alerte IA : Claire non jointe', e);
  }
}

/** À appeler dans le catch d'une route qui parle à l'IA. Ne lève jamais d'erreur. */
export async function alerterSiPanneIA(err: unknown, route: string): Promise<void> {
  try {
    const cause = causeIA(err);
    if (!cause) return;
    // NX : garde l'heure du DÉBUT de la panne, pas celle de la dernière erreur.
    const panne: PanneIA = { cause, route, depuis: Date.now() };
    await upstash([['SET', CLE_PANNE, JSON.stringify(panne), 'NX', 'EX', SEPT_JOURS]]);
    if (!(await prendreVerrou())) return;
    const { sujet, action, lien } = LIBELLES[cause];
    const detail = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    // Claire et le courriel partent en parallèle, chacun avec son propre filet : un
    // envoi Resend raté ne doit pas priver Claire de l'alerte, ni l'inverse.
    await Promise.all([reveillerClaire(panne, detail), envoyerCourriel(sujet, action, lien, route, detail)]);
  } catch (e) {
    console.error('Alerte IA : alerte non envoyée', e);
  }
}

async function envoyerCourriel(sujet: string, action: string, lien: string, route: string, detail: string): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Resend ne LÈVE PAS d'erreur quand il refuse un envoi : il renvoie `{ error }`.
    const { error } = await resend.emails.send({
      from: 'ViraReel AI <noreply@virareelai.com>',
      to: 'hello@virareelai.com',
      subject: `🚨 [ViraReel] ${sujet} — les générations échouent`,
      text: [
        `${sujet}. Les clientes ne peuvent plus générer de scripts.`,
        '',
        `À faire : ${action} : ${lien}`,
        '',
        `Route : ${route}`,
        `Message d'Anthropic : ${detail}`,
        '',
        "Prochaine alerte au plus tôt dans une heure si la panne continue.",
      ].join('\n'),
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
  } catch (e) {
    console.error('Alerte IA : courriel non envoyé', e);
  }
}
