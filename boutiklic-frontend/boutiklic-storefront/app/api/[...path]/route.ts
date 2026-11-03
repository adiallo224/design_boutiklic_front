import { proxyRequest } from '../../../lib/proxy'

// Relais vers l'API publique du core (liste blanche stricte, cf. lib/proxy.ts). Jamais mis en cache, jamais pré-rendu.
export const dynamic = 'force-dynamic'

const config = () => ({
  gatewayUrl: process.env.GATEWAY_URL ?? 'http://localhost:8080',
  devHost: process.env.STOREFRONT_DEV_HOST,
})

type Context = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, { params }: Context) {
  return proxyRequest(request, (await params).path, config())
}

export async function POST(request: Request, { params }: Context) {
  return proxyRequest(request, (await params).path, config())
}
