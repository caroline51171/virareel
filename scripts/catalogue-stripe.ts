// Cree (ou met a jour) le catalogue de prix ViraReel dans Stripe.
//
// REJOUABLE SANS DANGER : les produits portent un identifiant que NOUS imposons et
// les prix une `lookup_key` que nous choisissons. Relancer le script ne cree donc
// jamais de doublon — il constate ce qui existe deja et ne touche qu'au reste.
//
//   node --env-file=.env.local scripts/catalogue-stripe.ts     → environnement de TEST
//   STRIPE_SECRET_KEY=sk_live_xxx node scripts/catalogue-stripe.ts   → le vrai compte
//
// Un prix Stripe est IMMUABLE : on ne peut pas changer son montant. Si un montant a
// bouge, on cree un nouveau prix, on lui transfere la cle de recherche, et on archive
// l'ancien. Les abonnes en cours gardent le prix qu'ils ont signe — c'est exactement
// ce que veut dire « prix bloque a vie ».
import Stripe from 'stripe';
import { catalogueStripe } from '../lib/pricing.ts';

const cle = process.env.STRIPE_SECRET_KEY;
if (!cle) {
  console.error('❌ STRIPE_SECRET_KEY manquante.');
  process.exit(1);
}
const reel = cle.startsWith('sk_live');
const stripe = new Stripe(cle);

const DEVISE = 'cad';

async function produit(id: string, nom: string, description: string) {
  try {
    const existant = await stripe.products.retrieve(id);
    if (existant.name !== nom || existant.description !== description) {
      await stripe.products.update(id, { name: nom, description });
      return 'mis a jour';
    }
    return 'deja la';
  } catch (err) {
    if ((err as { code?: string }).code !== 'resource_missing') throw err;
    await stripe.products.create({ id, name: nom, description });
    return 'cree';
  }
}

async function prix(
  lookupKey: string, produitId: string, montant: number,
  periode: 'monthly' | 'annual', checkoutKey: string, fondateur: boolean,
) {
  const cents = Math.round(montant * 100);
  const interval = periode === 'annual' ? 'year' : 'month';
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const actuel = data[0];

  if (actuel
      && actuel.unit_amount === cents
      && actuel.currency === DEVISE
      && actuel.recurring?.interval === interval) {
    return { etat: 'deja la', id: actuel.id };
  }

  const neuf = await stripe.prices.create({
    product: produitId,
    currency: DEVISE,
    unit_amount: cents,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,          // reprend la cle a l'ancien prix, s'il existe
    metadata: { checkoutKey, fondateur: String(fondateur), periode },
  });
  if (actuel) await stripe.prices.update(actuel.id, { active: false });
  return { etat: actuel ? 'remplace' : 'cree', id: neuf.id };
}

async function main() {
  console.log(`\nCatalogue ViraReel — environnement ${reel ? '⚠️  RÉEL (sk_live)' : 'de TEST'}\n`);
  const entrees = catalogueStripe();

  const produitsFaits = new Set<string>();
  for (const e of entrees) {
    if (produitsFaits.has(e.produitId)) continue;
    produitsFaits.add(e.produitId);
    const etat = await produit(e.produitId, e.nomProduit, e.description);
    console.log(`  produit  ${e.produitId.padEnd(28)} ${etat}`);
  }

  console.log('');
  for (const e of entrees) {
    const r = await prix(e.lookupKey, e.produitId, e.montant, e.periode, e.checkoutKey, e.fondateur);
    const sou = `${e.montant} $`.padStart(8);
    console.log(`  prix     ${e.lookupKey.padEnd(28)} ${sou}  ${r.etat.padEnd(10)} ${r.id}`);
  }

  console.log(`\n✅ ${produitsFaits.size} produits, ${entrees.length} prix.\n`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
