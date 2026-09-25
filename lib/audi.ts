import { createHash, timingSafeEqual } from 'crypto';

// Reconnaître Audi, le robot de surveillance de Caroline — SOURCE UNIQUE.
//
// Le code secret vit SEULEMENT dans la variable Vercel AUDI_SECRET, jamais dans le
// code. Sans cette variable, ou sans le bon code, personne n'est reconnu : tout
// compte normalement.
//
// À quoi ça sert, et À RIEN D'AUTRE :
//   - /api/sante montre le détail par service ;
//   - les générations d'Audi ne sont pas comptées dans les stats de l'admin (compteur
//     d'essais anonymes + « premier essai » de l'onglet Performance).
// Pour tout le reste, Audi suit exactement le chemin d'un vrai client (mêmes limites,
// même générateur) : sinon il pourrait dire « tout va bien » alors qu'un client
// serait bloqué. Ne JAMAIS s'en servir pour lui ouvrir un passe-droit.
//
// Deux façons d'être reconnu :
//   - l'en-tête `x-audi: <code>` (scripts, /api/sante) ;
//   - le cookie posé par /api/audi?cle=<code> : Audi ouvre ce lien au début de sa
//     fenêtre privée, et toutes les générations lancées ensuite par le site dans ce
//     navigateur le transportent toutes seules.

export const AUDI_COOKIE = 'virareel_audi';

function empreinte(valeur: string): Buffer {
  return createHash('sha256').update(`virareel-audi:${valeur}`).digest();
}

/** Ce que contient le cookie : une empreinte du code, jamais le code lui-même. */
export function valeurCookieAudi(): string | null {
  const secret = process.env.AUDI_SECRET;
  return secret ? empreinte(secret).toString('hex') : null;
}

function egal(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Le code fourni est-il le bon ? (comparaison à temps constant) */
export function codeAudiValide(code: string | null | undefined): boolean {
  const secret = process.env.AUDI_SECRET;
  if (!secret || !code) return false;
  return egal(empreinte(code), empreinte(secret));
}

export function estAudi(req: {
  headers: { get(nom: string): string | null };
  cookies: { get(nom: string): { value: string } | undefined };
}): boolean {
  if (codeAudiValide(req.headers.get('x-audi'))) return true;
  const attendu = valeurCookieAudi();
  const cookie = req.cookies.get(AUDI_COOKIE)?.value;
  if (!attendu || !cookie) return false;
  return egal(Buffer.from(cookie), Buffer.from(attendu));
}
