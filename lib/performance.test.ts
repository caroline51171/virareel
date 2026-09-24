import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SANS_UTM, cacCents, csvConversions, csvTableau, filtrer, joursDe, lignes, lundiDe,
  periodeRaccourci, taux, totaux, valeursUtm, type Evenement, type Ligne,
} from './performance.ts';

// Jeu d'essai sur 2 semaines (lundi 14 → dimanche 27 septembre 2026), heures en UTC.
const EV: Evenement[] = [
  { t: '2026-09-14T15:00:00Z', type: 'signup', userId: 'u1', utm_campaign: 'test_fr', utm_content: 'reel1', utm_source: 'meta' },
  { t: '2026-09-14T15:01:00Z', type: 'first_trial', utm_campaign: 'test_fr' },
  { t: '2026-09-14T15:05:00Z', type: 'lead_email', email: 'a@b.c', utm_campaign: 'test_fr' },
  { t: '2026-09-14T15:10:00Z', type: 'initiate_checkout', userId: 'u1', plan: 'solo', utm_campaign: 'test_fr' },
  { t: '2026-09-14T15:12:00Z', type: 'purchase', userId: 'u1', client: 'cus_1', plan: 'solo', montantCents: 1900, stripeId: 'ch_1', utm_campaign: 'test_fr', utm_content: 'reel1', utm_source: 'meta' },
  // 21 h à Montréal le 15 = 01 h UTC le 16 : doit compter le 15.
  { t: '2026-09-16T01:00:00Z', type: 'purchase', userId: 'u1', client: 'cus_1', plan: 'solo', montantCents: 1900, stripeId: 'ch_2', renouvellement: true, utm_campaign: 'test_fr' },
  { t: '2026-09-16T14:00:00Z', type: 'signup', userId: 'u2' },
  { t: '2026-09-16T14:30:00Z', type: 'first_trial' },
  { t: '2026-09-22T14:00:00Z', type: 'purchase', userId: 'u2', client: 'cus_2', plan: 'creator', montantCents: 4900, stripeId: 'ch_3' },
  { t: '2026-09-23T14:00:00Z', type: 'refund', userId: 'u2', client: 'cus_2', plan: 'creator', montantCents: 4900, stripeId: 're_1' },
];
const DEUX_SEMAINES = { debut: '2026-09-14', fin: '2026-09-27' };
const TOUS = {};

// Les champs additifs : leur somme sur les lignes DOIT donner la carte.
const ADDITIFS: (keyof Ligne)[] = [
  'nouveaux_comptes', 'essais_demarres', 'leads_email', 'checkouts_inities', 'paiements_reussis',
  'revenu_brut_cents', 'remboursements_nb', 'remboursements_cents', 'revenu_net_cents', 'premiers_paiements',
];

function verifierSommes(ls: Ligne[], carte: Ligne) {
  for (const champ of ADDITIFS) {
    const somme = ls.reduce((s, l) => s + (l[champ] as number), 0);
    assert.equal(somme, carte[champ], `somme des lignes ≠ carte pour ${champ}`);
  }
}

test('somme des lignes = cartes, par jour ET par semaine, avec ou sans filtre', () => {
  for (const f of [TOUS, { utm_campaign: 'test_fr' }, { utm_campaign: SANS_UTM }]) {
    const carte = totaux(EV, DEUX_SEMAINES, f);
    verifierSommes(lignes(EV, DEUX_SEMAINES, f, 'jour'), carte);
    verifierSommes(lignes(EV, DEUX_SEMAINES, f, 'semaine'), carte);
  }
});

test('cartes : revenu brut, remboursements et net', () => {
  const c = totaux(EV, DEUX_SEMAINES, TOUS);
  assert.equal(c.paiements_reussis, 3);
  assert.equal(c.revenu_brut_cents, 8700);
  assert.equal(c.remboursements_nb, 1);
  assert.equal(c.remboursements_cents, 4900);
  assert.equal(c.revenu_net_cents, 3800);
  assert.equal(c.premiers_paiements, 2);
});

test('payeurs uniques : une personne qui paie 2 fois compte 1 sur la période', () => {
  assert.equal(totaux(EV, DEUX_SEMAINES, TOUS).payeurs_uniques, 2);
  const parJour = lignes(EV, DEUX_SEMAINES, TOUS, 'jour');
  assert.equal(parJour.find(l => l.date === '2026-09-14')!.payeurs_uniques, 1);
  assert.equal(parJour.find(l => l.date === '2026-09-15')!.payeurs_uniques, 1);
});

