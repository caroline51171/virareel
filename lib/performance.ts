// CALCULS de l'onglet Performance d'/admin : filtre par période et par UTM, lignes par
// jour ou par semaine, totaux des cartes, taux, et les deux exports CSV.
//
// Le serveur (app/api/admin/performance) renvoie la liste BRUTE des événements ; tout
// le reste se calcule ici, dans le navigateur. Changer de période ou de filtre ne
// relance donc aucune requête vers Stripe ou Clerk.
//
// Règle d'or, vérifiée par performance.test.ts : les cartes = la somme des lignes du
// tableau (sauf « payeurs uniques », qui compte des PERSONNES : quelqu'un qui paie deux
// jours de suite est 1 payeur sur la période, mais 1 payeur dans chacune des 2 lignes).
//
// Fuseau : America/Toronto partout, comme lib/croissance.ts. Semaine = lundi → dimanche.
// Montants en CENTS entiers (pas de flottants qui dérivent au fil des sommes).
//
// Fichier PUR (aucun import) : testé sans réseau.

export type TypeEvenement =
  | 'signup'
  | 'first_trial'
  | 'lead_email'
  | 'initiate_checkout'
  | 'purchase'
  | 'refund';

export const CLES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
export type CleUtm = (typeof CLES_UTM)[number];

export interface Evenement {
  t: string; // ISO
  type: TypeEvenement;
  userId?: string;
  email?: string;
  plan?: string;
  /** Paiement ou remboursement, en cents CAD (montant réellement versé sur le compte Stripe). */
  montantCents?: number;
  stripeId?: string;
  /** Qui a payé (client Stripe) : sert à compter les payeurs uniques. */
  client?: string;
  /** Paiement qui n'est pas le 1er de ce client (renouvellement mensuel). */
  renouvellement?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  fbclid?: string;
  landing_path?: string;
}

export type Agregation = 'jour' | 'semaine';

export interface Periode {
  debut: string; // YYYY-MM-DD inclus
  fin: string;   // YYYY-MM-DD inclus
}

/** Valeur de filtre qui désigne « les gens arrivés sans cette étiquette ». */
export const SANS_UTM = '(sans UTM)';
export type FiltreUtm = Partial<Record<CleUtm, string>>;

export interface Ligne {
  date: string;
  nouveaux_comptes: number;
  essais_demarres: number;
  leads_email: number;
  checkouts_inities: number;
  paiements_reussis: number;
  revenu_brut_cents: number;
  remboursements_nb: number;
  remboursements_cents: number;
  revenu_net_cents: number;
  payeurs_uniques: number;
  /** 1ers paiements seulement (hors renouvellements) : base des taux de conversion. */
  premiers_paiements: number;
  /** null = aucun jour saisi dans cette ligne. */
  depense_meta_cents: number | null;
}

const FUSEAU = 'America/Toronto';

export function jourToronto(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: FUSEAU }); // YYYY-MM-DD
}

