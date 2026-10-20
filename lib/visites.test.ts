import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appareilDe, estRobot, paysDe, sourceDe } from './visites.ts';

const SITE = 'www.virareelai.com';

test('source : la pub Meta, meme sans UTM', () => {
  assert.equal(sourceDe('https://l.facebook.com/', '', false, SITE), 'Facebook');
  assert.equal(sourceDe('https://m.facebook.com/', '', false, SITE), 'Facebook');
  assert.equal(sourceDe('android-app://com.facebook.katana/', '', false, SITE), 'Facebook');
  assert.equal(sourceDe('', '', true, SITE), 'Facebook'); // fbclid seul
  assert.equal(sourceDe('https://l.instagram.com/', '', false, SITE), 'Instagram');
});

test('source : l etiquette UTM passe avant le referent', () => {
  assert.equal(sourceDe('https://l.facebook.com/', 'ig', false, SITE), 'Instagram');
  assert.equal(sourceDe('', 'infolettre', false, SITE), 'Autre');
});

test('source : direct = aucun referent ou le site lui-meme', () => {
  assert.equal(sourceDe('', '', false, SITE), 'Direct');
  assert.equal(sourceDe('https://virareelai.com/cgv', '', false, SITE), 'Direct');
  assert.equal(sourceDe('https://www.google.ca/', '', false, SITE), 'Google');
  assert.equal(sourceDe('https://exemple.org/', '', false, SITE), 'Autre');
});

test('appareil', () => {
  assert.equal(appareilDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148'), 'mobile');
  assert.equal(appareilDe('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), 'mobile');
  assert.equal(appareilDe('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36'), 'tablette');
  assert.equal(appareilDe('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'), 'tablette');
  assert.equal(appareilDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0'), 'ordinateur');
});

test('robots et pays', () => {
  assert.equal(estRobot('facebookexternalhit/1.1'), true);
  assert.equal(estRobot('Mozilla/5.0 HeadlessChrome/141.0'), true);
  assert.equal(estRobot(''), true);
  assert.equal(estRobot('Mozilla/5.0 (iPhone) Mobile/15E148'), false);
  assert.equal(paysDe('FR'), 'FR');
  assert.equal(paysDe('fr'), '??');
  assert.equal(paysDe(null), '??');
});
