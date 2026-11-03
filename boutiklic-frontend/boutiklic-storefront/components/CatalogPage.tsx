import Link from 'next/link'
import { coreConfig, getProducts } from '../lib/core'
import { layoutFor } from '../lib/appearance'
import { translate } from '../lib/i18n'
import type { Locale } from '@boutiklic/shared'
import type { PublicAppearance } from '../lib/types'
import { ProductGrid } from './ProductGrid'

const PAGE_SIZE = 24

/** Liste paginée des articles (page « Produits »). */
export async function CatalogPage({ host, locale, appearance, page, basePath }: { host: string; locale: Locale; appearance: PublicAppearance; page: number; basePath: string }) {
  const products = (await getProducts(coreConfig(), host, page, PAGE_SIZE)) ?? { items: [], page, size: PAGE_SIZE, total: 0 }
  const lastPage = Math.max(0, Math.ceil(products.total / PAGE_SIZE) - 1)
  return (
    <>
      <h1>{translate(locale, 'products')}</h1>
      {products.items.length === 0 ? (
        <p className="muted">{translate(locale, 'noProducts')}</p>
      ) : (
        <ProductGrid products={products.items} locale={locale} layout={layoutFor(appearance.template)} />
      )}
      {lastPage > 0 ? (
        <nav className="pager" aria-label="pagination">
          {page > 0 ? <Link href={page === 1 ? basePath : `${basePath}?page=${page - 1}`}>← {translate(locale, 'previous')}</Link> : <span />}
          <span className="muted">{translate(locale, 'page')} {page + 1} / {lastPage + 1}</span>
          {page < lastPage ? <Link href={`${basePath}?page=${page + 1}`}>{translate(locale, 'next')} →</Link> : <span />}
        </nav>
      ) : null}
    </>
  )
}
