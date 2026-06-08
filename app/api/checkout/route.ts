import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

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

    // Montants en centimes
    const amounts: Record<string, Record<string, number>> = {
      creator: { monthly: 1499, annual: 12900 },
      pro:     { monthly: 2999, annual: 27900 },
    };

    const names: Record<string, string> = {
      creator: 'ViraReel Creator',
      pro:     'ViraReel Pro',
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
              description: plan === 'creator'
                ? (lang === 'fr' ? 'Générations illimitées · Toutes plateformes' : 'Unlimited generations · All platforms')
                : (lang === 'fr' ? 'Tout Creator + Variations illimitées + Historique' : 'Everything in Creator + Unlimited variations + History'),
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
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
