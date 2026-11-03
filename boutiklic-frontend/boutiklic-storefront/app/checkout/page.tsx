import { CheckoutForm } from '../../components/CheckoutForm'
import { coreConfig, getDelivery } from '../../lib/core'
import { pickLocale } from '../../lib/i18n'
import { requireSite } from '../../lib/site'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const { host, site } = await requireSite()
  const delivery = (await getDelivery(coreConfig(), host)) ?? { zones: [], pickupPoints: [] }
  return (
    <main className="wrap">
      <CheckoutForm locale={pickLocale(site.locale)} delivery={delivery} captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />
    </main>
  )
}
