'use client'

import Link from 'next/link'
import type { Locale } from '@boutiklic/shared'
import { translate } from '../lib/i18n'
import { useCart } from './CartProvider'

export function CartLink({ locale }: { locale: Locale }) {
  const { count, ready } = useCart()
  return (
    <Link className="cart-link" href="/cart" aria-label={`${translate(locale, 'cart')}${ready ? ` (${count})` : ''}`}>
      <span aria-hidden="true">🛒</span>
      <span>{translate(locale, 'cart')}</span>
      {ready && count > 0 ? <span className="badge">{count}</span> : null}
    </Link>
  )
}
