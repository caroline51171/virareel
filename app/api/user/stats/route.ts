import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

import { isUnlimitedEmail } from '@/lib/access';
import { quotaAJour } from '@/lib/quota';

const FREE_BONUS = 10; // générations bonus créditées à l'inscription

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ plan: 'free', generationsUsed: 0, generationsLimit: 0, resetDate: null });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
    // Bêta testeuse incluse : même interface illimitée que l'admin côté client.
    if (isUnlimitedEmail(userEmail)) {
      return NextResponse.json({ plan: 'admin', generationsUsed: 0, generationsLimit: -1, resetDate: null });
    }

    const plan = (user.publicMetadata?.plan as string) || 'free';

    if (plan === 'creator' || plan === 'pro' || plan === 'solo') {
      const generationsLimit = (user.privateMetadata?.generationsLimit as number) ?? -1;
      const stored = (user.privateMetadata?.generationsUsed as number) || 0;
      // Le quota se renouvelle chaque mois calendaire (lib/quota.ts). On l'affiche
      // ici SANS rien écrire : la première génération du mois persistera la date.
      // Sans ce calcul, l'abonné verrait « 60/60 utilisées » le 1er du mois alors
      // que le serveur, lui, le laisserait générer.
      const aJour = quotaAJour(stored, user.privateMetadata?.resetDate as string | undefined);

      return NextResponse.json({
        plan,
        generationsUsed: aJour.generationsUsed,
        generationsLimit,
        resetDate: aJour.resetDate,
      });
    }

    return NextResponse.json({
      plan: 'free',
      generationsUsed: 0,
      generationsLimit: 0,
      resetDate: null,
    });
  } catch {
    return NextResponse.json({ plan: 'free', generationsUsed: 0, generationsLimit: 0, resetDate: null });
  }
}
