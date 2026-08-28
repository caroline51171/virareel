import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFounderStatus } from '@/lib/founder';
import { ANNUAL_ENABLED, PRICING_BY_KEY, toCents } from '@/lib/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { plan, billing: rawBilling, lang } = await req.json();
    // Chemin annuel fermé côté serveur tant que non validé : toute requête (même
    // forgée) est ramenée à 'monthly'. Réversible via ANNUAL_ENABLED (lib/pricing.ts).
    const billing = ANNUAL_ENABLED ? rawBilling : 'monthly';
    const origin = req.headers.get('origin') || 'https://virareelai.com';
    const { userId } = await auth();

    // Montants DÉRIVÉS de lib/pricing.ts (SOURCE DE VÉRITÉ UNIQUE) — aucun prix en
    // dur ici : changer un prix dans pricing.ts change ce qui est réellement facturé.
    // Annuel = mensuel × 10 (2 mois offerts).
    const px = PRICING_BY_KEY[plan];
    const isAnnual = billing === 'annual';
    if (!px || (billing !== 'monthly' && !isAnnual)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    const normalAmount = toCents(isAnnual ? px.annualPublic : px.monthlyPublic);

    const names: Record<string, string> = {
      solo:    'ViraReel Solo',
      creator: 'ViraReel Creator',
      pro:     'ViraReel Agency',
    };

    // Offre fondateur : re-vérifiée CÔTÉ SERVEUR (anti-survente au-delà de 50).
    // Si ouverte → prix fondateur bloqué à vie + marquage `founder` sur l'abonnement.
    const founderStatus = await getFounderStatus(stripe);
    const isFounder = founderStatus.open;
    const amount = isFounder
      ? toCents(isAnnual ? px.annualFounder : px.monthlyFounder)
      : normalAmount;

    const baseDesc = plan === 'solo'
      ? (lang === 'fr' ? '60 générations/mois · Formule Solo' : '60 generations/month · Solo plan')
      : plan === 'creator'
      ? (lang === 'fr' ? '160 générations/mois · 4 plateformes + bilingue' : '160 generations/month · 4 platforms + bilingual')
      : (lang === 'fr' ? '1000 générations/mois · Compte pour agences' : '1000 generations/month · Agency account');
    const description = isFounder
      ? `${baseDesc} · ${lang === 'fr' ? '🔥 Fondateur — prix bloqué à vie' : '🔥 Founder — price locked for life'}`
      : baseDesc;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: isFounder ? `${names[plan]} — ${lang === 'fr' ? 'Fondateur' : 'Founder'}` : names[plan],
              description,
            },
            unit_amount: amount,
            recurring: {
              interval: billing === 'annual' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      // Le flag `founder` doit vivre sur l'ABONNEMENT (pas juste la session) pour que
      // le compteur (subscriptions.search) le retrouve et bloque à 50 places.
      subscription_data: {
        metadata: { userId: userId || '', plan, founder: isFounder ? 'true' : 'false' },
      },
      adaptive_pricing: { enabled: true },
      success_url: `${origin}/success?plan=${plan}&v=${amount / 100}&b=${billing}`,
      cancel_url:  `${origin}/#pricing`,
      locale: lang === 'fr' ? 'fr' : 'en',
      metadata: { userId: userId || '', plan, founder: isFounder ? 'true' : 'false' },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
