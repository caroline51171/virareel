import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getIP, hashIP, parseAnonCookie, makeAnonCookie } from '@/lib/anonTracking';
import { envoyerACapi, identitéDepuisRequete } from '@/lib/capi';
import { mesureAutoriseeServeur } from '@/lib/consentement';

// Reçoit le courriel donné au mur d'essai (il tombe au-delà de EMAIL_GATE_LIMIT crédits).
// Ajoute le contact à l'Audience Resend (liste pub, RESEND_AUDIENCE_ID) puis débloque
// le reste des essais (ANON_LIMIT, cf. lib/limits.ts) — même si Resend échoue,
// la génération ne doit jamais rester bloquée pour une raison marketing.
export async function POST(req: NextRequest) {
  const { email, eventId } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // Prospect envoyé ICI, côté serveur, et plus seulement par le navigateur : un
  // bloqueur de publicités empêche le pixel de partir, et l'envoi de secours du
  // navigateur passe par notre domaine mais peut lui aussi être coupé. Cette
  // requête-ci, elle, ne peut pas l'être — sans elle il n'y aurait pas d'essai.
  //
  // `eventId` vient du navigateur, qui l'a utilisé pour SA copie : même identifiant
  // des deux côtés = Meta n'en compte qu'un (déduplication sur 48 h).
  //
  // Le consentement est vérifié ici parce que le serveur ne peut pas s'appuyer sur
  // le silence du navigateur : donner son courriel n'est pas accepter d'être mesuré.
  if (typeof eventId === 'string' && eventId && mesureAutoriseeServeur(req)) {
    await envoyerACapi({
      event: 'Lead',
      eventId,
      url: req.headers.get('referer') || undefined,
      email,
      ...identitéDepuisRequete(req),
    });
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (audienceId && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.contacts.create({ email: email.toLowerCase().trim(), audienceId, unsubscribed: false });
    } catch {
      // Non bloquant : la liste pub est secondaire par rapport à l'expérience du client
    }
  }

  const ip = getIP(req);
  const ipHash = hashIP(ip);
  const existing = parseAnonCookie(req.cookies.get('virareel_anon')?.value);
  const n = existing && existing.ip === ipHash ? existing.n : 0;

  const response = NextResponse.json({ ok: true });
  response.cookies.set('virareel_anon', makeAnonCookie({ n, ip: ipHash, e: true }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
