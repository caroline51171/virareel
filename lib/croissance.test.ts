import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleDe, periodes, regrouper } from './croissance.ts';

// Un 7 septembre 2026, 15 h à Montréal (19 h UTC).
const MAINTENANT = new Date('2026-09-07T19:00:00Z');

test('cle du jour : calculee sur Montreal, pas sur UTC', () => {
  // 21 h a Montreal le 7 = 01 h UTC le 8. En UTC ca compterait pour le 8.
  assert.equal(cleDe(new Date('2026-09-08T01:00:00Z'), 'jour'), '2026-09-07');
  assert.equal(cleDe(new Date('2026-09-07T16:00:00Z'), 'jour'), '2026-09-07');
});

test('cle de semaine : toujours le lundi', () => {
  // Le 7 sept 2026 est un lundi ; le 12 est le samedi de la meme semaine.
  assert.equal(cleDe(new Date('2026-09-07T16:00:00Z'), 'semaine'), '2026-09-07');
  assert.equal(cleDe(new Date('2026-09-12T16:00:00Z'), 'semaine'), '2026-09-07');
  // Le 6 (dimanche) appartient a la semaine PRECEDENTE.
  assert.equal(cleDe(new Date('2026-09-06T16:00:00Z'), 'semaine'), '2026-08-31');
});

test('cle de mois', () => {
  assert.equal(cleDe(new Date('2026-09-30T16:00:00Z'), 'mois'), '2026-09');
});

test('periodes : de la plus ancienne a la plus recente, la derniere = maintenant', () => {
  const j = periodes(3, 'jour', MAINTENANT);
  assert.deepEqual(j, ['2026-09-05', '2026-09-06', '2026-09-07']);

  const s = periodes(3, 'semaine', MAINTENANT);
  assert.deepEqual(s, ['2026-08-24', '2026-08-31', '2026-09-07']);

  const m = periodes(3, 'mois', MAINTENANT);
  assert.deepEqual(m, ['2026-07', '2026-08', '2026-09']);
});

test('periodes en mois : un 31 ne fait pas sauter un mois court', () => {
  // Depuis le 31 mars, reculer d-un mois donnerait le 31 fevrier — donc mars a nouveau.
  const m = periodes(3, 'mois', new Date('2026-03-31T16:00:00Z'));
  assert.deepEqual(m, ['2026-01', '2026-02', '2026-03']);
});

test('regrouper : compte par periode', () => {
  const dates = [
    '2026-09-07T14:00:00Z',
    '2026-09-07T18:00:00Z',
    '2026-09-06T14:00:00Z',
  ];
  assert.deepEqual(regrouper(dates, 'jour', 3, MAINTENANT), [
    { periode: '2026-09-05', count: 0 },
    { periode: '2026-09-06', count: 1 },
    { periode: '2026-09-07', count: 2 },
  ]);
});

test('regrouper : une periode vide vaut 0, elle ne disparait pas', () => {
  const points = regrouper([], 'jour', 3, MAINTENANT);
  assert.equal(points.length, 3);
  assert.ok(points.every(p => p.count === 0));
});

test('regrouper : ce qui est hors fenetre ou invalide est ignore, sans planter', () => {
  const dates = ['2020-01-01T00:00:00Z', 'pas une date', null, undefined, ''];
  const points = regrouper(dates, 'jour', 3, MAINTENANT);
  assert.equal(points.reduce((s, p) => s + p.count, 0), 0);
});
