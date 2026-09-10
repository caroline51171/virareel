// ─── SOURCE DE VÉRITÉ UNIQUE de la tarification ViraReel ──────────────────────
// Tous les prix, prix barrés, équivalents mensuels/annuels et pourcentages
// affichés doivent être DÉRIVÉS d'ici. Aucune valeur de prix ou de % en dur
// ailleurs. Voir tests dans `lib/pricing.test.ts`.

// Annuel = 12 mois payés au prix de 10 → 2 mois offerts. La MÊME formule sert au
// prix public et au prix fondateur : le ratio fondateur/public est donc identique
// en mensuel et en annuel (invariant testé).
export const ANNUAL_MULTIPLIER = 10;

// Devise unique (déjà codée en dur côté Stripe dans checkout/route.ts).
export const CURRENCY = 'CAD';

// ─── Chemin annuel : MASQUÉ tant qu'il n'est pas validé en conditions réelles ──
// Un seul interrupteur pour tout fermer (UI + serveur). Passer à `true` pour le
// réactiver après les 4 checkouts test (cf. HANDOFF.md). Quand false :
//   • Pricing.tsx cache le toggle Annuel (mensuel seulement) ;
//   • checkout/route.ts force `billing = 'monthly'` (aucune requête annuelle ne passe).
export const ANNUAL_ENABLED = true;

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

// Dollars → centimes, pour Stripe (checkout/founder). Seule conversion permise —
// ne jamais réécrire un montant fondateur/public en dur ailleurs.
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
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

// ─── Catalogue Stripe ────────────────────────────────────────────────────────
// Avant le 2026-09-10, /api/checkout fabriquait un prix A LA VOLEE (`price_data`)
// a chaque achat. Consequence : aucun prix stable dans le compte Stripe, donc le
// portail client n'avait RIEN a proposer — le bouton « Passer a Creator » ne
// pouvait pas fonctionner, et `customer.subscription.updated` ne se produisait
// jamais. Le catalogue ci-dessous remplace cette improvisation.
//
// Les identifiants de PRIX different entre l'environnement de test et le reel :
// on ne les code donc jamais en dur. On passe par `lookup_key`, que nous
// choisissons — elle, elle est identique des deux cotes.
//
// Les identifiants de PRODUIT sont imposes par nous (Stripe l'autorise a la
// creation), ce qui rend le script du catalogue rejouable sans rien dupliquer.

export type Periode = 'monthly' | 'annual';

export interface EntreeCatalogue {
  produitId: string;      // impose par nous, identique test/reel
  nomProduit: string;
  description: string;
  checkoutKey: string;    // 'solo' | 'creator' | 'pro' — ce que le webhook enregistre
  fondateur: boolean;
  periode: Periode;
  lookupKey: string;      // la cle stable pour retrouver le prix
  montant: number;        // en dollars, dérivé de PLANS
}

const GENERATIONS: Record<string, number> = { solo: 60, creator: 160, agency: 1000 };
const NOMS: Record<string, string> = { solo: 'Solo', creator: 'Creator', agency: 'Agency' };

export function catalogueStripe(): EntreeCatalogue[] {
  const entrees: EntreeCatalogue[] = [];
  for (const plan of PLANS) {
    for (const fondateur of [false, true]) {
      const produitId = `virareel_${plan.id}${fondateur ? '_fondateur' : ''}`;
      const nomProduit = `ViraReel AI — ${NOMS[plan.id]}${fondateur ? ' (Fondateur)' : ''}`;
      const description = `${GENERATIONS[plan.id]} générations par mois`;
      const mensuel = fondateur ? plan.monthlyFounder : plan.monthlyPublic;
      for (const periode of ['monthly', 'annual'] as Periode[]) {
        entrees.push({
          produitId, nomProduit, description,
          checkoutKey: plan.checkoutKey,
          fondateur, periode,
          lookupKey: `${plan.id}${fondateur ? '_fondateur' : ''}_${periode}`,
          montant: periode === 'annual' ? annualPrice(mensuel) : mensuel,
        });
      }
    }
  }
  return entrees;
}

// Retrouve la cle de recherche d'un prix a partir de ce que le site demande deja.
export function lookupKeyPour(checkoutKey: string, periode: Periode, fondateur: boolean): string {
  const plan = PLANS.find(p => p.checkoutKey === checkoutKey);
  if (!plan) throw new Error(`forfait inconnu : ${checkoutKey}`);
  return `${plan.id}${fondateur ? '_fondateur' : ''}_${periode}`;
}
