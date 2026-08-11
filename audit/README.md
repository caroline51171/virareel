# Audit automatisé de ViraReel

Un vrai navigateur parcourt le site **en local**, comme une cliente, et vérifie les
chiffres et les fenêtres à chaque étape. Objectif : ne plus découvrir les bugs en
production.

## Lancer l'audit

```bash
cd audit && npm run audit
```

Tout démarre tout seul (le site en local + la fausse IA) et s'arrête à la fin.
Durée : environ 14 minutes (62 vérifications). Voir le rapport détaillé avec captures :

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
| Connexion — héritage | 12 essais brûlés sans compte, puis création d'un compte : il reste **6**, jamais 18 |
| Connexion — plafond | 18 essais au total (navigateur + compte confondus), et le plafond tient après un rechargement |
| Connexion — 19e essai | le paywall, pas un message d'erreur sec |
| Connexion — compteur | le chiffre affiché descend bien à chaque génération *(actuellement au rouge, voir plus bas)* |
| Connexion — 2e compte | se déconnecter et créer un autre compte ne redonne pas d'essais *(actuellement au rouge)* |
| Historique | les 3 générations apparaissent, la plus récente en haut |
| Export TXT | nom du fichier, en-tête, hook, les 4 plateformes et les 3 variations dépliées |
| Export MD | titres Markdown, une section par plateforme et par variation, trait entre les générations |
| Export CSV | marque d'encodage (accents dans Excel), en-tête exact, **une ligne par script livré**, aucune cellule à cheval sur 2 lignes |
| Export d'une seule génération | nom de fichier daté + sujet, et le fichier ne contient que cette génération |
| Export hors Chrome | le téléchargement classique (Firefox / Safari) livre bien le fichier sur le disque |
| Ménage | supprimer une génération, puis effacer tout l'historique |
| Historique sur téléphone | rien ne dépasse en largeur *(actuellement au rouge)* |

## Les comptes de test

Le parcours « connexion » a besoin d'un compte **neuf** à chaque fois : un compte
réutilisé garderait son compteur d'une exécution à l'autre et le test ne voudrait
plus rien dire. L'audit crée donc ses comptes par l'API Clerk et **les supprime à la
fin, même quand un test échoue**. Trois précautions :

- adresses en `+clerk_test@example.com` : ce sont des adresses de test reconnues par
  Clerk, **aucun courriel réel n'est envoyé** ;
- l'audit **refuse de démarrer** si les clés Clerk ne sont pas des clés de test
  (`pk_test` / `sk_test`) — l'instance de production ne peut pas être touchée ;
- au démarrage, les comptes oubliés par une exécution interrompue (Ctrl+C) sont
  effacés. Le filtre ne porte que sur le préfixe `virareel-audit-`.

Entre deux générations d'un compte connecté, l'audit **relit le compteur inscrit sur
le compte** (chez Clerk) avant de continuer. Deux raisons : ça vérifie la
comptabilisation elle-même, et ça évite une fausse alerte — Clerk met un court
instant à rendre visible ce qu'il vient d'écrire, et l'audit enchaîne les
générations bien plus vite qu'une personne. Conséquence connue et assumée côté
site : quelqu'un qui cliquerait plusieurs fois par seconde pourrait décrocher un
essai de plus. C'est de l'ordre de quelques sous, et hors de portée d'un usage
humain normal.

## ⚠️ Les 3 vérifications actuellement au ROUGE

Ce ne sont pas des tests cassés : ce sont **trois vrais défauts trouvés le
2026-08-11**, décrits ici tant qu'ils ne sont pas corrigés.

1. **Le compteur d'un compte gratuit connecté ne descend jamais.** Il affiche 6 et
   reste à 6, génération après génération, jusqu'au paywall qui tombe sans prévenir.
   Le plafond de 18, lui, est bien respecté — c'est l'affichage qui ment.
2. **Un 2e compte dans le même navigateur redonne 6 essais**, et ainsi de suite à
   chaque nouveau compte. Même cause que le point 1 : les générations faites une fois
   connecté ne sont pas inscrites dans le compteur du navigateur.
3. **Sur téléphone (375 px), l'historique ouvert fait déborder la page de 3 px** : la
   ligne « Exporter tout / Effacer l'historique » ne rentre pas.

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
