// ESSAI DE BOUT EN BOUT : la confirmation de résiliation part par courriel.
//
// Fabrique un vrai abonnement Stripe (test) Solo, le résilie en fin de période comme
// le portail, relit le VRAI événement `customer.subscription.updated` produit par
// Stripe (avec ses previous_attributes), le signe et le POSTe au webhook local.
// Puis : le même événement relivré n'envoie rien de plus (idempotence), et revenir
// sur la résiliation n'envoie rien.
//
//   node --env-file=.env.local scripts/essai-courriel-resiliation.ts <courriel>
//   (serveur local sur http://localhost:3000, STRIPE_WEBHOOK_SECRET local temporaire)
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.error('❌ Clé Stripe de TEST obligatoire (sk_test_).');
  process.exit(1);
}
const destinataire = process.argv[2];
if (!destinataire) {
  console.error('❌ Indiquer le courriel qui doit recevoir la confirmation.');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const WEBHOOK = 'http://localhost:3000/api/webhook/stripe';

async function evenementMaj(subId: string, apres: number): Promise<Stripe.Event> {
  for (let i = 0; i < 10; i++) {
    const evts = await stripe.events.list({ type: 'customer.subscription.updated', created: { gte: apres }, limit: 20 });
    const e = evts.data.find(x => (x.data.object as Stripe.Subscription).id === subId);
    if (e) return e;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('événement customer.subscription.updated introuvable');
}

async function poster(evt: Stripe.Event): Promise<number> {
  const corps = JSON.stringify(evt);
  const rep = await fetch(WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload: corps, secret: SECRET }),
    },
    body: corps,
  });
  return rep.status;
}

async function main() {
  let customerId = '';
  try {
    const client = await stripe.customers.create({ email: destinataire });
    customerId = client.id;
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: client.id });
    const solo = (await stripe.prices.list({ lookup_keys: ['solo_monthly'], active: true, limit: 1 })).data[0];
    const sub = await stripe.subscriptions.create({
      customer: client.id,
      items: [{ price: solo.id }],
      default_payment_method: pm.id,
      metadata: { userId: '', plan: 'solo', founder: 'false', lang: 'fr' },
    });

    // 1) Résiliation en fin de période, comme le portail
    const t1 = Math.floor(Date.now() / 1000) - 5;
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    const evtResil = await evenementMaj(sub.id, t1);
    console.log('previous_attributes :', JSON.stringify(evtResil.data.previous_attributes));
    console.log('résiliation         : HTTP %s', await poster(evtResil));
    console.log('même événement      : HTTP %s (ne doit PAS renvoyer de courriel)', await poster(evtResil));

    // 2) La personne revient sur sa résiliation : aucun courriel
    const t2 = Math.floor(Date.now() / 1000) - 1;
    await new Promise(r => setTimeout(r, 1500));
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
    const evtReprise = (await stripe.events.list({ type: 'customer.subscription.updated', created: { gte: t2 }, limit: 20 }))
      .data.find(x => (x.data.object as Stripe.Subscription).id === sub.id && 'cancel_at_period_end' in (x.data.previous_attributes ?? {})
        && (x.data.object as Stripe.Subscription).cancel_at_period_end === false);
    if (evtReprise) console.log('reprise             : HTTP %s (ne doit PAS envoyer de courriel)', await poster(evtReprise));
    else console.log('reprise             : événement pas encore visible, sauté');

    console.log('\n➡️  Vérifier : UNE seule « Confirmation de résiliation » reçue à %s,', destinataire);
    console.log('   et les journaux du serveur (« ✉️ Confirmation de résiliation envoyée »).');
  } finally {
    if (customerId) await stripe.customers.del(customerId).catch(() => {});
    console.log('(ménage fait : client et abonnement d\'essai supprimés)');
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
