import { Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { creerCompteTest, supprimerCompteTest, CompteTest } from '../clerkApi';

export type { CompteTest };
export { compteurDuCompte } from '../clerkApi';

// Arrête un test de connexion avec un message lisible si la préparation Clerk a
// échoué au démarrage (voir global-setup.ts). Sans ça, l'échec ressemble à un bug
// du site alors que c'est l'outil de test qui n'a pas pu se préparer.
export function exigerClerkPret(): void {
  if (process.env.AUDIT_CLERK_SETUP_ERROR) {
    throw new Error(
      'Connexion non testable : la préparation Clerk a échoué au démarrage de l\'audit.\n'
      + process.env.AUDIT_CLERK_SETUP_ERROR,
    );
  }
}

// Crée un compte gratuit NEUF (compteur de générations à 0) et connecte le
// navigateur dessus. Le compte est ajouté à `aSupprimer` : le test le supprime
// dans son `finally`, même s'il échoue en cours de route.
//
// La page doit déjà être chargée (Clerk doit tourner dans le navigateur) avant
// l'appel — c'est une exigence de l'aide officielle @clerk/testing.
export async function connecterCompteNeuf(
  page: Page,
  etiquette: string,
  aSupprimer: CompteTest[],
): Promise<CompteTest> {
  const compte = await creerCompteTest(etiquette);
  aSupprimer.push(compte);
  // Une reprise : la connexion programmée s'exécute DANS la page, et si celle-ci
  // recharge au mauvais moment l'opération est perdue en route (« promise was
  // garbage collected »). Vu une fois sur huit connexions. Rien à voir avec le site.
  try {
    await clerk.signIn({ page, emailAddress: compte.courriel });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await clerk.signIn({ page, emailAddress: compte.courriel });
  }
  return compte;
}

// Attend que le navigateur SACHE qu'il est connecté.
//
// Juste après un chargement de page, Clerk n'a pas encore rendu son verdict : le
// générateur se comporte alors comme s'il n'y avait personne (compteur anonyme,
// boutons pas encore actifs). Mesurer ou cliquer pendant cette fraction de seconde
// donne des résultats aléatoires — c'est ce qui rendait ce parcours instable.
export async function attendreConnexion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    null,
    { timeout: 30_000 },
  );
}

export async function supprimerComptes(comptes: CompteTest[]): Promise<void> {
  for (const c of comptes) await supprimerCompteTest(c.id);
}
