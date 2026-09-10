import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// QUEL COMPTOIR ouvrir. Le portail ne peut proposer un changement de forfait que
// pour des prix qui existent VRAIMENT dans le compte Stripe : avant le catalogue
// (scripts/catalogue-stripe.ts), les prix etaient fabriques a la volee a chaque
// achat, donc le portail n'avait rien a montrer et le bouton « Passer a Creator »
// ne pouvait pas fonctionner.
//
// Quatre configurations existent (scripts/portail-stripe.ts) : une normale, et une
// par forfait fondateur. Un fondateur Solo doit voir SON forfait au prix fondateur
// — pour pouvoir passer mensuel <-> annuel sans perdre son prix a vie — mais les
// autres forfaits au prix normal, parce que les CGV disent que le tarif fondateur
// n'est pas transferable a un forfait different.
const cacheConfig = new Map<string, string>();
async function comptoir(nom: string): Promise<string | undefined> {
  const connu = cacheConfig.get(nom);
  if (connu) return connu;
  for await (const c of stripe.billingPortal.configurations.list({ limit: 100 })) {
    if (c.metadata?.virareel === nom) {
      cacheConfig.set(nom, c.id);
      return c.id;
    }
  }
  // Aucune configuration trouvee : on ouvre le portail par defaut du tableau de bord
  // plutot que d'echouer. La personne peut toujours gerer sa carte et resilier.
  return undefined;
}

// 'pro' est la cle interne du forfait Agency (voir lib/pricing.ts).
const ID_DE_CHECKOUTKEY: Record<string, string> = { solo: 'solo', creator: 'creator', pro: 'agency' };

// Ouvre le portail client Stripe déjà connecté (pas besoin de retaper son courriel) —
// utilisé pour changer de forfait (Solo→Creator, etc.) sans créer un 2e abonnement,
// contrairement à /api/checkout qui crée toujours un NOUVEL abonnement.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const customerId = user.publicMetadata?.stripeCustomerId as string | undefined;
    if (!customerId) return NextResponse.json({ error: 'no_subscription' }, { status: 404 });

    // Fondateur ou non : le drapeau vit sur l'ABONNEMENT (pose par /api/checkout).
    let fondateur = false;
    const subId = user.publicMetadata?.stripeSubscriptionId as string | undefined;
    if (subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        fondateur = sub.metadata?.founder === 'true';
      } catch {
        // Abonnement introuvable (resilie, ou cree avant le catalogue) : comptoir normal.
      }
    }
    const planId = ID_DE_CHECKOUTKEY[(user.publicMetadata?.plan as string) || ''] || '';
    const configuration = await comptoir(fondateur && planId ? `fondateur_${planId}` : 'normale');

    const origin = req.headers.get('origin') || 'https://virareelai.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin,
      ...(configuration ? { configuration } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    return NextResponse.json({ error: 'portal_failed' }, { status: 500 });
  }
}
