import { NextRequest, NextResponse } from 'next/server';
import { MAX_OCTETS, enregistrerPartage, nettoyerPartage, quotaPartageOk } from '@/lib/partage';

// Crée le lien public d'une génération (bouton « Partager »). Ouvert à TOUS, visiteurs
// sans compte compris : partager ne coûte aucune génération. Voir lib/partage.ts.
export async function POST(req: NextRequest) {
  const brut = await req.text();
  if (brut.length > MAX_OCTETS) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const partage = nettoyerPartage(corps);
  if (!partage) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'inconnue';
  if (!(await quotaPartageOk(ip))) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  try {
    const id = await enregistrerPartage(partage);
    if (!id) return NextResponse.json({ error: 'storage' }, { status: 503 });
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'storage' }, { status: 503 });
  }
}
