import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNUAL_MULTIPLIER,
  annualPrice,
  founderDiscountPct,
  getPlanPricing,
  PLANS,
  prixPublic,
  deviseDuPays,
  formatPrice,
  catalogueStripe,
} from './pricing.ts';

// Valeurs attendues (point 3 du ticket) : 3 forfaits × 2 périodes.
const EXPECTED: Record<
  string,
  { monthlyPublic: number; annualPublic: number; monthlyFounder: number; annualFounder: number; pct: number }
> = {
  solo:    { monthlyPublic: 19,  annualPublic: 190,  monthlyFounder: 15, annualFounder: 150, pct: 21 },
  creator: { monthlyPublic: 49,  annualPublic: 490,  monthlyFounder: 39, annualFounder: 390, pct: 20 },
  agency:  { monthlyPublic: 129, annualPublic: 1290, monthlyFounder: 99, annualFounder: 990, pct: 23 },
};

for (const plan of PLANS) {
  const e = EXPECTED[plan.id];
  const px = getPlanPricing(plan);

  test(`${plan.id} — prix public mensuel/annuel`, () => {
    assert.equal(px.monthlyPublic, e.monthlyPublic);
    assert.equal(px.annualPublic, e.annualPublic);
    assert.equal(px.annualPublic, plan.monthlyPublic * ANNUAL_MULTIPLIER);
  });

  test(`${plan.id} — prix fondateur mensuel/annuel`, () => {
    assert.equal(px.monthlyFounder, e.monthlyFounder);
    assert.equal(px.annualFounder, e.annualFounder);
    assert.equal(px.annualFounder, plan.monthlyFounder * ANNUAL_MULTIPLIER);
  });

  test(`${plan.id} — rabais fondateur affiché`, () => {
    assert.equal(px.founderPct, e.pct);
  });

  // INVARIANT (point 2) : public et fondateur suivant la MÊME formule annuelle,
  // le ratio (donc le %) DOIT être identique en mensuel et en annuel.
  test(`${plan.id} — invariant : % mensuel === % annuel`, () => {
    const pctMonthly = founderDiscountPct(plan.monthlyPublic, plan.monthlyFounder);
    const pctAnnual = founderDiscountPct(annualPrice(plan.monthlyPublic), annualPrice(plan.monthlyFounder));
    assert.equal(pctMonthly, pctAnnual);
    assert.equal(pctMonthly, e.pct);
  });
}

// ─── Prix en euros (zone euro, taxes comprises) — choix de Caroline, 2026-09-27 ──
const EUR: Record<string, { mensuel: number; annuel: number }> = {
  solo: { mensuel: 15, annuel: 150 },
  creator: { mensuel: 39, annuel: 390 },
  agency: { mensuel: 99, annuel: 990 },
};

for (const plan of PLANS) {
  test(`${plan.id} — prix en euros mensuel/annuel`, () => {
    const px = getPlanPricing(plan);
    assert.equal(prixPublic(px, 'EUR', false), EUR[plan.id].mensuel);
    assert.equal(prixPublic(px, 'EUR', true), EUR[plan.id].annuel);
    assert.equal(prixPublic(px, 'CAD', false), plan.monthlyPublic);
  });
}

test('devise selon le pays : zone euro → EUR, le reste → CAD', () => {
  for (const pays of ['FR', 'fr', 'BE', 'DE', 'LU', 'MC', 'RE', 'GP']) assert.equal(deviseDuPays(pays), 'EUR', pays);
  for (const pays of ['CA', 'US', 'GB', 'CH', 'MA', '', null, undefined]) assert.equal(deviseDuPays(pays), 'CAD', String(pays));
});

test('affichage des prix', () => {
  assert.equal(formatPrice(19), '$19');
  assert.equal(formatPrice(15, 'EUR', 'fr'), '15\u00a0€');
  assert.equal(formatPrice(15, 'EUR', 'en'), '€15');
});

test('catalogue Stripe : option euro sur les prix publics seulement', () => {
  for (const e of catalogueStripe()) {
    if (e.fondateur) assert.equal(e.montantEur, null, e.lookupKey);
    else {
      const plan = PLANS.find(p => p.checkoutKey === e.checkoutKey)!;
      assert.equal(e.montantEur, e.periode === 'annual' ? plan.monthlyEur * ANNUAL_MULTIPLIER : plan.monthlyEur, e.lookupKey);
    }
  }
});
