/**
 * Clé d'idempotence d'une commande (en-tête Idempotency-Key, UUID v4). Règle: la MÊME clé pour la MÊME demande, pour qu'un nouvel essai après une coupure de réseau (réponse
 * perdue) retrouve la commande déjà créée au lieu d'en créer une seconde; une clé NEUVE dès que la demande change (autre panier, autre mode, autre total).
 */
export interface KeyStore {
  get(name: string): string | null
  set(name: string, value: string): void
  remove(name: string): void
}

const STORAGE_NAME = 'boutiklic.order-key.v1'

/**
 * UUID v4 qui fonctionne PARTOUT. `crypto.randomUUID()` n'existe que dans un contexte sécurisé (HTTPS/localhost) et dans les navigateurs récents (Chrome 92+, Safari 15.4+):
 * beaucoup de téléphones d'entrée de gamme ont un navigateur ou un WebView plus ancien. Repli sur `getRandomValues` (disponible bien plus tôt, y compris hors contexte sécurisé),
 * puis, en dernier recours seulement, sur Math.random (l'unicité compte ici, pas le secret: la clé n'est pas un jeton d'accès).
 */
export function uuidV4(cryptoApi: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> | undefined = globalThis.crypto): string {
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  const bytes = new Uint8Array(16)
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newKey(random: () => string = uuidV4): string {
  return random().toLowerCase()
}

/** Représentation canonique de ce que le serveur lie à la clé (mêmes éléments que l'empreinte du core). */
export function requestSignature(r: {
  items: { productId: string; quantity: number }[]
  deliveryMethod: string
  area?: string
  pickupPointId?: string
  paymentMethod: string
  buyerPhone: string
  expectedTotal: number
}): string {
  const lines = [...r.items].sort((a, b) => a.productId.localeCompare(b.productId)).map((i) => `${i.productId}x${i.quantity}`).join('|')
  return [lines, r.deliveryMethod, (r.area ?? '').trim().toLowerCase(), r.pickupPointId ?? '', r.paymentMethod, r.buyerPhone.replace(/\s+/g, ''), String(r.expectedTotal)].join('#')
}

/** Clé à utiliser pour cette demande: celle déjà mémorisée si la demande n'a pas changé, sinon une nouvelle (mémorisée à son tour). */
export function keyFor(signature: string, store: KeyStore, random?: () => string): string {
  const stored = store.get(STORAGE_NAME)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { signature?: string; key?: string }
      if (parsed.signature === signature && typeof parsed.key === 'string' && parsed.key) return parsed.key
    } catch {
      // illisible: on repart d'une clé neuve
    }
  }
  const key = newKey(random)
  store.set(STORAGE_NAME, JSON.stringify({ signature, key }))
  return key
}

/** À appeler quand la commande est créée (ou définitivement abandonnée): la prochaine commande aura sa propre clé. */
export function forgetKey(store: KeyStore): void {
  store.remove(STORAGE_NAME)
}
