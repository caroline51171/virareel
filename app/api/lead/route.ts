import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { envoyerACapi, identitéDepuisRequete } from '@/lib/capi';
import { mesureAutoriseeServeur } from '@/lib/consentement';

// Prospect à l'INSCRIPTION (courriel + mot de passe, ou Google), envoyé par nous.
//
// Pourquoi pas un webhook Clerk, qui serait le vrai équivalent du webhook Stripe :
// un webhook part des serveurs de Clerk, donc SANS le cookie de consentement ni
// l'adresse de la personne. Il enverrait à Meta quelqu'un qui a cliqué « Refuser ».
// Cette route-ci est appelée par le navigateur de la personne : elle a son cookie,
// son adresse, et ses cookies `_fbp`/`_fbc`.
//
// Ce qu'elle apporte par rapport à l'ancien envoi (components/MetaPixel.tsx) :
// celui-ci attendait que `window.fbq` existe et abandonnait au bout de 5 secondes.
// Si /api/zone répondait lentement, le Prospect était perdu en silence. Ici, plus
// d'attente et plus de course : le consentement est lu directement à la source.
//
// Le courriel n'est PAS pris dans le corps de la requête : il est lu sur la session
// Clerk. Sinon n'importe qui pourrait injecter l'adresse de son choix dans Meta.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { eventId } = await req.json().catch(() => ({}));
  if (typeof eventId !== 'string' || !eventId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Créer un compte n'est pas accepter d'être mesuré.
  if (!mesureAutoriseeServeur(req)) return NextResponse.json({ ok: false, raison: 'refus' });

  const user = await currentUser();
  const ok = await envoyerACapi({
    event: 'Lead',
    eventId,
    url: req.headers.get('referer') || undefined,
    email: user?.primaryEmailAddress?.emailAddress,
    ...identitéDepuisRequete(req),
  });

  return NextResponse.json({ ok });
}
