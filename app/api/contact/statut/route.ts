import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { marquerStatutClaire, STATUTS_CLAIRE, type StatutClaire } from '@/lib/messages';
import { jetonValide } from '@/lib/claire';

// Claire (l'assistante service client, dans Grok) appelle cette route après avoir
// traité un message du formulaire, pour que /admin affiche « répondu » ou « en attente
// de Caroline ». Deux façons de prouver que c'est bien elle :
// - le `jeton` reçu avec le message dans le webhook (ne vaut que pour ce message) ;
// - ou CLAIRE_STATUT_KEY dans « Authorization: Bearer <clé> ».
//
// Corps JSON : { "id": "…", "jeton": "…", "statut": "repondu" | "attente_caroline" }

function cleValide(recue: string | null): boolean {
  const attendue = process.env.CLAIRE_STATUT_KEY;
  if (!attendue || !recue) return false;
  const a = Buffer.from(`Bearer ${attendue}`);
  const b = Buffer.from(recue);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  let id: unknown, statut: unknown, jeton: unknown;
  try {
    ({ id, statut, jeton } = await req.json());
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const autorise =
    cleValide(req.headers.get('authorization')) ||
    (typeof id === 'string' && jetonValide(id, jeton));
  if (!autorise) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
