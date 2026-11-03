import type { MetadataRoute } from 'next'
import { navItems, resolveAppearance } from '../lib/appearance'
import { coreConfig, getProducts } from '../lib/core'
import { findSite } from '../lib/site'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const MAX_PAGES = 20

/** Plan du site de CETTE boutique: l'accueil et ses fiches article (au plus 1000, les plus récemment classées par la boutique d'abord). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const current = await findSite()
  if (!current) return []
  const base = `https://${current.host}`
  // L'accueil, puis les autres pages que le commerçant a activées.
  const entries: MetadataRoute.Sitemap = [{ url: base }, ...navItems(resolveAppearance(current.site)).filter((p) => p.href !== '/').map((p) => ({ url: `${base}${p.href}` }))]
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await getProducts(coreConfig(), current.host, page, PAGE_SIZE)
    if (!result || result.items.length === 0) break
    entries.push(...result.items.map((p) => ({ url: `${base}/p/${encodeURIComponent(p.id)}` })))
    if ((page + 1) * PAGE_SIZE >= result.total) break
  }
  return entries
}
