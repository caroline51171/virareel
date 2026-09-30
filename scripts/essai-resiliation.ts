// ESSAI du bouton « Résilier mon abonnement » (app/api/portal, action 'resilier').
//
// /api/portal exige une session Clerk : ce script refait donc le MÊME appel Stripe
// que la route, sur un vrai abonnement de TEST, avec la vraie configuration
// « normale » du portail. Deux cas :
//   1) abonnement actif          → Stripe ouvre l'écran d'annulation ;
//   2) déjà résilié (fin de période) → Stripe refuse cet écran, la route se replie
//      sur le portail normal (on vérifie que ce repli fonctionne).
//
//   node --env-file=.env.local scripts/essai-resiliation.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.error('❌ Cle Stripe de TEST obligatoire (sk_test_).');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function main() {
  const verdicts: [string, boolean][] = [];
  let customerId = '';
  try {
    let configuration: string | undefined;
    for await (const c of stripe.billingPortal.configurations.list({ limit: 100 })) {
      if (c.metadata?.virareel === 'normale') { configuration = c.id; break; }
    }
    verdicts.push(['configuration « normale » du portail trouvée', !!configuration]);

    const client = await stripe.customers.create({ email: 'delivered@resend.dev', metadata: { essai: 'resiliation' } });
    customerId = client.id;
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: client.id });
    const prix = (await stripe.prices.list({ lookup_keys: ['solo_monthly'], active: true, limit: 1 })).data[0];
    const sub = await stripe.subscriptions.create({
      customer: client.id, items: [{ price: prix.id }], default_payment_method: pm.id,
    });

    const base = { customer: client.id, return_url: 'https://www.virareelai.com', ...(configuration ? { configuration } : {}) };
    const flux = {
      ...base,
      flow_data: {
        type: 'subscription_cancel' as const,
        subscription_cancel: { subscription: sub.id },
        after_completion: { type: 'redirect' as const, redirect: { return_url: 'https://www.virareelai.com' } },
      },
    };

    // 1) Actif → écran d'annulation
    const s1 = await stripe.billingPortal.sessions.create(flux);
    verdicts.push(['abonnement actif : l\'écran d\'annulation s\'ouvre', s1.flow?.type === 'subscription_cancel' && !!s1.url]);
    console.log('   lien (valable quelques minutes) :', s1.url);

    // 2) Déjà résilié en fin de période → refus de Stripe, puis repli
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    const s2 = await stripe.billingPortal.sessions.create(flux).catch(() => stripe.billingPortal.sessions.create(base));
    verdicts.push(['déjà résilié : le portail normal s\'ouvre quand même', !!s2.url && !s2.flow]);
  } finally {
    if (customerId) await stripe.customers.del(customerId).catch(() => {});
  }
  console.log('');
  for (const [quoi, ok] of verdicts) console.log(`  ${ok ? '✅' : '❌'} ${quoi}`);
  console.log(verdicts.every(v => v[1]) ? '\n✅ TOUT PASSE\n' : '\n❌ AU MOINS UN ECHEC\n');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
