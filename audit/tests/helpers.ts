import { Page, Locator, expect } from '@playwright/test';

// Textes réellement affichés par le site (lib/i18n.ts + components/Generator.tsx).
// Si un de ces textes change dans le site, c'est ICI qu'il faut le corriger — le
// reste des tests ne connaît que ces clés.
export const T = {
  fr: {
    path: '/',
    platforms: {
      instagram: 'Instagram Reels',
      tiktok: 'TikTok',
      facebook: 'Facebook Reels',
      youtube: 'YouTube Shorts',
    },
    allPlatformsBtn: 'Les 4 plateformes',
    generateBtn: 'Générer mon script',
    variationsBtn: 'Générer 3 variations de scripts',
    ideasBtn: 'Générer 4 idées',
    remainingRe: /(\d+)\s+essais restants/,
    emailGate: 'Toute une série de bons scripts',
    emailPlaceholder: 'nom@courriel.com',
    unlockBtn: 'Débloquer mes essais',
    paywall: 'essais gratuits sont utilisés',
    seePlansBtn: 'Voir les abonnements',
    quotaHint: 'Une petite adaptation',
    heroZero: 'Vos essais gratuits sont utilisés.',
    heroSeePlans: 'Voir les forfaits',
    costNote: /plateformes sélectionnées = \d+ essais/,
    topicLabel: 'Sujet, idée, visuel & cible de votre vidéo',
    ideaTab: 'Idée',
    ideaPlaceholder: 'Sujet précis de cette idée...',
    ideaConfirmBtn: 'Confirmer et générer',
    bonusInvite: 'Activez les 4 plateformes',
    bonusActive: 'Essai bonus hors des essais gratuits',
    stayOnPage: 'Restez sur cette page',
    historyBtn: 'Historique de mes générations',
    historyEmpty: 'Aucune génération encore.',
    exportAllBtn: 'Exporter tout',
    exportOneBtn: 'Exporter',
    copyAllBtn: 'Tout copier',
    openEntry: 'Ouvrir',
    clearHistory: "Effacer l'historique",
    deleteSelected: 'Supprimer la sélection',
    txtHeader: 'Sujet :',
  },
  en: {
    path: '/en',
    platforms: {
      instagram: 'Instagram Reels',
      tiktok: 'TikTok',
      facebook: 'Facebook Reels',
      youtube: 'YouTube Shorts',
    },
    allPlatformsBtn: '4 Platforms',
    generateBtn: 'Generate my script',
    variationsBtn: 'Generate 3 script variations',
    ideasBtn: 'Generate 4 ideas',
    remainingRe: /(\d+)\s+trials remaining/,
    emailGate: 'Looks like you',
    emailPlaceholder: 'your@email.com',
    unlockBtn: 'Unlock my trials',
    paywall: 'free trials',
    seePlansBtn: 'See plans',
    quotaHint: 'One small tweak',
    heroZero: 'used your free trials',
    heroSeePlans: 'See the plans',
    costNote: /platforms selected = \d+ trials/,
    topicLabel: 'Topic, idea, visuals & audience of your video',
    ideaTab: 'Idea',
    ideaPlaceholder: 'Specific topic for this idea...',
    ideaConfirmBtn: 'Confirm and generate',
    bonusInvite: 'Turn on all 4 platforms',
    bonusActive: 'Bonus trial outside your free trials',
    stayOnPage: 'Stay on this page',
    historyBtn: 'My generation history',
    historyEmpty: 'No generations yet.',
    exportAllBtn: 'Export all',
    exportOneBtn: 'Export',
    copyAllBtn: 'Copy all',
    openEntry: 'Open',
    clearHistory: 'Clear history',
    deleteSelected: 'Delete selected',
    txtHeader: 'Topic :',
  },
} as const;

export type Lang = keyof typeof T;

// La fenêtre bloquante (mur du courriel, paywall, demande trop chère) : toutes
// les trois utilisent le MÊME contenant — c'est une règle produit, donc un seul
// sélecteur ici suffit à les attraper toutes.
export function modal(page: Page): Locator {
  return page.locator('div.fixed.inset-0.z-50').last();
}

export async function gotoApp(page: Page, lang: Lang) {
  // Le compteur du hero vient de /api/anon-status : on arme l'attente AVANT la
  // navigation, sinon la réponse arrive avant qu'on écoute et on attend dans le vide.
  const status = page.waitForResponse(r => r.url().includes('/api/anon-status'), { timeout: 30_000 });
  await page.goto(T[lang].path, { waitUntil: 'domcontentloaded' });
  await status.catch(() => { /* page servie sans appel : le test suivant tranchera */ });
}

// Compteur d'essais affiché sous les boutons du générateur.
export async function remaining(page: Page, lang: Lang): Promise<number> {
  const txt = await page.locator('#generator p').filter({ hasText: T[lang].remainingRe }).first().innerText();
  const m = txt.match(T[lang].remainingRe);
  return m ? Number(m[1]) : NaN;
}

export async function expectRemaining(page: Page, lang: Lang, n: number) {
  await expect.poll(() => remaining(page, lang), {
    message: `compteur d'essais attendu à ${n}`,
    timeout: 20_000,
  }).toBe(n);
}

function platformBtn(page: Page, lang: Lang, key: keyof typeof T['fr']['platforms']): Locator {
  return page.locator('#generator button').filter({ hasText: T[lang].platforms[key] }).first();
}

async function isSelected(btn: Locator): Promise<boolean> {
  const cls = (await btn.getAttribute('class')) || '';
  return cls.includes('bg-violet-600');
}

