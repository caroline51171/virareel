import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import {
  T, Lang, gotoApp, generate, clickGenerate, setPlatforms,
  expectRemaining, remaining, modal, expectModalFitsScreen,
} from './helpers';
import {
  exigerClerkPret, connecterCompteNeuf, attendreConnexion, compteurDuCompte,
  supprimerComptes, CompteTest,
} from './compte';

// LE PARCOURS « COMPTE GRATUIT CONNECTÉ ».
//
// C'est la zone où un bug coûte de l'argent : chaque essai offert en trop est une
// vraie requête payée à Claude. Trois garanties sont vérifiées ici :
//
//   1. HÉRITAGE — créer un compte ne remet pas le compteur à neuf. Quelqu'un qui a
//      déjà brûlé 12 essais dans son navigateur doit voir 6 restants, jamais 18.
//   2. PLAFOND 18 À VIE — 18 essais au TOTAL (navigateur + compte confondus), et ce
//      plafond survit à un rechargement de page.
//   3. PAYWALL AU 19e — à zéro, la fenêtre des forfaits, pas un message d'erreur sec.
//
// Mécanique du site : le compteur d'un compte gratuit démarre à
// `Math.max(compteur du compte, compteur du navigateur)` — `anonUsedFromRequest()`
// dans app/api/generate/route.ts. Un compte n'est pas un forfait gratuit, c'est la
// SUITE des mêmes 18 essais.
//
// Chaque test crée son propre compte Clerk (instance de TEST) et le supprime à la
// fin, y compris en cas d'échec : un compte réutilisé garderait son compteur d'une
// exécution à l'autre et le test ne voudrait plus rien dire.

test.beforeAll(exigerClerkPret);

// Amène le navigateur à 12 essais consommés SANS compte (3 × 4 plateformes).
async function brulerLes12Anonymes(page: import('@playwright/test').Page, lang: Lang) {
  await gotoApp(page, lang);
  await expectRemaining(page, lang, 12);
  for (const reste of [8, 4, 0]) {
    await generate(page, lang, { platforms: ['instagram', 'tiktok', 'facebook', 'youtube'] });
    await expectRemaining(page, lang, reste);
  }
}

for (const lang of ['fr', 'en'] as Lang[]) {
  test(`Compte gratuit connecté ${lang.toUpperCase()} : hérite du compteur, plafond 18 à vie, paywall au 19e`, async ({ page }) => {
    test.setTimeout(240_000);
    const t = T[lang];
    const comptes: CompteTest[] = [];

    try {
      await brulerLes12Anonymes(page, lang);

      // ── Connexion avec un compte NEUF ───────────────────────────────────────
      // Son compteur à lui est à 0 : s'il repartait de zéro, l'écran afficherait
      // 18 (soit 18 + 18 en tout). C'est exactement le trou que ce test surveille.
      const compte = await connecterCompteNeuf(page, `herite-${lang}`, comptes);
      await gotoApp(page, lang);
      await attendreConnexion(page);
      await expectRemaining(page, lang, 6);

      // ── Les 6 essais qui restent passent, le 19e non ─────────────────────────
      // Après chaque génération on relit le compteur inscrit SUR LE COMPTE : il doit
      // valoir 12 (hérités du navigateur) + le nombre de générations faites. C'est la
      // preuve que l'héritage vaut aussi à la comptabilisation, pas seulement à la
      // vérification. Cette relecture attend aussi que Clerk ait fini d'enregistrer —
      // sans quoi la requête suivante lirait un chiffre périmé.
      await setPlatforms(page, lang, ['instagram']);
      for (let i = 1; i <= 6; i++) {
        await generate(page, lang, { platforms: ['instagram'] });
        expect(await compteurDuCompte(compte.id, 12 + i), 'compteur inscrit sur le compte').toBe(12 + i);
      }

      await clickGenerate(page, lang);
      await expect(modal(page)).toContainText(lang === 'fr' ? '18 essais gratuits' : '18 free trials');
      await expect(modal(page)).toContainText(t.seePlansBtn);
      await expectModalFitsScreen(page);

      // ── Le plafond survit à un rechargement (« à vie ») ──────────────────────
      await gotoApp(page, lang);
      await attendreConnexion(page);
      await clickGenerate(page, lang);
      await expect(modal(page)).toContainText(lang === 'fr' ? '18 essais gratuits' : '18 free trials');
    } finally {
      await supprimerComptes(comptes);
    }
  });
}

// ── Les deux vérifications ci-dessous ne dépendent ni de la langue ni de la taille
// d'écran (c'est le même compteur et le même cookie) : elles tournent une seule
// fois, sur le format portable, pour ne pas rallonger l'audit inutilement.

test('Compte gratuit connecté : le compteur affiché descend à chaque génération', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'laptop-1280', 'Défaut indépendant de la taille d\'écran');
  test.setTimeout(240_000);
  const comptes: CompteTest[] = [];

  try {
    await brulerLes12Anonymes(page, 'fr');
    const compte = await connecterCompteNeuf(page, 'compteur', comptes);
    await gotoApp(page, 'fr');
    await attendreConnexion(page);
    await expectRemaining(page, 'fr', 6);

    // Le chiffre affiché doit suivre la réalité : 6 → 5 → 4. Sinon la cliente lit
    // « 6 essais restants » jusqu'à se prendre le paywall sans prévenir — et, pire,
    // le conseil « cette demande coûte plus que ce qu'il vous reste » ne peut plus
    // se déclencher, puisqu'il se base sur ce même chiffre.
    await setPlatforms(page, 'fr', ['instagram']);
    let faites = 0;
    for (const reste of [5, 4]) {
      await generate(page, 'fr', { platforms: ['instagram'] });
      await compteurDuCompte(compte.id, 12 + ++faites);
      await expectRemaining(page, 'fr', reste);
    }
  } finally {
    await supprimerComptes(comptes);
  }
});

test('Un 2e compte gratuit dans le même navigateur ne redonne pas d\'essais', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'laptop-1280', 'Défaut indépendant de la taille d\'écran');
  test.setTimeout(300_000);
  const comptes: CompteTest[] = [];

  try {
    // 12 essais anonymes + les 6 derniers sur un 1er compte = les 18 sont brûlés.
    await brulerLes12Anonymes(page, 'fr');
    const premier = await connecterCompteNeuf(page, 'premier', comptes);
    await gotoApp(page, 'fr');
    await attendreConnexion(page);
    await setPlatforms(page, 'fr', ['instagram']);
    for (let i = 1; i <= 6; i++) {
      await generate(page, 'fr', { platforms: ['instagram'] });
      await compteurDuCompte(premier.id, 12 + i);
    }
    await clickGenerate(page, 'fr');
    await expect(modal(page)).toContainText('18 essais gratuits');
    await modal(page).locator('button').first().click();

    // ── La faille évidente : se déconnecter et créer un autre compte ───────────
    await clerk.signOut({ page });
    await connecterCompteNeuf(page, 'second', comptes);
    await gotoApp(page, 'fr');
    await attendreConnexion(page);

    // Le 2e compte doit hériter des 18 essais DÉJÀ consommés dans ce navigateur.
    expect(await remaining(page, 'fr'), 'un 2e compte ne doit pas rouvrir le robinet').toBe(0);
    await clickGenerate(page, 'fr');
    await expect(modal(page)).toContainText('18 essais gratuits');
  } finally {
    await supprimerComptes(comptes);
  }
});
