import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerPartage, idPartage, idValide, premiereAccroche, lienPartage } from './partage.ts';

const T = new Date('2026-10-05T12:00:00Z');
const reel = { hook: 'Arrête de scroller', script: ['Un', 'Deux'], caption: 'Légende', bestTime: '18 h' };

test('un reel simple est gardé, sans les champs inconnus', () => {
  const p = nettoyerPartage({ mode: 'single', platform: 'tiktok', lang: 'fr', data: { ...reel, admin: true, topic: 'secret' } }, T)!;
  assert.deepEqual(p, { mode: 'single', platform: 'tiktok', lang: 'fr', date: '2026-10-05T12:00:00.000Z', data: reel });
});

test('le sujet tapé par la personne n\'est jamais enregistré', () => {
  const p = nettoyerPartage({ mode: 'single', topic: 'Mon client Dupont', data: reel }, T)!;
  assert.equal(JSON.stringify(p).includes('Dupont'), false);
});

test('variations, 4 plateformes et 4 idées', () => {
  assert.equal((nettoyerPartage({ mode: 'variations', data: { variations: [reel, reel, {}] } }, T)!.data as { variations: unknown[] }).variations.length, 2);
  assert.deepEqual(Object.keys(nettoyerPartage({ mode: 'all', data: { instagram: reel, youtube: reel, autre: reel } }, T)!.data as object), ['instagram', 'youtube']);
  const idees = nettoyerPartage({ mode: 'ideas', data: { ideas: [{ label: 'A', data: reel }, { label: 'B', data: { tiktok: reel } }] } }, T)!;
  assert.equal(premiereAccroche(idees), 'Arrête de scroller');
});

test('une demande qui ne ressemble pas à une génération est refusée', () => {
  assert.equal(nettoyerPartage(null), null);
  assert.equal(nettoyerPartage({ mode: 'pirate', data: reel }), null);
  assert.equal(nettoyerPartage({ mode: 'single', data: { caption: 'pub sans accroche ni script' } }), null);
  assert.equal(nettoyerPartage({ mode: 'single', data: { hook: 42 } }), null);
});

test('le même contenu donne le même lien, peu importe la date', async () => {
  const a = await idPartage(nettoyerPartage({ mode: 'single', data: reel }, T)!);
  const b = await idPartage(nettoyerPartage({ mode: 'single', data: reel }, new Date())!);
  const c = await idPartage(nettoyerPartage({ mode: 'single', data: { ...reel, hook: 'Autre' } }, T)!);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(idValide(a));
  assert.equal(idValide('../../etc'), false);
});

test('le lien du code QR est marqué', () => {
  assert.equal(lienPartage('https://www.virareelai.com', 'AbCdEfGhIjK'), 'https://www.virareelai.com/p/AbCdEfGhIjK');
  assert.equal(lienPartage('https://www.virareelai.com', 'AbCdEfGhIjK', true), 'https://www.virareelai.com/p/AbCdEfGhIjK?via=qr');
});

test('un partage vit 90 jours après son dernier partage', async () => {
  const { resteAVivre, DUREE_PARTAGE } = await import('./partage.ts');
  assert.equal(resteAVivre('2026-10-05T12:00:00.000Z', T), DUREE_PARTAGE);
  assert.equal(resteAVivre('2026-10-04T12:00:00.000Z', T), DUREE_PARTAGE - 86400);
  assert.equal(resteAVivre('2026-07-01T12:00:00.000Z', T), 0);
});
