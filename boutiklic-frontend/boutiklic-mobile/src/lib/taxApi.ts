import { apiClient } from './apiClient'

export interface TaxCategoryResponse {
  id: string
  name: string
  active: boolean
  /** Taux en vigueur (%), null si aucune règle active. */
  ratePercent: number | null
  /** Taux officiel du pays dont la catégorie est issue (STANDARD, REDUCED…) ; absent/null = créée à la main. */
  officialRateCode?: string | null
  /** true = le taux est lu dans le référentiel du pays et en suit les changements légaux ; false = taux personnalisé. */
  followsOfficialRate?: boolean
}

export interface CountryRate {
  code: string
  name: string
  ratePercent: number
  /** La boutique a déjà une catégorie fiscale issue de ce taux. */
  imported: boolean
}

/** Taux officiels du pays de la boutique ; `country` null = pays pas encore renseigné. */
export interface CountryRates {
  country: string | null
  rates: CountryRate[]
}

/** Client typé du module tax — cf. boutiklic-core TaxCategoryController. Écritures réservées au propriétaire. */
export const taxApi = {
  getActiveCategories: () => apiClient.get<TaxCategoryResponse[]>('/tax-categories'),
  create: (payload: { name: string; ratePercent: number }) => apiClient.post<TaxCategoryResponse>('/tax-categories', payload),
  /** Taux officiels du pays de la boutique, tels qu'en vigueur aujourd'hui. */
  getCountryRates: () => apiClient.get<CountryRates>('/tax-categories/country-rates'),
  /** Adopte un taux officiel : la catégorie créée en suit ensuite les changements légaux. Idempotent. */
  importCountryRate: (code: string) => apiClient.post<void>(`/tax-categories/country-rates/${code}/import`),
  /** Revient au taux officiel (après qu'un taux personnalisé a détaché la catégorie). */
  followOfficialRate: (taxCategoryId: string) => apiClient.post<void>(`/tax-categories/${taxCategoryId}/follow-official-rate`),
  /** Historise l'ancien taux : les ventes passées gardent celui de leur date. Sur une catégorie officielle, la détache du pays. */
  changeRate: (taxCategoryId: string, ratePercent: number) =>
    apiClient.patch<void>(`/tax-categories/${taxCategoryId}/rate`, { ratePercent }),
  /** Active/désactive la TVA de la boutique. `defaultTaxCategoryId` absent = conserver le défaut déjà configuré. */
  configure: (enabled: boolean, defaultTaxCategoryId?: string) =>
    apiClient.put<void>('/tax-categories/settings', { enabled, defaultTaxCategoryId }),
}
