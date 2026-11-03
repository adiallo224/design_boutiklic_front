import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { coreConfig, getStorefront } from './core'
import { resolveSiteHost } from './hostname'
import type { PublicStorefront } from './types'

/** Nom d'hôte de la requête en cours (valide), ou null. */
export async function currentHost(): Promise<string | null> {
  return resolveSiteHost((await headers()).get('host'), process.env.STOREFRONT_DEV_HOST)
}

export interface CurrentSite {
  host: string
  site: PublicStorefront
}

/** La boutique de cette adresse, ou null (adresse inconnue, boutique non publiée, suspendue...: le core répond pareil et la vitrine aussi). Mémoïsé par requête. */
export const findSite = cache(async (): Promise<CurrentSite | null> => {
  const host = await currentHost()
  if (!host) return null
  const site = await getStorefront(coreConfig(), host)
  return site ? { host, site } : null
})

/** Pour les pages: la boutique, ou la page 404 neutre (statut 404). */
export async function requireSite(): Promise<CurrentSite> {
  const current = await findSite()
  if (!current) notFound()
  return current
}
