import Stripe from 'stripe';

// ─── Offre Fondateur ──────────────────────────────────────────────────────────
// Les 50 premiers abonnés gardent leur prix À VIE. Stripe = source de vérité :
// on compte les abonnements ACTIFS marqués `founder` (metadata) — aucune base de
// données à gérer. « À vie » est gratuit techniquement : un abonnement créé au
// montant fondateur garde ce montant à chaque cycle (Stripe ne remonte jamais un
// abonnement existant), même après la fermeture de l'offre.

export const FOUNDER_TOTAL = 50;

// Prix fondateur À VIE, en centimes. Annuel = mensuel × 12 (PAS de cumul avec le
// rabais annuel −20 % : le tarif fondateur EST déjà le rabais, on n'empile pas).
export const FOUNDER_AMOUNTS: Record<string, Record<string, number>> = {
  solo:    { monthly: 800,  annual: 9600 },   // 8 $/mois · 96 $/an
  creator: { monthly: 1400, annual: 16800 },  // 14 $/mois · 168 $/an
  pro:     { monthly: 8900, annual: 106800 }, // 89 $/mois · 1068 $/an
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
