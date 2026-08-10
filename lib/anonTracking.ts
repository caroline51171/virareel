// Tracking anonyme (cookie signé + IP), partagé entre /api/generate et
// /api/capture-email — les deux routes doivent lire/écrire le même cookie.

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

export const ANON_SECRET =
  process.env.ANON_SECRET ||
  (process.env.CLERK_SECRET_KEY?.slice(0, 32) ?? 'virareel-anon-2026');

// Les plafonds vivent dans lib/limits.ts (aucun import, donc lisible aussi par le
// navigateur). Réexportés ici pour ne pas casser les imports existants.
import { MULTI_BONUS_CREDITS } from './limits';
export { ANON_LIMIT, EMAIL_GATE_LIMIT, FREE_ACCOUNT_LIMIT, MULTI_BONUS_CREDITS } from './limits';

export interface AnonData {
  n: number; // crédits utilisés
  ip: string; // hash de l'IP
  e?: boolean; // courriel déjà donné (débloque au-delà du mur du 4e crédit)
  b?: number; // crédits bonus déjà consommés (0 → 16 max, une seule fois par navigateur)
}

// Crédits bonus restants pour ce navigateur. Hors des essais gratuits : ni le compteur ni
// le mur du courriel ne s'appliquent tant qu'il en reste.
export function bonusLeft(data: AnonData | null): number {
  return Math.max(0, MULTI_BONUS_CREDITS - (data?.b ?? 0));
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
// connecté : un compte gratuit hérite de ce compteur, sinon épuiser ses essais
// puis créer un compte en redonnerait autant (le double au lieu du total prévu).
export function anonUsedFromRequest(req: NextRequest): number {
  const data = parseAnonCookie(req.cookies.get('virareel_anon')?.value);
  return data && data.ip === hashIP(getIP(req)) ? data.n : 0;
}

export function makeAnonCookie(data: AnonData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const sig = createHmac('sha256', ANON_SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${sig}`;
}
