import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isPageEnabled, resolveAppearance } from '../../lib/appearance'
import { pickLocale, translate } from '../../lib/i18n'
import { requireSite } from '../../lib/site'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await requireSite()
  return { title: translate(pickLocale(site.locale), 'pageAbout') }
}

export default async function AboutPage() {
  const { site } = await requireSite()
  const locale = pickLocale(site.locale)
  const appearance = resolveAppearance(site)
  if (!isPageEnabled(appearance, 'ABOUT')) notFound()
  return (
    <main className="wrap">
      <h1>{translate(locale, 'pageAbout')}</h1>
      {appearance.description ? <p className="description">{appearance.description}</p> : <p className="muted">{translate(locale, 'noAbout')}</p>}
    </main>
  )
}
