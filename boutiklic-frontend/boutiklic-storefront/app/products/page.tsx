import { CatalogPage } from '../../components/CatalogPage'
import { ContactBar } from '../../components/ContactBar'
import { resolveAppearance } from '../../lib/appearance'
import { pickLocale } from '../../lib/i18n'
import { requireSite } from '../../lib/site'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { host, site } = await requireSite()
  const locale = pickLocale(site.locale)
  const page = Math.max(0, Number.parseInt((await searchParams).page ?? '0', 10) || 0)
  return (
    <main className="wrap">
      <CatalogPage host={host} locale={locale} appearance={resolveAppearance(site)} page={page} basePath="/products" />
      <ContactBar site={site} locale={locale} />
    </main>
  )
}
