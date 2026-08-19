// Moteur d'export de l'historique — 100 % côté navigateur (aucun serveur, aucun coût).
// Transforme les générations en fichier téléchargeable, au format choisi par le client.
// Réutilise la même mise en forme texte que le bouton « Tout copier » (source unique).

import { LocalHistoryEntry } from './localHistory';

export type ExportFormat = 'txt' | 'csv' | 'md';

interface ReelData {
  hook?: string;
  script?: string[];
  screenText?: string[];
  visualInspo?: string[];
  caption?: string;
  bestTime?: string;
  duration?: string;
  soundTrend?: string | null;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  all: 'Multi-plateformes',
};

const TONE_LABELS: Record<string, { fr: string; en: string }> = {
  educational: { fr: 'Éducatif', en: 'Educational' },
  expert: { fr: 'Expert', en: 'Expert' },
  inspirational: { fr: 'Inspirant', en: 'Inspirational' },
  funny: { fr: 'Humoristique', en: 'Witty' },
  trendy: { fr: 'Tendance', en: 'Trendy' },
  emotional: { fr: 'Émotionnel', en: 'Emotional' },
};

function toneLabel(tone: string, lang: string): string {
  const t = TONE_LABELS[tone];
  if (!t) return tone;
  return lang === 'fr' ? t.fr : t.en;
}

function platformLabel(platform: string): string {
  return PLATFORM_NAMES[platform] || platform;
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dateStamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'export';
  return d.toISOString().slice(0, 10); // AAAA-MM-JJ
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'script';
}

// ─────────────────────────────────────────────────────────────
// Format TEXTE (réutilisé aussi pour le presse-papiers)
// ─────────────────────────────────────────────────────────────

// ⚠️ Chaque étiquette commence par une ICÔNE (🎣, 🎬…) VOLONTAIREMENT : sur iOS,
// un texte qui débute par « MOT: » (ex. « HOOK: ») est interprété comme une URL
// (schéma type mailto:/tel:) → iOS met le mot en minuscule et encode tout en %20
// au collage (bug « %%% »). L'icône en tête empêche cette détection d'URL.
export function reelToText(r: ReelData, lang: string): string {
  const fr = lang === 'fr';
  const parts: string[] = [];
  if (r.hook) parts.push(`🎣 HOOK: ${r.hook}`);
  if (r.script?.length) parts.push(`🎬 SCRIPT:\n${r.script.join('\n')}`);
  if (r.screenText?.length) parts.push(`✏️ ${fr ? 'TEXTE ÉCRAN' : 'SCREEN TEXT'}: ${r.screenText.join(' | ')}`);
  if (r.visualInspo?.length) parts.push(`🎬 ${fr ? 'INSPIRATION VISUELLE' : 'VISUAL INSPIRATION'}: ${r.visualInspo.join(' | ')}`);
  if (r.caption) parts.push(`📝 ${fr ? 'LÉGENDE' : 'CAPTION'}:\n${r.caption}`);
  if (r.bestTime) parts.push(`🕐 ${fr ? 'MEILLEUR MOMENT' : 'BEST TIME'}: ${r.bestTime}`);
  if (r.duration) parts.push(`⏱️ ${fr ? 'DURÉE' : 'DURATION'}: ${r.duration}`);
  if (r.soundTrend) parts.push(`🎵 ${fr ? 'SON' : 'SOUND'}: ${r.soundTrend}`);
  if (r.ytTitle) parts.push(`▶️ ${fr ? 'TITRE YOUTUBE' : 'YOUTUBE TITLE'}: ${r.ytTitle}`);
  if (r.seoDescription) parts.push(`🔍 ${fr ? 'DESCRIPTION SEO' : 'SEO DESCRIPTION'}:\n${r.seoDescription}`);
  if (r.keywords?.length) parts.push(`🏷️ ${fr ? 'MOTS-CLÉS' : 'KEYWORDS'}: ${r.keywords.join(', ')}`);
  return parts.join('\n\n');
}

