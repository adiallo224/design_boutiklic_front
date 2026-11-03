'use client'

import Link from 'next/link'
import type { Locale } from '@boutiklic/shared'
import { estimatedSubtotal, MAX_QUANTITY } from '../lib/cart'
import { translate } from '../lib/i18n'
import { money } from '../lib/money'
import { useCart } from './CartProvider'

export function CartView({ locale }: { locale: Locale }) {
  const { cart, ready, setQuantity, remove } = useCart()
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)

  if (!ready) return <p className="muted">{t('loading')}</p>
  if (cart.length === 0) {
    return (
      <>
        <h1>{t('cart')}</h1>
        <p className="muted">{t('emptyCart')}</p>
        <Link className="btn inline" href="/">{t('continueShopping')}</Link>
      </>
    )
  }
  const currency = cart[0].currency
  return (
    <>
      <h1>{t('cart')}</h1>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {cart.map((line) => (
          <li key={line.productId} className="cart-line">
            {line.imageUrl ? <img className="thumb" src={line.imageUrl} alt="" loading="lazy" decoding="async" /> : <div className="thumb-empty" aria-hidden="true">📦</div>}
            <div>
              <Link href={`/p/${encodeURIComponent(line.productId)}`}><strong>{line.name}</strong></Link>
              <div className="muted">{money(line.unitPrice, line.currency, locale)}</div>
              <div className="line-actions">
                <div className="stepper" style={{ margin: 0 }}>
                  <button type="button" aria-label="−" onClick={() => setQuantity(line.productId, line.quantity - 1)}>−</button>
                  <label className="visually-hidden" htmlFor={`q-${line.productId}`}>{t('quantity')}</label>
                  <input id={`q-${line.productId}`} inputMode="numeric" value={line.quantity}
                    onChange={(e) => setQuantity(line.productId, Math.min(MAX_QUANTITY, Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 0))} />
                  <button type="button" aria-label="+" onClick={() => setQuantity(line.productId, line.quantity + 1)}>+</button>
                </div>
                <button type="button" className="btn danger inline" onClick={() => remove(line.productId)}>{t('remove')}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="totals">
        <div className="row grand"><span>{t('subtotal')}</span><span>{money(estimatedSubtotal(cart), currency, locale)}</span></div>
      </div>
      <Link className="btn" href="/checkout">{t('checkout')}</Link>
    </>
  )
}
