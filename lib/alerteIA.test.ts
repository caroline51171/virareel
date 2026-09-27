import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { causeIA, alerterSiPanneIA } from './alerteIA.ts';

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

test('panne → Claire est réveillée par son webhook, en plus du courriel', async () => {
  process.env.CLAIRE_WEBHOOK_URL = 'https://claire.test/webhook';
  process.env.CLAIRE_WEBHOOK_KEY = 'cle-test';
  process.env.RESEND_API_KEY = 're_test';
  const appels: { url: string; init?: RequestInit }[] = [];
  const vraiFetch = globalThis.fetch;
  // Aucun appel réseau réel : Resend et Claire reçoivent une fausse réponse.
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    return new Response('{"id":"test"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    await alerterSiPanneIA(erreur(400, 'invalid_request_error', 'Your credit balance is too low'), '/api/generate');
  } finally {
    globalThis.fetch = vraiFetch;
  }
  const claire = appels.find(a => a.url === 'https://claire.test/webhook');
  assert.ok(claire, 'Claire non appelée');
  assert.equal((claire.init?.headers as Record<string, string>).Authorization, 'Bearer cle-test');
  const corps = JSON.parse(String(claire.init?.body));
  assert.equal(corps.source, 'alerte-panne-ia');
  assert.equal(corps.panne, 'Crédits Anthropic épuisés');
  assert.ok(appels.some(a => a.url.includes('resend')), 'courriel non envoyé');
});
