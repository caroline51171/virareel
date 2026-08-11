import { test, expect } from '@playwright/test';
import {
  T, Lang, gotoApp, generate, clickGenerate, setPlatforms,
  expectRemaining, modal, expectModalFitsScreen,
} from './helpers';

// LE PARCOURS COMPLET DES ESSAIS GRATUITS, du 1er essai au paywall.
//
// C'est le cœur de l'audit : chaque étape vérifie un CHIFFRE (le compteur) et la
// FENÊTRE affichée. Tout se joue dans un seul test parce que l'état s'accumule
// (le cookie d'essais suit le navigateur d'une étape à l'autre).
//
// Rappel des règles du site (lib/limits.ts) : 12 essais sans courriel, +6 après
// le courriel = 18, puis paywall. Coût : 1 par plateforme, 3 pour les variations.

for (const lang of ['fr', 'en'] as Lang[]) {
  test(`Parcours des essais gratuits ${lang.toUpperCase()} : 12 → courriel → 6 → paywall`, async ({ page }) => {
    test.setTimeout(180_000);
    const t = T[lang];

    await gotoApp(page, lang);
    await expectRemaining(page, lang, 12);

    // ── 1 plateforme = 1 essai ────────────────────────────────────────────────
    await generate(page, lang, { platforms: ['instagram'] });
    await expectRemaining(page, lang, 11);

    // ── 3 variations = 3 essais ───────────────────────────────────────────────
    await generate(page, lang, { platforms: ['instagram'], variations: true });
    await expectRemaining(page, lang, 8);

    // ── 4 plateformes = 4 essais, et 4 résultats livrés ───────────────────────
    await generate(page, lang, { platforms: ['instagram', 'tiktok', 'facebook', 'youtube'] });
    await expect(page.getByText('[TEST instagram', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('[TEST tiktok', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('[TEST facebook', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('[TEST youtube', { exact: false }).first()).toBeVisible();
    await expectRemaining(page, lang, 4);

    // ── Il reste 3 essais et la demande en coûte 4 : conseil, PAS le paywall ──
    await generate(page, lang, { platforms: ['instagram'] });
    await expectRemaining(page, lang, 3);
    await setPlatforms(page, lang, ['instagram', 'tiktok', 'facebook', 'youtube']);
    await clickGenerate(page, lang);
    await expect(modal(page)).toContainText(t.quotaHint);
    await expect(modal(page)).toContainText(lang === 'fr' ? 'en coûte 4' : 'costs 4');
    await expectModalFitsScreen(page);
    await modal(page).locator('button').filter({
      hasText: lang === 'fr' ? 'Ajuster ma demande' : 'Adjust my request',
    }).click();
    await expect(modal(page)).toHaveCount(0);
    // Le conseil ne doit RIEN avoir consommé.
    await expectRemaining(page, lang, 3);

    // ── Épuiser les 12 ────────────────────────────────────────────────────────
    await setPlatforms(page, lang, ['instagram']);
    for (const n of [2, 1, 0]) {
      await generate(page, lang, { platforms: ['instagram'] });
      await expectRemaining(page, lang, n);
    }

    // ── À 0 sans courriel : le mur du courriel, jamais le paywall ─────────────
    await clickGenerate(page, lang);
    await expect(modal(page)).toContainText(t.emailGate);
    await expect(modal(page)).toContainText(lang === 'fr' ? '6 essais de plus' : '6 more trials');
    await expectModalFitsScreen(page);

    // ── Le courriel débloque 6 essais ET relance la demande interrompue ───────
    // (régression du 2026-08-10 : sans ça, la demande ne partait jamais.)
    await modal(page).locator('input[type="email"]').fill('audit-local@example.com');
    const relance = page.waitForResponse(r => r.url().includes('/api/generate'), { timeout: 60_000 });
    await modal(page).locator('button').filter({ hasText: t.unlockBtn }).click();
    const res = await relance;
    expect(res.status(), 'la demande retenue doit repartir toute seule').toBe(200);
    await expect(modal(page)).toHaveCount(0);
    await expect(page.getByText('[TEST', { exact: false }).first()).toBeVisible();
    // 6 débloqués − 1 consommé par la demande relancée.
    await expectRemaining(page, lang, 5);

    // ── Épuiser les 6 ─────────────────────────────────────────────────────────
    await generate(page, lang, { platforms: ['instagram', 'tiktok', 'facebook', 'youtube'] });
    await expectRemaining(page, lang, 1);
    await setPlatforms(page, lang, ['instagram']);
    await generate(page, lang, { platforms: ['instagram'] });
    await expectRemaining(page, lang, 0);

    // ── VRAI zéro : le paywall, avec le chiffre réel (18) ─────────────────────
    await clickGenerate(page, lang);
    await expect(modal(page)).toContainText(lang === 'fr' ? '18 essais gratuits' : '18 free trials');
    await expect(modal(page)).toContainText(t.seePlansBtn);
    await expectModalFitsScreen(page);

    // ── L'accueil connaît lui aussi le vrai zéro ──────────────────────────────
    await gotoApp(page, lang);
    await expect(page.getByText(t.heroZero, { exact: false }).first()).toBeVisible();
    // Le lien ouvre LA fenêtre du générateur (aucune copie du texte).
    await page.getByRole('button', { name: t.heroSeePlans }).click();
    await expect(modal(page)).toContainText(lang === 'fr' ? '18 essais gratuits' : '18 free trials');
  });
}
