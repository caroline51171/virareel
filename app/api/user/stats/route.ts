import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

import { isUnlimitedEmail } from '@/lib/access';

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
      let generationsUsed = (user.privateMetadata?.generationsUsed as number) || 0;
      let resetDate = (user.privateMetadata?.resetDate as string) || null;

      return NextResponse.json({ plan, generationsUsed, generationsLimit, resetDate });
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
