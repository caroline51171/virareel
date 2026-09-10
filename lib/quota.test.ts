import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prochaineRemiseAZero, quotaAJour } from './quota.ts';

// Le quota se recharge à la DATE D'ANNIVERSAIRE de l'abonnement, jamais le 1er.
// Avant, quelqu'un abonné le 28 recevait un quota complet pour 3 jours, puis un
// quota NEUF le 1er : deux quotas pour un mois payé.
test('mensuel : la recharge tombe le jour d\'anniversaire, pas le 1er', () => {
  const avant = quotaAJour(60, '2026-04-28', new Date('2026-04-20T12:00:00Z'), 28);
  assert.equal(avant.generationsUsed, 60, 'avant la date : rien ne bouge');
  assert.equal(avant.remisAZero, false);

  const jourJ = quotaAJour(60, '2026-04-28', new Date('2026-04-28T00:05:00Z'), 28);
  assert.equal(jourJ.generationsUsed, 0);
  assert.equal(jourJ.resetDate, '2026-05-28', 'et surtout pas 2026-05-01');
  assert.equal(jourJ.remisAZero, true);
});

// Le cas qui a motivé la séparation facture/quota : un abonné ANNUEL n'est facturé
// qu'une fois par an, mais son quota est mensuel. C'est le calendrier qui recharge.
test('annuel : rechargé chaque mois, sans nouvelle facture', () => {
  let date = '2026-03-12';
  for (const attendu of ['2026-04-12', '2026-05-12', '2026-06-12']) {
    const r = quotaAJour(1000, date, new Date(`${date}T00:05:00Z`), 12);
    assert.equal(r.generationsUsed, 0);
    assert.equal(r.resetDate, attendu);
    date = r.resetDate;
  }
});

// Règle du 31 : un mois trop court est ramené à son dernier jour, mais l'ancrage
// n'est JAMAIS perdu. Même règle que les factures Stripe.
test('ancrage au 31 : ramené au dernier jour, jamais dérivé', () => {
  assert.equal(prochaineRemiseAZero(new Date('2026-01-31T00:00:00Z'), 31), '2026-02-28');
  assert.equal(prochaineRemiseAZero(new Date('2026-02-28T00:00:00Z'), 31), '2026-03-31');
  assert.equal(prochaineRemiseAZero(new Date('2026-03-31T00:00:00Z'), 31), '2026-04-30');
  assert.equal(prochaineRemiseAZero(new Date('2026-04-30T00:00:00Z'), 31), '2026-05-31');
});

test('année bissextile : le 29 février existe en 2028', () => {
  assert.equal(prochaineRemiseAZero(new Date('2028-01-31T00:00:00Z'), 31), '2028-02-29');
});

test('passage d\'année', () => {
  assert.equal(prochaineRemiseAZero(new Date('2026-12-15T23:00:00Z'), 15), '2027-01-15');
  assert.equal(prochaineRemiseAZero(new Date('2026-12-31T23:00:00Z'), 31), '2027-01-31');
});

// Sans ça, la remise à zéro se referait à CHAQUE requête et le plafond ne
// s'appliquerait jamais : la nouvelle date doit être persistée par l'appelant.
test('une remise à zéro pousse toujours la date au mois suivant', () => {
  const r = quotaAJour(60, '2026-08-12', new Date('2026-08-20T12:00:00Z'), 12);
  assert.equal(r.resetDate, '2026-09-12');
  const apres = quotaAJour(12, r.resetDate, new Date('2026-08-20T23:00:00Z'), 12);
  assert.equal(apres.generationsUsed, 12);
  assert.equal(apres.remisAZero, false);
});

test('compte sans jour d\'ancrage : comportement d\'avant, le 1er', () => {
  assert.equal(prochaineRemiseAZero(new Date('2026-03-15T00:00:00Z')), '2026-04-01');
  const r = quotaAJour(40, undefined, new Date('2026-08-29T12:00:00Z'));
  assert.equal(r.generationsUsed, 40, 'ce qui est consommé reste consommé');
  assert.equal(r.resetDate, '2026-09-01');
  assert.equal(r.remisAZero, true);
});

test('valeurs douteuses : jamais de compteur négatif ni d\'ancrage absurde', () => {
  assert.equal(quotaAJour(NaN, '2099-01-01').generationsUsed, 0);
  assert.equal(quotaAJour(-5, '2099-01-01').generationsUsed, 0);
  assert.equal(prochaineRemiseAZero(new Date('2026-03-10T00:00:00Z'), 0), '2026-04-01');
  assert.equal(prochaineRemiseAZero(new Date('2026-03-10T00:00:00Z'), 99), '2026-03-31');
});
