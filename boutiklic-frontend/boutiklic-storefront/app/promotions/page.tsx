import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductGrid } from '../../components/ProductGrid'
import { isOnDeal, isPageEnabled, layoutFor, resolveAppearance } from '../../lib/appearance'
import { coreConfig, getProducts } from '../../lib/core'
import { pickLocale, translate } from '../../lib/i18n'
import { requireSite } from '../../lib/site'
import type { PublicProduct } from '../../lib/types'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const MAX_PAGES = 4

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await requireSite()
  return { title: translate(pickLocale(site.locale), 'pagePromotions') }
}

/** Les articles dont le prix barré est supérieur au prix affiché (parmi les MAX_PAGES × PAGE_SIZE premiers articles du catalogue). */
export default async function PromotionsPage() {
  const { host, site } = await requireSite()
  const locale = pickLocale(site.locale)
  const appearance = resolveAppearance(site)
  if (!isPageEnabled(appearance, 'PROMOTIONS')) notFound()

  const deals: PublicProduct[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await getProducts(coreConfig(), host, page, PAGE_SIZE)
    if (!result) break
    deals.push(...result.items.filter(isOnDeal))
    if ((page + 1) * PAGE_SIZE >= result.total) break
  }

  return (
    <main className="wrap">
      <h1>{translate(locale, 'pagePromotions')}</h1>
      {deals.length === 0 ? <p className="muted">{translate(locale, 'noPromotions')}</p> : <ProductGrid products={deals} locale={locale} layout={layoutFor(appearance.template)} />}
    </main>
  )
}
