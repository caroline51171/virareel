import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

const ADMIN_EMAILS = ['caroline51171@hotmail.fr'];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ plan: 'free', generationsUsed: 0, generationsLimit: 0, resetDate: null });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const userEmail = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
    if (ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ plan: 'admin', generationsUsed: 0, generationsLimit: -1, resetDate: null });
    }

    const plan = (user.publicMetadata?.plan as string) || 'free';
    const generationsUsed = (user.privateMetadata?.generationsUsed as number) || 0;
    const generationsLimit = (user.privateMetadata?.generationsLimit as number) || 0;
    const resetDate = (user.privateMetadata?.resetDate as string) || null;

    // Vérifier si le compteur doit être réinitialisé
    if (resetDate && new Date() >= new Date(resetDate)) {
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);
      nextReset.setDate(1);
      const nextResetStr = nextReset.toISOString().split('T')[0];

      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: {
          generationsUsed: 0,
          resetDate: nextResetStr,
        },
      });

      return NextResponse.json({ plan, generationsUsed: 0, generationsLimit, resetDate: nextResetStr });
    }

    return NextResponse.json({ plan, generationsUsed, generationsLimit, resetDate });
  } catch {
    return NextResponse.json({ plan: 'free', generationsUsed: 0, generationsLimit: 0, resetDate: null });
  }
}
