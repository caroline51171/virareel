// PARTAGE D'UNE GÉNÉRATION — un lien public `/p/<id>` qui montre UNE génération en
// lecture seule, avec un bouton « Créer le mien gratuitement » (2026-10-05).
//
// Pourquoi un stockage serveur : l'historique vit dans le NAVIGATEUR (lib/localHistory.ts),
// l'ami qui reçoit le lien ne peut donc rien y lire. Seules les générations PARTAGÉES sont
// copiées ici, dans le même Redis Upstash que lib/journal.ts. Sans date d'expiration :
// un lien envoyé ne doit jamais devenir un lien mort chez quelqu'un.
//
// Ce qui est gardé : le résultat de l'IA seulement (accroche, script, légende…), la
// plateforme et la langue. JAMAIS le sujet tapé par la personne (il peut contenir le nom
// d'un client), ni son compte, ni son courriel.
//
// Le contenu vient du navigateur : n'importe qui peut appeler /api/partage avec le texte
// de son choix. D'où `nettoyerPartage` (seuls les champs connus, en texte, bornés),
// l'affichage en texte brut (aucun lien cliquable), le `noindex` de la page, et une
// limite de créations par adresse IP.
//
// Identifiant = empreinte du contenu : partager deux fois la même génération redonne le
// MÊME lien, sans doublon en base ni mémoire à tenir côté navigateur.
//
// Aucun import : utilisé par le serveur (Node et Edge pour l'image d'aperçu) et testé sans réseau.

export type ModePartage = 'single' | 'variations' | 'all' | 'ideas';

export interface ReelPartage {
  hook?: string;
  script?: string[];
  screenText?: string[];
  visualInspo?: string[];
  caption?: string;
  bestTime?: string;
  duration?: string;
  soundTrend?: string;
  ytTitle?: string;
  seoDescription?: string;
  keywords?: string[];
}

export type PlateformesPartage = Partial<Record<(typeof PLATEFORMES)[number], ReelPartage>>;

export interface Partage {
  mode: ModePartage;
  platform: string;
  lang: 'fr' | 'en';
  date: string; // ISO, moment du premier partage
  data: unknown; // ReelPartage | { variations } | PlateformesPartage | { ideas }
}

export const PLATEFORMES = ['instagram', 'tiktok', 'facebook', 'youtube'] as const;
const MODES: ModePartage[] = ['single', 'variations', 'all', 'ideas'];

// Bornes larges : une vraie génération n'en approche aucune.
const MAX_TEXTE = 3000;
const MAX_LISTE = 20;
export const MAX_OCTETS = 200_000;

function texte(v: unknown, max = MAX_TEXTE): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}

function liste(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const l = v.map(x => texte(x, 1000)).filter((x): x is string => !!x).slice(0, MAX_LISTE);
  return l.length ? l : undefined;
}

export function nettoyerReel(v: unknown): ReelPartage | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const r: ReelPartage = {
    hook: texte(o.hook, 500),
    script: liste(o.script),
    screenText: liste(o.screenText),
    visualInspo: liste(o.visualInspo),
    caption: texte(o.caption),
    bestTime: texte(o.bestTime, 200),
    duration: texte(o.duration, 200),
    soundTrend: texte(o.soundTrend, 300),
    ytTitle: texte(o.ytTitle, 300),
    seoDescription: texte(o.seoDescription),
    keywords: liste(o.keywords),
  };
  for (const k of Object.keys(r) as (keyof ReelPartage)[]) if (r[k] === undefined) delete r[k];
  // Sans accroche ni script, ce n'est pas une génération.
  return r.hook || r.script ? r : null;
}

function nettoyerPlateformes(v: unknown): PlateformesPartage | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const r: PlateformesPartage = {};
  for (const p of PLATEFORMES) {
    const reel = nettoyerReel(o[p]);
    if (reel) r[p] = reel;
  }
  return Object.keys(r).length ? r : null;
}

