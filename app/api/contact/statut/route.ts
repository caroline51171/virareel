import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { marquerStatutClaire, STATUTS_CLAIRE, type StatutClaire } from '@/lib/messages';

// Claire (l'assistante service client, dans Grok) appelle cette route après avoir
// traité un message du formulaire, pour que /admin affiche « répondu » ou « en attente
// de Caroline ». Protégée par CLAIRE_STATUT_KEY (variable Vercel), envoyée dans
// « Authorization: Bearer <clé> ».
//
// Corps JSON : { "id": "<id reçu dans le webhook>", "statut": "repondu" | "attente_caroline" }

function cleValide(recue: string | null): boolean {
  const attendue = process.env.CLAIRE_STATUT_KEY;
  if (!attendue || !recue) return false;
  const a = Buffer.from(`Bearer ${attendue}`);
  const b = Buffer.from(recue);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!cleValide(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let id: unknown, statut: unknown;
  try {
    ({ id, statut } = await req.json());
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  if (typeof id !== 'string' || !STATUTS_CLAIRE.includes(statut as StatutClaire)) {
    return NextResponse.json(
      { error: `Champs attendus : id (texte) et statut (${STATUTS_CLAIRE.join(' ou ')})` },
      { status: 400 },
    );
  }
  if (!(await marquerStatutClaire(id, statut as StatutClaire))) {
    return NextResponse.json({ error: 'Message introuvable' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
