import { describe, expect, it } from 'vitest'
import { CONTENT_PAGES, DEFAULT_APPEARANCE, paragraphs, isOnDeal, isPageEnabled, layoutFor, navItems, readableOn, resolveAppearance, safeMediaUrl, safeWebUrl, themeVars } from '../lib/appearance'
import type { PublicAppearance } from '../lib/types'

const full: PublicAppearance = {
  template: 'LUXURY',
  description: ' Bijoux ',
  logoUrl: '/api/v1/files/logo.png',
  faviconUrl: null,
  bannerUrl: 'https://cdn.example/banner.jpg',
  theme: { primaryColor: '#0B0B0B', secondaryColor: '#FAF7F2', accentColor: '#B8860B', buttonColor: '#B8860B', textColor: '#0B0B0B' },
  seo: { title: 'Titre', description: null, keywords: 'a, b', imageUrl: null },
  pages: ['CONTACT', 'HOME', 'FAQ', 'PRODUCTS'],
  socialLinks: [{ platform: 'INSTAGRAM', url: 'https://instagram.com/x' }],
}

describe('resolveAppearance', () => {
  it('sans apparence (core plus ancien), retombe sur l\'apparence par défaut', () => {
    expect(resolveAppearance({})).toEqual(DEFAULT_APPEARANCE)
  })
  it('reprend ce que le core envoie', () => {
    const a = resolveAppearance({ appearance: full })
    expect(a.template).toBe('LUXURY')
    expect(a.description).toBe('Bijoux')
    expect(a.theme.accentColor).toBe('#B8860B')
  })
  it('ne fait pas confiance aux couleurs, template et adresses reçus', () => {
    const a = resolveAppearance({
      appearance: {
        ...full,
        template: 'NEON' as never,
        theme: { ...full.theme, primaryColor: 'red; background:url(x)', buttonColor: '#12' },
        logoUrl: 'javascript:alert(1)',
        bannerUrl: '//evil.com/x.png',
        socialLinks: [{ platform: 'INSTAGRAM', url: 'javascript:alert(1)' }, { platform: 'TIKTOK', url: 'https://tiktok.com/@a' }],
      },
    })
    expect(a.template).toBe('MINIMAL')
    expect(a.theme.primaryColor).toBe(DEFAULT_APPEARANCE.theme.primaryColor)
    expect(a.theme.buttonColor).toBe(DEFAULT_APPEARANCE.theme.buttonColor)
    expect(a.logoUrl).toBeNull()
    expect(a.bannerUrl).toBeNull()
    expect(a.socialLinks).toEqual([{ platform: 'TIKTOK', url: 'https://tiktok.com/@a' }])
  })
})

describe('adresses', () => {
  it('seules les adresses http(s) sont des liens', () => {
    expect(safeWebUrl('https://a.com/x')).toBe('https://a.com/x')
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'a.com', '', null, undefined]) expect(safeWebUrl(bad as string)).toBeNull()
  })
  it('un média est une adresse http(s) ou un chemin du site', () => {
    expect(safeMediaUrl('/api/v1/files/a.png')).toBe('/api/v1/files/a.png')
    expect(safeMediaUrl('//evil.com/a.png')).toBeNull()
    expect(safeMediaUrl('data:image/png;base64,AA')).toBeNull()
  })
})

describe('thème', () => {
  it('choisit un texte lisible sur le fond', () => {
    expect(readableOn('#000000')).toBe('#FFFFFF')
    expect(readableOn('#FFFFFF')).toBe('#000000')
    expect(readableOn('#B8860B')).toBe('#000000')
    expect(readableOn('#1D4ED8')).toBe('#FFFFFF')
  })
  it('traduit le thème en variables CSS', () => {
    const vars = themeVars(full) as Record<string, string>
    expect(vars['--bg']).toBe('#FAF7F2')
    expect(vars['--accent']).toBe('#B8860B')
    expect(vars['--accent-text']).toBe('#000000')
    expect(vars['--brand-text']).toBe('#FFFFFF')
  })
})

describe('navigation', () => {
  it('suit l\'ordre du commerçant et ignore les pages sans contenu (FAQ...)', () => {
    expect(navItems(full).map((i) => i.code)).toEqual(['CONTACT', 'HOME', 'FAQ', 'PRODUCTS'])
  })
  it('sait si une page est activée', () => {
    expect(isPageEnabled(full, 'CONTACT')).toBe(true)
    expect(isPageEnabled(full, 'ABOUT')).toBe(false)
  })
})

describe('catalogue', () => {
  it('chaque template a sa présentation', () => {
    expect(layoutFor('FASHION')).toBe('large')
    expect(layoutFor('ELECTRONICS')).toBe('dense')
    expect(layoutFor('RESTAURANT')).toBe('list')
    expect(layoutFor('LUXURY')).toBe('spaced')
    expect(layoutFor('MINIMAL')).toBe('default')
  })
  it('une promotion est un article dont le prix barré dépasse le prix', () => {
    expect(isOnDeal({ price: 80, compareAtPrice: 100 })).toBe(true)
    expect(isOnDeal({ price: 100, compareAtPrice: 100 })).toBe(false)
    expect(isOnDeal({ price: 100, compareAtPrice: null })).toBe(false)
  })
})

describe('pages rédigées', () => {
  it('chaque page optionnelle a son adresse et son entrée de menu', () => {
    expect(CONTENT_PAGES).toEqual({ faq: 'FAQ', blog: 'BLOG', terms: 'TERMS', privacy: 'PRIVACY', returns: 'RETURNS' })
    const menu = navItems({ ...full, pages: ['FAQ', 'BLOG', 'TERMS', 'PRIVACY', 'RETURNS'] })
    expect(menu.map((i) => i.href)).toEqual(['/faq', '/blog', '/terms', '/privacy', '/returns'])
  })
  it('découpe le texte en paragraphes et ne touche pas au HTML (React l\'échappe)', () => {
    expect(paragraphs('Un\nsuite\n\n\n  Deux  \n\n')).toEqual(['Un\nsuite', 'Deux'])
    expect(paragraphs('<script>alert(1)</script>')).toEqual(['<script>alert(1)</script>'])
    expect(paragraphs('  ')).toEqual([])
  })
})
