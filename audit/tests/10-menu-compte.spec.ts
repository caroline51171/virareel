import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';
import {
  exigerClerkPret, connecterCompteNeuf, attendreConnexion, supprimerComptes, CompteTest,
} from './compte';
import { donnerForfait } from '../clerkApi';

// BOUTON « RÉSILIER » FACILEMENT REPÉRABLE (LPC Québec, art. 187.28).
//
// Un abonné trouve « Gérer mon abonnement » et « Résilier mon abonnement » dans le
// menu de sa photo de profil, en haut de la page, sans défiler (remarque de Jean,
// 2026-09-30). « Résilier » ouvre le portail Stripe sur l'écran d'annulation
// (/api/portal, action 'resilier'). Un compte gratuit n'a pas ces lignes.

test.beforeAll(exigerClerkPret);

test('Menu de la photo de profil : Gérer et Résilier pour un abonné, rien pour un gratuit', async ({ page }) => {
  test.setTimeout(180_000);
  const comptes: CompteTest[] = [];

  try {
    await gotoApp(page, 'fr');
    const compte = await connecterCompteNeuf(page, 'menu', comptes);

    // ── Gratuit : menu Clerk ordinaire ───────────────────────────────────────
    await attendreConnexion(page);
    await page.locator('.cl-userButtonTrigger').click();
    await expect(page.locator('.cl-userButtonPopoverCard')).toBeVisible();
    await expect(page.locator('.cl-userButtonPopoverCard').getByRole('button', { name: 'Résilier mon abonnement' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // ── Abonné Solo : les deux lignes, visibles sans défiler ─────────────────
    await donnerForfait(compte.id, 'solo', 60);
    const stats = page.waitForResponse(r => r.url().includes('/api/user/stats'), { timeout: 30_000 });
    await gotoApp(page, 'fr');
    await attendreConnexion(page);
    await stats;
    await page.locator('.cl-userButtonTrigger').click();
    const gerer = page.locator('.cl-userButtonPopoverCard').getByRole('button', { name: 'Gérer mon abonnement' });
    const resilier = page.locator('.cl-userButtonPopoverCard').getByRole('button', { name: 'Résilier mon abonnement' });
    await expect(gerer).toBeVisible();
    await expect(resilier).toBeInViewport();

    // « Résilier » demande bien l'écran d'annulation du portail.
    page.once('dialog', d => d.dismiss()); // compte de test sans client Stripe : alerte « indisponible »
    const appel = page.waitForRequest(r => r.url().includes('/api/portal') && r.method() === 'POST');
    await resilier.click();
    expect((await appel).postDataJSON()).toEqual({ action: 'resilier' });
  } finally {
    await supprimerComptes(comptes);
  }
});
