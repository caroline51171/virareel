import { NextRequest, NextResponse } from 'next/server';
import { getIP, hashIP, parseAnonCookie, bonusLeft } from '@/lib/anonTracking';
import { ANON_LIMIT, EMAIL_GATE_LIMIT } from '@/lib/limits';

// État de l'essai gratuit, lu dans le cookie signé — LA source de vérité pour le navigateur.
//
// Avant, le compteur et la disponibilité du bonus 4×4 vivaient dans localStorage, côté client.
// Quand les deux se contredisaient, le navigateur refusait la génération SANS demander au
// serveur (bug du bonus trouvé par Caroline le 2026-08-10 : « plus d'essais » alors que le
// serveur aurait dit oui). Maintenant un seul endroit décide.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const data = parseAnonCookie(req.cookies.get('virareel_anon')?.value);
  const valid = !!data && data.ip === hashIP(getIP(req));

  const used = valid ? data!.n : 0;
  const emailGiven = valid ? !!data!.e : false;

  // Compteur en DEUX temps : 12 → 0 sans courriel, puis 6 → 0 après. Le total (18) n'est
  // jamais montré, pour rester cohérent avec les « 12 essais gratuits » annoncés sur le site.
  const cap = emailGiven ? ANON_LIMIT : EMAIL_GATE_LIMIT;

  return NextResponse.json({
    used,
    emailGiven,
    remaining: Math.max(0, cap - used),
    bonusLeft: bonusLeft(valid ? data : null),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
