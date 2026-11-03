import type { MetadataRoute } from 'next'
import { currentHost } from '../lib/site'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await currentHost()
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/cart', '/checkout', '/order/', '/api/'] },
    ...(host ? { sitemap: `https://${host}/sitemap.xml` } : {}),
  }
}
