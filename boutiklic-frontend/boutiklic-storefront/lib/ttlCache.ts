/**
 * Petit cache mémoire à durée de vie courte, avec regroupement des demandes identiques en cours (dix visiteurs qui demandent la même page au même instant ne font qu'un appel au core).
 * La clé DOIT contenir le nom d'hôte de la boutique: c'est ce qui sépare les catalogues des boutiques entre eux.
 */
interface Entry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>()
  private readonly inflight = new Map<string, Promise<T>>()

  constructor(private readonly ttlMs: number, private readonly maxEntries = 500, private readonly now: () => number = Date.now) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key)
    if (hit && hit.expiresAt > this.now()) return hit.value
    const pending = this.inflight.get(key)
    if (pending) return pending

    const promise = load()
      .then((value) => {
        this.store(key, value)
        return value
      })
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, promise)
    return promise
  }

  /** Oublie tout ce qui concerne une boutique (clés « hôte|... »). */
  invalidateHost(host: string): void {
    for (const key of [...this.entries.keys()]) if (key.startsWith(`${host}|`)) this.entries.delete(key)
  }

  get size(): number {
    return this.entries.size
  }

  private store(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      // Éviction simple: d'abord ce qui est périmé, sinon la plus ancienne entrée.
      const now = this.now()
      for (const [k, e] of this.entries) if (e.expiresAt <= now) this.entries.delete(k)
      if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value as string)
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs })
  }
}
