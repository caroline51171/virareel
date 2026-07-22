import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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
    const { plan, billing, lang } = await req.json();
    const origin = req.headers.get('origin') || 'https://virareelai.com';
    const { userId } = await auth();

    // Montants en centimes
    const amounts: Record<string, Record<string, number>> = {
      solo:    { monthly: 1200, annual: 11500 },
      creator: { monthly: 1900, annual: 18200 },
      pro:     { monthly: 12900, annual: 123800 },
    };

    const names: Record<string, string> = {
      solo:    'ViraReel Solo',
      creator: 'ViraReel Creator',
      pro:     'ViraReel Agency',
    };

    const amount = amounts[plan]?.[billing];
    if (!amount) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: names[plan],
              description: plan === 'solo'
                ? (lang === 'fr' ? '60 générations/mois · Formule Solo' : '60 generations/month · Solo plan')
                : plan === 'creator'
                ? (lang === 'fr' ? '160 générations/mois · 4 plateformes + bilingue' : '160 generations/month · 4 platforms + bilingual')
                : (lang === 'fr' ? '1000 générations/mois · Compte pour agences' : '1000 generations/month · Agency account'),
            },
            unit_amount: amount,
            recurring: {
              interval: billing === 'annual' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/success?plan=${plan}`,
      cancel_url:  `${origin}/#pricing`,
      locale: lang === 'fr' ? 'fr' : 'en',
      metadata: { userId: userId || '', plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
