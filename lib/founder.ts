import Stripe from 'stripe';

// ─── Offre Fondateur ──────────────────────────────────────────────────────────
// Les 50 premiers abonnés gardent leur prix À VIE. Stripe = source de vérité :
// on compte les abonnements ACTIFS marqués `founder` (metadata) — aucune base de
// données à gérer. « À vie » est gratuit techniquement : un abonnement créé au
// montant fondateur garde ce montant à chaque cycle (Stripe ne remonte jamais un
// abonnement existant), même après la fermeture de l'offre.

export const FOUNDER_TOTAL = 50;

// Prix fondateur À VIE, en centimes. Annuel = mensuel × 10 (2 mois offerts),
// MÊME formule que le prix public (cf. lib/pricing.ts) → ratio fondateur/public
// identique en mensuel et en annuel.
export const FOUNDER_AMOUNTS: Record<string, Record<string, number>> = {
  solo:    { monthly: 1500, annual: 15000 }, // 15 $/mois · 150 $/an
  creator: { monthly: 3900, annual: 39000 }, // 39 $/mois · 390 $/an
  pro:     { monthly: 9900, annual: 99000 }, // 99 $/mois · 990 $/an
};

// Compte les abonnés fondateurs ACTIFS. En cas d'échec Stripe, on renvoie le total
// (= offre considérée FERMÉE) : fail-safe — on ne brade jamais un prix par erreur,
// et l'affichage reste cohérent avec le checkout.
export async function countActiveFounders(stripe: Stripe): Promise<number> {
  try {
    const res = await stripe.subscriptions.search({
      query: "status:'active' AND metadata['founder']:'true'",
      limit: 100,
    });
    return res.data.length;
  } catch {
    return FOUNDER_TOTAL;
  }
}

export interface FounderStatus {
  total: number;
  claimed: number;
  remaining: number;
  open: boolean;
}

export async function getFounderStatus(stripe: Stripe): Promise<FounderStatus> {
  const claimed = await countActiveFounders(stripe);
  const remaining = Math.max(0, FOUNDER_TOTAL - claimed);
  return { total: FOUNDER_TOTAL, claimed, remaining, open: claimed < FOUNDER_TOTAL };
}
