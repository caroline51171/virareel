import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getIP, hashIP, parseAnonCookie, makeAnonCookie } from '@/lib/anonTracking';

// Reçoit le courriel donné au mur du 6e crédit (essai anonyme : EMAIL_GATE_LIMIT=5).
// Ajoute le contact à l'Audience Resend (liste pub, RESEND_AUDIENCE_ID) puis débloque
// le reste des 9 essais (ANON_LIMIT, cf. lib/anonTracking.ts) — même si Resend échoue,
// la génération ne doit jamais rester bloquée pour une raison marketing.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
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
