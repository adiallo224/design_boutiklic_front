import Link from 'next/link'
import { ContactBar } from '../components/ContactBar'
import { Hero } from '../components/Hero'
import { ProductGrid } from '../components/ProductGrid'
import { layoutFor, resolveAppearance } from '../lib/appearance'
import { coreConfig, getProducts } from '../lib/core'
import { pickLocale, translate } from '../lib/i18n'
import { requireSite } from '../lib/site'

export const dynamic = 'force-dynamic'

const FEATURED = 8

/** Accueil: bandeau du template, puis les premiers articles et un lien vers tout le catalogue (page « Produits »). */
export default async function Home() {
  const { host, site } = await requireSite()
  const locale = pickLocale(site.locale)
  const appearance = resolveAppearance(site)
  const products = (await getProducts(coreConfig(), host, 0, FEATURED)) ?? { items: [], page: 0, size: FEATURED, total: 0 }

  return (
    <>
      <Hero name={site.name} appearance={appearance} />
      <main className="wrap">
        <h2>{translate(locale, 'products')}</h2>
        {products.items.length === 0 ? (
          <p className="muted">{translate(locale, 'noProducts')}</p>
        ) : (
          <ProductGrid products={products.items} locale={locale} layout={layoutFor(appearance.template)} />
        )}
        {products.total > products.items.length ? (
          <p className="center-link"><Link className="btn secondary inline" href="/products">{translate(locale, 'viewAll')}</Link></p>
        ) : null}
        <ContactBar site={site} locale={locale} />
      </main>
    </>
  )
}
