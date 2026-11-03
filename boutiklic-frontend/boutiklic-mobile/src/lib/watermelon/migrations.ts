import { schemaMigrations, addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations'

/** v1 → v2 : galerie d'images (cf. plan images multiples §2). Après l'ajout de la colonne, les
 *  lignes déjà en cache reprennent leur couverture comme galerie d'un élément — même choix que la
 *  migration Dexie miroir (cf. boutiklic-frontend/src/lib/dexie/database.ts) : sans ça, un article
 *  déjà répliqué localement afficherait une galerie vide jusqu'à son prochain ProductUpdatedEvent.
 *  SQL brut (pas de json1 requis) : replace() échappe backslash puis guillemet avant de les entourer
 *  d'un tableau JSON à un élément. */
export const watermelonMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'products',
          columns: [{ name: 'image_urls', type: 'string', isOptional: true }],
        }),
        unsafeExecuteSql(`
          UPDATE products
          SET image_urls = '["' || replace(replace(image_url, '\\', '\\\\'), '"', '\\"') || '"]'
          WHERE image_url IS NOT NULL AND image_url != ''
        `),
      ],
    },
    // v2 → v3 : conditionnement d'achat (étude prix décimaux, phase 2). Purement additif : aucun lot n'existait avant
    // cette version, donc null (achat à l'unité) est exact pour toutes les lignes déjà en cache — pas de rétro-remplissage.
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'products',
          columns: [
            { name: 'pack_size', type: 'number', isOptional: true },
            { name: 'pack_purchase_price', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // v3 → v4 : catégorie fiscale. Purement additif ; les lignes déjà en cache restent à NULL (« pas encore synchronisée ») et sont
    // complétées au prochain démarrage en ligne par catalogSync.repairMissingFields — sans vider le catalogue, qui doit rester
    // disponible hors ligne.
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'products',
          columns: [{ name: 'tax_category_id', type: 'string', isOptional: true }],
        }),
      ],
    },
    // v4 → v5 : coût unitaire exact (étude prix décimaux, phase 7e). Purement additif ; les lignes déjà en cache restent à NULL
    // (« pas encore connu ») et sont complétées au prochain démarrage en ligne par catalogSync.repairMissingFields.
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'products',
          columns: [{ name: 'unit_cost', type: 'number', isOptional: true }],
        }),
      ],
    },
  ],
})
