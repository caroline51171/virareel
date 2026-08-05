import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFounderStatus, FOUNDER_AMOUNTS } from '@/lib/founder';
import { ANNUAL_ENABLED } from '@/lib/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Prix Stripe — mensuels et annuels pour Creator et Pro
const PRICES: Record<string, Record<string, string>> = {
  creator: {
    monthly: 'price_creator_monthly',
    annual:  'price_creator_annual',
  },
  pro: {
    monthly: 'price_pro_monthly',
    annual:  'price_pro_annual',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { plan, billing: rawBilling, lang } = await req.json();
    // Chemin annuel fermé côté serveur tant que non validé : toute requête (même
    // forgée) est ramenée à 'monthly'. Réversible via ANNUAL_ENABLED (lib/pricing.ts).
    const billing = ANNUAL_ENABLED ? rawBilling : 'monthly';
    const origin = req.headers.get('origin') || 'https://virareelai.com';
    const { userId } = await auth();

    // Montants en centimes
    // Annuel = mensuel × 10 (2 mois offerts), aligné sur lib/pricing.ts.
    const amounts: Record<string, Record<string, number>> = {
      solo:    { monthly: 1900,  annual: 19000 },
      creator: { monthly: 4900,  annual: 49000 },
      pro:     { monthly: 12900, annual: 129000 },
    };

    const names: Record<string, string> = {
      solo:    'ViraReel Solo',
      creator: 'ViraReel Creator',
      pro:     'ViraReel Agency',
    };

    const normalAmount = amounts[plan]?.[billing];
    if (!normalAmount) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    // Offre fondateur : re-vérifiée CÔTÉ SERVEUR (anti-survente au-delà de 50).
    // Si ouverte → prix fondateur bloqué à vie + marquage `founder` sur l'abonnement.
    const founderStatus = await getFounderStatus(stripe);
    const isFounder = founderStatus.open;
    const amount = isFounder ? (FOUNDER_AMOUNTS[plan]?.[billing] ?? normalAmount) : normalAmount;

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
      success_url: `${origin}/success?plan=${plan}`,
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
