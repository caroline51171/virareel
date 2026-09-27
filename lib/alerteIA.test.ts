import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { causeIA } from './alerteIA.ts';

// Erreurs construites par le SDK lui-même, avec les corps que renvoie vraiment Anthropic.
const erreur = (status: number, type: string, message: string) =>
  Anthropic.APIError.generate(status, { type: 'error', error: { type, message } }, undefined, new Headers());

test('crédits vides → credits', () => {
  assert.equal(causeIA(erreur(400, 'invalid_request_error',
    'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.')), 'credits');
});

test('limite perso atteinte → limite', () => {
  assert.equal(causeIA(erreur(400, 'invalid_request_error',
    'You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.')), 'limite');
});

test('plafond du compte (429 enforced_spend_limit_reached) → limite', () => {
  assert.equal(causeIA(erreur(429, 'enforced_spend_limit_reached', 'Spend limit reached.')), 'limite');
});

test('clé refusée → cle', () => {
  assert.equal(causeIA(erreur(401, 'authentication_error', 'invalid x-api-key')), 'cle');
});

test('vraie surcharge ou bogue → pas d\'alerte', () => {
  assert.equal(causeIA(erreur(529, 'overloaded_error', 'Overloaded')), null);
  assert.equal(causeIA(erreur(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit')), null);
  assert.equal(causeIA(new SyntaxError('Unexpected token in JSON')), null);
});
