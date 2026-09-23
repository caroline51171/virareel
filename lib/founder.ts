import Stripe from 'stripe';
import { FOUNDER_ENABLED } from './pricing';

// ─── Offre Fondateur ──────────────────────────────────────────────────────────
// Les 50 premiers abonnés gardent leur prix À VIE. Stripe = source de vérité :
// on compte les abonnements ACTIFS marqués `founder` (metadata) — aucune base de
// données à gérer. « À vie » est gratuit techniquement : un abonnement créé au
// montant fondateur garde ce montant à chaque cycle (Stripe ne remonte jamais un
// abonnement existant), même après la fermeture de l'offre.

export const FOUNDER_TOTAL = 50;

// Montants fondateur (en dollars, dérivés) : voir lib/pricing.ts (PRICING_BY_KEY,
// monthlyFounder/annualFounder) — source de vérité unique, ne pas redupliquer ici.

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
  enabled: boolean; // offre active sur le site (interrupteur FOUNDER_ENABLED)
  total: number;
  claimed: number;
  remaining: number;
  open: boolean;
}

export async function getFounderStatus(stripe: Stripe): Promise<FounderStatus> {
  // Offre retirée : fermée, et surtout PAS « comblée » (le site n'affiche alors
  // aucun message sur les 50 places). Stripe n'est même pas interrogé.
  if (!FOUNDER_ENABLED) {
    return { enabled: false, total: FOUNDER_TOTAL, claimed: 0, remaining: 0, open: false };
  }
  const claimed = await countActiveFounders(stripe);
  const remaining = Math.max(0, FOUNDER_TOTAL - claimed);
  return { enabled: true, total: FOUNDER_TOTAL, claimed, remaining, open: claimed < FOUNDER_TOTAL };
}
