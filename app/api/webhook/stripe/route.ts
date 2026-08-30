import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { prochaineRemiseAZero } from '@/lib/quota';
import { factureRegleeParCharge } from '@/lib/refund';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_LIMITS: Record<string, number> = {
  solo: 60,
  creator: 160,
  pro: 1000,
};

// La date de renouvellement vient de lib/quota.ts — même fonction que celle qui
// DÉCIDE des remises à zéro côté generate/transcreate. Deux calculs séparés
// auraient pu diverger d'un jour.
const getNextResetDate = prochaineRemiseAZero;

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

  // 🔄 Nouvelle période FACTURÉE → remettre le compteur à zéro.
  // ⚠️ Ne suffit pas à lui seul : cette facture tombe chaque mois en mensuel, mais
  // une seule fois par an en ANNUEL. Le vrai renouvellement mensuel est fait par
  // lib/quota.ts, à la lecture du quota. On garde ce chemin parce qu'il repart
  // proprement du plafond du forfait à chaque facture (changement de forfait inclus).
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
                // Sans ça, la date affichée se périmait aussi pour les mensuels.
                resetDate: getNextResetDate(),
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

  // 💸 Remboursement COMPLET → fin d'abonnement immédiate, SAUF double facturation.
  // Règle des CGV §5. Toute la logique de décision est dans lib/refund.ts (testée).
  // On ne rétrograde PAS le compte ici : subscriptions.cancel() déclenche
  // `customer.subscription.deleted`, traité par le bloc ci-dessous — un seul
  // chemin de rétrogradation. Un remboursement partiel (`refunded: false`) ne
  // coupe jamais.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
    if (charge.refunded && customerId) {
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
      try {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 10,
        });
        for (const sub of subs.data) {
          const invoiceId =
            typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
          if (!invoiceId) continue;
          const paiements = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 10 });
          if (factureRegleeParCharge(paiements.data.map(p => p.payment), charge.id, paymentIntentId)) {
            await stripe.subscriptions.cancel(sub.id);
            console.log(`💸 Remboursement de ${charge.id} → abonnement ${sub.id} annulé sur-le-champ`);
          } else {
            console.log(`💸 Remboursement de ${charge.id} : la facture reste payée autrement (double facturation ?) — accès conservé`);
          }
        }
      } catch (err) {
        console.error('Webhook charge.refunded error:', err);
      }
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