// Un lot « 4 idees » est UNE entree contenant 4 generations. Plutot que d'ecrire un
// rendu special dans chacun des trois exportateurs (TXT, MD, CSV), on le deplie en
// sous-entrees et on reutilise le rendu qui existe deja. Une idee peut elle-meme
// etre multi-plateformes, d'ou la detection ci-dessous. 2026-08-19.
function expandIdeas(entry: LocalHistoryEntry, lang: string): { titre: string; sous: LocalHistoryEntry }[] {
  const list = ((entry.data as Record<string, unknown>).ideas as { label: string; data: unknown }[]) || [];
  return list.map((it, i) => {
    const o = it.data as Record<string, unknown>;
    const isAll = !!(o && (o.instagram || o.tiktok || o.facebook || o.youtube));
    return {
      titre: `${lang === 'fr' ? 'Idée' : 'Idea'} ${i + 1}${it.label ? ` — ${it.label}` : ''}`,
      sous: { ...entry, mode: isAll ? 'all' : 'single', data: it.data } as LocalHistoryEntry,
    };
  });
}

export function entryToText(entry: LocalHistoryEntry, lang: string): string {
  const d = entry.data as Record<string, unknown>;
  if (entry.mode === 'ideas') {
    return expandIdeas(entry, lang)
      .map(({ titre, sous }) => `═══ ${titre.toUpperCase()} ═══\n\n${entryToText(sous, lang)}`)
      .join('\n\n');
  }
  if (entry.mode === 'all') {
    return (['instagram', 'tiktok', 'facebook', 'youtube'] as const)
      .filter(p => d[p])
      .map(p => `═══ ${PLATFORM_NAMES[p].toUpperCase()} ═══\n\n${reelToText(d[p] as ReelData, lang)}`)
      .join('\n\n');
  }
  if (entry.mode === 'variations') {
    const vars = (d.variations as ReelData[]) || [];
    return vars
      .map((v, i) => `═══ ${lang === 'fr' ? 'VARIATION' : 'VARIATION'} ${i + 1} ═══\n\n${reelToText(v, lang)}`)
      .join('\n\n');
  }
  return reelToText(d as ReelData, lang);
}

function entryHeader(entry: LocalHistoryEntry, lang: string): string {
  const fr = lang === 'fr';
  return [
    `${fr ? 'Sujet' : 'Topic'} : ${entry.topic}`,
    `${fr ? 'Plateforme' : 'Platform'} : ${platformLabel(entry.platform)} · ${fr ? 'Ton' : 'Tone'} : ${toneLabel(entry.tone, lang)} · ${formatDate(entry.date, lang)}`,
  ].join('\n');
}

function entryToTxt(entry: LocalHistoryEntry, lang: string): string {
  return `ViraReel\n${entryHeader(entry, lang)}\n\n${entryToText(entry, lang)}`;
}

// ─────────────────────────────────────────────────────────────
// Format MARKDOWN (se colle proprement dans Notion / Google Docs)
// ─────────────────────────────────────────────────────────────

function reelToMarkdown(r: ReelData, lang: string): string {
  const fr = lang === 'fr';
  const parts: string[] = [];
  if (r.hook) parts.push(`### 🎣 Hook\n${r.hook}`);
  if (r.script?.length) parts.push(`### 🎬 Script\n${r.script.map(s => `- ${s}`).join('\n')}`);
  if (r.screenText?.length) parts.push(`### ✏️ ${fr ? 'Texte écran' : 'Screen text'}\n${r.screenText.join(' · ')}`);
  if (r.visualInspo?.length) parts.push(`### 🎬 ${fr ? 'Inspiration visuelle' : 'Visual inspiration'}\n${r.visualInspo.map(v => `- ${v}`).join('\n')}`);
  if (r.caption) parts.push(`### 📝 ${fr ? 'Légende' : 'Caption'}\n${r.caption}`);
  const meta: string[] = [];
  if (r.bestTime) meta.push(`🕐 ${r.bestTime}`);
  if (r.duration) meta.push(`⏱️ ${r.duration}`);
  if (r.soundTrend) meta.push(`🎵 ${r.soundTrend}`);
  if (meta.length) parts.push(meta.join(' · '));
  if (r.ytTitle) parts.push(`### ▶️ ${fr ? 'Titre YouTube' : 'YouTube title'}\n${r.ytTitle}`);
  if (r.seoDescription) parts.push(`### 🔍 ${fr ? 'Description SEO' : 'SEO description'}\n${r.seoDescription}`);
  if (r.keywords?.length) parts.push(`### 🏷️ ${fr ? 'Mots-clés' : 'Keywords'}\n${r.keywords.join(', ')}`);
  return parts.join('\n\n');
}

