import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddToCart } from '../../../components/AddToCart'
import { ContactBar } from '../../../components/ContactBar'
import { coreConfig, getProduct } from '../../../lib/core'
import { pickLocale, translate } from '../../../lib/i18n'
import { money } from '../../../lib/money'
import { findSite, requireSite } from '../../../lib/site'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const current = await findSite()
  const product = current ? await getProduct(coreConfig(), current.host, (await params).id) : null
  if (!product) return { title: 'Introuvable', robots: { index: false } }
  return {
    title: product.name,
    description: product.description?.slice(0, 160) ?? product.name,
    openGraph: { title: product.name, description: product.description?.slice(0, 160) ?? undefined, images: product.imageUrls.slice(0, 1) },
  }
}

export default async function ProductPage({ params }: Params) {
  const { host, site } = await requireSite()
  const locale = pickLocale(site.locale)
  const product = await getProduct(coreConfig(), host, (await params).id)
  if (!product) notFound()
  const images = product.imageUrls

  // Données structurées pour les moteurs de recherche: prix et devise, sans aucune donnée interne.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: images,
    offers: { '@type': 'Offer', price: product.price, priceCurrency: product.currency, availability: 'https://schema.org/InStock' },
  }

  return (
    <main className="wrap">
      <article className="product">
        <div className="gallery">
          {images[0] ? <img className="thumb" src={images[0]} alt={product.name} decoding="async" /> : <div className="thumb-empty" aria-hidden="true">📦</div>}
          {images.length > 1 ? (
            <div className="thumbs">
              {images.slice(1).map((src) => (
                <img key={src} src={src} alt="" loading="lazy" decoding="async" />
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h1>{product.name}</h1>
          <p className="big-price">
            {money(product.price, product.currency, locale)}
            {product.compareAtPrice ? <span className="compare">{money(product.compareAtPrice, product.currency, locale)}</span> : null}
          </p>
          {product.description ? <p className="description">{product.description}</p> : null}
          <AddToCart withQuantity locale={locale} product={{ id: product.id, name: product.name, imageUrl: images[0] ?? null, price: product.price, currency: product.currency }} />
          <ContactBar site={site} locale={locale} />
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </main>
  )
}
