import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSENT_COOKIE,
  mesureAutoriseeAvec,
  mesureAutoriseeServeur,
  zoneDepuisEnTetes,
} from './consentement.ts';

// Fabrique une requete de la forme que Next.js donne aux routes.
function requete(opts: { cookie?: string; pays?: string; langue?: string; gpc?: boolean } = {}) {
  const entetes: Record<string, string | undefined> = {
    'x-vercel-ip-country': opts.pays,
    'accept-language': opts.langue,
    'sec-gpc': opts.gpc ? '1' : undefined,
  };
  return {
    headers: { get: (n: string) => entetes[n.toLowerCase()] ?? null },
    cookies: {
      get: (n: string) =>
        n === CONSENT_COOKIE && opts.cookie !== undefined ? { value: opts.cookie } : undefined,
    },
  };
}

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

// Ces tests-ci couvrent la LECTURE de la requete, la ou une erreur serait invisible :
// un mauvais nom de cookie ou d-en-tete ne planterait rien, il eteindrait juste tous
// les envois serveur en silence, et personne ne s-en apercevrait avant des semaines.

test('serveur : un Quebecois qui a accepte est mesure', () => {
  assert.equal(mesureAutoriseeServeur(requete({ cookie: '1', pays: 'CA' })), true);
});

test('serveur : un Quebecois qui a refuse ne l-est jamais', () => {
  assert.equal(mesureAutoriseeServeur(requete({ cookie: '0', pays: 'CA' })), false);
});

test('serveur : sans cookie, rien au Quebec — mesure aux Etats-Unis', () => {
  assert.equal(mesureAutoriseeServeur(requete({ pays: 'CA' })), false);
  assert.equal(mesureAutoriseeServeur(requete({ pays: 'US' })), true);
});

test('serveur : un cookie abime est traite comme une absence de reponse', () => {
  assert.equal(mesureAutoriseeServeur(requete({ cookie: 'oui', pays: 'CA' })), false);
  assert.equal(mesureAutoriseeServeur(requete({ cookie: '', pays: 'CA' })), false);
});

test('serveur : l-en-tete Sec-GPC vaut refus, meme avec un accord', () => {
  assert.equal(mesureAutoriseeServeur(requete({ cookie: '1', pays: 'US', gpc: true })), false);
});

test('serveur : pays inconnu → la langue tranche', () => {
  assert.equal(mesureAutoriseeServeur(requete({ langue: 'fr-CA' })), false);
  assert.equal(mesureAutoriseeServeur(requete({ langue: 'en-US' })), true);
});