function entryToMarkdown(entry: LocalHistoryEntry, lang: string): string {
  const fr = lang === 'fr';
  const d = entry.data as Record<string, unknown>;
  const header = `# ${entry.topic}\n**Date :** ${formatDate(entry.date, lang)} · **${fr ? 'Plateforme' : 'Platform'} :** ${platformLabel(entry.platform)} · **Ton :** ${toneLabel(entry.tone, lang)}`;

  let body: string;
  if (entry.mode === 'ideas') {
    body = expandIdeas(entry, lang)
      .map(({ titre, sous }) => `## ${titre}\n${entryToMarkdown(sous, lang).split('\n\n').slice(1).join('\n\n')}`)
      .join('\n\n');
  } else if (entry.mode === 'all') {
    body = (['instagram', 'tiktok', 'facebook', 'youtube'] as const)
      .filter(p => d[p])
      .map(p => `## ${PLATFORM_NAMES[p]}\n${reelToMarkdown(d[p] as ReelData, lang)}`)
      .join('\n\n');
  } else if (entry.mode === 'variations') {
    const vars = (d.variations as ReelData[]) || [];
    body = vars
      .map((v, i) => `## ${fr ? 'Variation' : 'Variation'} ${i + 1}\n${reelToMarkdown(v, lang)}`)
      .join('\n\n');
  } else {
    body = reelToMarkdown(d as ReelData, lang);
  }
  return `${header}\n\n${body}`;
}

// ─────────────────────────────────────────────────────────────
// Format CSV (une ligne par script — pour tableur / calendrier de contenu)
// ─────────────────────────────────────────────────────────────

const BOM = '﻿'; // pour que Excel lise correctement les accents
// Point-virgule = séparateur attendu par Excel en français/québécois (et compris par Google Sheets)
const CSV_SEP = ';';

function csvCell(value: string | undefined | null): string {
  // Cellule sur une seule ligne (compact) : les retours à la ligne deviennent des espaces
  // → rangées uniformes dans le tableur (calendrier de contenu). MD/TXT restent aérés.
  const v = (value ?? '').toString().replace(/\r?\n/g, ' ').trim();
  return `"${v.replace(/"/g, '""')}"`;
}

function reelToCsvCells(r: ReelData): string[] {
  return [
    r.hook || '',
    (r.script || []).join(' / '),
    (r.screenText || []).join(' | '),
    (r.visualInspo || []).join(' / '),
    r.caption || '',
    r.bestTime || '',
    r.duration || '',
    r.soundTrend || '',
    r.ytTitle || '',
    r.seoDescription || '',
    (r.keywords || []).join(', '),
  ];
}

function csvHeader(lang: string): string {
  const fr = lang === 'fr';
  const cols = fr
    ? ['Date', 'Sujet', 'Variante/Plateforme', 'Ton', 'Hook', 'Script', 'Texte écran', 'Inspiration visuelle', 'Légende', 'Meilleur moment', 'Durée', 'Son', 'Titre YouTube', 'Description SEO', 'Mots-clés']
    : ['Date', 'Topic', 'Variant/Platform', 'Tone', 'Hook', 'Script', 'Screen text', 'Visual inspiration', 'Caption', 'Best time', 'Duration', 'Sound', 'YouTube title', 'SEO description', 'Keywords'];
  return cols.map(csvCell).join(CSV_SEP);
}

