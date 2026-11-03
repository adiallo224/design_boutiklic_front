/**
 * Adresse (slug) d'un site e-commerce. Ces règles MIROITENT celles du serveur (3 à 40 caractères, minuscules, chiffres et tirets, ni tiret en début ou fin, ni double
 * tiret, pas uniquement des chiffres) pour guider la saisie sans attendre une réponse ; le serveur reste l'unique juge (adresses réservées, déjà prises...).
 */
export const SLUG_MIN = 3
export const SLUG_MAX = 40

export type SlugProblem = 'tooShort' | 'tooLong' | 'chars' | 'hyphens' | 'digitsOnly'

/** Propose une adresse à partir d'un nom commercial : « Chez Mamadou & Fils » devient « chez-mamadou-fils ». */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

/** Premier problème qui rendrait cette adresse invalide, ou null. La saisie est considérée telle quelle (pas de correction silencieuse). */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'tooShort'
  if (slug.length > SLUG_MAX) return 'tooLong'
  if (!/^[a-z0-9-]+$/.test(slug)) return 'chars'
  if (slug.startsWith('-') || slug.endsWith('-') || slug.includes('--')) return 'hyphens'
  if (/^[0-9]+$/.test(slug)) return 'digitsOnly'
  return null
}
