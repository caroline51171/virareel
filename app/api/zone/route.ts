import { NextRequest, NextResponse } from 'next/server';

// Quelle règle de consentement s'applique à CE visiteur ?
//
// Décidé CÔTÉ SERVEUR, à partir du pays que Vercel lit sur la connexion — le
// navigateur, lui, peut mentir sur sa langue. En secours seulement : la langue
// déclarée. En cas de doute on choisit TOUJOURS le régime strict : mieux vaut ne
// pas mesurer un Américain que pister un Européen sans son accord.
//
//   'consentement' → rien ne part avant « J'accepte » (Canada/Québec, EEE, UK, Suisse)
//   'refus'        → la mesure démarre, et s'arrête net si la personne refuse (US, reste)
//
// La page d'accueil reste mise en cache et identique pour tout le monde : c'est pour
// ça que la zone est demandée ici, par une petite requête à part, et jamais calculée
// pendant le rendu de la page.

export const dynamic = 'force-dynamic';

const EEE = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
];
const STRICT = new Set([...EEE, 'GB', 'CH', 'CA']);

// Langues des pays stricts : filet quand le pays est inconnu (proxy, VPN, réseau privé).
const LANGUES_STRICTES = /^(fr|de|it|nl|da|sv|nb|nn|no|fi|is|pl|cs|sk|sl|hu|ro|bg|hr|el|et|lv|lt|mt|pt|es|ga|en-gb|en-ca|en-ie)/i;

export async function GET(req: NextRequest) {
  const pays = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  let zone: 'consentement' | 'refus';

  if (pays) {
    zone = STRICT.has(pays) ? 'consentement' : 'refus';
  } else {
    const langue = (req.headers.get('accept-language') || '').trim();
    zone = LANGUES_STRICTES.test(langue) ? 'consentement' : 'refus';
  }

  return NextResponse.json({ zone, pays: pays || null }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
