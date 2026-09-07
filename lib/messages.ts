// Messages du formulaire de contact, gardés dans Upstash (même Redis que lib/anonStats.ts).
//
// Pourquoi les stocker : avant, un message partait UNIQUEMENT par courriel vers
// hello@virareelai.com. Si Resend échouait, le message était perdu pour de bon — le
// visiteur voyait une erreur et Caroline ne savait jamais qu'il avait écrit. On
// enregistre donc AVANT d'envoyer : le courriel devient la notification rapide, le
// stockage devient la source qui ne se perd pas.
//
// Format : une liste Redis `messages`, le plus récent en tête (LPUSH). Pas de base de
// données à gérer, cohérent avec le reste du projet.

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

const CLE = 'messages';
const CLE_LUS = 'messages_lus';
// Au-delà, les plus vieux tombent. Largement au-dessus du volume attendu, et ça
// empêche la liste de grossir sans fin.
const MAX = 500;

export interface Message {
  id: string;
  date: string;          // ISO
  type: string;          // comment | question | support
  nom: string;
  courriel: string;
  message: string;
  /** L'envoi du courriel de notification a-t-il réussi ? Sinon, SEUL le stockage l'a. */
  courrielEnvoye: boolean;
}

async function redis(commandes: unknown[][]): Promise<{ result: unknown }[] | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify(commandes),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function enregistrerMessage(m: Message): Promise<void> {
  await redis([
    ['LPUSH', CLE, JSON.stringify(m)],
    ['LTRIM', CLE, 0, MAX - 1],
  ]);
}

/** Marque l'envoi du courriel comme réussi, une fois Resend passé. */
export async function marquerCourrielEnvoye(id: string): Promise<void> {
  const messages = await lireMessages();
  const i = messages.findIndex(m => m.id === id);
  if (i === -1) return;
  messages[i].courrielEnvoye = true;
  await redis([['LSET', CLE, i, JSON.stringify(messages[i])]]);
}

export async function lireMessages(): Promise<Message[]> {
  const res = await redis([['LRANGE', CLE, 0, MAX - 1]]);
  const brut = res?.[0]?.result;
  if (!Array.isArray(brut)) return [];
  return brut.flatMap(v => {
    try {
      return [JSON.parse(String(v)) as Message];
    } catch {
      return []; // une entrée abîmée ne doit pas cacher toutes les autres
    }
  });
}

/** Date ISO du dernier message que Caroline a marqué comme lu. */
export async function dernierLu(): Promise<string | null> {
  const res = await redis([['GET', CLE_LUS]]);
  const v = res?.[0]?.result;
  return typeof v === 'string' ? v : null;
}

export async function marquerToutLu(dateISO: string): Promise<void> {
  await redis([['SET', CLE_LUS, dateISO]]);
}
