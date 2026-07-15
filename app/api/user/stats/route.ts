import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

const ADMIN_EMAILS = ['caroline51171@gmail.com', 'caroline51171@hotmail.fr'];
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
    if (ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ plan: 'admin', generationsUsed: 0, generationsLimit: -1, resetDate: null });
    }

    const plan = (user.publicMetadata?.plan as string) || 'free';

    if (plan === 'creator' || plan === 'pro') {
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
