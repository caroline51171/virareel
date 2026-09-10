import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { prochaineRemiseAZero } from '@/lib/quota';
import { factureRegleeParCharge } from '@/lib/refund';
import { envoyerACapi } from '@/lib/capi';

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
    if (invoice.billing_reason === 'subscription_cycle') {
      // Le RENOUVELLEMENT DU QUOTA ne se fait plus ici. Cette facture tombe chaque
      // mois en mensuel mais UNE SEULE FOIS PAR AN en annuel : la laisser recharger
      // le compteur donnait deux rechargements par mois aux uns et un par an aux
      // autres. C'est lib/quota.ts qui recharge, a la date d'anniversaire, pour tout
      // le monde. On garde ce chemin uniquement pour re-synchroniser le PLAFOND.
      try {
        const subId = typeof invoice.parent?.subscription_details?.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId = sub.metadata?.userId;
          const plan = sub.metadata?.plan;
          const limit = plan ? PLAN_LIMITS[plan] : undefined;
          if (userId && limit) {
            await clerk.users.updateUserMetadata(userId, {
              privateMetadata: { generationsLimit: limit },
            });
            console.log(`Plafond re-synchronise pour userId: ${userId} (plan: ${plan})`);
          }
        }
      } catch (err) {
        console.error('Webhook invoice.paid error:', err);
      }
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;

    // Achat envoyé à Meta ICI, côté serveur — fiable même si la page de succès du
    // client ne charge jamais (bloqueur de pub, onglet fermé trop vite, connexion
    // coupée). `session.id` sert d'identifiant PARTAGÉ avec la copie que le
    // navigateur envoie depuis app/success/page.tsx : Meta ne compte qu'un achat.
    // Envoyé même si userId/plan manquent plus bas : le paiement a quand même eu lieu.
    //
    // ⚠️ Aucune adresse IP ni navigateur ici, VOLONTAIREMENT : cette requête vient de
    // Stripe, pas du client. L'ancienne version appelait /api/capi en HTTP, qui lisait
    // alors l'IP de Vercel et l'envoyait à Meta comme si c'était celle de l'acheteur —
    // de la fausse donnée d'appariement à chaque vente. Le courriel Stripe, lui, est
    // un identifiant bien plus fort, et la copie navigateur (app/success/page.tsx)
    // apporte l'IP réelle quand elle passe : Meta fusionne les deux sur `event_id`.
    await envoyerACapi({
      event: 'Purchase',
      eventId: session.id,
      url: `${req.nextUrl.origin}/success`,
      value: session.amount_total ? session.amount_total / 100 : undefined,
      currency: (session.currency || 'cad').toUpperCase(),
      email: session.customer_details?.email ?? undefined,
    });

    if (!userId || !plan) {
      console.error('Webhook: Missing userId or plan in session metadata');
      return NextResponse.json({ ok: true });
    }

    // JOUR D'ANCRAGE — le jour du mois ou le quota se rechargera desormais, copie
    // de la date d'anniversaire de Stripe. Avant, le quota repartait le 1er pour
    // tout le monde : quelqu'un abonne le 28 recevait un quota complet pour 3 jours,
    // puis un quota NEUF le 1er — deux quotas pour un mois paye.
    let jourAncrage = new Date().getUTCDate();
    try {
      const subId = session.subscription as string | null;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        if (sub.billing_cycle_anchor) {
          jourAncrage = new Date(sub.billing_cycle_anchor * 1000).getUTCDate();
        }
      }
    } catch (err) {
      // Stripe injoignable : on garde le jour d'aujourd'hui, qui est la meme date
      // a une seconde pres. Jamais de retour silencieux au 1er.
      console.error('Webhook: lecture billing_cycle_anchor impossible', err);
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
          jourAncrage,
          resetDate: getNextResetDate(new Date(), jourAncrage),
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
      // L'identifiant Clerk voyage dans les metadonnees de l'ABONNEMENT (pose a la
      // creation, voir /api/checkout). Avant, on chargeait les 200 PREMIERS comptes
      // Clerk et on cherchait dedans : passe 200 comptes — les essais gratuits
      // compris — l'abonne devenait introuvable et l'annulation ne se faisait plus,
      // en silence.
      const userId = subscription.metadata?.userId;
      const user = userId ? await clerk.users.getUser(userId).catch(() => null) : null;

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
