import http from 'node:http'
import https from 'node:https'

export interface UpstreamInit {
  method?: string
  headers?: Headers | Record<string, string>
  body?: ArrayBuffer
  signal?: AbortSignal
  timeoutMs?: number
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

/**
 * Appel HTTP vers le gateway qui RESPECTE l'en-tête `Host` demandé. Le `fetch` de Node (undici) ignore un `Host` personnalisé et envoie celui de la destination: avec lui, le core
 * recevrait le nom du gateway au lieu de celui de la boutique et ne reconnaîtrait aucun site. `node:http` envoie l'en-tête tel quel. Les réponses (JSON de quelques ko) sont lues
 * en entier, bornées à 2 Mo, avec un délai maximal.
 */
export function upstreamFetch(url: string, init: UpstreamInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const transport = target.protocol === 'https:' ? https : http
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, name) => {
      headers[name] = value
    })
    if (init.body) headers['content-length'] = String(init.body.byteLength)

    const request = transport.request(target, { method: init.method ?? 'GET', headers, timeout: init.timeoutMs ?? 10_000 }, (response) => {
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('réponse trop volumineuse'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        const out = new Headers()
        for (const [name, value] of Object.entries(response.headers)) {
          if (value !== undefined) out.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        const status = response.statusCode ?? 502
        // Une réponse sans corps (204, 304...) ne peut pas en recevoir un.
        const hasBody = status !== 204 && status !== 205 && status !== 304
        resolve(new Response(hasBody ? Buffer.concat(chunks) : null, { status, headers: out }))
      })
      response.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error('délai dépassé')))
    request.on('error', reject)
    init.signal?.addEventListener('abort', () => request.destroy(new Error('annulé')), { once: true })
    if (init.body) request.write(Buffer.from(init.body))
    request.end()
  })
}
