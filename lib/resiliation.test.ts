import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vientDEtreResilie, nomForfait, courrielResiliation } from './resiliation.ts';

test('résiliation en fin de période : envoie', () => {
  assert.equal(vientDEtreResilie({ cancel_at_period_end: true, cancel_at: 1800000000 }, { cancel_at_period_end: false, cancel_at: null }), true);
});

test('résiliation par date fixe (cancel_at seul) : envoie', () => {
  assert.equal(vientDEtreResilie({ cancel_at_period_end: false, cancel_at: 1800000000 }, { cancel_at: null }), true);
});

test('la personne revient sur sa résiliation : rien', () => {
  assert.equal(vientDEtreResilie({ cancel_at_period_end: false, cancel_at: null }, { cancel_at_period_end: true, cancel_at: 1800000000 }), false);
});

test('changement de forfait sur un abonnement déjà résilié : rien', () => {
  assert.equal(vientDEtreResilie({ cancel_at_period_end: true, cancel_at: 1800000000 }, { items: {} } as never), false);
});

test('déjà résilié, seule la date change : rien', () => {
  assert.equal(vientDEtreResilie({ cancel_at_period_end: true, cancel_at: 1800000000 }, { cancel_at: 1700000000 }), false);
});

test('pas de previous_attributes : rien', () => {
  assert.equal(vientDEtreResilie({ cancel_at_period_end: true, cancel_at: 1800000000 }, undefined), false);
});

test('nom du forfait : pro = Agency', () => {
  assert.equal(nomForfait('pro'), 'Agency');
  assert.equal(nomForfait('inconnu'), '');
});

test('courriel : contient forfait, deux dates et « aucun autre paiement »', () => {
  const { sujet, html } = courrielResiliation({
    forfait: 'Solo',
    demandeLe: new Date('2026-10-01T14:00:00Z'),
    finAcces: new Date('2026-10-29T14:00:00Z'),
    lang: 'fr',
  });
  assert.match(sujet, /résiliation/);
  assert.match(html, /ViraReel AI Solo a été résilié le 1 octobre 2026/);
  assert.match(html, /jusqu’au 29 octobre 2026/);
  assert.match(html, /Aucun autre paiement ne sera prélevé/);
  assert.match(html, /<a href="https:\/\/virareelai\.com">virareelai\.com<\/a>/);
});

test('courriel anglais', () => {
  const { html } = courrielResiliation({
    forfait: 'Agency',
    demandeLe: new Date('2026-10-01T14:00:00Z'),
    finAcces: new Date('2026-10-29T14:00:00Z'),
    lang: 'en',
  });
  assert.match(html, /No further payments will be charged/);
});
