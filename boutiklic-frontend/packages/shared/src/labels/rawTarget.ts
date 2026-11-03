/**
 * Cible d'une imprimante en réseau, saisie sous la forme « hôte » ou « hôte:port » (port 9100 par défaut, le port
 * « RAW / JetDirect » des imprimantes d'étiquettes). Renvoie `null` si la saisie n'est pas une cible plausible :
 * nom d'hôte ou IPv4, port 1–65535 — jamais d'URL, de chemin ni d'espace.
 */
export const DEFAULT_RAW_PORT = 9100

export interface RawNetworkTarget {
  host: string
  port: number
}

const HOSTNAME = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function parseNetworkTarget(input: string | null | undefined): RawNetworkTarget | null {
  if (!input) return null
  const text = input.trim()
  const match = /^([^:\s]+)(?::(\d{1,5}))?$/.exec(text)
  if (!match) return null
  const host = match[1]
  if (!HOSTNAME.test(host)) return null
  const port = match[2] === undefined ? DEFAULT_RAW_PORT : Number(match[2])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return { host, port }
}

export function formatNetworkTarget(target: RawNetworkTarget): string {
  return target.port === DEFAULT_RAW_PORT ? target.host : `${target.host}:${target.port}`
}
