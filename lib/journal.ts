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

// ── Usage par jour (générations + coût IA), pour que les cartes d'/admin suivent la
// période choisie. Clerk ne garde qu'un total par compte, sans date : ce suivi ne
// commence donc qu'au jour où il a été ajouté (CLE_USAGE_DEBUT), les jours d'avant
// n'existent pas. Hash 'YYYY-MM-DD' → valeur, gardé sans limite (une case par jour).
const CLE_USAGE_GENERATIONS = 'usage_generations';
const CLE_USAGE_COUT = 'usage_cout';
const CLE_USAGE_COUT_BETA = 'usage_cout_beta';
const CLE_USAGE_DEBUT = 'usage_debut';

export type UsageJour = { generations: number; cout: number; coutBeta: number };

/** `credits` = ce que la demande retire du quota ; `coutUSD` = coût réel Claude. */
export async function enregistrerUsage(credits: number, coutUSD: number, beta: boolean): Promise<void> {
  const jour = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  await redis([
    ['SET', CLE_USAGE_DEBUT, jour, 'NX'],
    ['HINCRBY', CLE_USAGE_GENERATIONS, jour, credits],
    ['HINCRBYFLOAT', CLE_USAGE_COUT, jour, coutUSD],
    ...(beta ? [['HINCRBYFLOAT', CLE_USAGE_COUT_BETA, jour, coutUSD]] : []),
  ]);
}

/** Usage par jour + le premier jour suivi (null tant que rien n'a été enregistré). */
export async function lireUsage(): Promise<{ debut: string | null; jours: Record<string, UsageJour> }> {
  const res = await redis([
    ['GET', CLE_USAGE_DEBUT],
    ['HGETALL', CLE_USAGE_GENERATIONS],
    ['HGETALL', CLE_USAGE_COUT],
    ['HGETALL', CLE_USAGE_COUT_BETA],
  ]);
  const jours: Record<string, UsageJour> = {};
  const lire = (brut: unknown, champ: keyof UsageJour) => {
    if (!Array.isArray(brut)) return;
    for (let i = 0; i + 1 < brut.length; i += 2) {
      const n = Number(brut[i + 1]);
      if (!Number.isFinite(n)) continue;
      const jour = String(brut[i]);
      jours[jour] ??= { generations: 0, cout: 0, coutBeta: 0 };
      jours[jour][champ] = n;
    }
  };
  lire(res?.[1]?.result, 'generations');
  lire(res?.[2]?.result, 'cout');
  lire(res?.[3]?.result, 'coutBeta');
  const debut = res?.[0]?.result;
  return { debut: typeof debut === 'string' ? debut : null, jours };
}

// ── Visites (lib/visites.ts) : totaux par jour, rien qui identifie la personne ──────
const CLE_VISITES = 'visites';               // hash : jour → nombre
const CLE_VISITES_DETAIL = 'visites_detail'; // hash : 'jour|source|Facebook' → nombre
const CLE_VISITES_DEBUT = 'visites_debut';

export async function enregistrerVisite(source: string, pays: string, appareil: string): Promise<void> {
  const jour = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  await redis([
    ['SET', CLE_VISITES_DEBUT, jour, 'NX'],
    ['HINCRBY', CLE_VISITES, jour, 1],
    ['HINCRBY', CLE_VISITES_DETAIL, `${jour}|source|${source}`, 1],
    ['HINCRBY', CLE_VISITES_DETAIL, `${jour}|pays|${pays}`, 1],
    ['HINCRBY', CLE_VISITES_DETAIL, `${jour}|appareil|${appareil}`, 1],
  ]);
}

export type DetailVisites = Record<string, Record<'source' | 'pays' | 'appareil', Record<string, number>>>;

/** Visites par jour, leur détail, et le 1er jour compté (null tant qu'aucune visite). */
export async function lireVisites(): Promise<{ debut: string | null; jours: Record<string, number>; detail: DetailVisites }> {
  const res = await redis([
    ['GET', CLE_VISITES_DEBUT],
    ['HGETALL', CLE_VISITES],
    ['HGETALL', CLE_VISITES_DETAIL],
  ]);
  const jours: Record<string, number> = {};
  const brutJours = res?.[1]?.result;
  if (Array.isArray(brutJours)) {
    for (let i = 0; i + 1 < brutJours.length; i += 2) {
      const n = Number(brutJours[i + 1]);
      if (Number.isFinite(n)) jours[String(brutJours[i])] = n;
    }
  }
  const detail: DetailVisites = {};
  const brutDetail = res?.[2]?.result;
  if (Array.isArray(brutDetail)) {
    for (let i = 0; i + 1 < brutDetail.length; i += 2) {
      const [jour, axe, valeur] = String(brutDetail[i]).split('|');
      const n = Number(brutDetail[i + 1]);
      if (!valeur || !Number.isFinite(n) || (axe !== 'source' && axe !== 'pays' && axe !== 'appareil')) continue;
      detail[jour] ??= { source: {}, pays: {}, appareil: {} };
      detail[jour][axe][valeur] = n;
    }
  }
  const debut = res?.[0]?.result;
  return { debut: typeof debut === 'string' ? debut : null, jours, detail };
}
