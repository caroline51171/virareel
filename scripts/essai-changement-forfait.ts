// ESSAI DE BOUT EN BOUT du changement de forfait — la question de Caroline :
// « si la personne a fait 40 generations, sa prochaine sera-t-elle bien la 41e
//   apres un changement de forfait, ou le compteur retombe-t-il a zero ? »
//
// Le compteur ne doit PAS retomber a zero : un changement de forfait n'est pas un
// nouveau mois. Sinon Solo -> Creator -> Solo redonnerait des generations gratuites
// a volonte. Et le jour d'ancrage ne doit pas bouger non plus : Stripe garde la date
// d'anniversaire d'origine, notre quota doit la garder aussi.
//
// Ce script fabrique un vrai abonnement Stripe (test), un vrai compte Clerk (test),
// signe un vrai evenement `customer.subscription.updated` et le POSTe au webhook du
// serveur local. Rien n'est simule : c'est le vrai code du webhook qui repond.
//
//   node --env-file=.env.local scripts/essai-changement-forfait.ts
//   (le serveur local doit tourner sur http://localhost:3000)
import Stripe from 'stripe';
import { createClerkClient } from '@clerk/backend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const WEBHOOK = 'http://localhost:3000/api/webhook/stripe';

const prixDe = async (cle: string) =>
  (await stripe.prices.list({ lookup_keys: [cle], active: true, limit: 1 })).data[0];

async function main() {
  let userId = '';
  let customerId = '';
  try {
    // 1) Un abonne Solo qui a deja consomme 40 de ses 60 generations
    const user = await clerk.users.createUser({
      emailAddress: [`essai.forfait.${Date.now()}@example.com`],
      password: `Vr${Date.now()}!Qz7pLm`,
      publicMetadata: { plan: 'solo' },
      privateMetadata: {
        generationsUsed: 40,
        generationsLimit: 60,
        jourAncrage: 28,
        resetDate: '2026-10-28',
      },
    });
    userId = user.id;

    const client = await stripe.customers.create({ email: `essai-${Date.now()}@exemple.test` });
    customerId = client.id;
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: client.id });
    await stripe.customers.update(client.id, { invoice_settings: { default_payment_method: pm.id } });

    const solo = await prixDe('solo_monthly');
    let sub = await stripe.subscriptions.create({
      customer: client.id,
      items: [{ price: solo.id }],
      default_payment_method: pm.id,
      metadata: { userId, plan: 'solo', founder: 'false' },
    });

    const avant = await clerk.users.getUser(userId);
    console.log('AVANT   plan=%s  utilisees=%s / plafond=%s  ancrage=%s  reset=%s',
      avant.publicMetadata.plan,
      avant.privateMetadata.generationsUsed,
      avant.privateMetadata.generationsLimit,
      avant.privateMetadata.jourAncrage,
      avant.privateMetadata.resetDate);

    // 2) La personne passe a Creator depuis le portail
    const creator = await prixDe('creator_monthly');
    sub = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: creator.id }],
      proration_behavior: 'create_prorations',
    });

    // 3) Stripe previent notre webhook — vrai evenement, vraie signature
    const evenement = {
      id: `evt_essai_${Date.now()}`,
      object: 'event',
      api_version: '2025-01-01',
      created: Math.floor(Date.now() / 1000),
      type: 'customer.subscription.updated',
      data: { object: sub },
    };
    const corps = JSON.stringify(evenement);
    const signature = stripe.webhooks.generateTestHeaderString({ payload: corps, secret: SECRET });
    const rep = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
      body: corps,
    });
    console.log('\nwebhook : HTTP %s %s\n', rep.status, await rep.text());

    const apres = await clerk.users.getUser(userId);
    const u = apres.privateMetadata;
    console.log('APRES   plan=%s  utilisees=%s / plafond=%s  ancrage=%s  reset=%s',
      apres.publicMetadata.plan, u.generationsUsed, u.generationsLimit, u.jourAncrage, u.resetDate);

    const verdicts = [
      ['le forfait devient creator', apres.publicMetadata.plan === 'creator'],
      ['le plafond passe a 160', u.generationsLimit === 160],
      ['le compteur reste a 40 (la prochaine sera la 41e)', u.generationsUsed === 40],
      ['le jour d\'ancrage ne bouge pas', u.jourAncrage === 28],
      ['la date de renouvellement ne bouge pas', u.resetDate === '2026-10-28'],
    ] as const;
    console.log('');
    for (const [quoi, ok] of verdicts) console.log(`  ${ok ? '✅' : '❌'} ${quoi}`);
    console.log(verdicts.every(v => v[1]) ? '\n✅ TOUT PASSE\n' : '\n❌ AU MOINS UN ECHEC\n');

    await stripe.subscriptions.cancel(sub.id);
  } finally {
    if (userId) await clerk.users.deleteUser(userId).catch(() => {});
    if (customerId) await stripe.customers.del(customerId).catch(() => {});
    console.log('(menage fait : compte et client d\'essai supprimes)');
  }
}

main().catch(err => { console.error('❌', err.message, JSON.stringify(err.errors ?? '', null, 1)); process.exit(1); });
