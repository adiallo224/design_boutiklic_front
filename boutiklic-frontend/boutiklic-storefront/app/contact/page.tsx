import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContactBar } from '../../components/ContactBar'
import { isPageEnabled, resolveAppearance } from '../../lib/appearance'
import { pickLocale, translate } from '../../lib/i18n'
import { requireSite } from '../../lib/site'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await requireSite()
  return { title: translate(pickLocale(site.locale), 'pageContact') }
}

export default async function ContactPage() {
  const { site } = await requireSite()
  const locale = pickLocale(site.locale)
  if (!isPageEnabled(resolveAppearance(site), 'CONTACT')) notFound()
  return (
    <main className="wrap">
      <h1>{translate(locale, 'pageContact')}</h1>
      {site.contactPhone ? <p>📞 <a href={`tel:${site.contactPhone.replace(/[^+\d]/g, '')}`}>{site.contactPhone}</a></p> : null}
      {site.contactEmail ? <p>✉️ <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></p> : null}
      <ContactBar site={site} locale={locale} />
    </main>
  )
}
