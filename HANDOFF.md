# HANDOFF — Tarification ViraReel

État au **2026-07-24** après le déploiement « bons prix ce soir ».

## ✅ En ligne (prod)
- Grille **verrouillée** : public **19 / 49 / 129 $ USD**, fondateur **15 / 39 / 99 $ USD**.
- **Mensuel uniquement.** Le toggle Annuel est **masqué** (chemin annuel non validé).
- Source de vérité unique : [`lib/pricing.ts`](lib/pricing.ts) (`ANNUAL_MULTIPLIER=10`, `PLANS`, dérivations). Aucun prix/% en dur ailleurs.
- Facturation alignée : [`checkout/route.ts`](app/api/checkout/route.ts) + [`founder.ts`](lib/founder.ts) → affiché = facturé (mensuel ET annuel, l'annuel étant déjà aligné ×10 mais fermé).
- Tests : `npm test` → 12/12.

## 🔒 Interrupteur unique
`ANNUAL_ENABLED` dans [`lib/pricing.ts`](lib/pricing.ts). Actuellement `false`.
- UI : `Pricing.tsx` cache le toggle Annuel.
- Serveur : `checkout/route.ts` force `billing = 'monthly'` (aucune requête annuelle, même forgée, ne passe).

## ⏭️ Reste à faire (prochaine session)

### 1. Réactiver le toggle annuel — APRÈS les 4 checkouts test
Passer `ANNUAL_ENABLED = true` **seulement une fois** ces 4 checkouts vérifiés en mode test Stripe (montant **et** intervalle) :

| Checkout | Attendu |
|---|---|
| Solo public mensuel | 19 $ · `interval=month`, `interval_count=1` |
| Solo public annuel | 190 $ · `interval=year`, `interval_count=1` |
| Creator fondateur mensuel | 39 $ · `interval=month`, `interval_count=1` |
| Creator fondateur annuel | 390 $ · `interval=year`, `interval_count=1` |

⚠️ Vérifier l'**intervalle** dans Stripe Dashboard → Subscriptions (un montant annuel avec `interval=month` débiterait chaque mois). Si un seul cloche, ne pas réactiver.

### 2. Remettre le défaut du toggle sur Annuel
Une fois l'annuel validé : `Pricing.tsx` `useState(false)` → `useState(true)` (parcours le plus rentable).

### 3. Tarif « à vie » PERSISTÉ (point 6 du ticket original, pas encore fait au sens fort)
Aujourd'hui « à vie » repose uniquement sur l'`unit_amount` figé côté Stripe à la création. À durcir : price ID Stripe dédié **ou** montant persisté en `metadata`, jamais un % recalculé au renouvellement. Vérifier qu'un fondateur qui bascule mensuel ↔ annuel garde son statut et son tarif. **Ne migrer aucun abonné existant.**

### 4. Compteur de places fondateur
Réexposer / fiabiliser le compteur `X/50` (cf. `lib/founder.ts` + `/api/founder-status`).

### 5. Garantie 14 jours
À ajouter (affichage + politique).

## ⚠️ Non vérifié
- **Nombre réel d'abonnés fondateurs actifs : INCONNU.** L'hypothèse « < 50 aujourd'hui » est une supposition, PAS une donnée Stripe. À confirmer : Stripe Dashboard → Subscriptions, filtre `status:active AND metadata['founder']:'true'`.
