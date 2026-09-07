import { NextRequest, NextResponse } from 'next/server';
import { envoyerACapi, identitéDepuisRequete } from '@/lib/capi';

// API Conversions de Meta (CAPI) — le jumeau serveur du pixel du navigateur.
//
// À quoi ça sert : un bloqueur de pubs, un iPhone ou une extension peut empêcher le
// pixel de partir. L'événement se perd, et la campagne apprend moins vite. Le même
// événement envoyé par NOTRE serveur, lui, passe.
//
// ⚠️ Le point le plus important : chaque événement porte un `event_id` identique des
// deux côtés. C'est ce qui permet à Meta de reconnaître qu'il s'agit du MÊME
// événement et de n'en compter qu'un. Sans ça, tout serait compté en double et le
// coût par abonné serait faux.
//
// Consentement : cette route ne rattrape JAMAIS quelqu'un qui a refusé. Le navigateur
// ne l'appelle que lorsqu'il a le droit de mesurer (voir lib/pixel.ts) — un refus
// coupe les deux chemins d'un coup.
//
// Sans `META_CAPI_TOKEN` dans les variables d'environnement, la route ne fait rien et
// répond « ignoré » : le pixel du navigateur continue de fonctionner seul.

// L'envoi lui-même vit dans lib/capi.ts, partagé avec les routes qui envoient
// leurs propres événements (capture-email, checkout, webhook Stripe). Cette route
// n'est plus que la porte d'entrée du NAVIGATEUR.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { event, eventId, url, value, currency, email } = await req.json();
    if (!event || !eventId) return NextResponse.json({ ok: false }, { status: 400 });

    // Le navigateur envoyait `fbp`/`fbc` dans le corps ; on les lit maintenant
    // directement dans ses cookies, à la même source et sans lui faire confiance.
    const ok = await envoyerACapi({
      event, eventId, url, value, currency, email,
      ...identitéDepuisRequete(req),
    });

    // On ne fait jamais échouer le parcours du client pour un problème de mesure.
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
