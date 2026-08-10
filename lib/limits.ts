// SOURCE UNIQUE des plafonds d'essai gratuit — lisible par le SERVEUR et par le NAVIGATEUR.
//
// Ce fichier ne doit JAMAIS importer quoi que ce soit (surtout pas `next/server`) : c'est
// ce qui permet à `components/Generator.tsx` de lire les mêmes nombres que les routes API.
// Avant, le total était écrit en double (lib/anonTracking.ts ET Generator.tsx) et rien
// n'empêchait les deux de diverger.

// Essais offerts sans RIEN demander (ni courriel, ni carte). C'est le seul chiffre annoncé
// publiquement sur le site.
export const EMAIL_GATE_LIMIT = 12;

// Total après le mur du courriel : 12 + 6. Le « 18 » n'est jamais annoncé à l'avance —
// les 6 se révèlent dans la fenêtre du courriel, comme un bonus.
export const ANON_LIMIT = 18;

// Plafond À VIE d'un compte gratuit connecté. Volontairement identique au total anonyme :
// un compte n'est pas un forfait gratuit, c'est la SUITE des mêmes essais (le compteur du
// navigateur est hérité via anonUsedFromRequest, donc jamais 18 + 18).
export const FREE_ACCOUNT_LIMIT = ANON_LIMIT;

// Essai bonus « 4 idées × 4 plateformes » : la combo coûte 16 crédits, soit plus que les
// essais offerts, donc elle est offerte UNE fois par navigateur. Compté en CRÉDITS parce
// que la combo arrive en 4 requêtes successives (une par idée) — le bonus doit couvrir les 4.
export const MULTI_BONUS_CREDITS = 16;
