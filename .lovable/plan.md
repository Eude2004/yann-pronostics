## Objectif

Aligner la plateforme avec le cahier des charges : vente à l'unité uniquement, panel admin complet, multilingue FR/EN, temps réel, et expérience d'achat sans friction pour les visiteurs.

Le travail est découpé en 6 lots indépendants qui peuvent être livrés et testés séparément.

---

## Lot 1 — Suppression des abonnements / VIP

- Retirer la route `/subscriptions` et toute UI mentionnant VIP / Plans / Abonnement (landing, dashboard, header).
- Retirer le chemin `kind: "subscription"` de `initiatePayment` et de la page `/payment/return`.
- Garder les tables `subscriptions` / `subscription_plans` en base (non destructif) mais ne plus les exposer dans l'app. *(Une migration de drop pourra être proposée plus tard si vous le souhaitez.)*
- Nettoyer `has_active_vip` côté usage (la fonction reste en DB).

## Lot 2 — Admin redirigé vers /admin + verrou d'achat

- À la connexion, si l'utilisateur a le rôle `admin`, redirection automatique vers `/admin` (au lieu de `/dashboard`).
- Bloquer côté `initiatePayment` toute tentative d'achat par un admin (sauf si **Mode Test Pay** est activé).
- Le bouton "Acheter" sur la landing est masqué/désactivé pour les admins hors mode test.

## Lot 3 — Mode Test Pay (switch admin global)

- Nouvelle clé `test_pay_mode` dans `app_settings` (booléen, défaut `false`).
- Switch dans **Paramètres du site** du panel admin pour l'activer/désactiver.
- Quand actif :
  - `initiatePayment` court-circuite CinetPay même si les clés sont configurées et marque la transaction `notes = "Mode Test Pay"`.
  - L'admin peut acheter et tester le déblocage de bout en bout.
- Badge visible "MODE TEST" dans le header quand activé pour éviter toute confusion.

## Lot 4 — Pop-up rétention visiteur

- Après un téléchargement réussi de la vidéo d'un coupon par un visiteur **non connecté**, affichage d'une modale :  
  *"Pour ne pas perdre vos données et sécuriser vos achats, créez un compte dès maintenant."*
- Boutons : "Créer un compte" → `/auth`, "Plus tard" → ferme.
- Mémorisation dans `localStorage` pour ne pas réafficher en boucle dans la même session.

## Lot 5 — Multilingue FR/EN

- Installation de `i18next` + `react-i18next` + détection navigateur.
- Deux dictionnaires : `fr.json` (par défaut) et `en.json`.
- Couverture : header, landing, auth, dashboard, admin, paiement, toasts principaux.
- Sélecteur de langue (FR/EN) dans le header à côté du toggle de thème.
- Préférence persistée dans `localStorage` et — pour les utilisateurs connectés — dans `profiles.locale` (nouvelle colonne) synchronisée multi-appareils comme le thème.

## Lot 6 — Temps réel (Supabase Realtime)

- Activer la publication realtime sur `transactions`, `coupons`, `profiles`.
- **Côté utilisateur** : la page `/payment/return` écoute l'update de sa transaction (au lieu du polling 3s) → déblocage instantané. `/dashboard` se met à jour live quand un nouveau coupon est débloqué.
- **Côté admin** : tableau de bord (CA, nombre d'utilisateurs, ventes) se met à jour sans refresh via abonnements sur `transactions` et `profiles`.

---

## Détails techniques

- **DB** : 1 migration unique ajoutant `app_settings.test_pay_mode` (via insert d'une ligne `key='test_pay_mode'`), `profiles.locale TEXT DEFAULT 'fr'`, et `ALTER PUBLICATION supabase_realtime ADD TABLE` pour les 3 tables ciblées.
- **Server fns modifiés** : `initiatePayment` (check admin + test_pay_mode), nouvelle `updateLocalePreference`, `setTestPayMode` (admin-only).
- **Routes touchées** : `src/routes/index.tsx`, `_authenticated/dashboard.tsx`, `_authenticated/admin.tsx`, `_authenticated/payment.return.tsx`, `auth.tsx`. Suppression de `_authenticated/subscriptions.tsx`.
- **Nouveaux composants** : `LanguageToggle`, `TestPayBadge`, `VisitorSignupPrompt` modale, `AdminSettingsPanel` (extension).
- **Hooks** : `use-realtime-transactions`, `use-i18n` wrapper.

---

## Ordre proposé

1. Lot 1 + Lot 2 (cohérents ensemble, peu de risque)
2. Lot 3 (Mode Test Pay)
3. Lot 6 (Realtime — débloque l'UX paiement)
4. Lot 4 (Pop-up visiteur)
5. Lot 5 (i18n — gros volume de strings, à faire en dernier)

Confirmez-vous cet ordre, ou souhaitez-vous prioriser un lot en particulier (ex : commencer par i18n, ou faire d'abord Realtime) ?
