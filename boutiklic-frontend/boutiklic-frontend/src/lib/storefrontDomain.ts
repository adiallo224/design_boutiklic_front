import type { StorefrontResponse } from './storefrontsApi'

/** Adresse publique d'un site : son domaine principal (sous-domaine automatique, ou domaine personnalisé plus tard), sinon le premier domaine non retiré. */
export function primaryHostname(site: Pick<StorefrontResponse, 'domains'>): string | null {
  return (site.domains.find((d) => d.primary && d.status !== 'REMOVED') ?? site.domains.find((d) => d.status !== 'REMOVED'))?.hostname ?? null
}
