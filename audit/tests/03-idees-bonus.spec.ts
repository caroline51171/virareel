import { test, expect } from '@playwright/test';
import {
  T, Lang, gotoApp, openIdeas, fillIdeas, runIdeas, setPlatforms,
  expectRemaining, modal, expectModalFitsScreen, ecartChampBouton,
} from './helpers';

// MODE « 4 IDÉES » ET ESSAI BONUS — la zone la plus corrigée du site (3 correctifs
// les 10 et 11 août 2026). Règles à tenir, décidées par Caroline :
//   • le champ principal du haut est OBLIGATOIRE (sinon l'IA invente le contexte) ;
//   • l'essai bonus est UN SEUL COUP, gratuit quel que soit le nombre de plateformes ;
//   • le lot de 4 idées = 4 requêtes : le bonus doit couvrir les 4, pas seulement la 1re
//     (le vrai bug de prod : le compteur tombait de 12 à 9) ;
//   • l'avertissement « restez sur cette page » n'apparaît que PENDANT la génération.

const SUJETS = ['Erreur de tarification', 'Client qui ghost', 'Portfolio qui convertit', 'Prospection sans pub'];
const CONTEXTE = 'Agence de contenu qui parle aux petites entreprises, ton direct, tournage au bureau';

for (const lang of ['fr', 'en'] as Lang[]) {
  test.describe(`4 idées ${lang.toUpperCase()}`, () => {
    test('le champ principal vide bloque, et ramène au champ à la fermeture', async ({ page }) => {
      const t = T[lang];
      await gotoApp(page, lang);
      await openIdeas(page, lang);
      await fillIdeas(page, lang, SUJETS);

      // Le champ du haut est resté vide : le site doit refuser AVANT d'appeler le serveur.
      await page.locator('#generator button').filter({ hasText: t.ideaConfirmBtn }).first().click();
      await expect(modal(page)).toContainText(t.topicLabel);
      await expectModalFitsScreen(page);

      await modal(page).locator('button').filter({
        hasText: lang === 'fr' ? 'Ajuster ma demande' : 'Adjust my request',
      }).click();
      // À la fermeture, la personne doit se retrouver DEVANT le champ à remplir.
      await expect(page.locator('#generator textarea').first()).toBeInViewport();
      await expectRemaining(page, lang, 12);
    });

    test('l\'avertissement « restez sur cette page » n\'apparaît pas avant le clic', async ({ page }) => {
      const t = T[lang];
      await gotoApp(page, lang);
      await page.locator('#generator textarea').first().fill(CONTEXTE);
      await openIdeas(page, lang);
      await fillIdeas(page, lang, SUJETS);
      // Avant le clic il poussait le bouton sous la barre d'adresse sur téléphone.
      await expect(page.getByText(t.stayOnPage, { exact: false })).toHaveCount(0);
      // Et le bouton doit rester JUSTE sous le champ (mesures du 11 août : 126 px
      // au maximum). Si ce chiffre grimpe, c'est qu'un bloc s'est glissé entre les deux.
      expect(await ecartChampBouton(page, lang),
        'le bouton « Confirmer et générer » est repoussé loin sous le champ',
      ).toBeLessThan(200);
    });

    test('4 idées × 4 plateformes = 16 résultats gratuits, puis le bonus est brûlé', async ({ page }) => {
      test.setTimeout(180_000);
      const t = T[lang];
      await gotoApp(page, lang);
      await page.locator('#generator textarea').first().fill(CONTEXTE);
      await openIdeas(page, lang);
      await fillIdeas(page, lang, SUJETS);

      // Le message vert est cliquable et doit allumer les 4 plateformes.
      await page.locator('#generator button').filter({ hasText: t.bonusInvite }).first().click();
      await expect(page.getByText(t.bonusActive, { exact: false })).toBeVisible();

      const statuts = await runIdeas(page, lang, 4);
      expect(statuts, 'les 4 idées doivent toutes passer').toEqual([200, 200, 200, 200]);

      // LE point du test : 16 résultats livrés, et AUCUN essai déduit.
      await expectRemaining(page, lang, 12);

      // Chaque idée porte bien ses 4 plateformes.
      for (const i of [1, 2, 3, 4]) {
        await page.locator('#generator button').filter({ hasText: `${t.ideaTab} ${i}` }).last().click();
        for (const p of ['instagram', 'tiktok', 'facebook', 'youtube']) {
          await expect(page.getByText(`[TEST ${p}`, { exact: false }).first()).toBeVisible();
        }
      }

      // Le bonus ne sert qu'une fois : l'invitation verte doit avoir disparu.
      await expect(page.getByText(t.bonusActive, { exact: false })).toHaveCount(0);
      await expect(page.getByText(t.bonusInvite, { exact: false })).toHaveCount(0);

      // Et le lot suivant est bel et bien facturé : 4 idées × 1 plateforme = 4 essais.
      await setPlatforms(page, lang, ['instagram']);
      await fillIdeas(page, lang, SUJETS);
      const statuts2 = await runIdeas(page, lang, 4);
      expect(statuts2).toEqual([200, 200, 200, 200]);
      await expectRemaining(page, lang, 8);
    });

    test('4 idées × 1 plateforme est gratuit aussi (le bonus vaut pour tout le lot)', async ({ page }) => {
      test.setTimeout(120_000);
      await gotoApp(page, lang);
      await page.locator('#generator textarea').first().fill(CONTEXTE);
      await openIdeas(page, lang);
      await fillIdeas(page, lang, SUJETS);
      // Une seule plateforme cochée (l'état par défaut du site).
      const statuts = await runIdeas(page, lang, 4);
      expect(statuts).toEqual([200, 200, 200, 200]);
      // Avant le correctif du 11 août, ce lot déduisait 4 essais par surprise.
      await expectRemaining(page, lang, 12);
    });
  });
}
