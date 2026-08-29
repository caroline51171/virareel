import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prochaineRemiseAZero, quotaAJour } from './quota.ts';

// Le cas qui a motivé le correctif : un abonné ANNUEL. Sa facture ne tombe qu'une
// fois par an, mais son quota doit repartir à zéro à chaque mois calendaire.
test('le mois suivant repart à zéro, même sans nouvelle facture', () => {
  const enJuillet = quotaAJour(158, '2026-08-01', new Date('2026-07-20T12:00:00Z'));
  assert.equal(enJuillet.generationsUsed, 158, 'avant la date : rien ne bouge');
  assert.equal(enJuillet.remisAZero, false);

  const enAout = quotaAJour(158, '2026-08-01', new Date('2026-08-01T00:05:00Z'));
  assert.equal(enAout.generationsUsed, 0, 'le jour dit : compteur à zéro');
  assert.equal(enAout.resetDate, '2026-09-01');
  assert.equal(enAout.remisAZero, true);
});

// Sans ça, la remise à zéro se referait à CHAQUE requête et le plafond ne
// s'appliquerait jamais : la nouvelle date doit être persistée par l'appelant.
test('une remise à zéro pousse toujours la date au mois suivant', () => {
  const r = quotaAJour(60, '2026-08-01', new Date('2026-08-15T12:00:00Z'));
  assert.equal(r.resetDate, '2026-09-01');
  // Le même jour, après persistance, le compteur remonte normalement.
  const apres = quotaAJour(12, r.resetDate, new Date('2026-08-15T23:00:00Z'));
  assert.equal(apres.generationsUsed, 12);
  assert.equal(apres.remisAZero, false);
});

test('abonné d\'avant le correctif : on pose une date, sans offrir un mois', () => {
  const r = quotaAJour(40, undefined, new Date('2026-08-29T12:00:00Z'));
  assert.equal(r.generationsUsed, 40, 'ce qui est consommé reste consommé');
  assert.equal(r.resetDate, '2026-09-01');
  assert.equal(r.remisAZero, true);
});

test('passage d\'année et fin de mois', () => {
  assert.equal(prochaineRemiseAZero(new Date('2026-12-31T23:00:00Z')), '2027-01-01');
  assert.equal(prochaineRemiseAZero(new Date('2026-01-31T00:00:00Z')), '2026-02-01');
  assert.equal(prochaineRemiseAZero(new Date('2026-02-28T00:00:00Z')), '2026-03-01');
});

test('valeurs douteuses en mémoire : jamais de compteur négatif', () => {
  assert.equal(quotaAJour(NaN, '2099-01-01').generationsUsed, 0);
  assert.equal(quotaAJour(-5, '2099-01-01').generationsUsed, 0);
});
