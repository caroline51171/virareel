import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factureDePeriode, factureRegleeParCharge } from './refund.ts';

// Changement de forfait au portail : la facture d'ajustement est la plus récente,
// mais c'est la facture de souscription qui paie la période.
test('après un changement de forfait → la facture de période, pas l\'ajustement', () => {
  assert.equal(
    factureDePeriode([
      { id: 'in_ajustement', billing_reason: 'subscription_update' },
      { id: 'in_souscription', billing_reason: 'subscription_create' },
    ]),
    'in_souscription'
  );
});

// Renouvellement : la facture du mois courant l'emporte sur celle de la souscription.
test('renouvellement → la facture de période la plus récente', () => {
  assert.equal(
    factureDePeriode([
      { id: 'in_ajustement', billing_reason: 'subscription_update' },
      { id: 'in_mois2', billing_reason: 'subscription_cycle' },
      { id: 'in_souscription', billing_reason: 'subscription_create' },
    ]),
    'in_mois2'
  );
});

test('aucune facture de période → rien', () => {
  assert.equal(factureDePeriode([{ id: 'in_x', billing_reason: 'manual' }, { id: 'in_y' }]), null);
  assert.equal(factureDePeriode([]), null);
});

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
