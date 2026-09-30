// ESSAI DE BOUT EN BOUT de « Renoncer au contrat ici » (app/api/renonciation).
//
// Fabrique de vrais abonnements Stripe (TEST) et POSTe la demande au serveur local,
// exactement comme la page /renoncer. Trois cas :
//   1) cliente FRANCE, payée aujourd'hui → remboursée en entier + abonnement annulé ;
//   2) client CANADA, payé aujourd'hui   → rien ne bouge (droit UE/R.-U. seulement) ;
//   3) adresse sans abonnement           → rien ne bouge, accusé quand même.
// (Le cas « plus de 14 jours » est couvert par lib/renonciation.test.ts.)
//
// Les accusés partent à delivered@resend.dev (adresse d'essai de Resend, qui ne va
// nulle part). hello@virareelai.com reçoit un avis par cas.
//
//   node --env-file=.env.local scripts/essai-renonciation.ts
//   (le serveur local doit tourner sur http://localhost:3000)
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  console.error('❌ Cle Stripe de TEST obligatoire (sk_test_).');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const API = 'http://localhost:3000/api/renonciation';
const COURRIEL = 'delivered@resend.dev';

const prixDe = async (cle: string) =>
  (await stripe.prices.list({ lookup_keys: [cle], active: true, limit: 1 })).data[0];

async function abonne(pays: string) {
  const client = await stripe.customers.create({ email: COURRIEL, metadata: { essai: 'renonciation' } });
  const pm = await stripe.paymentMethods.create({
    type: 'card',
    card: { token: 'tok_visa' },
    billing_details: { address: { country: pays } },
  });
  await stripe.paymentMethods.attach(pm.id, { customer: client.id });
  const sub = await stripe.subscriptions.create({
    customer: client.id,
    items: [{ price: (await prixDe('solo_monthly')).id }],
    default_payment_method: pm.id,
  });
  return { client, sub };
}

async function demander(nom: string) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, courriel: COURRIEL, lang: 'fr' }),
  });
  return { statut: r.status, corps: await r.json() };
}

async function main() {
  const aSupprimer: string[] = [];
  const verdicts: [string, boolean][] = [];
  try {
    // 1) France
    const fr = await abonne('FR');
    aSupprimer.push(fr.client.id);
    // Le Canada est créé AVANT la demande France : les deux partagent l'adresse de test,
    // on vérifie donc aussi que seul l'abonnement français est remboursé.
    const ca = await abonne('CA');
    aSupprimer.push(ca.client.id);

    const rep = await demander('Essai Renonciation');
    verdicts.push(['la page répond « demande reçue »', rep.statut === 200 && rep.corps.ok === true]);

    const subFr = await stripe.subscriptions.retrieve(fr.sub.id);
    const piFr = (await stripe.invoicePayments.list({ invoice: subFr.latest_invoice as string, limit: 1 })).data[0]
      ?.payment?.payment_intent as string;
    const chFr = await stripe.charges.retrieve((await stripe.paymentIntents.retrieve(piFr)).latest_charge as string);
    verdicts.push(['FRANCE : abonnement annulé', subFr.status === 'canceled']);
    verdicts.push(['FRANCE : remboursé en entier', chFr.refunded === true && chFr.amount_refunded === chFr.amount]);
    const remb = (await stripe.refunds.list({ charge: chFr.id, limit: 1 })).data[0];
    verdicts.push(['FRANCE : remboursement marqué « renonciation_14_jours »', remb?.metadata?.motif === 'renonciation_14_jours']);

    const subCa = await stripe.subscriptions.retrieve(ca.sub.id);
    const piCa = (await stripe.invoicePayments.list({ invoice: subCa.latest_invoice as string, limit: 1 })).data[0]
      ?.payment?.payment_intent as string;
    const chCa = await stripe.charges.retrieve((await stripe.paymentIntents.retrieve(piCa)).latest_charge as string);
    verdicts.push(['CANADA : abonnement toujours actif', subCa.status === 'active']);
    verdicts.push(['CANADA : aucun remboursement', chCa.amount_refunded === 0]);

    // 2) Double clic : une 2e demande ne rembourse rien de plus et ne plante pas.
    const rep2 = await demander('Essai Renonciation');
    const chFr2 = await stripe.charges.retrieve(chFr.id);
    verdicts.push(['double demande : réponse normale, rien de remboursé en plus',
      rep2.statut === 200 && chFr2.amount_refunded === chFr.amount]);

    // 3) Adresse sans abonnement : on supprime les clients d'essai, puis on redemande.
    for (const id of aSupprimer.splice(0)) await stripe.customers.del(id).catch(() => {});
    const rep3 = await demander('Essai Sans Abonnement');
    verdicts.push(['sans abonnement : réponse identique « demande reçue »', rep3.statut === 200 && rep3.corps.ok === true]);
  } finally {
    for (const id of aSupprimer) await stripe.customers.del(id).catch(() => {});
  }

  console.log('');
  for (const [quoi, ok] of verdicts) console.log(`  ${ok ? '✅' : '❌'} ${quoi}`);
  console.log(verdicts.every(v => v[1]) ? '\n✅ TOUT PASSE\n' : '\n❌ AU MOINS UN ECHEC\n');
  console.log('(menage fait : clients d\'essai supprimes)');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
