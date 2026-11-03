import { appSchema, tableSchema } from '@nozbe/watermelondb'

/**
 * Réplique locale offline-first (cf. plan offline-first, Phase 3 : catalogue lecture+écriture).
 * Portée volontairement au seul catalogue produit — le stock reste un instantané en lecture seule
 * (cf. lib/stockCache.ts), jamais réécrit localement, conformément à la règle "le serveur reste seul
 * autoritaire pour la décrémentation réelle".
 *
 * Pas de tenant_id : cette base locale suit le même choix que l'outbox existant (lib/outbox.ts),
 * qui n'est pas non plus scopé par tenant — connu et accepté, à revoir si le besoin multi-boutique
 * simultané sur un même device se confirme (cf. plan, "point de friction à trancher").
 */
export const watermelonSchema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'products',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'barcode', type: 'string', isOptional: true },
        { name: 'category_id', type: 'string', isOptional: true },
        { name: 'purchase_price', type: 'number' },
        { name: 'sale_price', type: 'number' },
        { name: 'currency', type: 'string' },
        { name: 'image_url', type: 'string', isOptional: true },
        // Galerie ordonnée, JSON texte (ex. '["https://.../a.png","https://.../b.png"]') — le premier
        // élément est la couverture ci-dessus (cf. plan images multiples §2). Colonne v2.
        { name: 'image_urls', type: 'string', isOptional: true },
        // Conditionnement d'achat (unités par lot / prix d'un lot) — null = achat à l'unité. Colonnes v3. Indispensables
        // dans la réplique : la fiche produit renvoie tous les champs à l'enregistrement et une mise à jour REMPLACE le
        // conditionnement côté serveur — sans elles, modifier un article effacerait son lot.
        // Catégorie fiscale (module tax). NULL = pas encore synchronisée (lignes antérieures à la v4), '' = « automatique », sinon
        // l'id de la catégorie — cf. catalogSync.repairMissingFields. Indispensable : la fiche article renvoie tous les champs à
        // l'enregistrement et une mise à jour REMPLACE la catégorie fiscale côté serveur. Colonne v4.
        { name: 'tax_category_id', type: 'string', isOptional: true },
        { name: 'pack_size', type: 'number', isOptional: true },
        { name: 'pack_purchase_price', type: 'number', isOptional: true },
        // Coût unitaire exact (6 décimales) tel que stocké par le serveur. NULL = pas encore connu (lignes antérieures à la v5) :
        // la lecture dérive alors du lot ou du prix d'achat et catalogSync.repairMissingFields le complète. Colonne v5.
        { name: 'unit_cost', type: 'number', isOptional: true },
        { name: 'favorite', type: 'boolean' },
        { name: 'active', type: 'boolean' },
        // Timestamp serveur (epoch ms) — comparé au pull suivant pour ignorer un changement déjà
        // appliqué localement (LWW, cf. plan : "catalogue = cache donc LWW acceptable").
        { name: 'server_updated_at', type: 'number' },
      ],
    }),
  ],
})
