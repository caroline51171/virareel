import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_LIMITS: Record<string, number> = {
  creator: 160,
  pro: 600,
};

function getNextResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const clerk = await clerkClient();

  // 🔄 Renouvellement mensuel → remettre le compteur à zéro
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    // Seulement pour les renouvellements (pas le premier paiement, géré par checkout.session.completed)
    if (invoice.billing_reason === 'subscription_cycle' && invoice.customer) {
      const customerId = invoice.customer as string;
      try {
        const users = await clerk.users.getUserList({ limit: 200 });
        const user = users.data.find(u => u.publicMetadata?.stripeCustomerId === customerId);
        if (user) {
          const plan = (user.publicMetadata?.plan as string) || 'free';
          const limit = PLAN_LIMITS[plan];
          if (limit) {
            await clerk.users.updateUserMetadata(user.id, {
              privateMetadata: {
                generationsUsed: 0,
                generationsLimit: limit,
              },
            });
            console.log(`🔄 Compteur remis à zéro pour userId: ${user.id} (plan: ${plan})`);
          }
        }
      } catch (err) {
        console.error('Webhook invoice.paid error:', err);
      }
    }
  }

  // ✅ Paiement réussi → activer le plan
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;

    if (!userId || !plan) {
      console.error('Webhook: Missing userId or plan in session metadata');
      return NextResponse.json({ ok: true });
    }

    try {
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          plan,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        },
        privateMetadata: {
          generationsUsed: 0,
          generationsLimit: PLAN_LIMITS[plan] || 200,
          resetDate: getNextResetDate(),
        },
      });
      console.log(`✅ Plan ${plan} activé pour userId: ${userId}`);
    } catch (err) {
      console.error('Webhook: Error updating user metadata:', err);
    }
  }

  // ❌ Abonnement annulé → retour au plan Free
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    try {
      const users = await clerk.users.getUserList({ limit: 200 });
      const user = users.data.find(
        u => u.publicMetadata?.stripeCustomerId === customerId
      );

      if (user) {
        await clerk.users.updateUserMetadata(user.id, {
          publicMetadata: {
            plan: 'free',
            stripeCustomerId: customerId,
            stripeSubscriptionId: null,
          },
          privateMetadata: {
            generationsUsed: 0,
            generationsLimit: 0,
            resetDate: null,
          },
        });
        console.log(`Plan réinitialisé à Free pour userId: ${user.id}`);
      }
    } catch (err) {
      console.error('Webhook: Error resetting user to free:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
