import type { Locale } from '@boutiklic/shared'
import { digitsOnly } from '../lib/money'
import { translate } from '../lib/i18n'
import type { PublicStorefront } from '../lib/types'

export function ContactBar({ site, locale }: { site: PublicStorefront; locale: Locale }) {
  const whatsapp = site.contactWhatsapp ? digitsOnly(site.contactWhatsapp) : ''
  if (!site.contactPhone && !whatsapp) return null
  return (
    <section aria-label={translate(locale, 'contact')} className="contact">
      {site.contactPhone ? <a className="btn secondary" href={`tel:${site.contactPhone.replace(/[^+\d]/g, '')}`}>📞 {translate(locale, 'call')}</a> : null}
      {whatsapp ? <a className="btn secondary" href={`https://wa.me/${whatsapp}`} rel="noopener noreferrer" target="_blank">💬 {translate(locale, 'whatsapp')}</a> : null}
    </section>
  )
}
