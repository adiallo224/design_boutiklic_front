import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface Seen {
  method: string
  url: string
  headers: IncomingMessage['headers']
  body: string
}

/** Un VRAI serveur HTTP local qui joue le gateway: il enregistre exactement ce que la vitrine lui envoie (dont l'en-tête Host) et répond comme on le lui demande. */
export async function startFakeGateway(respond: (seen: Seen) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const requests: Seen[] = []
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const seen = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks).toString('utf8') }
      requests.push(seen)
      const answer = respond(seen)
      res.writeHead(answer.status ?? 200, { 'content-type': 'application/json', ...(answer.headers ?? {}) })
      res.end(answer.body === undefined ? '{}' : JSON.stringify(answer.body))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { url, requests, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}
