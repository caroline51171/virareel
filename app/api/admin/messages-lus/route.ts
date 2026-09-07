import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { isAdminEmail } from '@/lib/access';
import { marquerToutLu } from '@/lib/messages';

// Marque les messages comme lus jusqu'à maintenant. Même verrou admin que
// /api/admin/stats : sans lui, n'importe qui pourrait effacer la pastille et
// Caroline manquerait un message client.

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const clerk = await clerkClient();
  const me = await clerk.users.getUser(userId);
  if (!isAdminEmail(me.emailAddresses[0]?.emailAddress?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await marquerToutLu(new Date().toISOString());
  return NextResponse.json({ ok: true });
}
