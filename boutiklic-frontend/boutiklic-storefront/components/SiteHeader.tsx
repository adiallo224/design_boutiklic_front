import Link from 'next/link'
import type { Locale } from '@boutiklic/shared'
import { navItems } from '../lib/appearance'
import { translate } from '../lib/i18n'
import type { PublicAppearance } from '../lib/types'
import { CartLink } from './CartLink'

export function SiteHeader({ name, appearance, locale }: { name: string; appearance: PublicAppearance; locale: Locale }) {
  const items = navItems(appearance)
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href="/">
          {appearance.logoUrl ? <img className="brand-logo" src={appearance.logoUrl} alt="" /> : null}
          <span>{name}</span>
        </Link>
        <CartLink locale={locale} />
      </div>
      {items.length > 1 ? (
        <nav className="site-nav" aria-label={translate(locale, 'mainMenu')}>
          <div className="wrap">
            {items.map((item) => (
              <Link key={item.code} href={item.href}>{translate(locale, item.label)}</Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  )
}
