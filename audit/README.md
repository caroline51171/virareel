# Audit automatisé de ViraReel

Un vrai navigateur parcourt le site **en local**, comme une cliente, et vérifie les
chiffres et les fenêtres à chaque étape. Objectif : ne plus découvrir les bugs en
production.

## Lancer l'audit

```bash
cd audit && npm run audit
```

Tout démarre tout seul (le site en local + la fausse IA) et s'arrête à la fin.
Durée : environ 3 minutes. Voir le rapport détaillé avec captures :

```bash
cd audit && npm run rapport
```

## Pourquoi ça ne coûte rien

L'appel à Claude est détourné vers un petit serveur local (`mock-ai.mjs`) qui répond
du faux contenu au bon format. Trois verrous empêchent toute facture :

1. `ANTHROPIC_BASE_URL` pointe sur `127.0.0.1` (dans `playwright.config.ts`) ;
2. la clé API est remplacée par une fausse clé — même en cas d'erreur d'adresse,
   aucun appel payant ne peut aboutir ;
3. Clerk et Stripe tournent sur les clés de **test** du `.env.local`.

**Aucune ligne du site n'est modifiée pour l'audit.** Le site ne sait pas qu'il est
audité ; c'est son vrai code qui répond, y compris `app/api/generate/route.ts`.

Le site tourne sur le port **3100** (pas 3000) pour ne pas se mélanger avec un
`npm run dev` déjà ouvert. Rien ne touche virareelai.com.

## Ce qui est vérifié aujourd'hui

En **375 px (téléphone) et 1280 px (portable)**, en **français et en anglais** :

| Parcours | Ce qui est vérifié |
|---|---|
| Accueil | s'affiche, rien ne dépasse en largeur, le bouton principal tient dans l'écran et mène au générateur |
| Compteur neuf | un visiteur neuf voit bien **12** essais (jamais 18) |
| 1 plateforme | coûte 1 essai, le résultat s'affiche |
| 3 variations | coûtent 3 essais |
| 4 plateformes | coûtent 4 essais et livrent **4** résultats |
| Demande trop chère | 3 essais restants pour une demande à 4 → fenêtre de conseil, **pas** le paywall, et **rien n'est consommé** |
| Mur du courriel | à 0 essai sans courriel : la fenêtre du courriel, jamais le paywall |
| Les 6 bonus | le courriel débloque 6 essais **et relance tout seul** la demande interrompue |
| Vrai zéro | paywall avec le chiffre réel (18) et le lien vers les forfaits |
| Accueil au vrai zéro | le texte sous le bouton change et « Voir les forfaits » ouvre **la** fenêtre du générateur |
| Fenêtres | chaque fenêtre bloquante tient dans l'écran (mesurée, pas devinée) |
| 4 idées — champ vide | bloqué avant tout appel au serveur, et la fermeture ramène au champ à remplir |
| 4 idées — avertissement | « restez sur cette page » n'apparaît que **pendant** la génération, et le bouton reste visible |
| Essai bonus | 4 idées × 4 plateformes = **16 résultats, 0 essai déduit** ; le message vert allume les 4 plateformes |
| Essai bonus — une fois | le lot suivant est bien facturé (4 essais), l'invitation verte disparaît |
| Essai bonus — 1 plateforme | 4 idées × 1 plateforme est gratuit aussi (le bonus couvre tout le lot) |
| Transcréation | coût annoncé avant le clic, réécriture livrée, **1 essai**, original toujours accessible |
| Forfaits | 3 cartes dans l'ordre Solo / Creator / **Agency**, prix mensuels conformes à `lib/pricing.ts` |
| Forfaits — annuel | chaque prix annuel est exactement le mensuel × 10 |
| Paiement | le bouton crée une vraie session Stripe (mode test) ; **la page de paiement est bloquée**, rien n'est payé |

## Ce qui n'est PAS encore vérifié

À ajouter : connexion (compte gratuit connecté qui hérite du compteur), historique
et export TXT/MD/CSV.

## ⚠️ Ne rien modifier pendant que l'audit tourne

Le site tourne en mode développement : enregistrer un fichier du projet le fait
recompiler en pleine course, et des pages répondent alors « 404 » — ce qui produit
de faux échecs. Lancer l'audit, le laisser finir, puis reprendre le travail.

## Ce que l'audit ne saura jamais juger

Le **goût** : placement, ton, choix de couleurs, qualité du texte généré. Ça reste
humain. L'audit dit « le chiffre est faux » ou « la fenêtre dépasse », pas « c'est laid ».

## Si un test échoue

Le rapport contient une **capture d'écran** et une **vidéo** du moment exact de
l'échec. Un échec veut dire une chose de deux : soit le site a un vrai problème,
soit un texte du site a changé — dans ce cas, les textes attendus sont regroupés
en haut de `tests/helpers.ts` (objet `T`), et c'est le seul endroit à corriger.
