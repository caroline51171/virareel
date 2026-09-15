import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterEtape, nomDuForfait } from './historiqueForfaits.ts';

test('achat, changement, annulation : trois etapes dans l\'ordre', () => {
  let h = ajouterEtape(undefined, 'creator', '2026-09-15T19:57:00Z');
  h = ajouterEtape(h, 'solo', '2026-09-20T12:00:00Z');
  h = ajouterEtape(h, 'free', '2026-10-01T12:00:00Z');
  assert.deepEqual(h.map(e => e.plan), ['creator', 'solo', 'free']);
});

test('meme forfait deux fois de suite (evenements Stripe en double) : note une seule fois', () => {
  let h = ajouterEtape([], 'creator', '2026-09-15T19:57:00Z');
  h = ajouterEtape(h, 'creator', '2026-09-15T19:57:02Z');
  assert.equal(h.length, 1);
  assert.equal(h[0].date, '2026-09-15T19:57:00Z');
});

test('revenir a un forfait deja eu plus tot : c\'est une nouvelle etape', () => {
  let h = ajouterEtape([], 'solo', '2026-09-01T00:00:00Z');
  h = ajouterEtape(h, 'creator', '2026-09-10T00:00:00Z');
  h = ajouterEtape(h, 'solo', '2026-09-20T00:00:00Z');
  assert.equal(h.length, 3);
});

test('donnee abimee dans Clerk : ignoree sans planter', () => {
  const h = ajouterEtape([{ plan: 'solo' }, 'n\'importe quoi', null], 'creator', '2026-09-15T00:00:00Z');
  assert.deepEqual(h, [{ plan: 'creator', date: '2026-09-15T00:00:00Z' }]);
});

test('pro s\'affiche Agency', () => {
  assert.equal(nomDuForfait('pro'), 'Agency');
  assert.equal(nomDuForfait('free'), 'Free');
});
