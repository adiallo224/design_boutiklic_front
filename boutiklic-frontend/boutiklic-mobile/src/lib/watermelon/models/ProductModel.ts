import { Model } from '@nozbe/watermelondb'
import { field, json, text } from '@nozbe/watermelondb/decorators'

const sanitizeImageUrls = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string') : [])

export default class ProductModel extends Model {
  static table = 'products'

  @text('name') name!: string
  @text('barcode') barcode!: string | null
  @text('category_id') categoryId!: string | null
  @field('purchase_price') purchasePrice!: number
  @field('sale_price') salePrice!: number
  @text('currency') currency!: string
  @text('image_url') imageUrl!: string | null
  /** Galerie ordonnée — colonne v2, cf. migrations.ts. Lignes migrées depuis v1 (jamais écrites
   *  depuis) : tombe sur un tableau vide, jamais sur image_url seul, pour ne pas fabriquer un ordre
   *  qui n'existait pas ; recalée à la prochaine synchro (cf. catalogSync.ts). */
  @json('image_urls', sanitizeImageUrls) imageUrls!: string[]
  /** Catégorie fiscale — colonne v4. NULL = pas encore synchronisée, '' = « automatique », sinon l'id (cf. catalogSync). */
  @text('tax_category_id') taxCategoryId!: string | null
  /** Conditionnement d'achat — colonnes v3, cf. migrations.ts. null = achat à l'unité. */
  @field('pack_size') packSize!: number | null
  @field('pack_purchase_price') packPurchasePrice!: number | null
  /** Coût unitaire exact stocké par le serveur — colonne v5. NULL = pas encore connu (cf. catalogSync.repairMissingFields). */
  @field('unit_cost') unitCost!: number | null
  @field('favorite') favorite!: boolean
  @field('active') active!: boolean
  @field('server_updated_at') serverUpdatedAt!: number
}
