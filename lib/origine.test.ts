import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoderOrigine, encoderOrigine, origineDepuisUrl } from './origine.ts';

const T = new Date('2026-09-24T12:00:00Z');

test('les UTM et le fbclid de l\'adresse sont lus, avec la page d\'arrivée', () => {
  const o = origineDepuisUrl('https://virareelai.com/en?utm_source=meta&utm_campaign=test_fr&utm_content=reel1&fbclid=IwAR123', T);
  assert.deepEqual(o, {
    utm_source: 'meta', utm_campaign: 'test_fr', utm_content: 'reel1', fbclid: 'IwAR123',
    landing_path: '/en', t: '2026-09-24T12:00:00.000Z',
  });
});

test('une visite directe ne produit rien (la personne sera « sans UTM »)', () => {
  assert.equal(origineDepuisUrl('https://virareelai.com/?plan=solo', T), null);
  assert.equal(origineDepuisUrl('pas une adresse', T), null);
});

test('aller-retour par le cookie', () => {
  const o = origineDepuisUrl('https://virareelai.com/?utm_campaign=été 2026;x', T)!;
  assert.deepEqual(decoderOrigine(encoderOrigine(o)), o);
});

test('un cookie trafiqué ne laisse passer que des étiquettes texte connues', () => {
  assert.equal(decoderOrigine('%%%'), null);
  assert.equal(decoderOrigine(encodeURIComponent(JSON.stringify({ admin: true }))), null);
  assert.deepEqual(decoderOrigine({ utm_source: 'meta', utm_medium: 42 }), { utm_source: 'meta' });
});
