import { TrackingView } from '../../../components/TrackingView'
import { pickLocale } from '../../../lib/i18n'
import { requireSite } from '../../../lib/site'

export const dynamic = 'force-dynamic'

// Le jeton de suivi est dans l'URL (`?t=`): il est lu ici et transmis au composant, jamais journalisé ni envoyé en référent (cf. en-têtes dans next.config.ts).
export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { site } = await requireSite()
  const { number } = await params
  const { t } = await searchParams
  return (
    <main className="wrap">
      <meta name="robots" content="noindex" />
      <TrackingView locale={pickLocale(site.locale)} orderNumber={number} token={t ?? ''} />
    </main>
  )
}
