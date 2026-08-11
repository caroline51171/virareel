import { test, expect } from '@playwright/test';
import { T, Lang, gotoApp, generate, expectRemaining } from './helpers';

// TRANSCRÉATION — réécriture native dans l'autre langue, 1 essai, quota partagé
// avec la génération. La logique de crédits est DUPLIQUÉE depuis /api/generate :
// c'est justement pour ça qu'elle mérite son propre test.

for (const lang of ['fr', 'en'] as Lang[]) {
  test(`Transcréation ${lang.toUpperCase()} : coûte 1 essai et livre un texte réécrit`, async ({ page }) => {
    test.setTimeout(120_000);
    const fr = lang === 'fr';

    await gotoApp(page, lang);
    await generate(page, lang, { platforms: ['instagram'] });
    await expectRemaining(page, lang, 11);

    // Le bouton vit dans la carte de résultat.
    const boutonTraduire = page.getByRole('button', {
      name: fr ? /Traduire vers/ : /Translate to/,
    }).first();
    await expect(boutonTraduire).toBeVisible();

    // L'avertissement de coût doit être annoncé AVANT de cliquer.
    await expect(
      page.getByText(fr ? '1 génération de votre pack' : '1 generation from your pack').first(),
    ).toBeVisible();

    // Depuis le site FR on traduit vers l'anglais (marchés US/UK/AU…), depuis le
    // site EN vers le français (marchés QC/FR/BE…).
    const nomMarche = fr ? 'US · États-Unis' : 'QC · Québec';
    await boutonTraduire.click();
    const marche = page.getByRole('button', { name: nomMarche }).first();
    await expect(marche).toBeVisible();

    const reponse = page.waitForResponse(r => r.url().includes('/api/transcreate'), { timeout: 60_000 });
    await marche.click();
    expect((await reponse).status(), 'la transcréation doit répondre 200').toBe(200);

    // Onglets Original | marché cible, puis le contenu transcréé.
    const ongletTrad = page.getByRole('button', { name: nomMarche }).first();
    await expect(ongletTrad).toBeVisible({ timeout: 30_000 });
    await ongletTrad.click();
    await expect(page.getByText('[TRAD]', { exact: false }).first()).toBeVisible();

    // 1 essai, pas plus.
    await expectRemaining(page, lang, 10);

    // Et l'original reste accessible : « un Copier = toute l'unité », on ne perd rien.
    await page.getByRole('button', { name: 'Original' }).first().click();
    await expect(page.getByText('[TEST instagram', { exact: false }).first()).toBeVisible();
  });
}
