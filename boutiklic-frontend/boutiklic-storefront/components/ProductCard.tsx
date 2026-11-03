import Link from 'next/link'
import type { Locale } from '@boutiklic/shared'
import { money } from '../lib/money'
import type { PublicProduct } from '../lib/types'
import { AddToCart } from './AddToCart'

export function ProductCard({ product, locale }: { product: PublicProduct; locale: Locale }) {
  const image = product.imageUrls[0] ?? null
  return (
    <li className="card">
      <Link className="card-link" href={`/p/${encodeURIComponent(product.id)}`}>
        {image ? <img className="thumb" src={image} alt={product.name} loading="lazy" decoding="async" /> : <div className="thumb-empty" aria-hidden="true">📦</div>}
        <div className="card-body">
          <h2 className="card-title">{product.name}</h2>
          <span className="price">{money(product.price, product.currency, locale)}</span>
          {product.compareAtPrice ? <span className="compare">{money(product.compareAtPrice, product.currency, locale)}</span> : null}
        </div>
      </Link>
      <div className="card-actions">
        <AddToCart locale={locale} product={{ id: product.id, name: product.name, imageUrl: image, price: product.price, currency: product.currency }} />
      </div>
    </li>
  )
}
