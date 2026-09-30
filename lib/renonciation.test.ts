import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dansLeDelai, issueGlobale, courrielAccuse } from './renonciation.ts';
import { paysAvecRetractation } from './consentement.ts';

const jour = (iso: string) => new Date(iso);

// Payé le 1er octobre : le délai court jusqu'à la fin du 15 octobre (14 jours après).
test('dans le délai le 14e jour, même en fin de journée', () => {
  assert.equal(dansLeDelai(jour('2026-10-01T18:00:00Z'), jour('2026-10-15T23:59:00Z')), true);
});

test('hors délai le 16 octobre', () => {
  assert.equal(dansLeDelai(jour('2026-10-01T18:00:00Z'), jour('2026-10-16T00:00:01Z')), false);
});

test('le jour même du paiement → dans le délai', () => {
  assert.equal(dansLeDelai(jour('2026-10-01T09:00:00Z'), jour('2026-10-01T09:05:00Z')), true);
});

test('France, Allemagne, Norvège, Royaume-Uni → droit de renonciation', () => {
  for (const p of ['FR', 'de', 'NO', 'GB']) assert.equal(paysAvecRetractation(p), true, p);
});

test('Canada, États-Unis, Suisse, pays inconnu → pas ce droit-là', () => {
  for (const p of ['CA', 'US', 'CH', '', null, undefined]) assert.equal(paysAvecRetractation(p), false, String(p));
});

test('plusieurs abonnements : le remboursement l\'emporte sur le reste', () => {
  assert.equal(issueGlobale(['hors_delai', 'rembourse']), 'rembourse');
  assert.equal(issueGlobale(['hors_zone', 'a_traiter']), 'a_traiter');
  assert.equal(issueGlobale([]), 'aucun_abonnement');
});

test('l\'accusé reprend le nom, le courriel, la date et l\'heure — et échappe le HTML', () => {
  const { sujet, html } = courrielAccuse({
    nom: 'Anne <b>Martin</b>', courriel: 'anne@exemple.fr',
    date: jour('2026-10-03T14:05:00Z'), issue: 'rembourse', lang: 'fr',
  });
  assert.match(sujet, /Accusé de réception/);
  assert.match(html, /3 octobre 2026/);
  assert.match(html, /14:05/);
  assert.match(html, /anne@exemple\.fr/);
  assert.match(html, /Anne &lt;b&gt;Martin&lt;\/b&gt;/);
  assert.match(html, /remboursé en entier/);
});

test('hors délai : l\'accusé donne le lien cliquable de Link', () => {
  const { html } = courrielAccuse({
    nom: 'Tom', courriel: 't@x.uk', date: new Date(), issue: 'hors_delai', lang: 'en',
  });
  assert.match(html, /<a href="https:\/\/support\.link\.com\//);
});
