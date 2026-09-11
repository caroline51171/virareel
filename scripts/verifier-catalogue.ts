// VERIFICATION EN LECTURE SEULE du catalogue de prix et du portail Stripe.
//
// Ne cree rien, ne modifie rien, ne supprime rien : que des lectures. Sans danger
// sur le vrai compte.
//
//   node --env-file=.env.local scripts/verifier-catalogue.ts     → environnement de TEST
//   $env:STRIPE_SECRET_KEY="rk_live_xxx"; node scripts/verifier-catalogue.ts   → le vrai compte
//
// Pour le vrai compte, une CLE LIMITEE en lecture seule suffit et se copie, elle
// (Stripe ne montre une cle secrete complete qu'a sa creation). Droits necessaires :
// Produits = Lecture, Prix = Lecture, Configurations du portail = Lecture.
//
// Pourquoi ce script existe : scripts/catalogue-stripe.ts repart d'un prix existant
// quand le MONTANT est bon, sans regarder ses metadonnees. Un prix arrive autrement
// (copie depuis le mode test, cree a la main) peut donc porter la bonne cle de
// recherche et le bon montant mais PAS l'etiquette `checkoutKey` — or c'est elle,
// et elle seule, que le webhook `customer.subscription.updated` lit pour savoir vers
// quel forfait basculer le compte. Sans elle, le changement de forfait est facture
// par Stripe et reste sans effet dans ViraReel, sans aucun message d'erreur.
import Stripe from 'stripe';
import { catalogueStripe, PLANS } from '../lib/pricing.ts';

const cle = process.env.STRIPE_SECRET_KEY;
if (!cle) {
  console.error('❌ STRIPE_SECRET_KEY manquante.');
  process.exit(1);
}
const stripe = new Stripe(cle);
// `sk_live_...` (cle complete) ou `rk_live_...` (cle limitee en lecture) : les deux
// parlent au VRAI compte. Ne pas tester que `sk_live`, sinon une cle limitee ferait
// afficher « environnement de TEST » sur des chiffres bien reels.
const reel = cle.includes('_live');
const DEVISE = 'cad';

let problemes = 0;
const ko = (msg: string) => { problemes++; console.log(`     ❌ ${msg}`); };

/** Les 12 prix du catalogue : existence, montant, devise, frequence, etiquettes. */
async function verifierPrix(): Promise<void> {
  console.log('PRIX\n');

  for (const e of catalogueStripe()) {
    const { data } = await stripe.prices.list({ lookup_keys: [e.lookupKey], active: true, limit: 2 });
    const p = data[0];
    const etiquette = `  ${e.lookupKey.padEnd(28)}`;

    if (!p) {
      console.log(`${etiquette} ABSENT`);
      ko(`aucun prix actif pour « ${e.lookupKey} » — relancer scripts/catalogue-stripe.ts`);
      continue;
    }

    const cents = Math.round(e.montant * 100);
    const interval = e.periode === 'annual' ? 'year' : 'month';
    const produitId = typeof p.product === 'string' ? p.product : p.product.id;
    const ecarts: string[] = [];

    if (p.unit_amount !== cents) ecarts.push(`montant ${(p.unit_amount ?? 0) / 100} $ au lieu de ${e.montant} $`);
    if (p.currency !== DEVISE) ecarts.push(`devise ${p.currency} au lieu de ${DEVISE}`);
    if (p.recurring?.interval !== interval) ecarts.push(`frequence ${p.recurring?.interval} au lieu de ${interval}`);
    if (produitId !== e.produitId) ecarts.push(`produit ${produitId} au lieu de ${e.produitId}`);
    // L'etiquette critique : le webhook du changement de forfait ne lit que celle-la.
    if (p.metadata?.checkoutKey !== e.checkoutKey) {
      ecarts.push(`checkoutKey « ${p.metadata?.checkoutKey ?? 'absente'} » au lieu de « ${e.checkoutKey} »`);
    }
    if (data.length > 1) ecarts.push('DEUX prix actifs portent cette cle');

    console.log(`${etiquette} ${String(e.montant + ' $').padStart(8)}  ${ecarts.length ? 'PROBLEME' : 'ok'}  ${p.id}`);
    for (const e2 of ecarts) ko(e2);
  }
}

/** Les 4 comptoirs du portail client : c'est eux qui rendent le changement possible. */
async function verifierPortail() {
  console.log('\nPORTAIL CLIENT\n');

  const trouvees = new Map<string, Stripe.BillingPortal.Configuration>();
  for await (const c of stripe.billingPortal.configurations.list({ limit: 100 })) {
    const nom = c.metadata?.virareel;
    if (typeof nom === 'string') trouvees.set(nom, c);
  }

  const attendues: Array<[string, string | null]> = [
    ['normale', null],
    ...PLANS.map(p => [`fondateur_${p.id}`, p.id] as [string, string]),
  ];

  for (const [nom, fondateurDe] of attendues) {
    const c = trouvees.get(nom);
    const etiquette = `  ${nom.padEnd(20)}`;
    if (!c) {
      console.log(`${etiquette} ABSENTE`);
      ko(`configuration « ${nom} » introuvable — relancer scripts/portail-stripe.ts`);
      continue;
    }

    const maj = c.features?.subscription_update;
    const ecarts: string[] = [];
    if (!c.active) ecarts.push('configuration inactive');
    if (!maj?.enabled) ecarts.push('le changement de forfait est DESACTIVE');
    if (maj?.proration_behavior !== 'always_invoice') {
      ecarts.push(`prorata « ${maj?.proration_behavior} » au lieu de « always_invoice »`);
    }
    if (!c.business_profile?.privacy_policy_url) ecarts.push('politique de confidentialite absente');
    if (!c.business_profile?.terms_of_service_url) ecarts.push('conditions d-utilisation absentes');

    // La LISTE DES FORFAITS offerts par ce comptoir n'est pas verifiable ici :
    // l'API Stripe (version 2026-05-27.dahlia) ne renvoie pas
    // `features.subscription_update.products` dans la configuration, meme en lecture
    // directe. Elle a ete verifiee A L'OEIL en mode test le 2026-09-11, en ouvrant
    // une vraie session de portail : un fondateur Solo voit Solo (Fondateur) a
    // 15 $/mois et 150 $/an, Creator a 49 $ et Agency a 129 $ — conforme aux CGV.
    // Ne pas transformer ce trou en faux probleme : un script qui crie au loup sur
    // une donnee absente finit par etre ignore le jour ou il a raison.

    console.log(`${etiquette} ${ecarts.length ? 'PROBLEME' : 'ok'}  ${c.id}`);
    for (const e of ecarts) ko(e);
  }
}

async function main() {
  console.log(`\nVerification ViraReel — environnement ${reel ? '⚠️  RÉEL (sk_live)' : 'de TEST'}`);
  console.log('Lecture seule : rien n-est cree ni modifie.\n');
  await verifierPrix();
  await verifierPortail();
  console.log(problemes === 0
    ? '\n✅ Catalogue et portail conformes. Le changement de forfait a tout ce qu-il lui faut.\n'
    : `\n❌ ${problemes} probleme(s) ci-dessus. NE PAS faire le test d-achat avant de les regler.\n`);
  process.exit(problemes === 0 ? 0 : 1);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
