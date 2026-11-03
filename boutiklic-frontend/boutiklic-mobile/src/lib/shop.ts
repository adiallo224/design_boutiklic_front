/** Sépare "Madina, Conakry" en (quartier, ville) — cf. quartier figé dans ShopIdentity (pas encore de sélecteur). */
export function splitQuartier(quartier: string): { neighborhood: string; city: string } {
  const [neighborhood, city] = quartier.split(',').map((part) => part.trim())
  return { neighborhood: neighborhood || quartier, city: city || 'Conakry' }
}
