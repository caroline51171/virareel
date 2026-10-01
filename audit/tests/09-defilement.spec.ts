import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { T, gotoApp, setPlatforms, openIdeas, fillIdeas } from './helpers';

// DÉFILEMENT APRÈS CHAQUE ACTION (2026-09-30).
// Question de Caroline : après une génération, la page arrive-t-elle au bon endroit,
// sur cellulaire comme sur portable ? « Bon endroit » = le haut du résultat juste
// sous la barre du haut, sans avoir à défiler.
//
// La fausse IA répond en un éclair ; la vraie prend 10 à 30 s. Les deux défilements
// du site (vers le bloc d'attente au départ, vers le résultat à l'arrivée) se
// marcheraient dessus et fausseraient la mesure : on retient donc chaque réponse
// 6 s, comme une vraie génération.

const TAILLES = [
  { nom: 'android-360', width: 360, height: 740 },
  { nom: 'iphone-390', width: 390, height: 844 },
  { nom: 'portable-1280', width: 1280, height: 800 },
  { nom: 'portable-1440', width: 1440, height: 900 },
];
const DELAI_IA = 6_000;
const DOSSIER = process.env.DEFILEMENT_DIR || path.join(__dirname, '..', 'test-results', 'defilement');

const SUJET = 'Comment gagner du temps sur la creation de contenu pour une agence';
const IDEES = ['Erreur de tarification', 'Client qui ghost', 'Portfolio qui convertit', 'Prospection sans pub'];

interface Mesure {
  taille: string; action: string;
  barreBas: number; resultatHaut: number; ecart: number; hauteurEcran: number; nbBlocs: number;
  defilementY: number;
}
const mesures: Mesure[] = [];

// Attend que la page cesse de bouger (le site défile en « smooth »).
async function attendreImmobile(page: Page) {
  let avant = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === avant) return;
    avant = y;
    await page.waitForTimeout(250);
  }
}

async function mesurer(page: Page, taille: string, action: string, bloc: 'premier' | 'dernier' = 'premier') {
  await expect(page.getByText('[TEST', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(300);
  await attendreImmobile(page);
  const m = await page.evaluate((bloc) => {
    const nav = document.querySelector('nav')!.getBoundingClientRect();
    const blocs = [...document.querySelectorAll('#generator div.animate-fadeIn.select-text')];
    const res = (bloc === 'dernier' ? blocs[blocs.length - 1] : blocs[0]).getBoundingClientRect();
    return {
      nbBlocs: blocs.length,
      barreBas: Math.round(nav.bottom),
      resultatHaut: Math.round(res.top),
      hauteurEcran: window.innerHeight,
      defilementY: Math.round(window.scrollY),
    };
  }, bloc);
  const ligne = { taille, action, ...m, ecart: m.resultatHaut - m.barreBas };
  mesures.push(ligne);
  console.log(`  ${taille.padEnd(14)} ${action.padEnd(16)} barre=${m.barreBas} résultat=${m.resultatHaut} écart=${ligne.ecart} blocs=${m.nbBlocs}`);
  await page.screenshot({ path: path.join(DOSSIER, `${taille}__${action}.png`) });
  // Mesuré le 2026-09-30 : écart de -1 à 14 px partout. Au-delà de cette marge,
  // le haut du résultat est caché sous la barre ou trop loin dessous.
  expect(ligne.ecart, `${action} : haut du résultat sous la barre`).toBeGreaterThanOrEqual(-8);
  expect(ligne.ecart, `${action} : haut du résultat trop loin de la barre`).toBeLessThanOrEqual(40);
  // Un seul résultat à l'écran : l'ancien (4 idées ↔ mode ordinaire) restait affiché.
  expect(m.nbBlocs, `${action} : un seul résultat affiché`).toBe(1);
}

async function cliquerGenerer(page: Page, texte: string) {
  const rep = page.waitForResponse(r => r.url().includes('/api/generate'), { timeout: 60_000 });
  await page.locator('#generator button').filter({ hasText: texte }).first().click();
  expect((await rep).status()).toBe(200);
}

test.describe('Défilement après chaque action', () => {
  test.setTimeout(600_000);
  // Les 4 tailles d'écran sont créées ici : inutile de tout refaire une 2e fois
  // sous le projet téléphone (~4 min de gagnées).
  test.skip(({}, info) => info.project.name !== 'laptop-1280', 'tailles gérées dans le test');

  test.beforeAll(() => fs.mkdirSync(DOSSIER, { recursive: true }));

  for (const tl of TAILLES) {
    test(tl.nom, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: tl.width, height: tl.height },
        locale: 'fr-CA',
        baseURL: 'http://localhost:3100',
      });
      const page = await ctx.newPage();
      await page.route('**/api/generate', async route => {
        const rep = await route.fetch();
        await new Promise(r => setTimeout(r, DELAI_IA));
        await route.fulfill({ response: rep });
      });
      const t = T.fr;
      await gotoApp(page, 'fr');
      await page.locator('#generator textarea').first().fill(SUJET);

      // 1) Une génération, 1 plateforme
      await setPlatforms(page, 'fr', ['instagram']);
      await cliquerGenerer(page, t.generateBtn);
      await mesurer(page, tl.nom, '1-generation');

      // 2) Les 4 plateformes
      await setPlatforms(page, 'fr', ['instagram', 'tiktok', 'facebook', 'youtube']);
      await cliquerGenerer(page, t.generateBtn);
      await mesurer(page, tl.nom, '2-4-plateformes');

      // 3) 3 variations (1 plateforme)
      await setPlatforms(page, 'fr', ['instagram']);
      await cliquerGenerer(page, t.variationsBtn);
      await mesurer(page, tl.nom, '3-variations');

      // 4) 4 idées (essai bonus, 4 plateformes)
      await setPlatforms(page, 'fr', ['instagram', 'tiktok', 'facebook', 'youtube']);
      await openIdeas(page, 'fr');
      await fillIdeas(page, 'fr', IDEES);
      await cliquerGenerer(page, t.ideaConfirmBtn);
      await mesurer(page, tl.nom, '4-idees', 'dernier');

      // 5) Retour à une génération simple après les idées
      await setPlatforms(page, 'fr', ['instagram']);
      await page.locator('#generator textarea').first().fill(SUJET);
      await cliquerGenerer(page, t.generateBtn);
      await mesurer(page, tl.nom, '5-generation-apres-idees');

      await ctx.close();
    });
  }

  // Une visiteuse neuve qui commence directement par les 4 idées.
  for (const tl of TAILLES) {
    test(`${tl.nom} — 4 idées en premier`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: tl.width, height: tl.height }, locale: 'fr-CA', baseURL: 'http://localhost:3100',
      });
      const page = await ctx.newPage();
      await page.route('**/api/generate', async route => {
        const rep = await route.fetch();
        await new Promise(r => setTimeout(r, DELAI_IA));
        await route.fulfill({ response: rep });
      });
      await gotoApp(page, 'fr');
      await page.locator('#generator textarea').first().fill(SUJET);
      await setPlatforms(page, 'fr', ['instagram', 'tiktok', 'facebook', 'youtube']);
      await openIdeas(page, 'fr');
      await fillIdeas(page, 'fr', IDEES);
      await cliquerGenerer(page, T.fr.ideaConfirmBtn);
      await mesurer(page, tl.nom, '0-idees-en-premier', 'dernier');
      await ctx.close();
    });
  }

  test.afterAll(() => {
    fs.writeFileSync(path.join(DOSSIER, 'mesures.json'), JSON.stringify(mesures, null, 2));
  });
});
