/**
 * Saisie des quartiers d'une zone de livraison : un par ligne, ou séparés par des virgules ou points-virgules. Mêmes règles que le serveur (au plus 100 lieux de 80
 * caractères, doublons ignorés sans tenir compte de la casse ni des accents) pour que ce que l'on voit soit ce qui sera enregistré.
 */
export const MAX_AREAS = 100
export const MAX_AREA_LENGTH = 80

/** Comparaison insensible à la casse, aux accents et aux séparateurs — comme la correspondance faite par le serveur au calcul des frais. */
export function normalizeArea(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseAreas(text: string): string[] {
  const seen = new Set<string>()
  const areas: string[] = []
  for (const raw of text.split(/[\n,;]+/)) {
    const area = raw.trim()
    const key = normalizeArea(area)
    if (!area || seen.has(key)) continue
    seen.add(key)
    areas.push(area)
  }
  return areas
}

export function areasToText(areas: string[]): string {
  return areas.join('\n')
}

/** Premier problème qui ferait refuser cette saisie par le serveur, ou null. */
export function areasProblem(areas: string[]): 'tooMany' | 'tooLong' | null {
  if (areas.length > MAX_AREAS) return 'tooMany'
  if (areas.some((a) => a.length > MAX_AREA_LENGTH)) return 'tooLong'
  return null
}
