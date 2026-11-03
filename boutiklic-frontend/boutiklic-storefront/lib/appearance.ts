/**
 * Apparence d'une vitrine: ce que le commerçant a configuré (template, couleurs, pages, réseaux sociaux), traduit en ce que la vitrine affiche. Tout ce qui vient du core est
 * revalidé ici (couleurs, adresses): la vitrine ne fait pas confiance à une valeur qu'elle va injecter dans une feuille de style ou un lien.
 */
import type { CSSProperties } from 'react'
import type { MessageKey } from './i18n'
import type { PageCode, PublicAppearance, PublicProduct, PublicStorefront, TemplateCode } from './types'

export const DEFAULT_APPEARANCE: PublicAppearance = {
  template: 'MINIMAL',
  description: null,
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  theme: { primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#2563EB', buttonColor: '#111827', textColor: '#111827' },
  seo: { title: null, description: null, keywords: null, imageUrl: null },
  pages: ['HOME', 'PRODUCTS', 'PROMOTIONS', 'CONTACT', 'ABOUT'],
  socialLinks: [],
}

const TEMPLATES: readonly TemplateCode[] = ['FASHION', 'ELECTRONICS', 'RESTAURANT', 'LUXURY', 'MINIMAL']
const HEX = /^#[0-9a-f]{6}$/i

/** L'apparence du site, avec l'apparence par défaut pour tout ce qui manque ou est invalide (core plus ancien, valeur corrompue). */
export function resolveAppearance(site: Pick<PublicStorefront, 'appearance'>): PublicAppearance {
  const a = site.appearance
  if (!a) return DEFAULT_APPEARANCE
  const color = (value: string | undefined, fallback: string) => (value && HEX.test(value) ? value : fallback)
  const d = DEFAULT_APPEARANCE.theme
  return {
    template: TEMPLATES.includes(a.template) ? a.template : 'MINIMAL',
    description: a.description?.trim() || null,
    logoUrl: safeMediaUrl(a.logoUrl),
    faviconUrl: safeMediaUrl(a.faviconUrl),
    bannerUrl: safeMediaUrl(a.bannerUrl),
    theme: {
      primaryColor: color(a.theme?.primaryColor, d.primaryColor),
      secondaryColor: color(a.theme?.secondaryColor, d.secondaryColor),
      accentColor: color(a.theme?.accentColor, d.accentColor),
      buttonColor: color(a.theme?.buttonColor, d.buttonColor),
      textColor: color(a.theme?.textColor, d.textColor),
    },
    seo: {
      title: a.seo?.title?.trim() || null,
      description: a.seo?.description?.trim() || null,
      keywords: a.seo?.keywords?.trim() || null,
      imageUrl: safeMediaUrl(a.seo?.imageUrl),
    },
    pages: Array.isArray(a.pages) && a.pages.length > 0 ? a.pages : DEFAULT_APPEARANCE.pages,
    socialLinks: (a.socialLinks ?? []).filter((l) => safeWebUrl(l.url) !== null),
  }
}

/** Adresse http(s) seulement (jamais « javascript: » ni « data: »), sinon null. */
export function safeWebUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Média: adresse http(s) ou chemin du site (« /api/... »), sinon null. */
export function safeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/') && !url.startsWith('//')) return url
  return safeWebUrl(url)
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Noir ou blanc, selon ce qui se lit le mieux sur cette couleur de fond (0,179 = luminance où le contraste WCAG avec le noir égale celui avec le blanc). */
export function readableOn(background: string): '#000000' | '#FFFFFF' {
  return luminance(background) > 0.179 ? '#000000' : '#FFFFFF'
}

/** Variables CSS posées sur le <body>; la feuille de style en déduit surfaces, bordures et textes secondaires. Fond clair forcé: les couleurs choisies le supposent. */
export function themeVars(appearance: PublicAppearance): CSSProperties {
  const t = appearance.theme
  return {
    '--bg': t.secondaryColor,
    '--text': t.textColor,
    '--brand': t.primaryColor,
    '--brand-text': readableOn(t.primaryColor),
    '--highlight': t.accentColor,
    '--accent': t.buttonColor,
    '--accent-text': readableOn(t.buttonColor),
    colorScheme: 'light',
  } as CSSProperties
}

/** Les pages que la vitrine sait afficher, avec leur adresse et leur libellé. Le core ne liste une page optionnelle (FAQ, blog...) que si elle est activée ET rédigée. */
export const RENDERED_PAGES: Partial<Record<PageCode, { href: string; label: MessageKey }>> = {
  HOME: { href: '/', label: 'pageHome' },
  PRODUCTS: { href: '/products', label: 'pageProducts' },
  PROMOTIONS: { href: '/promotions', label: 'pagePromotions' },
  CONTACT: { href: '/contact', label: 'pageContact' },
  ABOUT: { href: '/about', label: 'pageAbout' },
  FAQ: { href: '/faq', label: 'pageFaq' },
  BLOG: { href: '/blog', label: 'pageBlog' },
  TERMS: { href: '/terms', label: 'pageTerms' },
  PRIVACY: { href: '/privacy', label: 'pagePrivacy' },
  RETURNS: { href: '/returns', label: 'pageReturns' },
}

/** Pages optionnelles dont le texte est rédigé par le commerçant, par adresse (« /faq » → FAQ). */
export const CONTENT_PAGES: Record<string, PageCode> = { faq: 'FAQ', blog: 'BLOG', terms: 'TERMS', privacy: 'PRIVACY', returns: 'RETURNS' }

/** Paragraphes d'un texte brut (séparés par une ligne vide). Aucun HTML n'est interprété: React échappe le texte. */
export function paragraphs(body: string): string[] {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}

export function navItems(appearance: PublicAppearance): { code: PageCode; href: string; label: MessageKey }[] {
  return appearance.pages.flatMap((code) => {
    const page = RENDERED_PAGES[code]
    return page ? [{ code, ...page }] : []
  })
}

export function isPageEnabled(appearance: PublicAppearance, code: PageCode): boolean {
  return appearance.pages.includes(code)
}

/** Présentation des articles propre à chaque template (grille serrée, grandes vignettes, liste...). */
export type CatalogLayout = 'default' | 'large' | 'dense' | 'list' | 'spaced'

export function layoutFor(template: TemplateCode): CatalogLayout {
  switch (template) {
    case 'FASHION':
      return 'large'
    case 'ELECTRONICS':
      return 'dense'
    case 'RESTAURANT':
      return 'list'
    case 'LUXURY':
      return 'spaced'
    default:
      return 'default'
  }
}

/** Un article est en promotion quand son ancien prix barré est supérieur au prix affiché. */
export function isOnDeal(product: Pick<PublicProduct, 'price' | 'compareAtPrice'>): boolean {
  return product.compareAtPrice !== null && product.compareAtPrice > product.price
}
