/**
 * Icônes de catégorie (écran Catégories). La valeur stockée dans `Category.icon` est la CLÉ ci-dessous (noms Material Symbols de la
 * maquette quand ils existent) ; `emoji` est le rendu de repli des surfaces sans bibliothèque d'icônes (mobile, étiquettes).
 * Les anciennes catégories dont `icon` est déjà un emoji restent valides : {@link categoryIconEmoji} le renvoie tel quel.
 * Le web associe chaque clé à une icône lucide (frontend/src/desktop/components/CategoryIcon.tsx).
 */
export interface CategoryIconDef {
  key: string
  emoji: string
}

export const DEFAULT_CATEGORY_ICON = 'category'

/** Palette de couleurs des catégories (maquette study/web/Categories Screen.html + rouge, jaune, vert et bleu vifs). */
export const CATEGORY_COLORS: readonly string[] = [
  '#C0553A', '#1E3A5F', '#0E7A52', '#8A6712', '#6B4FA0', '#B23A66', '#1F7A72', '#7A4A2E', '#44546B', '#B2651C',
  '#D32F2F', '#E0A800', '#2E9E44', '#2563EB',
]

export const CATEGORY_ICONS: readonly CategoryIconDef[] = [
  // Alimentation
  { key: 'local_grocery_store', emoji: '🛒' },
  { key: 'restaurant', emoji: '🍽️' },
  { key: 'bakery_dining', emoji: '🥐' },
  { key: 'egg', emoji: '🥚' },
  { key: 'icecream', emoji: '🍦' },
  { key: 'local_cafe', emoji: '☕' },
  { key: 'liquor', emoji: '🍷' },
  { key: 'set_meal', emoji: '🐟' },
  { key: 'grass', emoji: '🌾' },
  { key: 'nutrition', emoji: '🍎' },
  // Quincaillerie
  { key: 'hardware', emoji: '🔨' },
  { key: 'construction', emoji: '🏗️' },
  { key: 'plumbing', emoji: '🚰' },
  { key: 'electrical_services', emoji: '🔌' },
  { key: 'carpenter', emoji: '📏' },
  { key: 'lock', emoji: '🔒' },
  { key: 'cable', emoji: '🔗' },
  { key: 'build', emoji: '🔧' },
  { key: 'format_paint', emoji: '🎨' },
  { key: 'lightbulb', emoji: '💡' },
  // Habits et accessoires
  { key: 'checkroom', emoji: '👕' },
  { key: 'dry_cleaning', emoji: '✂️' },
  { key: 'footprint', emoji: '👟' },
  { key: 'shopping_bag', emoji: '👜' },
  { key: 'watch', emoji: '⌚' },
  { key: 'diamond', emoji: '💎' },
  { key: 'eyeglasses', emoji: '👓' },
  // Produits ménagers et maison
  { key: 'cleaning_services', emoji: '🧹' },
  { key: 'local_laundry_service', emoji: '🧺' },
  { key: 'kitchen', emoji: '🍲' },
  { key: 'microwave', emoji: '♨️' },
  { key: 'refrigerator', emoji: '🧊' },
  { key: 'chair', emoji: '🪑' },
  { key: 'bed', emoji: '🛏️' },
  { key: 'bathtub', emoji: '🛁' },
  { key: 'shower', emoji: '🚿' },
  { key: 'delete', emoji: '🗑️' },
  // Hygiène, beauté et santé
  { key: 'spa', emoji: '🧴' },
  { key: 'auto_awesome', emoji: '✨' },
  { key: 'medication', emoji: '💊' },
  { key: 'stethoscope', emoji: '🩺' },
  { key: 'child_care', emoji: '🍼' },
  // Électronique
  { key: 'devices', emoji: '💻' },
  { key: 'smartphone', emoji: '📱' },
  { key: 'headphones', emoji: '🎧' },
  { key: 'tv', emoji: '📺' },
  { key: 'photo_camera', emoji: '📷' },
  { key: 'battery_full', emoji: '🔋' },
  { key: 'print', emoji: '🖨️' },
  // Autres
  { key: 'category', emoji: '🔷' },
  { key: 'inventory_2', emoji: '📦' },
  { key: 'pets', emoji: '🐾' },
  { key: 'school', emoji: '🎓' },
  { key: 'edit', emoji: '✏️' },
  { key: 'menu_book', emoji: '📚' },
  { key: 'toys', emoji: '🎮' },
  { key: 'fitness_center', emoji: '🏋️' },
  { key: 'directions_car', emoji: '🚗' },
  { key: 'local_gas_station', emoji: '⛽' },
  { key: 'local_shipping', emoji: '🚚' },
  { key: 'redeem', emoji: '🎁' },
  { key: 'music_note', emoji: '🎵' },
  { key: 'favorite', emoji: '❤️' },
]

const EMOJI_BY_KEY = new Map(CATEGORY_ICONS.map((i) => [i.key, i.emoji]))

/** Vrai si `icon` est une clé du catalogue (et non un emoji hérité). */
export function isCategoryIconKey(icon: string | null | undefined): icon is string {
  return !!icon && EMOJI_BY_KEY.has(icon)
}

/** Rendu texte d'une icône de catégorie : l'emoji de la clé, l'ancien emoji tel quel, ou `fallback` si vide. */
export function categoryIconEmoji(icon: string | null | undefined, fallback = '📦'): string {
  if (!icon) return fallback
  return EMOJI_BY_KEY.get(icon) ?? icon
}
