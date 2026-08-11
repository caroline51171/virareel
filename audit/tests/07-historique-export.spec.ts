import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import {
  T, Lang, gotoApp, generate, setPlatforms, expectNoHorizontalOverflow,
} from './helpers';
import {
  exigerClerkPret, connecterCompteNeuf, attendreConnexion, supprimerComptes, CompteTest,
} from './compte';

// HISTORIQUE + EXPORT TXT / MD / CSV.
//
// L'historique vit dans le navigateur du client (lib/localHistory.ts) et l'export
// est fabriqué sur place, sans serveur (lib/exportHistory.ts). C'est LE livrable
// des agences : ce qu'elles rangent chez elles. On vérifie donc le contenu réel
// des fichiers, pas seulement que le bouton réagit.
//
// L'historique n'existe que pour un compte connecté → même préparation que 06.
//
// Trois formes de génération sont produites, parce que l'export les traite
// différemment : 1 plateforme (single), 3 variations (variations), 4 plateformes (all).

test.beforeAll(exigerClerkPret);

const SUJETS = {
  fr: {
    single: 'Recette de pizza maison en 30 secondes',
    variations: 'Trois erreurs de montage video a eviter',
    all: 'Presenter une agence de contenu en 20 secondes',
  },
  en: {
    single: 'Homemade pizza recipe in 30 seconds',
    variations: 'Three video editing mistakes to avoid',
    all: 'Introducing a content agency in 20 seconds',
  },
} as const;

// Remplace la fenêtre « Enregistrer sous » du navigateur (API showSaveFilePicker,
// Chrome/Edge) par un espion qui garde le nom et le contenu du fichier. Sans ça, une
// vraie fenêtre système s'ouvrirait et bloquerait l'audit. Le chemin de repli
// (téléchargement classique de Firefox/Safari) est vérifié séparément, plus bas.
async function espionnerEnregistrement(page: Page) {
  await page.addInitScript(() => {
    interface FichierExporte { nom?: string; contenu: string }
    (window as unknown as { __exports: FichierExporte[] }).__exports = [];
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker =
      async (opts?: { suggestedName?: string }) => ({
        createWritable: async () => ({
          write: async (data: string) => {
            (window as unknown as { __exports: FichierExporte[] }).__exports
              .push({ nom: opts?.suggestedName, contenu: data });
          },
          close: async () => {},
        }),
      });
  });
}

async function dernierExport(page: Page): Promise<{ nom: string; contenu: string }> {
  const fichiers = await page.evaluate(
    () => (window as unknown as { __exports: { nom?: string; contenu: string }[] }).__exports,
  );
  expect(fichiers.length, 'aucun fichier n\'a été écrit').toBeGreaterThan(0);
  const f = fichiers[fichiers.length - 1];
  return { nom: f.nom || '', contenu: f.contenu };
}

function sectionHistorique(page: Page, lang: Lang) {
  return page.locator('section').filter({ hasText: T[lang].historyBtn });
}

// Ouvre un menu « Exporter » et choisit le format. `bouton` = le déclencheur à cliquer.
async function exporter(page: Page, bouton: ReturnType<Page['locator']>, format: 'TXT' | 'CSV' | 'MD') {
  await bouton.click();
  const menu = page.locator('div.absolute.right-0.top-full').last();
  await menu.locator('button').filter({ hasText: format }).click();
}

