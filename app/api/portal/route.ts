import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Ouvre le portail client Stripe déjà connecté (pas besoin de retaper son courriel) —
// utilisé pour changer de forfait (Solo→Creator, etc.) sans créer un 2e abonnement,
// contrairement à /api/checkout qui crée toujours un NOUVEL abonnement.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const customerId = user.publicMetadata?.stripeCustomerId as string | undefined;
    if (!customerId) return NextResponse.json({ error: 'no_subscription' }, { status: 404 });

    const origin = req.headers.get('origin') || 'https://virareelai.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    return NextResponse.json({ error: 'portal_failed' }, { status: 500 });
  }
}
