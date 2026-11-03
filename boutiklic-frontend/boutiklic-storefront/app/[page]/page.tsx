import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CONTENT_PAGES, RENDERED_PAGES, paragraphs } from '../../lib/appearance'
import { coreConfig, getPage } from '../../lib/core'
import { pickLocale, translate } from '../../lib/i18n'
import { requireSite } from '../../lib/site'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ page: string }> }

/** Pages optionnelles rédigées par le commerçant (FAQ, blog, CGV, confidentialité, retours). Toute autre adresse, page désactivée ou sans contenu: la page 404 neutre. */
async function load(params: Params['params']) {
  const { host, site } = await requireSite()
  const code = CONTENT_PAGES[(await params).page]
  if (!code) notFound()
  const content = await getPage(coreConfig(), host, code)
  if (!content) notFound()
  return { locale: pickLocale(site.locale), code, content }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, code } = await load(params)
  return { title: translate(locale, RENDERED_PAGES[code]!.label) }
}

export default async function ContentPage({ params }: Params) {
  const { locale, code, content } = await load(params)
  return (
    <main className="wrap">
      <h1>{translate(locale, RENDERED_PAGES[code]!.label)}</h1>
      <div className="description">
        {paragraphs(content.body).map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
    </main>
  )
}
