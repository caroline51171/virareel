import { clerkSetup } from '@clerk/testing/playwright';
import { loadEnvLocal, assertClerkTestKeys } from './loadEnv';
import { menageComptesTest } from './clerkApi';

// Préparation commune à tout l'audit, exécutée UNE fois avant les tests.
//
// `clerkSetup()` demande à Clerk un « jeton de test » qui permet à un navigateur
// automatisé de se connecter sans être pris pour un robot. Sans lui, la connexion
// programmée échoue sur la protection anti-robot de Clerk.
//
// Si Clerk est injoignable, on ne fait PAS tomber tout l'audit : les 48 vérifications
// qui n'ont rien à voir avec la connexion doivent continuer de tourner. On note la
// panne, et seuls les tests de connexion s'arrêtent avec un message clair.
export default async function globalSetup(): Promise<void> {
  loadEnvLocal();
  try {
    assertClerkTestKeys();
    await clerkSetup();
    // Comptes laissés par une exécution interrompue : on repart propre.
    const restes = await menageComptesTest();
    if (restes > 0) console.log(`Audit : ${restes} compte(s) de test oublié(s) supprimé(s).`);
  } catch (err) {
    process.env.AUDIT_CLERK_SETUP_ERROR = err instanceof Error ? err.message : String(err);
  }
}
