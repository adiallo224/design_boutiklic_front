import { findSite } from '../lib/site'
import { pickLocale, translate } from '../lib/i18n'

/** Page neutre: adresse inconnue, boutique non publiée ou suspendue, article ou commande introuvable. Elle ne révèle rien de plus. */
export default async function NotFound() {
  const locale = pickLocale((await findSite())?.site.locale)
  return (
    <main className="wrap center">
      <h1>{translate(locale, 'notFoundTitle')}</h1>
      <p className="muted">{translate(locale, 'notFoundText')}</p>
    </main>
  )
}
