import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export interface HistoryEntry {
  id: number;
  date: string;
  topic: string;
  platform: string;
  lang: string;
  hook: string;
  caption: string;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ history: [] });
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const history = (user.privateMetadata?.history as HistoryEntry[]) || [];
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ history: [] });
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { history: [] },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
