import { NextRequest, NextResponse } from 'next/server';
import { zoneDepuisEnTetes } from '@/lib/consentement';

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

// ⚠️ La liste des pays et la règle vivent dans lib/consentement.ts, partagées avec
// les routes qui envoient elles-mêmes des événements à Meta. Une 2e copie ici
// finirait par diverger, et le navigateur et le serveur se contrediraient.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pays = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const zone = zoneDepuisEnTetes(pays, req.headers.get('accept-language'));

  return NextResponse.json({ zone, pays: pays || null }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
