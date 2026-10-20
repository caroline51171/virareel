import { NextRequest, NextResponse, after } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { isHorsStats } from '@/lib/access';
import { enregistrerVisite } from '@/lib/journal';
import { appareilDe, estRobot, paysDe, sourceDe } from '@/lib/visites';

// +1 visite, envoyé une fois par session par components/CompteurVisites.tsx.
// Répond tout de suite : l'écriture se fait après la réponse et ne peut jamais
// ralentir ni casser la page du visiteur. Voir lib/visites.ts pour la vie privée.

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent');
  if (estRobot(ua)) return new NextResponse(null, { status: 204 });

  let corps: { ref?: unknown; utm?: unknown; fb?: unknown } = {};
  try {
    const texte = await req.text();
    if (texte.length <= 2000) corps = JSON.parse(texte);
  } catch {
    // Corps illisible : la visite compte quand même, en « Direct ».
  }
  const source = sourceDe(
    typeof corps.ref === 'string' ? corps.ref : '',
    typeof corps.utm === 'string' ? corps.utm.slice(0, 60) : '',
    corps.fb === true,
    req.nextUrl.hostname,
  );
  const pays = paysDe(req.headers.get('x-vercel-ip-country'));
  const appareil = appareilDe(ua);
  const { userId } = await auth();

  after(async () => {
    try {
      // Les comptes de Caroline et de test ne gonflent pas les visites.
      if (userId) {
        const u = await (await clerkClient()).users.getUser(userId);
        if (isHorsStats(u.emailAddresses[0]?.emailAddress)) return;
      }
      await enregistrerVisite(source, pays, appareil);
    } catch {
      // Une statistique ne doit jamais faire d'erreur visible.
    }
  });
  return new NextResponse(null, { status: 204 });
}
