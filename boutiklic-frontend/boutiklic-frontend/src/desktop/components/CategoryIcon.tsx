import type { LucideIcon } from 'lucide-react'
import {
  Apple, Archive, Baby, Bath, Battery, Bed, BookOpen, Cable, Camera, Car, Coffee, Construction, CookingPot, Croissant, Dumbbell,
  Egg, Glasses, Footprints, Fuel, Gamepad2, Gem, Gift, GraduationCap, Hammer, Headphones, Heart, IceCreamCone, Lightbulb, Lock,
  Microwave, MonitorSmartphone, Music, PawPrint, Paintbrush, Pencil, Pill, Plug, Printer, Refrigerator, Ruler, Scissors, Shapes,
  ShoppingBag, ShoppingCart, ShowerHead, Smartphone, Sparkles, SprayCan, Stethoscope, Armchair, Trash2, Truck, Tv, UtensilsCrossed, Watch,
  WashingMachine, Wheat, Wine, Wrench, Droplets, Fish, Flower2, Shirt,
} from 'lucide-react'
import { DEFAULT_CATEGORY_ICON, categoryIconEmoji, isCategoryIconKey } from '@boutiklic/shared'

/** Clé stockée (cf. @boutiklic/shared categoryIcons) -> icône lucide. Une clé absente d'ici retombe sur l'emoji de repli. */
const ICONS: Record<string, LucideIcon> = {
  local_grocery_store: ShoppingCart,
  restaurant: UtensilsCrossed,
  bakery_dining: Croissant,
  egg: Egg,
  icecream: IceCreamCone,
  local_cafe: Coffee,
  liquor: Wine,
  set_meal: Fish,
  grass: Wheat,
  nutrition: Apple,
  hardware: Hammer,
  construction: Construction,
  plumbing: Droplets,
  electrical_services: Plug,
  carpenter: Ruler,
  lock: Lock,
  cable: Cable,
  build: Wrench,
  format_paint: Paintbrush,
  lightbulb: Lightbulb,
  checkroom: Shirt,
  dry_cleaning: Scissors,
  footprint: Footprints,
  shopping_bag: ShoppingBag,
  watch: Watch,
  diamond: Gem,
  eyeglasses: Glasses,
  cleaning_services: SprayCan,
  local_laundry_service: WashingMachine,
  kitchen: CookingPot,
  microwave: Microwave,
  refrigerator: Refrigerator,
  chair: Armchair,
  bed: Bed,
  bathtub: Bath,
  shower: ShowerHead,
  delete: Trash2,
  spa: Flower2,
  auto_awesome: Sparkles,
  medication: Pill,
  stethoscope: Stethoscope,
  child_care: Baby,
  devices: MonitorSmartphone,
  smartphone: Smartphone,
  headphones: Headphones,
  tv: Tv,
  photo_camera: Camera,
  battery_full: Battery,
  print: Printer,
  category: Shapes,
  inventory_2: Archive,
  pets: PawPrint,
  school: GraduationCap,
  edit: Pencil,
  menu_book: BookOpen,
  toys: Gamepad2,
  fitness_center: Dumbbell,
  directions_car: Car,
  local_gas_station: Fuel,
  local_shipping: Truck,
  redeem: Gift,
  music_note: Music,
  favorite: Heart,
}


interface CategoryIconProps {
  icon: string | null | undefined
  /** Taille de l'icône en px. */
  size?: number
  /** Couleur du trait (par défaut celle du texte courant). */
  className?: string
}

/** Icône d'une catégorie : trait lucide pour les clés connues, emoji pour les anciennes données (icon = emoji). */
export default function CategoryIcon({ icon, size = 16, className }: CategoryIconProps) {
  const key = isCategoryIconKey(icon) ? icon : null
  const Icon = (key && ICONS[key]) || (!icon ? ICONS[DEFAULT_CATEGORY_ICON] : null)
  if (Icon) return <Icon size={size} strokeWidth={2} className={className} aria-hidden />
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} aria-hidden>
      {categoryIconEmoji(icon)}
    </span>
  )
}
