import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// AUDIT VIRAREEL — tout tourne en LOCAL, sur la vraie application.
//
// Deux serveurs sont démarrés automatiquement :
//   1. la fausse IA (mock-ai.mjs) — remplace api.anthropic.com ;
//   2. le site lui-même (npm run dev), branché sur la fausse IA.
//
// Sécurité anti-facture, à trois verrous :
//   • ANTHROPIC_BASE_URL pointe sur 127.0.0.1 ;
//   • ANTHROPIC_API_KEY est remplacée par une fausse clé, donc même en cas
//     d'erreur d'adresse aucun appel payant ne peut aboutir ;
//   • le port est 3100, jamais 3000, pour ne pas se mélanger avec un `npm run dev`
//     déjà ouvert.
// Clerk et Stripe utilisent les clés de TEST du .env.local (pk_test/sk_test).

const APP_PORT = 3100;
const MOCK_PORT = 4010;
// `localhost` et non 127.0.0.1 : Next 16 bloque par défaut ses ressources de
// développement pour les autres hôtes (avertissement allowedDevOrigins).
const BASE_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: './tests',
  // Charge les clés de TEST du .env.local et prépare la connexion Clerk automatisée.
  globalSetup: require.resolve('./global-setup'),
  // Un seul navigateur à la fois : les tests brûlent des compteurs d'essais côté
  // serveur, deux parcours en parallèle se marcheraient dessus.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'rapport' }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: false },
    },
    {
      name: 'laptop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: 'node mock-ai.mjs',
      cwd: __dirname,
      port: MOCK_PORT,
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: `npm run dev -- --port ${APP_PORT}`,
      cwd: path.join(__dirname, '..'),
      url: BASE_URL,
      reuseExistingServer: true,
      // La 1re compilation de Next peut être longue sur un démarrage à froid.
      timeout: 300_000,
      env: {
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        ANTHROPIC_API_KEY: 'sk-ant-audit-fausse-cle',
      },
    },
  ],
});
