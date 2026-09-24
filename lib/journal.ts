// JOURNAL DES ÉVÉNEMENTS du tunnel, pour l'onglet Performance d'/admin.
//
// Seuls les événements que PERSONNE d'autre n'horodate vivent ici :
//   first_trial        — 1re génération d'un navigateur ou d'un compte gratuit (/api/generate)
//   lead_email         — courriel donné au mur des essais (/api/capture-email)
//   initiate_checkout  — clic sur un forfait, session Stripe ouverte (/api/checkout)
// Les inscriptions (Clerk), les courriels (Resend), les paiements et remboursements
// (Stripe) sont relus à la source par /api/admin/performance : leur historique remonte
// ainsi au début du SaaS, et un webhook manqué ne fausse jamais le revenu.
//
// Stockage : le même Redis Upstash que lib/anonStats.ts et lib/messages.ts. Un
// « sorted set » trié par heure, qu'on relit en entier (volume minuscule).
//
// Aucun enregistrement ne doit JAMAIS faire échouer une génération ou un paiement :
// toutes les fonctions avalent leurs erreurs.

import { mesureAutoriseeServeur } from './consentement';
import { ORIGINE_COOKIE, decoderOrigine, type Origine } from './origine';

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

const CLE = 'journal_evenements';
const CLE_DEPENSES = 'depense_meta'; // hash : 'YYYY-MM-DD' → dollars dépensés chez Meta ce jour-là
// Au-delà, les plus vieux tombent. Des années de marge au volume actuel, et la liste
// ne peut pas grossir sans fin.
const MAX = 20000;

export type TypeJournal = 'first_trial' | 'lead_email' | 'initiate_checkout';

export interface EntreeJournal {
  t: string; // ISO
  type: TypeJournal;
  userId?: string;
  email?: string;
  plan?: string;
  origine?: Origine;
}

async function redis(commandes: unknown[][]): Promise<{ result: unknown }[] | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      body: JSON.stringify(commandes),
      cache: 'no-store',
    });
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * La provenance de la personne, lue dans SON cookie — seulement si la mesure est
 * permise pour elle (même règle que le pixel). À n'appeler que sur une requête venue
 * de son navigateur.
 */
export function origineDepuisRequete(req: {
  headers: { get(nom: string): string | null };
  cookies: { get(nom: string): { value: string } | undefined };
}): Origine | undefined {
  if (!mesureAutoriseeServeur(req)) return undefined;
  return decoderOrigine(req.cookies.get(ORIGINE_COOKIE)?.value) ?? undefined;
}

export async function enregistrerEvenement(e: Omit<EntreeJournal, 't'> & { t?: string }): Promise<void> {
  const t = e.t ?? new Date().toISOString();
  // Un identifiant aléatoire dans la valeur : sans lui, deux événements identiques à
  // la même milliseconde n'en feraient qu'un dans le sorted set.
  const membre = JSON.stringify({ ...e, t, id: Math.random().toString(36).slice(2, 10) });
  await redis([
    ['ZADD', CLE, new Date(t).getTime(), membre],
    ['ZREMRANGEBYRANK', CLE, 0, -(MAX + 1)],
  ]);
}

export async function lireJournal(): Promise<EntreeJournal[]> {
  const res = await redis([['ZRANGE', CLE, 0, -1]]);
  const brut = res?.[0]?.result;
  if (!Array.isArray(brut)) return [];
  return brut.flatMap(v => {
    try {
      const e = JSON.parse(String(v)) as EntreeJournal;
      return typeof e.t === 'string' && typeof e.type === 'string' ? [e] : [];
    } catch {
      return []; // une entrée abîmée ne doit pas cacher toutes les autres
    }
  });
}

/** Dépense Meta saisie à la main par Caroline, jour par jour. */
export async function lireDepenses(): Promise<Record<string, number>> {
  const res = await redis([['HGETALL', CLE_DEPENSES]]);
  const brut = res?.[0]?.result;
  const depenses: Record<string, number> = {};
  if (Array.isArray(brut)) {
    for (let i = 0; i + 1 < brut.length; i += 2) {
      const n = Number(brut[i + 1]);
      if (Number.isFinite(n)) depenses[String(brut[i])] = n;
    }
  }
  return depenses;
}

/** `montant` null = case vidée : le jour redevient « non saisi ». */
export async function ecrireDepense(jour: string, montant: number | null): Promise<boolean> {
  const res = montant === null
    ? await redis([['HDEL', CLE_DEPENSES, jour]])
    : await redis([['HSET', CLE_DEPENSES, jour, String(montant)]]);
  return res !== null;
}

/**
 * Provenance à recopier sur le compte Clerk, ou undefined s'il n'y a rien à faire :
 * premier passage marqué, donc un compte qui a déjà sa provenance la garde.
 */
export function origineAAttacher(
  privateMetadata: Record<string, unknown> | undefined,
  req: Parameters<typeof origineDepuisRequete>[0],
): Origine | undefined {
  if (privateMetadata?.origine) return undefined;
  return origineDepuisRequete(req);
}
