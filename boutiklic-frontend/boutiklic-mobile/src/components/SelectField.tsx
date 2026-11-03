import { useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

export interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Remplace `<select>` (inexistant en RN) — même pattern de dropdown que ShopCountry.tsx. */
export default function SelectField({ value, onChange, options, placeholder, disabled, className }: SelectFieldProps) {
  const { t } = useTranslation()
  const fieldPlaceholder = placeholder ?? t('components.choosePlaceholder')
  const [open, setOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<View>(null)
  const selected = options.find((o) => o.value === value)

  /** Le menu est un Modal (rendu hors de l'arbre, au-dessus de tout) — sa position est donc
   *  mesurée par rapport à l'écran au moment de l'ouverture, pas héritée du flux normal. */
  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ top: y + height + 4, left: x, width })
      setOpen(true)
    })
  }

  return (
    <View>
      <Pressable
        ref={triggerRef}
        onPress={() => !disabled && (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        className={`h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 flex-row items-center justify-between disabled:opacity-60 ${className ?? ''}`}
      >
        <Text className={`text-base font-semibold ${selected ? '' : 'text-text-dim'}`} numberOfLines={1}>
          {selected?.label ?? fieldPlaceholder}
        </Text>
        <ChevronDown size={18} color="#676E7E" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: menuAnchor.top, left: menuAnchor.left, width: menuAnchor.width, maxHeight: 240 }}
            className="bg-bg-card border border-border rounded-2xl overflow-hidden"
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className="px-4 py-3"
                >
                  <Text className={`font-semibold ${o.value === value ? 'text-primary font-extrabold' : ''}`}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
