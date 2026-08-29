import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { META_PIXEL_ID } from '@/lib/pixel';

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

export const dynamic = 'force-dynamic';

const API = 'https://graph.facebook.com/v21.0';

function sha256(v: string): string {
  return crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
}

export async function POST(req: NextRequest) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return NextResponse.json({ ok: false, raison: 'token absent' });

  try {
    const { event, eventId, url, value, currency, email, fbp, fbc } = await req.json();
    if (!event || !eventId) return NextResponse.json({ ok: false }, { status: 400 });

    // Données de correspondance : jamais de courriel en clair, uniquement son empreinte.
    const userData: Record<string, unknown> = {
      client_user_agent: req.headers.get('user-agent') || undefined,
      client_ip_address:
        (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined,
    };
    if (email) userData.em = [sha256(String(email))];
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const customData: Record<string, unknown> = {};
    if (typeof value === 'number' && value > 0) {
      customData.value = value;
      customData.currency = currency || 'CAD';
    }

    const res = await fetch(`${API}/${META_PIXEL_ID}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: event,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: url,
          action_source: 'website',
          user_data: userData,
          ...(Object.keys(customData).length ? { custom_data: customData } : {}),
        }],
      }),
    });

    // On ne fait jamais échouer le parcours du client pour un problème de mesure.
    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
