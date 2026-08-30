import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factureRegleeParCharge } from './refund.ts';

// Vrai remboursement : la charge remboursée est celle de la dernière facture.
test('la charge de la dernière facture → on coupe', () => {
  assert.equal(
    factureRegleeParCharge([{ payment_intent: 'pi_abc' }], 'ch_1', 'pi_abc'),
    true
  );
  assert.equal(
    factureRegleeParCharge([{ charge: 'ch_1' }], 'ch_1', null),
    true
  );
});

// Double facturation : la charge remboursée est une charge EN TROP — la facture
// est réglée par un AUTRE paiement. Le client garde son accès.
test('une charge en double → on ne touche à rien', () => {
  assert.equal(
    factureRegleeParCharge([{ payment_intent: 'pi_legitime' }], 'ch_double', 'pi_double'),
    false
  );
  assert.equal(
    factureRegleeParCharge([{ charge: 'ch_legitime' }], 'ch_double', null),
    false
  );
});

// Les objets dépliés (Stripe renvoie parfois l'objet complet, pas l'id).
test('accepte les références dépliées', () => {
  assert.equal(
    factureRegleeParCharge([{ payment_intent: { id: 'pi_abc' } }], 'ch_1', 'pi_abc'),
    true
  );
  assert.equal(
    factureRegleeParCharge([{ charge: { id: 'ch_1' } }], 'ch_1', null),
    true
  );
});

// Garde-fou : une charge sans payment_intent ne doit jamais matcher un paiement
// sans payment_intent « par égalité de deux null ».
test('null ne matche jamais null', () => {
  assert.equal(factureRegleeParCharge([{ payment_intent: null }], 'ch_1', null), false);
  assert.equal(factureRegleeParCharge([{}], 'ch_1', null), false);
  assert.equal(factureRegleeParCharge([], 'ch_1', 'pi_abc'), false);
});
