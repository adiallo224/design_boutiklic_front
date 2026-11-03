import type { ProblemDetail } from './types'

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  problem: ProblemDetail | null
  /** Vrai quand le serveur n'a pas pu être joint (coupure): le panier et la clé d'idempotence sont conservés pour un nouvel essai. */
  networkError: boolean
}

/** Appel de l'API publique via la vitrine (même origine). Ne lève jamais d'exception: le résultat dit ce qui s'est passé. */
export async function callApi<T>(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`/api/${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: 'no-store',
    })
    const json = await response.json().catch(() => null)
    return response.ok
      ? { ok: true, status: response.status, data: json as T, problem: null, networkError: false }
      : { ok: false, status: response.status, data: null, problem: (json as ProblemDetail) ?? { status: response.status }, networkError: false }
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') throw error
    return { ok: false, status: 0, data: null, problem: null, networkError: true }
  }
}
