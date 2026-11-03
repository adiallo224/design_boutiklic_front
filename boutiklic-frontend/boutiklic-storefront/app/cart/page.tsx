import { CartView } from '../../components/CartView'
import { pickLocale } from '../../lib/i18n'
import { requireSite } from '../../lib/site'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const { site } = await requireSite()
  return (
    <main className="wrap">
      <CartView locale={pickLocale(site.locale)} />
    </main>
  )
}
