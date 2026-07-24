import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNUAL_MULTIPLIER,
  annualPrice,
  founderDiscountPct,
  getPlanPricing,
  PLANS,
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
