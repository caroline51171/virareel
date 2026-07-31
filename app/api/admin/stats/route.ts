import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const ADMIN_EMAILS = ['caroline51171@gmail.com', 'caroline51171@hotmail.fr'];
// Coût moyen estimé par génération (modèle claude-sonnet-4-6, voir mémoire : 2-3,6 ¢/script).
const AVG_COST_PER_GENERATION = 0.03;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
  const clients = users
    .filter(u => !ADMIN_EMAILS.includes((u.emailAddresses[0]?.emailAddress || '').toLowerCase()))
    .map(u => {
      const plan = (u.publicMetadata?.plan as string) || 'free';
      const generationsUsed = (u.privateMetadata?.generationsUsed as number) || 0;
      const generationsLimit = (u.privateMetadata?.generationsLimit as number) ?? (plan === 'free' ? 0 : -1);
      return {
        email: u.emailAddresses[0]?.emailAddress || '',
        plan,
        generationsUsed,
        generationsLimit,
        atMax: generationsLimit > 0 && generationsUsed >= generationsLimit,
      };
    })
    .sort((a, b) => b.generationsUsed - a.generationsUsed);

  const totalGenerations = clients.reduce((s, c) => s + c.generationsUsed, 0);
  const estimatedCost = totalGenerations * AVG_COST_PER_GENERATION;

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

  return NextResponse.json({
    clients,
    totalGenerations,
    estimatedCost,
    mrr,
    estimatedProfit: mrr - estimatedCost,
  });
}
