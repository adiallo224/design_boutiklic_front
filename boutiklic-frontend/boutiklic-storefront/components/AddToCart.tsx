'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Locale } from '@boutiklic/shared'
import { MAX_QUANTITY } from '../lib/cart'
import { translate } from '../lib/i18n'
import { useCart } from './CartProvider'

interface Props {
  locale: Locale
  product: { id: string; name: string; imageUrl: string | null; price: number; currency: string }
  /** Sur la fiche: choix de la quantité. Dans la grille: un seul bouton. */
  withQuantity?: boolean
}

export function AddToCart({ locale, product, withQuantity = false }: Props) {
  const { add } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  const submit = () => {
    add({ productId: product.id, name: product.name, imageUrl: product.imageUrl, unitPrice: product.price, currency: product.currency }, quantity)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 2000)
  }

  return (
    <div>
      {withQuantity ? (
        <div className="stepper">
          <button type="button" aria-label="−" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
          <label className="visually-hidden" htmlFor={`qty-${product.id}`}>{translate(locale, 'quantity')}</label>
          <input
            id={`qty-${product.id}`}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(Math.min(MAX_QUANTITY, Math.max(1, Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)))}
          />
          <button type="button" aria-label="+" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}>+</button>
        </div>
      ) : null}
      <button type="button" className="btn" onClick={submit}>
        {justAdded ? `✓ ${translate(locale, 'added')}` : translate(locale, 'addToCart')}
      </button>
      {justAdded ? (
        <p role="status" className="muted">
          <Link href="/cart">{translate(locale, 'cart')} →</Link>
        </p>
      ) : null}
    </div>
  )
}
