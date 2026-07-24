// ─── SOURCE DE VÉRITÉ UNIQUE de la tarification ViraReel ──────────────────────
// Tous les prix, prix barrés, équivalents mensuels/annuels et pourcentages
// affichés doivent être DÉRIVÉS d'ici. Aucune valeur de prix ou de % en dur
// ailleurs. Voir tests dans `lib/pricing.test.ts`.

// Annuel = 12 mois payés au prix de 10 → 2 mois offerts. La MÊME formule sert au
// prix public et au prix fondateur : le ratio fondateur/public est donc identique
// en mensuel et en annuel (invariant testé).
export const ANNUAL_MULTIPLIER = 10;

// Devise unique (déjà codée en dur côté Stripe dans checkout/route.ts).
export const CURRENCY = 'USD';

// ─── Chemin annuel : MASQUÉ tant qu'il n'est pas validé en conditions réelles ──
// Un seul interrupteur pour tout fermer (UI + serveur). Passer à `true` pour le
// réactiver après les 4 checkouts test (cf. HANDOFF.md). Quand false :
//   • Pricing.tsx cache le toggle Annuel (mensuel seulement) ;
//   • checkout/route.ts force `billing = 'monthly'` (aucune requête annuelle ne passe).
export const ANNUAL_ENABLED = false;

export interface Plan {
  id: string;          // identifiant public de forfait
  checkoutKey: string; // clé interne Stripe/plan ('pro' = Agency — ne pas casser)
  monthlyPublic: number;
  monthlyFounder: number;
}

export const PLANS: Plan[] = [
  { id: 'solo',    checkoutKey: 'solo',    monthlyPublic: 19,  monthlyFounder: 15 },
  { id: 'creator', checkoutKey: 'creator', monthlyPublic: 49,  monthlyFounder: 39 },
  { id: 'agency',  checkoutKey: 'pro',     monthlyPublic: 129, monthlyFounder: 99 },
];

// ─── Formules ────────────────────────────────────────────────────────────────
export function annualPrice(monthly: number): number {
  return monthly * ANNUAL_MULTIPLIER;
}

// Rabais fondateur = 1 − (fondateur / public) de la période courante, arrondi à
// l'entier. Identique en mensuel et en annuel car les deux périodes dérivent de la
// même formule annuelle (invariant).
export function founderDiscountPct(publicPrice: number, founderPrice: number): number {
  return Math.round((1 - founderPrice / publicPrice) * 100);
}

export function formatPrice(amount: number): string {
  return `$${amount}`;
}

// ─── Dérivations prêtes à afficher ───────────────────────────────────────────
export interface PlanPricing {
  id: string;
  checkoutKey: string;
  monthlyPublic: number;
  annualPublic: number;
  monthlyFounder: number;
  annualFounder: number;
  founderPct: number; // identique mensuel/annuel
}

export function getPlanPricing(plan: Plan): PlanPricing {
  return {
    id: plan.id,
    checkoutKey: plan.checkoutKey,
    monthlyPublic: plan.monthlyPublic,
    annualPublic: annualPrice(plan.monthlyPublic),
    monthlyFounder: plan.monthlyFounder,
    annualFounder: annualPrice(plan.monthlyFounder),
    founderPct: founderDiscountPct(plan.monthlyPublic, plan.monthlyFounder),
  };
}

export const PLAN_PRICING: PlanPricing[] = PLANS.map(getPlanPricing);

// Lookup par clé de checkout interne ('solo' | 'creator' | 'pro').
export const PRICING_BY_KEY: Record<string, PlanPricing> = Object.fromEntries(
  PLAN_PRICING.map((p) => [p.checkoutKey, p]),
);
