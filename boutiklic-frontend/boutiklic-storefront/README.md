# Vitrine publique multi-sites (boutiklic-storefront)

Next.js (App Router). **Un seul processus sert toutes les boutiques**: la boutique est déduite du nom de domaine demandé (`Host`), jamais d'un paramètre ni d'un en-tête
fourni par le visiteur. Le projet est volontairement **hors des workspaces npm** de la racine (son propre `package-lock.json`) ; il lit `packages/shared` en source.

## Comment ça marche

```
navigateur ──► Caddy (TLS, X-Forwarded-For) ──► vitrine (Next) ──► gateway ──► core /api/v1/public/**
                                                  │  ▲ Host du visiteur conservé de bout en bout
                                                  └─ pages rendues côté serveur (catalogue, fiche article), relais /api/* (devis, commande, suivi)
```

* **Lecture** (accueil, fiche article, livraison): rendu serveur, données mises en cache 60 s **par boutique** (l'hôte fait partie de l'URL de cache: `_site=`, cf. `lib/core.ts`).
* **Écriture** (devis, commande, suivi, annulation): le navigateur appelle `/api/public/...` (même origine, pas de CORS); `lib/proxy.ts` relaie vers le gateway.
  **Liste blanche stricte** ; cookies, `Authorization`, `X-Tenant-ID` et `X-Client-IP` ne sont jamais transmis.
* **Aucun prix ne vient du navigateur**: le devis et la commande sont recalculés par le core. La vitrine n'envoie que (article, quantité), le mode, le lieu et le total *affiché*
  (pour détecter un changement de prix).
* **Réseaux instables**: panier en stockage local ; clé `Idempotency-Key` mémorisée pour la même demande (un nouvel essai après coupure retrouve la commande déjà créée).

## Développement

```bash
cd boutiklic-storefront && npm install
# localhost n'est la vitrine d'aucune boutique: indiquer le domaine d'une boutique de test publiée.
GATEWAY_URL=http://localhost:8080 STOREFRONT_DEV_HOST=ma-boutique.boutiklic.com npm run dev
npm test          # logique pure: panier, clé d'idempotence, proxy, client API, traductions
npm run typecheck
```

## Production

* `Dockerfile` (contexte = racine du dépôt). Variables: `GATEWAY_URL` (obligatoire), `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build, seulement si le captcha est activé côté core).
* **Ne jamais définir `STOREFRONT_DEV_HOST` en production.**
* Caddy doit : (1) router chaque domaine de boutique (sous-domaines `*.boutiklic.com` + domaines personnalisés) vers cette vitrine **en conservant le `Host`** ;
  (2) poser `X-Forwarded-For` (le proxy ne retient que la dernière entrée). Le certificat joker est le chantier E8-00 (2e moitié), non fait.
* Le core doit rester non joignable directement depuis Internet (`X-Client-IP` est posé par le gateway).

## Limites connues

* Pas de catégories ni de recherche publiques (le core ne les expose pas encore) ; pas d'indication de stock (« en stock / plus que N »).
* Un seul moyen de paiement par mode: paiement à la livraison / au retrait. Mobile Money: EPIC 6.
* Pas de thème par boutique (couleurs, logo): le core n'a pas encore de réglage de thème.
* Non testé contre un core réel dans un navigateur: tests unitaires + faux gateway HTTP local qui reproduit le contrat.
