import Stripe from 'stripe';
import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { envoyerACapi, identitéDepuisRequete } from '@/lib/capi';
import { mesureAutoriseeServeur } from '@/lib/consentement';
import { getFounderStatus } from '@/lib/founder';
import { ANNUAL_ENABLED, PRICING_BY_KEY, toCents, lookupKeyPour } from '@/lib/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Retrouve un prix du CATALOGUE (scripts/catalogue-stripe.ts) par sa cle de
// recherche. Les identifiants de prix different entre l'environnement de test et le
// vrai compte : la cle, elle, est la meme des deux cotes.
//
// Avant, le prix etait fabrique a la volee ici (`price_data`). Un prix neuf naissait
// a chaque achat, donc le compte Stripe n'avait aucun prix stable — et le portail
// client n'avait rien a proposer pour un changement de forfait.
//
// Mise en cache par instance : le catalogue ne bouge pas entre deux deploiements.
const cachePrix = new Map<string, string>();
async function prixDuCatalogue(lookupKey: string): Promise<string> {
  const connu = cachePrix.get(lookupKey);
  if (connu) return connu;
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (!data[0]) throw new Error(`prix absent du catalogue : ${lookupKey} — lancer scripts/catalogue-stripe.ts`);
  cachePrix.set(lookupKey, data[0].id);
  return data[0].id;
}

export async function POST(req: NextRequest) {
  try {
    const { plan, billing: rawBilling, lang, eventId } = await req.json();
    // Chemin annuel fermé côté serveur tant que non validé : toute requête (même
    // forgée) est ramenée à 'monthly'. Réversible via ANNUAL_ENABLED (lib/pricing.ts).
    const billing = ANNUAL_ENABLED ? rawBilling : 'monthly';
    const origin = req.headers.get('origin') || 'https://virareelai.com';
    const { userId } = await auth();
    // Verrou obligatoire : sans lui, un paiement peut aboutir sans compte pour le
    // recevoir (deja arrive en test le 09-03). Meme patron que /api/portal.
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // Montants DÉRIVÉS de lib/pricing.ts (SOURCE DE VÉRITÉ UNIQUE) — aucun prix en
    // dur ici : changer un prix dans pricing.ts change ce qui est réellement facturé.
    // Annuel = mensuel × 10 (2 mois offerts).
    const px = PRICING_BY_KEY[plan];
    const isAnnual = billing === 'annual';
    if (!px || (billing !== 'monthly' && !isAnnual)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    const normalAmount = toCents(isAnnual ? px.annualPublic : px.monthlyPublic);

    // Offre fondateur : re-vérifiée CÔTÉ SERVEUR (anti-survente au-delà de 50).
    // Si ouverte → prix fondateur bloqué à vie + marquage `founder` sur l'abonnement.
    const founderStatus = await getFounderStatus(stripe);
    const isFounder = founderStatus.open;
    const amount = isFounder
      ? toCents(isAnnual ? px.annualFounder : px.monthlyFounder)
      : normalAmount;

    // Le nom et la description affiches par Stripe viennent maintenant du PRODUIT du
    // catalogue, plus d'un texte fabrique ici. Consequence assumee : la page de
    // paiement n'est plus bilingue sur ce point (elle l'est pour le reste, via
    // `locale`). En echange, le portail client peut enfin proposer un changement de
    // forfait, ce qui etait impossible avec un prix jetable.
    const priceId = await prixDuCatalogue(
      lookupKeyPour(plan, isAnnual ? 'annual' : 'monthly', isFounder),
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Le flag `founder` doit vivre sur l'ABONNEMENT (pas juste la session) pour que
      // le compteur (subscriptions.search) le retrouve et bloque a 50 places.
      // `userId` sert aussi a retrouver l'abonne sur CHAQUE webhook, sans balayer Clerk.
      subscription_data: {
        metadata: { userId: userId || '', plan, founder: isFounder ? 'true' : 'false' },
      },
      adaptive_pricing: { enabled: true },
      // sid = id de la session Stripe : sert d'identifiant PARTAGE avec l'Achat que
      // le webhook envoie a Meta cote serveur, pour que les deux copies (navigateur
      // + serveur) du meme achat ne comptent qu'une fois.
      success_url: `${origin}/success?plan=${plan}&v=${amount / 100}&b=${billing}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/#pricing`,
      locale: lang === 'fr' ? 'fr' : 'en',
      metadata: { userId: userId || '', plan, founder: isFounder ? 'true' : 'false' },
    });

    // Paiement initié envoyé ICI plutôt que depuis le navigateur seul. Deux raisons :
    // un bloqueur de publicités coupe le pixel, et surtout le navigateur part vers
    // Stripe dans la seconde qui suit — s'il clique un forfait avant que le pixel ait
    // fini de charger, l'événement était PERDU (le pixel attend /api/zone). Ici, rien
    // de tout ça : la requête a forcément eu lieu, sinon il n'y aurait pas de paiement.
    //
    // `after()` fait partir l'envoi APRÈS la réponse : la redirection vers Stripe
    // n'attend pas Meta. Sans lui, une promesse non attendue serait tuée par Vercel.
    //
    // Montant réel (prix fondateur inclus), donc Meta apprend la vraie valeur.
    if (typeof eventId === 'string' && eventId && mesureAutoriseeServeur(req)) {
      const identité = identitéDepuisRequete(req);
      after(() => envoyerACapi({
        event: 'InitiateCheckout',
        eventId,
        url: `${origin}/#pricing`,
        value: amount / 100,
        currency: 'CAD',
        ...identité,
      }));
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