for (const lang of ['fr', 'en'] as Lang[]) {
  test(`Historique + export TXT/MD/CSV ${lang.toUpperCase()}`, async ({ page }) => {
    test.setTimeout(240_000);
    const t = T[lang];
    const fr = lang === 'fr';
    const sujets = SUJETS[lang];
    const comptes: CompteTest[] = [];
    // Les suppressions de l'historique passent par une confirmation du navigateur.
    page.on('dialog', d => d.accept());

    try {
      await espionnerEnregistrement(page);
      await gotoApp(page, lang);
      await connecterCompteNeuf(page, `historique-${lang}`, comptes);
      await gotoApp(page, lang);
      // L'historique n'est enregistré que si le navigateur sait DÉJÀ qui est connecté
      // (la clé de rangement est l'identifiant du compte).
      await attendreConnexion(page);

      // ── Trois générations, une par forme d'export ───────────────────────────
      await setPlatforms(page, lang, ['instagram']);
      await generate(page, lang, { topic: sujets.single, platforms: ['instagram'] });
      await generate(page, lang, { topic: sujets.variations, platforms: ['instagram'], variations: true });
      await generate(page, lang, {
        topic: sujets.all,
        platforms: ['instagram', 'tiktok', 'facebook', 'youtube'],
      });

      // ── L'historique s'ouvre et contient les 3 générations, la plus récente en haut
      const section = sectionHistorique(page, lang);
      await section.getByRole('button', { name: t.historyBtn }).click();
      const entrees = section.locator('input[type="checkbox"]');
      await expect(entrees).toHaveCount(3);
      await expect(section).toContainText(sujets.single);
      await expect(section).toContainText(sujets.variations);
      await expect(section).toContainText(sujets.all);
      // Ordre : la dernière génération (4 plateformes) doit être la première ligne.
      await expect(section.locator('p.text-white.font-semibold').first()).toHaveText(sujets.all);

      // ── Export TXT de tout l'historique ─────────────────────────────────────
      const exportTout = section.getByRole('button', { name: t.exportAllBtn });
      await exporter(page, exportTout, 'TXT');
      const txt = await dernierExport(page);
      expect(txt.nom, 'nom du fichier TXT').toMatch(/^virareel-historique-\d{4}-\d{2}-\d{2}\.txt$/);
      expect(txt.contenu).toContain('ViraReel');
      expect(txt.contenu).toContain(`${t.txtHeader} ${sujets.single}`);
      expect(txt.contenu).toContain(`${t.txtHeader} ${sujets.variations}`);
      expect(txt.contenu).toContain(`${t.txtHeader} ${sujets.all}`);
      expect(txt.contenu).toContain('🎣 HOOK:');
      // Les 3 formes doivent être dépliées, pas résumées.
      expect(txt.contenu).toContain('═══ INSTAGRAM ═══');
      expect(txt.contenu).toContain('═══ TIKTOK ═══');
      expect(txt.contenu).toContain('═══ VARIATION 1 ═══');
      expect(txt.contenu).toContain('═══ VARIATION 3 ═══');
      // Le contenu vient bien des générations (marque de la fausse IA).
      expect(txt.contenu).toContain('[TEST');

      // ── Export MD ───────────────────────────────────────────────────────────
      await exporter(page, exportTout, 'MD');
      const md = await dernierExport(page);
      expect(md.nom).toMatch(/\.md$/);
      expect(md.contenu).toContain(`# ${sujets.all}`);
      expect(md.contenu).toContain('### 🎣 Hook');
      expect(md.contenu).toContain('## Instagram');
      expect(md.contenu).toContain('## YouTube');
      expect(md.contenu).toContain('## Variation 1');
      // Les entrées sont séparées par un trait horizontal Markdown.
      expect(md.contenu).toContain('\n---\n');

      // ── Export CSV ──────────────────────────────────────────────────────────
      await exporter(page, exportTout, 'CSV');
      const csv = await dernierExport(page);
      expect(csv.nom).toMatch(/\.csv$/);
      // Marque d'encodage : sans elle, Excel affiche « Ã© » à la place des accents.
      expect(csv.contenu.charCodeAt(0), 'BOM UTF-8 attendu en tête du CSV').toBe(0xFEFF);
      const lignes = csv.contenu.slice(1).split('\r\n');
      expect(lignes[0]).toBe(
        (fr
          ? ['Date', 'Sujet', 'Variante/Plateforme', 'Ton', 'Hook', 'Script', 'Texte écran', 'Inspiration visuelle', 'Légende', 'Meilleur moment', 'Durée', 'Son', 'Titre YouTube', 'Description SEO', 'Mots-clés']
          : ['Date', 'Topic', 'Variant/Platform', 'Tone', 'Hook', 'Script', 'Screen text', 'Visual inspiration', 'Caption', 'Best time', 'Duration', 'Sound', 'YouTube title', 'SEO description', 'Keywords']
        ).map(c => `"${c}"`).join(';'),
      );
      // 1 en-tête + 1 (single) + 3 (variations) + 4 (plateformes) = 9 lignes.
      expect(lignes.length, 'une ligne de tableur par script livré').toBe(9);
      // Chaque ligne tient sur UNE ligne (aucun retour à la ligne dans une cellule).
      for (const l of lignes) expect(l.startsWith('"')).toBe(true);

      // ── Export d'UNE seule génération ───────────────────────────────────────
      const carteRecente = section.locator('div.bg-slate-800.border').first();
      await carteRecente.getByRole('button', { name: t.openEntry }).click();
      await expect(carteRecente.getByRole('button', { name: t.copyAllBtn })).toBeVisible();
      await exporter(page, carteRecente.getByRole('button', { name: t.exportOneBtn, exact: true }), 'TXT');
      const seule = await dernierExport(page);
      expect(seule.nom, 'le nom du fichier reprend la date et le sujet')
        .toMatch(/^virareel-\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.txt$/);
      expect(seule.contenu).toContain(`${t.txtHeader} ${sujets.all}`);
      // Un seul sujet dans le fichier : c'est bien UNE génération, pas tout l'historique.
      expect(seule.contenu).not.toContain(sujets.single);

      // ── Chemin de repli (Firefox / Safari) : vrai téléchargement ────────────
      // On retire l'API « Enregistrer sous » pour forcer le téléchargement classique,
      // celui que reçoivent les clientes qui ne sont pas sur Chrome.
      await page.evaluate(() => { delete (window as unknown as Record<string, unknown>).showSaveFilePicker; });
      const telechargement = page.waitForEvent('download', { timeout: 30_000 });
      await exporter(page, exportTout, 'TXT');
      const dl = await telechargement;
      expect(dl.suggestedFilename()).toMatch(/^virareel-historique-\d{4}-\d{2}-\d{2}\.txt$/);
      const chemin = await dl.path();
      expect(fs.readFileSync(chemin, 'utf8')).toContain(`${t.txtHeader} ${sujets.all}`);

      // ── Ménage : supprimer une génération, puis tout effacer ────────────────
      await entrees.first().check();
      await section.locator('button').filter({ hasText: t.deleteSelected }).click();
      await expect(entrees).toHaveCount(2);
      await expect(section).not.toContainText(sujets.all);

      await section.locator('button').filter({ hasText: t.clearHistory }).click();
      await expect(section).toContainText(t.historyEmpty);
    } finally {
      await supprimerComptes(comptes);
    }
  });
}

// Vérification à part, pour qu'un défaut d'affichage ne masque pas les vérifications
// de contenu des exports ci-dessus. Ne dépend pas de la langue : c'est la même barre
// de boutons dans les deux.
test('Historique ouvert : rien ne dépasse en largeur sur téléphone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-375', 'Vérification propre au format téléphone');
  test.setTimeout(180_000);
  const comptes: CompteTest[] = [];

  try {
    await gotoApp(page, 'fr');
    await connecterCompteNeuf(page, 'debordement', comptes);
    await gotoApp(page, 'fr');
    await attendreConnexion(page);
    // Une génération suffit : la barre « Exporter tout / Effacer l'historique »
    // n'apparaît que lorsque l'historique n'est pas vide.
    await setPlatforms(page, 'fr', ['instagram']);
    await generate(page, 'fr', { topic: SUJETS.fr.single, platforms: ['instagram'] });

    const section = sectionHistorique(page, 'fr');
    await section.getByRole('button', { name: T.fr.historyBtn }).click();
    await expect(section.locator('input[type="checkbox"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  } finally {
    await supprimerComptes(comptes);
  }
});