function entryToCsvRows(entry: LocalHistoryEntry, lang: string): string[] {
  const d = entry.data as Record<string, unknown>;
  const date = formatDate(entry.date, lang);
  const tone = toneLabel(entry.tone, lang);

  const rowFor = (variant: string, r: ReelData) =>
    [csvCell(date), csvCell(entry.topic), csvCell(variant), csvCell(tone), ...reelToCsvCells(r).map(csvCell)].join(CSV_SEP);

  if (entry.mode === 'ideas') {
    return expandIdeas(entry, lang).flatMap(({ titre, sous }) =>
      entryToCsvRows(sous, lang).map(r => r.replace(csvCell(entry.topic), csvCell(`${entry.topic} · ${titre}`))));
  }
  if (entry.mode === 'all') {
    return (['instagram', 'tiktok', 'facebook', 'youtube'] as const)
      .filter(p => d[p])
      .map(p => rowFor(PLATFORM_NAMES[p], d[p] as ReelData));
  }
  if (entry.mode === 'variations') {
    const vars = (d.variations as ReelData[]) || [];
    return vars.map((v, i) => rowFor(`${lang === 'fr' ? 'Variation' : 'Variation'} ${i + 1}`, v));
  }
  return [rowFor(platformLabel(entry.platform), d as ReelData)];
}

// ─────────────────────────────────────────────────────────────
// Téléchargement
// ─────────────────────────────────────────────────────────────

// Type minimal de l'API « File System Access » (Chrome/Edge). Absente ailleurs.
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
type ShowSaveFilePicker = (opts?: SaveFilePickerOptions) => Promise<{
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
}>;

const MIME: Record<ExportFormat, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
};

// Enregistre un fichier. Sur Chrome/Edge → ouvre une vraie fenêtre « Enregistrer sous »
// (le client choisit le dossier, ex. « Clients / Pizzeria »). Ailleurs (Firefox/Safari)
// → repli automatique sur le téléchargement classique (dossier Téléchargements).
async function saveFile(filename: string, content: string, format: ExportFormat): Promise<void> {
  if (typeof window === 'undefined') return;
  const mime = MIME[format];
  const ext = `.${format}`;

  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: format.toUpperCase(), accept: { [mime]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (err) {
      // L'utilisateur a fermé/annulé la fenêtre → ne rien télécharger
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Autre souci → on retombe sur la méthode classique ci-dessous
    }
  }

  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildContent(entriesOrEntry: LocalHistoryEntry | LocalHistoryEntry[], format: ExportFormat, lang: string): string {
  const entries = Array.isArray(entriesOrEntry) ? entriesOrEntry : [entriesOrEntry];
  if (format === 'csv') {
    const rows = entries.flatMap(e => entryToCsvRows(e, lang));
    return BOM + [csvHeader(lang), ...rows].join('\r\n');
  }
  if (format === 'md') {
    return entries.map(e => entryToMarkdown(e, lang)).join('\n\n---\n\n');
  }
  return entries.map(e => entryToTxt(e, lang)).join('\n\n════════════════════════════\n\n');
}

// Exporte UNE génération dans le format choisi.
export function exportEntry(entry: LocalHistoryEntry, format: ExportFormat, lang: string): Promise<void> {
  const filename = `virareel-${dateStamp(entry.date)}-${slugify(entry.topic)}.${format}`;
  return saveFile(filename, buildContent(entry, format, lang), format);
}

// Exporte TOUT l'historique dans un seul fichier.
export function exportAll(entries: LocalHistoryEntry[], format: ExportFormat, lang: string): Promise<void> {
  const filename = `virareel-historique-${new Date().toISOString().slice(0, 10)}.${format}`;
  return saveFile(filename, buildContent(entries, format, lang), format);
}
