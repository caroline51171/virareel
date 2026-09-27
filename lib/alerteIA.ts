import { Resend } from 'resend';

// Courriel d'alerte quand l'IA refuse de travailler pour une raison que SEULE
// Caroline peut régler (crédits vides, limite de dépenses atteinte, clé refusée).
// Sans ça, les clientes voyaient « Beaucoup de monde » ou « Generation failed » et
// personne n'était averti — la nuit en France, ça pouvait durer des heures.
//
// Au plus UN courriel par heure (verrou Redis SET NX EX, partagé entre les serveurs).
// Sans Redis, verrou en mémoire seulement (un courriel par serveur et par heure).
// Jamais bloquant : une alerte ratée ne doit pas changer la réponse à la cliente.

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;
const CLE_VERROU = 'alerte-ia:derniere';
const UNE_HEURE = 60 * 60;

export type CauseIA = 'credits' | 'limite' | 'cle';

const LIBELLES: Record<CauseIA, { sujet: string; action: string }> = {
  credits: {
    sujet: 'Crédits Anthropic épuisés',
    action: 'Ajouter des crédits : https://platform.claude.com/settings/billing',
  },
  limite: {
    sujet: 'Limite de dépenses Anthropic atteinte',
    action: 'Monter la limite mensuelle : https://platform.claude.com/settings/limits',
  },
  cle: {
    sujet: 'Clé Anthropic refusée',
    action: 'Vérifier ANTHROPIC_API_KEY dans Vercel (clé révoquée ou expirée ?) : https://platform.claude.com/settings/keys',
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

let dernierEnvoiLocal = 0;

async function prendreVerrou(): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        body: JSON.stringify([['SET', CLE_VERROU, String(Date.now()), 'NX', 'EX', UNE_HEURE]]),
        cache: 'no-store',
      });
      if (res.ok) {
        const [r] = (await res.json()) as { result: unknown }[];
        return r?.result === 'OK';
      }
    } catch {
      // Redis en panne : on retombe sur le verrou en mémoire.
    }
  }
  if (Date.now() - dernierEnvoiLocal < UNE_HEURE * 1000) return false;
  dernierEnvoiLocal = Date.now();
  return true;
}

/** À appeler dans le catch d'une route qui parle à l'IA. Ne lève jamais d'erreur. */
export async function alerterSiPanneIA(err: unknown, route: string): Promise<void> {
  try {
    const cause = causeIA(err);
    if (!cause || !(await prendreVerrou())) return;
    const { sujet, action } = LIBELLES[cause];
    const detail = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Resend ne LÈVE PAS d'erreur quand il refuse un envoi : il renvoie `{ error }`.
    const { error } = await resend.emails.send({
      from: 'ViraReel AI <noreply@virareelai.com>',
      to: 'hello@virareelai.com',
      subject: `🚨 [ViraReel] ${sujet} — les générations échouent`,
      text: [
        `${sujet}. Les clientes ne peuvent plus générer de scripts.`,
        '',
        `À faire : ${action}`,
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
