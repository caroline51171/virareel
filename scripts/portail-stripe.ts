// Cree (ou met a jour) les configurations du PORTAIL CLIENT Stripe.
//
// Pourquoi 4 configurations et pas une seule :
//
//   Stripe interdit de mettre deux prix du MEME produit avec la MEME frequence dans
//   une configuration. Le prix normal et le prix fondateur d'un meme forfait, tous
//   deux mensuels, ne peuvent donc pas cohabiter. (Mensuel + annuel du meme produit,
//   eux, sont permis : ce sont deux frequences differentes.)
//
//   Et surtout, les CGV (app/cgv/page.tsx) disent : le tarif fondateur s'applique
//   « exclusivement au forfait souscrit », il n'est PAS transferable a un autre
//   forfait. Un fondateur Solo doit donc voir Solo au prix fondateur, mais Creator
//   et Agency au prix NORMAL. C'est une configuration par forfait fondateur.
//
//     normale          : Solo, Creator, Agency — prix normaux
//     fondateur_solo   : Solo FONDATEUR + Creator, Agency normaux
//     fondateur_creator: Creator FONDATEUR + Solo, Agency normaux
//     fondateur_agency : Agency FONDATEUR + Solo, Creator normaux
//
// Dans chaque configuration, un forfait est offert en mensuel ET en annuel : c'est
// ce qui permet a un fondateur de changer de frequence SANS perdre son prix a vie —
// le seul trou reel que les CGV laissaient ouvert (note du 2026-08-07).
//
// REJOUABLE : les configurations sont retrouvees par leur `metadata.virareel`.
//
//   node --env-file=.env.local scripts/portail-stripe.ts    → TEST
//   STRIPE_SECRET_KEY=sk_live_xxx node scripts/portail-stripe.ts  → le vrai compte
import Stripe from 'stripe';
import { PLANS } from '../lib/pricing.ts';

const cle = process.env.STRIPE_SECRET_KEY;
if (!cle) {
  console.error('❌ STRIPE_SECRET_KEY manquante.');
  process.exit(1);
}
const stripe = new Stripe(cle);
const SITE = 'https://virareelai.com';

// Un changement de forfait est FACTURE SUR-LE-CHAMP plutot que reporte a la
// prochaine facture. L'argent et les generations restent ainsi synchronises : la
// personne qui vient d'atteindre sa limite paye et recoit son nouveau plafond dans
// le meme geste. Pour reporter a la facture suivante : 'create_prorations'.
const PRORATA: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.ProrationBehavior =
  'always_invoice';

async function prixParCle(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for await (const p of stripe.prices.list({ active: true, limit: 100 })) {
    if (p.lookup_key) m.set(p.lookup_key, p.id);
  }
  return m;
}

function produits(prix: Map<string, string>, fondateurDe: string | null) {
  return PLANS.map(plan => {
    const fond = plan.id === fondateurDe;
    const suffixe = fond ? '_fondateur' : '';
    const cles = [`${plan.id}${suffixe}_monthly`, `${plan.id}${suffixe}_annual`];
    const ids = cles.map(c => {
      const id = prix.get(c);
      if (!id) throw new Error(`prix absent du catalogue : ${c} — lancer scripts/catalogue-stripe.ts`);
      return id;
    });
    return { product: `virareel_${plan.id}${suffixe}`, prices: ids };
  });
}

async function configuration(nom: string, fondateurDe: string | null, prix: Map<string, string>) {
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      privacy_policy_url: `${SITE}/privacy`,
      terms_of_service_url: `${SITE}/cgv`,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: PRORATA,
        products: produits(prix, fondateurDe),
      },
    },
    metadata: { virareel: nom },
  };

  for await (const c of stripe.billingPortal.configurations.list({ limit: 100 })) {
    if (c.metadata?.virareel === nom) {
      const maj = await stripe.billingPortal.configurations.update(c.id, params);
      return { etat: 'mise a jour', id: maj.id };
    }
  }
  const neuve = await stripe.billingPortal.configurations.create(params);
  return { etat: 'creee', id: neuve.id };
}

async function main() {
  const reel = cle!.startsWith('sk_live');
  console.log(`\nPortail ViraReel — environnement ${reel ? '⚠️  RÉEL (sk_live)' : 'de TEST'}\n`);
  const prix = await prixParCle();

  const aFaire: Array<[string, string | null]> = [
    ['normale', null],
    ...PLANS.map(p => [`fondateur_${p.id}`, p.id] as [string, string]),
  ];

  for (const [nom, fondateurDe] of aFaire) {
    const r = await configuration(nom, fondateurDe, prix);
    console.log(`  config  ${nom.padEnd(20)} ${r.etat.padEnd(12)} ${r.id}`);
  }
  console.log(`\n✅ ${aFaire.length} configurations. Changement de forfait facturé : ${PRORATA}.\n`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
