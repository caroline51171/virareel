import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { getAnonTrialsByDay } from '@/lib/anonStats';

const ADMIN_EMAILS = ['caroline51171@gmail.com', 'caroline51171@hotmail.fr'];
// Repli pour les générations d'AVANT le suivi du coût réel (voir generate/route.ts).
const AVG_COST_PER_GENERATION = 0.03;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type ClientRow = {
  email: string;
  plan: string;
  generationsUsed: number | null;
  generationsLimit: number | null;
  atMax: boolean;
  source: 'compte' | 'essai';
  costUSD: number;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const clerk = await clerkClient();
  const me = await clerk.users.getUser(userId);
  const myEmail = me.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
  if (!ADMIN_EMAILS.includes(myEmail)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: users } = await clerk.users.getUserList({ limit: 200 });
  const accounts: ClientRow[] = users
    .filter(u => !ADMIN_EMAILS.includes((u.emailAddresses[0]?.emailAddress || '').toLowerCase()))
    .map(u => {
      const plan = (u.publicMetadata?.plan as string) || 'free';
      const generationsUsed = (u.privateMetadata?.generationsUsed as number) || 0;
      const generationsLimit = (u.privateMetadata?.generationsLimit as number) ?? (plan === 'free' ? 0 : -1);
      // Coût réel accumulé (voir generate/route.ts) ; repli estimé pour les générations d'avant ce suivi.
      const costUSD = (u.privateMetadata?.totalCostUSD as number | undefined) ?? (generationsUsed * AVG_COST_PER_GENERATION);
      return {
        email: (u.emailAddresses[0]?.emailAddress || '').toLowerCase(),
        plan,
        generationsUsed: generationsUsed as number | null,
        generationsLimit: generationsLimit as number | null,
        atMax: generationsLimit > 0 && generationsUsed >= generationsLimit,
        source: 'compte' as const,
        costUSD,
      };
    });

  // Courriels captés au mur d'essai anonyme (5e crédit), avant création de compte —
  // vivent uniquement dans l'Audience Resend, pas dans Clerk (voir capture-email/route.ts).
  const accountEmails = new Set(accounts.map(a => a.email));
  let trials: ClientRow[] = [];
  if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data } = await resend.contacts.list({ audienceId: process.env.RESEND_AUDIENCE_ID });
      trials = (data?.data || [])
        .map(c => (c.email || '').toLowerCase())
        .filter(email => email && !accountEmails.has(email))
        .map(email => ({
          email,
          plan: 'essai gratuit',
          generationsUsed: null,
          generationsLimit: null,
          atMax: false,
          source: 'essai' as const,
          costUSD: 0,
        }));
    } catch {
      // Non bloquant : le tableau reste utile même sans la liste Resend.
    }
  }

  const clients = [...accounts, ...trials].sort((a, b) => (b.generationsUsed ?? -1) - (a.generationsUsed ?? -1));

  const totalGenerations = accounts.reduce((s, c) => s + (c.generationsUsed || 0), 0);
  const estimatedCost = accounts.reduce((s, c) => s + c.costUSD, 0);

  let mrrCents = 0;
  let cursor: string | undefined;
  do {
    const page = await stripe.subscriptions.list({ status: 'active', limit: 100, starting_after: cursor });
    for (const sub of page.data) {
      const price = sub.items.data[0]?.price;
      const amount = price?.unit_amount || 0;
      mrrCents += price?.recurring?.interval === 'year' ? amount / 12 : amount;
    }
    cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
  } while (cursor);
  const mrr = mrrCents / 100;

  const anonTrialsByDay = await getAnonTrialsByDay(14);

  return NextResponse.json({
    clients,
    totalGenerations,
    estimatedCost,
    mrr,
    estimatedProfit: mrr - estimatedCost,
    anonTrialsByDay,
  });
}