// Sélectionne EXACTEMENT la liste demandée (le site part sur Instagram seul).
export async function setPlatforms(page: Page, lang: Lang, wanted: Array<keyof typeof T['fr']['platforms']>) {
  const keys = ['instagram', 'tiktok', 'facebook', 'youtube'] as const;
  for (const k of keys) {
    const btn = platformBtn(page, lang, k);
    const on = await isSelected(btn);
    const shouldBeOn = wanted.includes(k);
    // « jamais zéro coché » côté site : on allume avant d'éteindre.
    if (shouldBeOn && !on) await btn.click();
  }
  for (const k of keys) {
    const btn = platformBtn(page, lang, k);
    if (!wanted.includes(k) && (await isSelected(btn))) await btn.click();
  }
}

interface GenOptions {
  topic?: string;
  platforms?: Array<keyof typeof T['fr']['platforms']>;
  variations?: boolean;
}

// Une génération complète, du remplissage du sujet au résultat affiché.
export async function generate(page: Page, lang: Lang, opts: GenOptions = {}) {
  const topic = opts.topic ?? 'Comment gagner du temps sur la creation de contenu pour une agence';
  await page.locator('#generator textarea').first().fill(topic);
  if (opts.platforms) await setPlatforms(page, lang, opts.platforms);

  const btn = page.locator('#generator button').filter({
    hasText: opts.variations ? T[lang].variationsBtn : T[lang].generateBtn,
  }).first();

  const answer = page.waitForResponse(r => r.url().includes('/api/generate'), { timeout: 60_000 });
  await btn.click();
  const res = await answer;
  expect(res.status(), 'la génération doit répondre 200').toBe(200);
  // Le résultat porte la marque de la fausse IA : sa présence prouve que le
  // contenu affiché vient bien de la réponse serveur.
  await expect(page.getByText('[TEST', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
}

// Clique sur Générer SANS attendre de réponse : sert aux cas où le site doit
// bloquer AVANT d'appeler le serveur (mur du courriel, paywall, demande trop chère).
export async function clickGenerate(page: Page, lang: Lang, topic = 'Sujet de test pour la fenetre bloquante') {
  await page.locator('#generator textarea').first().fill(topic);
  await page.locator('#generator button').filter({ hasText: T[lang].generateBtn }).first().click();
}

// ── Mode « 4 idées » ────────────────────────────────────────────────────────

// Ouvre le panneau des 4 idées (le bouton du bas du générateur).
export async function openIdeas(page: Page, lang: Lang) {
  await page.locator('#generator button').filter({ hasText: T[lang].ideasBtn }).first().click();
  await expect(page.getByPlaceholder(T[lang].ideaPlaceholder)).toBeVisible();
}

// Remplit les 4 onglets d'idées (un champ à la fois, comme une vraie personne).
export async function fillIdeas(page: Page, lang: Lang, sujets: string[]) {
  for (let i = 0; i < sujets.length; i++) {
    await page.locator('#generator button').filter({ hasText: `${T[lang].ideaTab} ${i + 1}` }).first().click();
    await page.getByPlaceholder(T[lang].ideaPlaceholder).fill(sujets[i]);
  }
}

// Lance le lot d'idées et attend les N réponses (le mode 4 idées = N requêtes
// successives, une par idée — c'est ce détail qui a déjà causé un vrai bug).
export async function runIdeas(page: Page, lang: Lang, attendues: number) {
  const statuts: number[] = [];
  const collecte = (r: { url(): string; status(): number }) => {
    if (r.url().includes('/api/generate')) statuts.push(r.status());
  };
  page.on('response', collecte);
  await page.locator('#generator button').filter({ hasText: T[lang].ideaConfirmBtn }).first().click();
  await expect.poll(() => statuts.length, {
    message: `${attendues} requêtes attendues (une par idée)`,
    timeout: 120_000,
  }).toBe(attendues);
  page.off('response', collecte);
  return statuts;
}

// Distance verticale entre le champ d'une idée et le bouton « Confirmer et générer ».
// Mesurée EN UN SEUL INSTANT côté navigateur : lire les deux positions par deux
// appels séparés donne des chiffres incohérents pendant le défilement animé de la
// page (c'est ce qui rendait une vérification « le bouton est-il à l'écran ? »
// imprévisible). Repères mesurés le 2026-08-11 : 126 px (téléphone FR),
// 110 px (téléphone EN), 94 px (portable). Ce qu'on surveille : qu'un bloc de texte
// ne vienne pas repousser le bouton loin sous le champ, comme l'avertissement jaune
// le faisait avant le correctif du 11 août.
export async function ecartChampBouton(page: Page, lang: Lang): Promise<number> {
  return page.evaluate(([ph, txt]) => {
    const champ = document.querySelector(`input[placeholder="${ph}"]`)!.getBoundingClientRect();
    const btn = [...document.querySelectorAll('#generator button')]
      .find(b => b.textContent?.includes(txt))!.getBoundingClientRect();
    return Math.round(btn.top - champ.bottom);
  }, [T[lang].ideaPlaceholder, T[lang].ideaConfirmBtn]);
}

// Rien ne doit dépasser horizontalement — c'est LE défaut visible sur téléphone.
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll, 'la page ne doit pas défiler horizontalement')
    .toBeLessThanOrEqual(overflow.client + 1);
}

// Une fenêtre bloquante doit tenir dans l'écran, bouton compris.
export async function expectModalFitsScreen(page: Page) {
  const card = modal(page).locator('div.relative.z-10').first();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  const size = page.viewportSize()!;
  expect(box, 'la fenêtre doit être mesurable').not.toBeNull();
  expect(box!.x, 'fenêtre hors écran à gauche').toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width, 'fenêtre hors écran à droite').toBeLessThanOrEqual(size.width + 1);
  expect(box!.height, 'fenêtre plus haute que l\'écran').toBeLessThanOrEqual(size.height + 1);
}