/** Ce qu'on accepte d'enregistrer, ou null si la demande ne ressemble pas à une génération. */
export function nettoyerPartage(brut: unknown, maintenant = new Date()): Partage | null {
  if (!brut || typeof brut !== 'object') return null;
  const b = brut as Record<string, unknown>;
  const mode = MODES.find(m => m === b.mode);
  if (!mode) return null;
  const lang = b.lang === 'en' ? 'en' : 'fr';
  const platform = typeof b.platform === 'string' && [...PLATEFORMES, 'all'].includes(b.platform) ? b.platform : 'instagram';
  const d = b.data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object') return null;

  let data: unknown = null;
  if (mode === 'single') {
    data = nettoyerReel(d);
  } else if (mode === 'all') {
    data = nettoyerPlateformes(d);
  } else if (mode === 'variations') {
    const vars = Array.isArray(d.variations)
      ? d.variations.slice(0, 5).map(nettoyerReel).filter((x): x is ReelPartage => !!x)
      : [];
    data = vars.length ? { variations: vars } : null;
  } else {
    // 'ideas' : chaque idée est un reel seul OU un lot de plateformes.
    const ideas = Array.isArray(d.ideas)
      ? d.ideas.slice(0, 4).flatMap((it: unknown) => {
          const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
          const contenu = nettoyerPlateformes(o.data) ?? nettoyerReel(o.data);
          return contenu ? [{ label: texte(o.label, 200) ?? '', data: contenu }] : [];
        })
      : [];
    data = ideas.length ? { ideas } : null;
  }
  if (!data) return null;
  return { mode, platform, lang, date: maintenant.toISOString(), data };
}

/** La première accroche du partage : titre de la page et de l'image d'aperçu. */
export function premiereAccroche(p: Partage): string {
  const d = p.data as Record<string, unknown>;
  const deReel = (v: unknown): string | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    if (typeof o.hook === 'string') return o.hook;
    for (const pf of PLATEFORMES) {
      const h = (o[pf] as ReelPartage | undefined)?.hook;
      if (h) return h;
    }
    return undefined;
  };
  if (Array.isArray(d.ideas)) return deReel((d.ideas[0] as { data?: unknown })?.data) ?? '';
  if (Array.isArray(d.variations)) return deReel(d.variations[0]) ?? '';
  return deReel(d) ?? '';
}

// Empreinte du contenu (sans la date, qui changerait à chaque essai) : 12 caractères
// base64url = 72 bits, impossible à deviner.
export async function idPartage(p: Partage): Promise<string> {
  const contenu = { mode: p.mode, platform: p.platform, lang: p.lang, data: p.data };
  const octets = new TextEncoder().encode(JSON.stringify(contenu));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', octets));
  let bin = '';
  for (const o of hash.slice(0, 9)) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function idValide(id: string): boolean {
  return /^[A-Za-z0-9_-]{12}$/.test(id);
}

// ---- Stockage (Upstash, API REST) ---------------------------------------------------

const UPSTASH_URL = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(commandes: unknown[][]): Promise<{ result?: unknown; error?: string }[] | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(commandes),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

/** Enregistre (une seule fois : NX) et renvoie l'identifiant, ou null si le stockage est injoignable. */
export async function enregistrerPartage(p: Partage): Promise<string | null> {
  const id = await idPartage(p);
  const r = await redis([['SET', `partage:${id}`, JSON.stringify(p), 'NX']]);
  return r && !r[0]?.error ? id : null;
}

export async function lirePartage(id: string): Promise<Partage | null> {
  if (!idValide(id)) return null;
  try {
    const r = await redis([['GET', `partage:${id}`]]);
    const brut = r?.[0]?.result;
    return typeof brut === 'string' ? (JSON.parse(brut) as Partage) : null;
  } catch {
    return null;
  }
}

// Au-delà, l'adresse IP doit attendre l'heure suivante. Une personne réelle en partage
// quelques-unes ; 30 à l'heure ne gêne personne et empêche de remplir la base en boucle.
export const MAX_PAR_HEURE = 30;

/** true si cette IP peut encore créer un lien cette heure-ci. Stockage en panne → on laisse passer. */
export async function quotaPartageOk(ip: string): Promise<boolean> {
  const heure = new Date().toISOString().slice(0, 13);
  const cle = `partage_ip:${ip}:${heure}`;
  try {
    const r = await redis([['INCR', cle], ['EXPIRE', cle, 3600]]);
    const n = Number(r?.[0]?.result ?? 0);
    return n <= MAX_PAR_HEURE;
  } catch {
    return true;
  }
}

/** Le lien à envoyer. `qr` : marque la visite comme venue d'un code QR (onglet Performance). */
export function lienPartage(site: string, id: string, qr = false): string {
  return `${site}/p/${id}${qr ? '?via=qr' : ''}`;
}
