import type { Locale } from '@boutiklic/shared'
import type { CatalogLayout } from '../lib/appearance'
import type { PublicProduct } from '../lib/types'
import { ProductCard } from './ProductCard'

/** La présentation (grille serrée, grandes vignettes, liste...) vient du template et est appliquée par la feuille de style via `data-layout`. */
export function ProductGrid({ products, locale, layout }: { products: PublicProduct[]; locale: Locale; layout: CatalogLayout }) {
  return (
    <ul className="grid" data-layout={layout}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} />
      ))}
    </ul>
  )
}
