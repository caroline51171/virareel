import { test } from 'node:test';
import assert from 'node:assert/strict';
import { achatDepuisMetadata, metadataAchat } from './capiAchat.ts';

const ID = { clientIp: '1.2.3.4', clientUserAgent: 'Mozilla/5.0', fbp: 'fb.1.123.456', fbc: 'fb.1.123.abc' };

test('consentement donne : l\'identite fait l\'aller-retour complet', () => {
  const lu = achatDepuisMetadata(metadataAchat(ID, true));
  assert.equal(lu.envoyer, true);
  assert.deepEqual(lu.identite, ID);
});

test('refus : rien de la personne n\'est stocke, et l\'Achat ne part pas', () => {
  const meta = metadataAchat(ID, false);
  assert.deepEqual(meta, { mesure: '0' });
  assert.equal(achatDepuisMetadata(meta).envoyer, false);
});

test('session creee avant ce changement (pas de cle) : ancien comportement, on envoie', () => {
  const lu = achatDepuisMetadata({ userId: 'u1', plan: 'solo' });
  assert.equal(lu.envoyer, true);
  assert.deepEqual(lu.identite, { clientIp: undefined, clientUserAgent: undefined, fbp: undefined, fbc: undefined });
});

test('valeurs absentes : aucune cle vide envoyee a Stripe', () => {
  assert.deepEqual(metadataAchat({ clientIp: '1.2.3.4' }, true), { mesure: '1', capi_ip: '1.2.3.4' });
});

test('limite Stripe de 500 caracteres respectee', () => {
  const meta = metadataAchat({ clientUserAgent: 'x'.repeat(900) }, true);
  assert.equal(meta.capi_ua.length, 500);
});
