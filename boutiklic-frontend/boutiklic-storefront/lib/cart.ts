/**
 * Panier côté navigateur (résistant aux coupures: stockage local). Les prix qu'il garde ne servent QU'À l'affichage immédiat: le total réel est toujours recalculé par le
 * serveur (devis), et rien de ce qui est ici n'est envoyé comme prix.
 */
export interface CartItem {
  productId: string
  name: string
  imageUrl: string | null
  /** Prix unitaire TTC affiché au moment de l'ajout (indicatif). */
  unitPrice: number
  currency: string
  quantity: number
}

export const MAX_QUANTITY = 999
export const MAX_LINES = 50

const clamp = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0)))

/** Ajoute des unités (cumule si l'article y est déjà). Une quantité nulle ou négative ne change rien; le panier est plafonné. */
export function addItem(cart: CartItem[], item: Omit<CartItem, 'quantity'>, quantity = 1): CartItem[] {
  const add = clamp(quantity)
  if (add === 0) return cart
  const existing = cart.find((line) => line.productId === item.productId)
  if (existing) {
    return cart.map((line) => (line.productId === item.productId ? { ...line, ...item, quantity: clamp(line.quantity + add) } : line))
  }
  if (cart.length >= MAX_LINES) return cart
  return [...cart, { ...item, quantity: add }]
}

/** Fixe la quantité d'une ligne ; 0 la retire. */
export function setQuantity(cart: CartItem[], productId: string, quantity: number): CartItem[] {
  const next = clamp(quantity)
  return next === 0 ? cart.filter((line) => line.productId !== productId) : cart.map((line) => (line.productId === productId ? { ...line, quantity: next } : line))
}

export const removeItem = (cart: CartItem[], productId: string): CartItem[] => cart.filter((line) => line.productId !== productId)

export const itemCount = (cart: CartItem[]): number => cart.reduce((sum, line) => sum + line.quantity, 0)

/** Estimation d'affichage uniquement (le serveur fait foi). */
export const estimatedSubtotal = (cart: CartItem[]): number => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

/**
 * Relit un panier stocké. Tout ce qui est illisible ou invalide est écarté sans jamais lever d'erreur: un stockage corrompu (ou modifié à la main) ne doit pas casser la
 * vitrine, il donne simplement un panier vide ou réduit aux lignes valables.
 */
export function parseCart(raw: string | null | undefined): CartItem[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const lines: CartItem[] = []
  for (const entry of data.slice(0, MAX_LINES)) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    if (typeof e.productId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(e.productId) || typeof e.name !== 'string') continue
    const quantity = clamp(Number(e.quantity))
    if (quantity === 0 || lines.some((l) => l.productId === e.productId)) continue
    lines.push({
      productId: e.productId,
      name: e.name.slice(0, 255),
      imageUrl: typeof e.imageUrl === 'string' ? e.imageUrl : null,
      unitPrice: Number.isFinite(Number(e.unitPrice)) && Number(e.unitPrice) >= 0 ? Number(e.unitPrice) : 0,
      currency: typeof e.currency === 'string' ? e.currency.slice(0, 10) : '',
      quantity,
    })
  }
  return lines
}

export const serializeCart = (cart: CartItem[]): string => JSON.stringify(cart)
