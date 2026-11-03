import { useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal } from 'react-native'
import { Check, ChevronDown } from 'lucide-react-native'
import { PHONE_COUNTRIES } from '@boutiklic/shared'

interface CountryCodePickerProps {
  countryId: string
  setCountryId: (id: string) => void
}

/** Sélecteur d'indicatif téléphonique (drapeau + indicatif + liste au clic) — Login/CreateAccount/
 *  ForgotPassword (via PhoneNumberField). Réutilise PHONE_COUNTRIES (@boutiklic/shared) plutôt
 *  qu'une liste mondiale. */
export default function CountryCodePicker({ countryId, setCountryId }: CountryCodePickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<View>(null)
  const selected = PHONE_COUNTRIES.find((c) => c.id === countryId) ?? PHONE_COUNTRIES[0]

  /** Le menu est un Modal (rendu hors de l'arbre, au-dessus de tout) — sa position est donc
   *  mesurée par rapport à l'écran au moment de l'ouverture, pas héritée du flux normal. */
  const openPicker = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ top: y + height + 8, left: x, width: Math.max(width, 260) })
      setShowPicker(true)
    })
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={() => (showPicker ? setShowPicker(false) : openPicker())}
        className="flex-row items-center gap-1.5"
      >
        <Text className="text-xl leading-none">{selected.flag}</Text>
        <Text className="amount text-lg font-bold text-text-muted">{selected.dialCode}</Text>
        <ChevronDown size={16} color="#676E7E" />
      </Pressable>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setShowPicker(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: menuAnchor.top, left: menuAnchor.left, width: menuAnchor.width, maxHeight: 300 }}
            className="bg-bg-card border border-border rounded-2xl overflow-hidden"
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {PHONE_COUNTRIES.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setCountryId(c.id)
                    setShowPicker(false)
                  }}
                  className="flex-row items-center justify-between gap-3 px-4 py-3"
                >
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl leading-none">{c.flag}</Text>
                    <Text className="font-semibold">{c.name}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="amount font-bold text-text-muted">{c.dialCode}</Text>
                    {c.id === selected.id && <Check size={16} color="#0E2038" />}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
