import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesureAutoriseeAvec, zoneDepuisEnTetes } from './consentement.ts';

// Ce fichier décide si on a le droit d'envoyer quelqu'un à Meta. Une erreur ici
// n'est pas un bug d'affichage : c'est une infraction à la Loi 25 / au RGPD.

test('zone : le Québec et l-Europe exigent un consentement', () => {
  assert.equal(zoneDepuisEnTetes('CA', null), 'consentement');
  assert.equal(zoneDepuisEnTetes('FR', null), 'consentement');
  assert.equal(zoneDepuisEnTetes('GB', null), 'consentement');
  assert.equal(zoneDepuisEnTetes('CH', null), 'consentement');
});

test('zone : les États-Unis et le reste démarrent au chargement', () => {
  assert.equal(zoneDepuisEnTetes('US', null), 'refus');
  assert.equal(zoneDepuisEnTetes('JP', null), 'refus');
});

test('zone : pays inconnu → la langue tranche, et le doute va au strict', () => {
  assert.equal(zoneDepuisEnTetes(null, 'fr-CA,fr;q=0.9'), 'consentement');
  assert.equal(zoneDepuisEnTetes(null, 'en-GB'), 'consentement');
  assert.equal(zoneDepuisEnTetes(null, 'en-US'), 'refus');
});

test('un refus explicite ferme la porte, même en zone permissive', () => {
  assert.equal(mesureAutoriseeAvec('0', 'refus', false), false);
  assert.equal(mesureAutoriseeAvec('0', 'consentement', false), false);
});

test('un accord explicite ouvre la porte dans les deux zones', () => {
  assert.equal(mesureAutoriseeAvec('1', 'consentement', false), true);
  assert.equal(mesureAutoriseeAvec('1', 'refus', false), true);
});

test('sans réponse : rien au Québec/en Europe, mesure aux États-Unis', () => {
  assert.equal(mesureAutoriseeAvec(null, 'consentement', false), false);
  assert.equal(mesureAutoriseeAvec(null, 'refus', false), true);
});

test('GPC vaut refus partout, même après un « J-accepte »', () => {
  assert.equal(mesureAutoriseeAvec('1', 'refus', true), false);
  assert.equal(mesureAutoriseeAvec('1', 'consentement', true), false);
  assert.equal(mesureAutoriseeAvec(null, 'refus', true), false);
});
