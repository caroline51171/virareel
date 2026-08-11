import { test, expect } from '@playwright/test';
import { Lang, gotoApp, expectNoHorizontalOverflow } from './helpers';

// FORFAITS ET PAIEMENT — les chiffres viennent de lib/pricing.ts (source unique).
// Les valeurs ci-dessous sont écrites À LA MAIN volontairement : si quelqu'un
// modifie un prix dans le code, le test doit le SIGNALER, pas suivre en silence.
const PRIX = {
  public: { solo: 19, creator: 49, agency: 129 },
  fondateur: { solo: 15, creator: 39, agency: 99 },
};
const MOIS_OFFERTS = 10; // annuel = mensuel × 10 (2 mois offerts)

for (const lang of ['fr', 'en'] as Lang[]) {
  test.describe(`Forfaits ${lang.toUpperCase()}`, () => {
    test('les 3 forfaits affichent les bons prix, mensuels et annuels', async ({ page }) => {
      await gotoApp(page, lang);

      // L'offre fondateur ouverte ou fermée change les prix affichés : on demande
      // au site lui-même dans quel état il est, plutôt que de le supposer.
      const etat = await page.request.get('/api/founder-status').then(r => r.json());
      const grille = etat.open === true ? PRIX.fondateur : PRIX.public;

      const forfaits = page.locator('#pricing');
      await forfaits.scrollIntoViewIfNeeded();
      const cartes = forfaits.locator('div.grid > div');
      await expect(cartes, 'il doit y avoir exactement 3 forfaits').toHaveCount(3);

      // Ordre attendu des cartes. La clé interne du 3e est « pro », mais il
      // s'affiche TOUJOURS « Agency » — c'est une règle à ne pas casser.
      const attendus = [
        { nom: 'Solo', prix: grille.solo },
        { nom: 'Creator', prix: grille.creator },
        { nom: 'Agency', prix: grille.agency },
      ];

      // Mensuel (état par défaut du sélecteur).
      for (const [i, a] of attendus.entries()) {
        await expect(cartes.nth(i), `carte ${i + 1} = ${a.nom}`).toContainText(a.nom);
        await expect(
          cartes.nth(i).getByText(`$${a.prix}`, { exact: true }).first(),
          `prix mensuel $${a.prix} attendu sur ${a.nom}`,
        ).toBeVisible();
      }

      // Bascule annuelle : chaque prix doit être exactement × 10.
      await forfaits.getByRole('button', { name: lang === 'fr' ? 'Annuel' : 'Annual' }).click();
      for (const [i, a] of attendus.entries()) {
        await expect(
          cartes.nth(i).getByText(`$${a.prix * MOIS_OFFERTS}`, { exact: true }).first(),
          `prix annuel $${a.prix * MOIS_OFFERTS} attendu sur ${a.nom}`,
        ).toBeVisible();
      }

      await expectNoHorizontalOverflow(page);
    });

    test('choisir un forfait mène à une vraie page de paiement Stripe (sans payer)', async ({ page }) => {
      // On BLOQUE le chargement de la page Stripe : on vérifie que l'adresse est
      // correcte, sans jamais ouvrir de formulaire de paiement.
      await page.route('https://checkout.stripe.com/**', route => route.abort());

      // La vraie demande part bien vers le site (donc vers Stripe en mode test),
      // mais on lit sa réponse AU PASSAGE : après, la page file vers Stripe et le
      // contenu de la réponse n'est plus lisible.
      let paiement: { url?: string; error?: string } | null = null;
      let statut = 0;
      await page.route('**/api/checkout', async route => {
        const vraie = await route.fetch();
        statut = vraie.status();
        paiement = await vraie.json().catch(() => null);
        await route.fulfill({ response: vraie });
      });

      await gotoApp(page, lang);
      const forfaits = page.locator('#pricing');
      await forfaits.scrollIntoViewIfNeeded();

      // La carte du milieu (Creator) : son bouton d'achat est le dernier de la carte.
      const creator = forfaits.locator('div.grid > div').nth(1);
      await expect(creator).toContainText('Creator');
      await creator.locator('button').last().click();

      await expect.poll(() => paiement, { timeout: 60_000 }).not.toBeNull();
      expect(statut, 'la création du paiement doit répondre 200').toBe(200);
      expect(paiement!.url, 'Stripe doit renvoyer une adresse de paiement').toContain('checkout.stripe.com');
    });
  });
}
