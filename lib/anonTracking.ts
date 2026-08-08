// Tracking anonyme (cookie signé + IP), partagé entre /api/generate et
// /api/capture-email — les deux routes doivent lire/écrire le même cookie.

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

export const ANON_SECRET =
  process.env.ANON_SECRET ||
  (process.env.CLERK_SECRET_KEY?.slice(0, 32) ?? 'virareel-anon-2026');

// Source de vérité UNIQUE pour les 2 routes qui partagent le cookie `virareel_anon`
// (generate + transcreate) — évite qu'elles se désynchronisent comme avant.
export const ANON_LIMIT = 9;
export const EMAIL_GATE_LIMIT = 5;

// Plafond À VIE d'un compte gratuit connecté. Sans lui, créer un compte donnait un
// accès illimité (le quota n'était vérifié que pour solo/creator/pro). Même chiffre
// que l'essai anonyme : rien de nouveau à expliquer sur le site.
export const FREE_ACCOUNT_LIMIT = ANON_LIMIT;

export interface AnonData {
  n: number; // crédits utilisés
  ip: string; // hash de l'IP
  e?: boolean; // courriel déjà donné (débloque au-delà du mur du 4e crédit)
}

export function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

export function hashIP(ip: string): string {
  return createHmac('sha256', ANON_SECRET).update(ip).digest('hex').slice(0, 16);
}

export function parseAnonCookie(val: string | undefined): AnonData | null {
  if (!val) return null;
  try {
    const dot = val.lastIndexOf('.');
    if (dot < 0) return null;
    const payload = val.slice(0, dot);
    const sig = val.slice(dot + 1);
    const expected = createHmac('sha256', ANON_SECRET).update(payload).digest('hex').slice(0, 16);
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (typeof data.n !== 'number' || typeof data.ip !== 'string') return null;
    return data as AnonData;
  } catch { return null; }
}

// Essais déjà consommés par CE navigateur, lisibles même quand l'utilisateur est
// connecté : un compte gratuit hérite de ce compteur, sinon épuiser ses 9 essais
// puis créer un compte donnerait 9 essais de plus (9 + 9 = 18 au lieu de 9).
export function anonUsedFromRequest(req: NextRequest): number {
  const data = parseAnonCookie(req.cookies.get('virareel_anon')?.value);
  return data && data.ip === hashIP(getIP(req)) ? data.n : 0;
}

export function makeAnonCookie(data: AnonData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const sig = createHmac('sha256', ANON_SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${sig}`;
}
