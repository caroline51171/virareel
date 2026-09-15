// ESSAI DE BOUT EN BOUT : un remboursement annule l'abonnement, MEME apres un
// changement de forfait.
//
// Le defaut corrige : apres un changement au portail (prorata `always_invoice`), la
// DERNIERE facture de l'abonnement est une facture d'ajustement. Le webhook regardait
// celle-la — la charge remboursee ne la reglait jamais, donc l'abonnement restait actif.
//
// Ce script fabrique un vrai abonnement Stripe (test) Creator fondateur, le fait
// descendre vers Solo comme le portail, rembourse la charge de la souscription, signe
// un vrai evenement `charge.refunded` et le POSTe au webhook du serveur local.
//
//   node --env-file=.env.local scripts/essai-remboursement.ts
//   (le serveur local doit tourner sur http://localhost:3000)
import Stripe from 'stripe';
import { createClerkClient } from '@clerk/backend';

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.error('❌ Cle Stripe de TEST obligatoire (sk_test_).');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const WEBHOOK = 'http://localhost:3000/api/webhook/stripe';

const prixDe = async (cle: string) =>
  (await stripe.prices.list({ lookup_keys: [cle], active: true, limit: 1 })).data[0];

async function main() {
  let userId = '';
  let customerId = '';
  try {
    const user = await clerk.users.createUser({
      emailAddress: [`essai.rembourse.${Date.now()}@example.com`],
      password: `Vr${Date.now()}!Qz7pLm`,
    });
    userId = user.id;

    const client = await stripe.customers.create({ email: `essai-${Date.now()}@exemple.test` });
    customerId = client.id;
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: client.id });
    await stripe.customers.update(client.id, { invoice_settings: { default_payment_method: pm.id } });

    // 1) Souscription Creator fondateur (39 $)
    const creator = await prixDe('creator_fondateur_monthly');
    let sub = await stripe.subscriptions.create({
      customer: client.id,
      items: [{ price: creator.id }],
      default_payment_method: pm.id,
      metadata: { userId, plan: 'creator', founder: 'true' },
    });
    const factureSouscription = sub.latest_invoice as string;

    // 2) Baisse vers Solo, exactement comme le portail (always_invoice)
    const solo = await prixDe('solo_monthly');
    sub = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: solo.id }],
      proration_behavior: 'always_invoice',
    });
    const derniere = await stripe.invoices.retrieve(sub.latest_invoice as string);
    console.log('derniere facture apres la baisse : %s (%s, %s $)',
      derniere.id, derniere.billing_reason, (derniere.total ?? 0) / 100);

    // 3) Remboursement complet de la charge de la souscription
    const paiements = await stripe.invoicePayments.list({ invoice: factureSouscription, limit: 1 });
    const piId = paiements.data[0]?.payment?.payment_intent as string;
    const pi = await stripe.paymentIntents.retrieve(piId);
    await stripe.refunds.create({ payment_intent: piId });
    const charge = await stripe.charges.retrieve(pi.latest_charge as string);

    // 4) Stripe previent notre webhook — vrai evenement, vraie signature
    const corps = JSON.stringify({
      id: `evt_essai_${Date.now()}`,
      object: 'event',
      api_version: '2025-01-01',
      created: Math.floor(Date.now() / 1000),
      type: 'charge.refunded',
      data: { object: charge },
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: corps, secret: SECRET });
    const rep = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
      body: corps,
    });
    console.log('webhook : HTTP %s %s', rep.status, await rep.text());

    const apres = await stripe.subscriptions.retrieve(sub.id);
    const verdicts = [
      ['la derniere facture est bien un ajustement (le piege)', derniere.billing_reason === 'subscription_update'],
      ['la charge est remboursee en entier', charge.refunded === true],
      ['l\'abonnement est annule', apres.status === 'canceled'],
    ] as const;
    console.log('');
    for (const [quoi, ok] of verdicts) console.log(`  ${ok ? '✅' : '❌'} ${quoi}`);
    console.log(verdicts.every(v => v[1]) ? '\n✅ TOUT PASSE\n' : '\n❌ AU MOINS UN ECHEC\n');

    if (apres.status !== 'canceled') await stripe.subscriptions.cancel(sub.id);
  } finally {
    if (userId) await clerk.users.deleteUser(userId).catch(() => {});
    if (customerId) await stripe.customers.del(customerId).catch(() => {});
    console.log('(menage fait : compte et client d\'essai supprimes)');
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
