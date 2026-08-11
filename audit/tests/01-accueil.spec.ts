import { test, expect } from '@playwright/test';
import { T, Lang, gotoApp, expectNoHorizontalOverflow, expectRemaining } from './helpers';

// L'accueil : ce que voit une personne qui arrive pour la première fois.
for (const lang of ['fr', 'en'] as Lang[]) {
  test.describe(`Accueil ${lang.toUpperCase()}`, () => {
    test('la page s\'affiche sans rien qui dépasse', async ({ page }) => {
      await gotoApp(page, lang);
      await expect(page.locator('h1').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test('le bouton principal du hero est visible et mène au générateur', async ({ page }) => {
      await gotoApp(page, lang);
      const cta = page.locator('a[href="#generator"]').first();
      await expect(cta).toBeVisible();

      // Le bouton doit tenir dans la largeur de l'écran (bug classique sur téléphone).
      const box = await cta.boundingBox();
      const size = page.viewportSize()!;
      expect(box!.x, 'le bouton dépasse à gauche').toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width, 'le bouton dépasse à droite').toBeLessThanOrEqual(size.width + 1);

      await cta.click();
      await expect(page.locator('#generator')).toBeVisible();
    });

    test('un visiteur neuf a bien 12 essais annoncés dans le générateur', async ({ page }) => {
      await gotoApp(page, lang);
      // 12 = EMAIL_GATE_LIMIT (lib/limits.ts). Le total réel est 18, jamais annoncé ici.
      await expectRemaining(page, lang, 12);
    });

    test('le générateur est utilisable sans rien qui dépasse', async ({ page }) => {
      await gotoApp(page, lang);
      await page.locator('#generator').scrollIntoViewIfNeeded();
      await expect(
        page.locator('#generator button').filter({ hasText: T[lang].generateBtn }).first(),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}
