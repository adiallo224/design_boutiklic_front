'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addItem, itemCount, parseCart, removeItem, serializeCart, setQuantity, type CartItem } from '../lib/cart'

const STORAGE_KEY = 'boutiklic.cart.v1'

interface CartApi {
  cart: CartItem[]
  /** Faux tant que le stockage n'a pas été relu (évite d'afficher « panier vide » une fraction de seconde). */
  ready: boolean
  count: number
  add(item: Omit<CartItem, 'quantity'>, quantity?: number): void
  setQuantity(productId: string, quantity: number): void
  remove(productId: string): void
  clear(): void
}

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setCart(parseCart(window.localStorage.getItem(STORAGE_KEY)))
    } catch {
      // stockage indisponible (navigation privée...): le panier reste en mémoire pour cette visite
    }
    setReady(true)
    // Même panier dans tous les onglets de la vitrine.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setCart(parseCart(event.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeCart(cart))
    } catch {
      // idem
    }
  }, [cart, ready])

  const add = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => setCart((c) => addItem(c, item, quantity)), [])
  const setQty = useCallback((productId: string, quantity: number) => setCart((c) => setQuantity(c, productId, quantity)), [])
  const remove = useCallback((productId: string) => setCart((c) => removeItem(c, productId)), [])
  const clear = useCallback(() => setCart([]), [])

  const value = useMemo<CartApi>(() => ({ cart, ready, count: itemCount(cart), add, setQuantity: setQty, remove, clear }), [cart, ready, add, setQty, remove, clear])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartApi {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart doit être utilisé dans <CartProvider>')
  return context
}
