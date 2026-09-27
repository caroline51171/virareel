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
  /** fr | en — la langue de la page d'où vient le message. */
  langue?: string;
  /** Claire (l'assistante service client, dans Grok) a-t-elle reçu le message ?
   *  `false` = en attente : il repart au prochain réveil (nouveau message ou
   *  rattrapage du matin). Absent = message d'avant le branchement, jamais renvoyé. */
  claireAvisee?: boolean;
  /** Ce que Claire a fait du message, envoyé par elle via /api/contact/statut. */
  statutClaire?: StatutClaire;
  statutClaireDate?: string; // ISO
}

export const STATUTS_CLAIRE = ['repondu', 'attente_caroline'] as const;
export type StatutClaire = (typeof STATUTS_CLAIRE)[number];

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

/** Applique `champs` aux messages dont l'id est dans `ids`, en une seule lecture.
 *  Renvoie le nombre de messages trouvés. */
async function mettreAJour(ids: string[], champs: Partial<Message>): Promise<number> {
  const messages = await lireMessages();
  const commandes: unknown[][] = [];
  messages.forEach((m, i) => {
    if (ids.includes(m.id)) commandes.push(['LSET', CLE, i, JSON.stringify({ ...m, ...champs })]);
  });
  if (commandes.length) await redis(commandes);
  return commandes.length;
}

/** Marque l'envoi du courriel comme réussi, une fois Resend passé. */
export async function marquerCourrielEnvoye(id: string): Promise<void> {
  await mettreAJour([id], { courrielEnvoye: true });
}

export async function marquerClaireAvisee(ids: string[]): Promise<void> {
  await mettreAJour(ids, { claireAvisee: true });
}

/** `false` si aucun message ne porte cet id. Un statut vaut aussi « reçu ». */
export async function marquerStatutClaire(id: string, statut: StatutClaire): Promise<boolean> {
  const trouves = await mettreAJour([id], {
    claireAvisee: true,
    statutClaire: statut,
    statutClaireDate: new Date().toISOString(),
  });
  return trouves > 0;
}

/** Les messages que Claire n'a pas encore reçus, du plus ancien au plus récent. */
export async function messagesPourClaire(): Promise<Message[]> {
  return (await lireMessages()).filter(m => m.claireAvisee === false).reverse();
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
