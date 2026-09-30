import { test, expect } from '@playwright/test';
import { gotoApp, generate } from './helpers';
import {
  exigerClerkPret, connecterCompteNeuf, attendreConnexion, compteurDuCompte,
  supprimerComptes, CompteTest,
} from './compte';
import { donnerForfait } from '../clerkApi';

// LE FORFAIT SOLO DONNE CE QUE PROMET SA CARTE (lib/i18n.ts).
//
// Carte Solo : « Possibilité de 3 variations » + « Les 4 plateformes ». Le mode
// « 4 idées × 4 plateformes » reste la différence de Creator, SAUF un essai offert
// par compte Solo, hors de ses générations (2026-09-29). Après : bouton grisé ET
// refusé par le serveur (403 ideas_locked), pour qu'on ne puisse pas le contourner.
//
// Le compte reçoit le forfait Solo directement dans Clerk (instance de TEST), comme
// le ferait le webhook Stripe après un paiement. Aucune carte, aucun paiement.
// Indépendant de la langue et de la taille d'écran : une seule fois, en portable.

test.beforeAll(exigerClerkPret);

test('Forfait Solo : 1 plateforme, 4 plateformes et 3 variations ouverts ; 4 idées = 1 essai offert puis réservé à Creator', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'laptop-1280', 'Même règle à toutes les tailles d\'écran');
  test.setTimeout(240_000);
  const comptes: CompteTest[] = [];

  try {
    await gotoApp(page, 'fr');
    const compte = await connecterCompteNeuf(page, 'solo', comptes);
    await donnerForfait(compte.id, 'solo', 60);

    const stats = page.waitForResponse(r => r.url().includes('/api/user/stats'), { timeout: 30_000 });
    await gotoApp(page, 'fr');
    await attendreConnexion(page);
    const plan = await (await stats).json() as { plan?: string };
    expect(plan.plan, 'le site voit bien le forfait Solo').toBe('solo');

    // ── 1 plateforme = 1 génération ──────────────────────────────────────────
    await generate(page, 'fr', { platforms: ['instagram'] });
    expect(await compteurDuCompte(compte.id, 1), 'compteur Solo').toBe(1);

    // ── Les 4 plateformes : 4 résultats, 4 générations ───────────────────────
    await generate(page, 'fr', { platforms: ['instagram', 'tiktok', 'facebook', 'youtube'] });
    for (const p of ['instagram', 'tiktok', 'facebook', 'youtube']) {
      await expect(page.getByText(`[TEST ${p}`, { exact: false }).first()).toBeVisible();
    }
    expect(await compteurDuCompte(compte.id, 5), 'compteur Solo').toBe(5);

    // ── 3 variations = 3 générations ─────────────────────────────────────────
    await generate(page, 'fr', { platforms: ['instagram'], variations: true });
    expect(await compteurDuCompte(compte.id, 8), 'compteur Solo').toBe(8);

    // ── 4 idées : bouton visible, avec la note de l'essai offert… ─────────────
    const boutonIdees = page.locator('#generator button').filter({ hasText: 'Générer 4 idées' });
    await expect(boutonIdees).toBeEnabled();
    await expect(page.getByText('1 essai offert, hors de vos générations Solo').first()).toBeVisible();

    // … le 1er lot passe, sans toucher au compteur (hors des 60)…
    const idees = {
      topic: 'Essai offert Solo', platform: 'instagram', platforms: ['instagram'],
      tone: 'educatif', lang: 'fr', region: 'qc', ideaTopics: ['a', 'b', 'c', 'd'],
    };
    const essai = await page.request.post('/api/generate', { data: { ...idees, multiBonus: true, multiBonusLast: true } });
    expect(essai.status(), "l'essai offert passe").toBe(200);
    expect(await compteurDuCompte(compte.id, 8), 'essai offert hors du compteur').toBe(8);

    // … puis refusé par le serveur, même appelé directement.
    const res = await page.request.post('/api/generate', { data: idees });
    expect(res.status(), 'le serveur refuse un 2e lot à Solo').toBe(403);
    expect((await res.json()).error).toBe('ideas_locked');
    // Rien n'a été facturé pour la tentative refusée.
    expect(await compteurDuCompte(compte.id, 8)).toBe(8);

    // L'écran le montre : bouton grisé + note « déjà utilisé ».
    await gotoApp(page, 'fr');
    await attendreConnexion(page);
    await expect(page.getByText('essai offert déjà utilisé').first()).toBeVisible({ timeout: 30_000 });
    await expect(boutonIdees).toBeDisabled();
  } finally {
    await supprimerComptes(comptes);
  }
});
