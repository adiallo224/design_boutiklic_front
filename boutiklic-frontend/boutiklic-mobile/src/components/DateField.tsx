import { useState } from 'react'
import { View, Text, Pressable, Platform, Modal } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useTranslation } from 'react-i18next'

function fmtLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface DateFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  textClassName?: string
}

/** Champ de date cross-platform. @react-native-community/datetimepicker n'a pas d'implémentation
 *  web (rien ne s'affiche) — on bascule sur un <input type="date"> natif du navigateur. Sur iOS,
 *  le calendrier est présenté dans sa propre feuille modale plein écran plutôt qu'inséré dans la
 *  mise en page appelante : intégré directement (mode inline/spinner), il hérite de la largeur
 *  contrainte du conteneur (ex. un menu déroulant de 220px) et devient illisible/non tactile —
 *  une feuille dédiée lui garantit toujours assez d'espace, quel que soit l'endroit d'où on l'ouvre. */
export default function DateField({ value, onChange, placeholder, className, textClassName = 'text-sm font-semibold' }: DateFieldProps) {
  const { t } = useTranslation()
  const fieldPlaceholder = placeholder ?? t('components.choosePlaceholder')
  const [show, setShow] = useState(false)
  const [draft, setDraft] = useState(value)

  if (Platform.OS === 'web') {
    return (
      <View className={className}>
        <input
          type="date"
          value={value}
          onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
          style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', height: '100%', font: 'inherit', color: 'inherit' }}
        />
      </View>
    )
  }

  const openPicker = () => {
    // Si value est vide, le calendrier affiche déjà aujourd'hui par défaut (repli visuel) — mais
    // sans ça, taper sur "aujourd'hui" (déjà sélectionné visuellement) ne déclenche aucun
    // onChange (la date ne "change" pas du point de vue du widget), donc Valider soumettrait
    // encore une chaîne vide.
    setDraft(value || fmtLocalDate(new Date()))
    setShow(true)
  }

  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setShow(false)
    if (event.type === 'set' && date) onChange(fmtLocalDate(date))
  }

  const handleIosChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) setDraft(fmtLocalDate(date))
  }

  return (
    <>
      <Pressable onPress={openPicker} className={className}>
        <Text className={textClassName}>{value || fieldPlaceholder}</Text>
      </Pressable>

      {show && Platform.OS === 'ios' && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setShow(false)}>
            <Pressable onPress={(e) => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 rounded-t-[24px] bg-bg p-5 gap-3.5">
              <DateTimePicker
                value={draft ? new Date(draft) : new Date()}
                mode="date"
                display="inline"
                onChange={handleIosChange}
                themeVariant="light"
                textColor="#111418"
                accentColor="#0E2038"
                style={{ alignSelf: 'center' }}
              />
              <Pressable
                onPress={() => {
                  onChange(draft)
                  setShow(false)
                }}
                className="w-full py-3.5 rounded-xl bg-primary items-center"
              >
                <Text className="text-papier font-bold">{t('components.confirm')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {show && Platform.OS !== 'ios' && (
        <DateTimePicker value={value ? new Date(value) : new Date()} mode="date" display="default" onChange={handleAndroidChange} />
      )}
    </>
  )
}
