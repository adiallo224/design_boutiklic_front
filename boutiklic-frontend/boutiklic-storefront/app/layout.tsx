import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CartProvider } from '../components/CartProvider'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { resolveAppearance, themeVars } from '../lib/appearance'
import { findSite } from '../lib/site'
import { pickLocale } from '../lib/i18n'
import './globals.css'

// Rendu à la demande: la boutique dépend du nom d'hôte de chaque requête.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const current = await findSite()
  if (!current) return { title: 'Boutique introuvable', robots: { index: false } }
  const { site } = current
  const appearance = resolveAppearance(site)
  const title = appearance.seo.title ?? site.name
  const description = appearance.seo.description ?? appearance.description ?? site.name
  const image = appearance.seo.imageUrl ?? appearance.bannerUrl ?? appearance.logoUrl
  const icon = appearance.faviconUrl ?? appearance.logoUrl
  return {
    title: { default: title, template: `%s · ${site.name}` },
    description,
    ...(appearance.seo.keywords ? { keywords: appearance.seo.keywords.split(',').map((k) => k.trim()).filter(Boolean) } : {}),
    ...(icon ? { icons: { icon } } : {}),
    openGraph: { type: 'website', siteName: site.name, title, description, ...(image ? { images: [image] } : {}) },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const current = await findSite()
  const locale = pickLocale(current?.site.locale)
  const appearance = current ? resolveAppearance(current.site) : null
  return (
    <html lang={locale}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body data-template={appearance?.template} style={appearance ? themeVars(appearance) : undefined}>
        <CartProvider>
          {current && appearance ? <SiteHeader name={current.site.name} appearance={appearance} locale={locale} /> : null}
          {children}
          {current && appearance ? <SiteFooter name={current.site.name} appearance={appearance} locale={locale} /> : null}
        </CartProvider>
      </body>
    </html>
  )
}
