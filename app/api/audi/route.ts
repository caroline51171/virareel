import { NextRequest, NextResponse } from 'next/server';
import { AUDI_COOKIE, codeAudiValide, valeurCookieAudi } from '@/lib/audi';
import { CONSENT_COOKIE, CONSENT_COOKIE_MAX_AGE } from '@/lib/consentement';

// Porte d'entrée d'Audi : /api/audi?cle=<code>&vers=/en
//
// Avec le bon code, pose le cookie qui retire ses générations des stats (voir
// lib/audi.ts) ET le refus des cookies de mesure, puis renvoie vers la page demandée (l'accueil par défaut). Avec un
// mauvais code : même redirection, sans cookie — rien ne dit si le code était bon.
export async function GET(req: NextRequest) {
  const vers = req.nextUrl.searchParams.get('vers') ?? '/';
  // Seulement une page du site : jamais « //ailleurs.com » ni une adresse complète.
  const cible = vers.startsWith('/') && !vers.startsWith('//') ? vers : '/';

  const res = NextResponse.redirect(new URL(cible, req.url), 303);
  res.headers.set('Cache-Control', 'no-store');
  const valeur = valeurCookieAudi();
  if (valeur && codeAudiValide(req.nextUrl.searchParams.get('cle'))) {
    res.cookies.set(AUDI_COOKIE, valeur, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // une journée : la fenêtre privée d'Audi dure bien moins
    });
    // Comme un clic sur « Refuser » : rien ne part vers Meta (ni pixel, ni CAPI), même
    // depuis les États-Unis où la mesure démarre par défaut. Le pixel relit ce cookie
    // (lib/pixel.ts), le serveur aussi (lib/consentement.ts). Pas HttpOnly, comme
    // celui que la bannière écrit.
    res.cookies.set(CONSENT_COOKIE, '0', { path: '/', sameSite: 'lax', maxAge: CONSENT_COOKIE_MAX_AGE });
  }
  return res;
}