test('jour compté à Montréal, pas en UTC', () => {
  const l = lignes(EV, DEUX_SEMAINES, TOUS, 'jour');
  assert.equal(l.find(x => x.date === '2026-09-15')!.paiements_reussis, 1);
  assert.equal(l.find(x => x.date === '2026-09-16')!.paiements_reussis, 0);
});

test('semaine = lundi → dimanche, étiquetée par le lundi', () => {
  assert.equal(lundiDe('2026-09-27'), '2026-09-21'); // dimanche
  assert.equal(lundiDe('2026-09-21'), '2026-09-21');
  const s = lignes(EV, DEUX_SEMAINES, TOUS, 'semaine');
  assert.deepEqual(s.map(l => l.date), ['2026-09-21', '2026-09-14']);
  assert.equal(s[1].paiements_reussis, 2);
  assert.equal(s[0].paiements_reussis, 1);
});

test('tous les jours de la période ont leur ligne, même vides', () => {
  const l = lignes(EV, DEUX_SEMAINES, TOUS, 'jour');
  assert.equal(l.length, 14);
  assert.equal(l[0].date, '2026-09-27'); // plus récent en haut
});

test('filtre UTM : campagne précise, et « sans UTM »', () => {
  const avec = totaux(EV, DEUX_SEMAINES, { utm_campaign: 'test_fr' });
  assert.equal(avec.paiements_reussis, 2);
  assert.equal(avec.nouveaux_comptes, 1);
  const sans = totaux(EV, DEUX_SEMAINES, { utm_campaign: SANS_UTM });
  assert.equal(sans.paiements_reussis, 1);
  assert.equal(sans.nouveaux_comptes, 1);
  // Deux filtres ensemble = les deux conditions.
  assert.equal(totaux(EV, DEUX_SEMAINES, { utm_campaign: 'test_fr', utm_content: 'reel1' }).paiements_reussis, 1);
  assert.deepEqual(valeursUtm(EV, 'utm_campaign'), ['test_fr', SANS_UTM]);
});

test('taux : sur les 1ers paiements, et null quand la base est 0', () => {
  const t = taux(totaux(EV, DEUX_SEMAINES, TOUS));
  assert.equal(t.essai_lead, 1 / 2);
  assert.equal(t.lead_checkout, 1);
  assert.equal(t.checkout_paye, 2); // 2 premiers paiements pour 1 clic journalisé
  assert.equal(t.compte_paye, 1);
  assert.equal(taux(totaux([], DEUX_SEMAINES, TOUS)).essai_lead, null);
});

test('dépense Meta : somme par semaine, null si rien saisi, CAC = dépense ÷ payeurs', () => {
  const dep = { '2026-09-14': 10, '2026-09-15': 12.5, '2026-09-30': 99 };
  const c = totaux(EV, DEUX_SEMAINES, TOUS, dep);
  assert.equal(c.depense_meta_cents, 2250); // le 30 est hors période
  assert.equal(cacCents(c), 1125);
  const s = lignes(EV, DEUX_SEMAINES, TOUS, 'semaine', dep);
  assert.equal(s[1].depense_meta_cents, 2250);
  assert.equal(s[0].depense_meta_cents, null);
  assert.equal(cacCents(totaux(EV, DEUX_SEMAINES, TOUS)), null);
});

test('raccourcis de période, sur le jour de Montréal', () => {
  const soir = new Date('2026-09-25T02:00:00Z'); // 22 h le 24 à Montréal
  assert.deepEqual(periodeRaccourci('aujourdhui', soir), { debut: '2026-09-24', fin: '2026-09-24' });
  assert.deepEqual(periodeRaccourci('hier', soir), { debut: '2026-09-23', fin: '2026-09-23' });
  assert.deepEqual(periodeRaccourci('7jours', soir), { debut: '2026-09-18', fin: '2026-09-24' });
  assert.equal(joursDe({ debut: '2026-09-30', fin: '2026-09-01' }).length, 0);
});

test('CSV : en-têtes dans l\'ordre, virgule décimale, UTM sur la conversion', () => {
  const tab = csvTableau(lignes(EV, DEUX_SEMAINES, TOUS, 'semaine')).split('\r\n');
  assert.ok(tab[0].startsWith('﻿date;nouveaux_comptes;essais_demarres;leads_email;checkouts_inities;paiements_reussis;revenu_brut_cad'));
  assert.equal(tab.length, 3);
  assert.ok(tab[2].includes(';38,00;'));
  const conv = csvConversions(filtrer(EV, DEUX_SEMAINES, { utm_content: 'reel1' })).split('\r\n');
  assert.equal(conv.length, 3);
  assert.ok(conv[1].includes('purchase;solo;19,00;ch_1;meta;;test_fr;reel1'));
});
