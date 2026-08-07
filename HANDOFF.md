# HANDOFF — Tarification ViraReel

État au **2026-08-07**. Le chantier tarification est **terminé** ; ce qui suit est
l'état de référence, pas une liste de tâches.

## ✅ En ligne (prod)

- Grille **verrouillée** : public **19 / 49 / 129 $**, fondateur **15 / 39 / 99 $**.
- Devise **CAD** (depuis le 2026-08-05) + **Adaptive Pricing** Stripe activé
  (conversion automatique pour les visiteurs hors Canada).
- **Mensuel ET annuel actifs.** `ANNUAL_ENABLED = true`. Annuel = mensuel × 10
  (2 mois offerts), même formule pour le public et le fondateur.
- Toggle Tarifs : **défaut MENSUEL** (`Pricing.tsx`, `useState(false)`).
- **Source de vérité unique : [`lib/pricing.ts`](lib/pricing.ts).** Tout en dérive —
  l'affichage ET les montants réellement facturés à Stripe
  ([`checkout/route.ts`](app/api/checkout/route.ts) via `PRICING_BY_KEY` + `toCents`,
  [`founder.ts`](lib/founder.ts)). **Aucun prix ni % en dur ailleurs.**
- Tests : `npm test` → 12/12.

### ⚠️ Règle à respecter
Tout nouveau montant Stripe **doit** dériver de `lib/pricing.ts`. Ne jamais
réécrire un prix en dur dans une route — c'était la cause de la dette remboursée
le 2026-08-07 (commit `49dadd1`) : affiché et facturé pouvaient diverger.

## 🔒 Offre fondateur — « à vie »

**Aucun travail requis, ne pas rouvrir.** Stripe fige l'`unit_amount` sur
l'abonnement à sa création : le tarif fondateur est donc déjà permanent, sans
price ID dédié ni metadata supplémentaire.

- **« À vie » = sur le FORFAIT SOUSCRIT**, non transférable en cas de changement
  de forfait (règle publiée : carte de forfait, FAQ, CGV section 2).
- **Ne PAS créer de prix fondateur au catalogue Stripe** : ça permettrait à un
  fondateur de changer de forfait en gardant le tarif fondateur — contraire à la
  règle ci-dessus.
- **Ne PAS créer de 2e configuration du portail réservée aux fondateurs** :
  quand un fondateur change de forfait via le portail et perd son tarif, c'est
  exactement ce que la politique annonce. La bloquer obligerait à gérer les
  upgrades à la main.
- Angle mort résiduel **assumé** : passer mensuel ↔ annuel sur le *même* forfait
  fait aussi perdre le tarif fondateur.
- Race condition (2 paiements simultanés sur la dernière place → 51 fondateurs) :
  **décision de ne pas corriger**, prise le 2026-08-07.

## ⏭️ Reste à faire (facultatif, aucun blocage)

1. **Confirmer un vrai checkout annuel payé en prod** (nécessite que Caroline
   saisisse une carte). Montants et intervalles déjà validés en mode test.
2. **Compteur de places jamais vu bouger.** `/api/founder-status` renvoyait
   `{total:50, claimed:0, remaining:50, open:true}` le 2026-08-07 — logique
   correcte mais jamais exercée avec un abonné réel. Test possible en mode Test
   Stripe (`sk_test_`) : créer un faux abonnement marqué `founder`, vérifier que
   `claimed` passe à 1, puis l'annuler.

## ❌ Abandonné (ne plus proposer)

- **Garantie 14 jours** — annulée par la politique de remboursement du
  2026-08-05 (CGV section 5). Pas de garantie formelle : les essais gratuits
  servent à tester avant d'acheter.
- **Garantie 100 % remboursement** — rejetée après recherche (référence Spotify).

## 💡 Rappel utile

Rembourser un paiement Stripe **n'annule pas** l'abonnement — ce sont deux
actions distinctes (Payments → Refund, et Subscriptions → Cancel). Si le
compteur de fondateurs monte sans vrai client, chercher des abonnements de test
encore `active`.

Pour tester la page de succès **sans payer** : `virareelai.com/success?plan=solo`
(ou `creator` / `pro`).