// Midi UTC : assez loin de minuit pour qu'aucun décalage de fuseau ne fasse basculer le jour.
function midi(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`);
}

export function decalerJour(jour: string, n: number): string {
  const d = midi(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function lundiDe(jour: string): string {
  return decalerJour(jour, -((midi(jour).getUTCDay() + 6) % 7));
}

/** Tous les jours de la période, du plus ancien au plus récent. */
export function joursDe(p: Periode): string[] {
  const jours: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.debut) || !/^\d{4}-\d{2}-\d{2}$/.test(p.fin)) return jours;
  // Borne de sécurité : une date de fin tapée de travers ne doit pas geler la page.
  for (let j = p.debut; j <= p.fin && jours.length < 3700; j = decalerJour(j, 1)) jours.push(j);
  return jours;
}

export type Raccourci = 'aujourdhui' | 'hier' | '7jours';

export function periodeRaccourci(r: Raccourci, maintenant = new Date()): Periode {
  const auj = jourToronto(maintenant);
  if (r === 'aujourdhui') return { debut: auj, fin: auj };
  if (r === 'hier') {
    const hier = decalerJour(auj, -1);
    return { debut: hier, fin: hier };
  }
  return { debut: decalerJour(auj, -6), fin: auj };
}

/** L'événement passe-t-il le filtre UTM ? Un filtre vide ou absent laisse tout passer. */
export function passeFiltre(e: Evenement, f: FiltreUtm): boolean {
  for (const cle of CLES_UTM) {
    const voulu = f[cle];
    if (!voulu) continue;
    const reel = e[cle];
    if (voulu === SANS_UTM ? !!reel : reel !== voulu) return false;
  }
  return true;
}

/** Les événements de la période (jours de Toronto) qui passent le filtre, du plus récent au plus ancien. */
export function filtrer(evenements: Evenement[], p: Periode, f: FiltreUtm): Evenement[] {
  return evenements
    .filter(e => {
      const d = new Date(e.t);
      if (Number.isNaN(d.getTime())) return false;
      const j = jourToronto(d);
      return j >= p.debut && j <= p.fin && passeFiltre(e, f);
    })
    .sort((a, b) => b.t.localeCompare(a.t));
}

/** Les valeurs présentes pour une étiquette UTM, pour remplir les menus du filtre. */
export function valeursUtm(evenements: Evenement[], cle: CleUtm): string[] {
  const vues = new Set<string>();
  let sans = false;
  for (const e of evenements) {
    if (e[cle]) vues.add(e[cle]!);
    else sans = true;
  }
  const liste = [...vues].sort((a, b) => a.localeCompare(b));
  return sans ? [...liste, SANS_UTM] : liste;
}

function ligneVide(date: string): Ligne {
  return {
    date,
    nouveaux_comptes: 0,
    essais_demarres: 0,
    leads_email: 0,
    checkouts_inities: 0,
    paiements_reussis: 0,
    revenu_brut_cents: 0,
    remboursements_nb: 0,
    remboursements_cents: 0,
    revenu_net_cents: 0,
    payeurs_uniques: 0,
    premiers_paiements: 0,
    depense_meta_cents: null,
  };
}

function ajouterEvenement(l: Ligne, e: Evenement, payeurs: Set<string>): void {
  switch (e.type) {
    case 'signup': l.nouveaux_comptes++; break;
    case 'first_trial': l.essais_demarres++; break;
    case 'lead_email': l.leads_email++; break;
    case 'initiate_checkout': l.checkouts_inities++; break;
    case 'purchase':
      l.paiements_reussis++;
      l.revenu_brut_cents += e.montantCents ?? 0;
      if (!e.renouvellement) l.premiers_paiements++;
      payeurs.add(e.client || e.userId || e.email || e.stripeId || e.t);
      break;
    case 'refund':
      l.remboursements_nb++;
      l.remboursements_cents += e.montantCents ?? 0;
      break;
  }
  l.revenu_net_cents = l.revenu_brut_cents - l.remboursements_cents;
}

function ajouterDepense(l: Ligne, cents: number | undefined): void {
  if (cents === undefined) return;
  l.depense_meta_cents = (l.depense_meta_cents ?? 0) + cents;
}

/**
 * Une ligne par jour (ou par semaine = lundi) de la période, jours vides compris : un
 * jour sans rien est une information, pas un trou. Plus récent en haut.
 *
 * `depenses` : dollars saisis par jour → comptés tels quels, jamais filtrés par UTM (Meta
 * ne dit pas à quelle campagne ils vont ici).
 */
export function lignes(
  evenements: Evenement[],
  p: Periode,
  f: FiltreUtm,
  agregation: Agregation,
  depenses: Record<string, number> = {},
): Ligne[] {
  const cle = (jour: string) => (agregation === 'jour' ? jour : lundiDe(jour));
  const parCle = new Map<string, { ligne: Ligne; payeurs: Set<string> }>();
  for (const jour of joursDe(p)) {
    const k = cle(jour);
    if (!parCle.has(k)) parCle.set(k, { ligne: ligneVide(k), payeurs: new Set() });
    if (depenses[jour] !== undefined) ajouterDepense(parCle.get(k)!.ligne, Math.round(depenses[jour] * 100));
  }
  for (const e of filtrer(evenements, p, f)) {
    const entree = parCle.get(cle(jourToronto(new Date(e.t))));
    if (entree) ajouterEvenement(entree.ligne, e, entree.payeurs);
  }
  return [...parCle.values()]
    .map(({ ligne, payeurs }) => ({ ...ligne, payeurs_uniques: payeurs.size }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Les cartes : totaux de la période. Payeurs uniques = personnes distinctes sur TOUTE la période. */
export function totaux(
  evenements: Evenement[],
  p: Periode,
  f: FiltreUtm,
  depenses: Record<string, number> = {},
): Ligne {
  const t = ligneVide(`${p.debut} → ${p.fin}`);
  const payeurs = new Set<string>();
  for (const jour of joursDe(p)) {
    if (depenses[jour] !== undefined) ajouterDepense(t, Math.round(depenses[jour] * 100));
  }
  for (const e of filtrer(evenements, p, f)) ajouterEvenement(t, e, payeurs);
  t.payeurs_uniques = payeurs.size;
  return t;
}

export interface Taux {
  essai_lead: number | null;
  lead_checkout: number | null;
  checkout_paye: number | null;
  compte_paye: number | null;
}

// null quand la base est 0 : « 0 % » ferait croire à un échec là où il n'y a rien à mesurer.
const ratio = (num: number, base: number) => (base > 0 ? num / base : null);

/**
 * Taux calculés, jamais stockés. Les deux derniers comptent les 1ers paiements
 * seulement : un renouvellement mensuel n'est pas une conversion de la pub.
 */
export function taux(l: Ligne): Taux {
  return {
    essai_lead: ratio(l.leads_email, l.essais_demarres),
    lead_checkout: ratio(l.checkouts_inities, l.leads_email),
    checkout_paye: ratio(l.premiers_paiements, l.checkouts_inities),
    compte_paye: ratio(l.premiers_paiements, l.nouveaux_comptes),
  };
}

/** Coût d'acquisition : dépense Meta ÷ payeurs uniques. null si rien de saisi ou aucun payeur. */
export function cacCents(l: Ligne): number | null {
  if (l.depense_meta_cents === null || l.payeurs_uniques === 0) return null;
  return Math.round(l.depense_meta_cents / l.payeurs_uniques);
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
// Même convention que l'export de l'historique (lib/exportHistory.ts) : BOM pour les
// accents, point-virgule, virgule décimale — ce qu'Excel attend en français.

const BOM = '﻿';
const SEP = ';';

function cellule(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function dollars(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

function pourcent(v: number | null): string {
  return v === null ? '' : (v * 100).toFixed(1).replace('.', ',');
}

export const COLONNES_TABLEAU = [
  'date',
  'nouveaux_comptes',
  'essais_demarres',
  'leads_email',
  'checkouts_inities',
  'paiements_reussis',
  'revenu_brut_cad',
  'remboursements_nb',
  'remboursements_cad',
  'revenu_net_cad',
  'payeurs_uniques',
  'depense_meta_cad',
  'essai_lead_pct',
  'lead_checkout_pct',
  'checkout_paye_pct',
  'compte_paye_pct',
] as const;

export function valeursLigne(l: Ligne): string[] {
  const t = taux(l);
  return [
    l.date,
    String(l.nouveaux_comptes),
    String(l.essais_demarres),
    String(l.leads_email),
    String(l.checkouts_inities),
    String(l.paiements_reussis),
    dollars(l.revenu_brut_cents),
    String(l.remboursements_nb),
    dollars(l.remboursements_cents),
    dollars(l.revenu_net_cents),
    String(l.payeurs_uniques),
    dollars(l.depense_meta_cents),
    pourcent(t.essai_lead),
    pourcent(t.lead_checkout),
    pourcent(t.checkout_paye),
    pourcent(t.compte_paye),
  ];
}

export function csvTableau(ls: Ligne[]): string {
  return BOM + [COLONNES_TABLEAU.join(SEP), ...ls.map(l => valeursLigne(l).map(cellule).join(SEP))].join('\r\n');
}

/** « 2026-09-24 14:05 », heure de Toronto. */
export function heureToronto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const heure = d.toLocaleTimeString('en-GB', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' });
  return `${jourToronto(d)} ${heure}`;
}

export const COLONNES_CONVERSIONS = [
  'timestamp',
  'user_id',
  'email',
  'event',
  'plan',
  'amount_cad',
  'stripe_payment_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'fbclid',
  'landing_path',
] as const;

export function valeursConversion(e: Evenement): string[] {
  return [
    heureToronto(e.t),
    e.userId ?? '',
    e.email ?? '',
    e.type,
    e.plan ? `${e.plan}${e.renouvellement ? ' (renouvellement)' : ''}` : '',
    e.montantCents === undefined ? '' : dollars(e.montantCents),
    e.stripeId ?? '',
    e.utm_source ?? '',
    e.utm_medium ?? '',
    e.utm_campaign ?? '',
    e.utm_content ?? '',
    e.fbclid ?? '',
    e.landing_path ?? '',
  ];
}

export function csvConversions(evenements: Evenement[]): string {
  return BOM + [COLONNES_CONVERSIONS.join(SEP), ...evenements.map(e => valeursConversion(e).map(cellule).join(SEP))].join('\r\n');
}
