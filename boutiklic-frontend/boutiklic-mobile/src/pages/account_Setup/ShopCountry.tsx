import { useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronLeft, TriangleAlert } from 'lucide-react-native'
import { COUNTRIES, type Country } from '@boutiklic/shared'

export const countries = COUNTRIES

interface ShopCountryProps {
  countryId: string
  setCountryId: (id: string) => void
  onContinue: () => void
  onBack?: () => void
}

/** Étape 2/4 de la création de boutique — pays & devise (cf. ShopProfile.tsx "DEVISE", "Fixée à la
 *  création"). Étape 1 = Onboarding (langue). */
export default function ShopCountry({ countryId, setCountryId, onContinue, onBack }: ShopCountryProps) {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<View>(null)
  const selected = countries.find((c) => c.id === countryId) ?? countries[0]
  const insets = useSafeAreaInsets()
  const CURRENCY_LABELS: Record<Country['currency'], string> = {
    GNF: t('common.currency.gnf'),
    FCFA: t('common.currency.fcfa'),
    SLE: t('common.currency.sle'),
    LRD: t('common.currency.lrd'),
    GHS: t('common.currency.ghs'),
    NGN: t('common.currency.ngn'),
    GMD: t('common.currency.gmd'),
    CVE: t('common.currency.cve'),
    DZD: t('common.currency.dzd'),
    AOA: t('common.currency.aoa'),
    BWP: t('common.currency.bwp'),
    BIF: t('common.currency.bif'),
    KMF: t('common.currency.kmf'),
    CDF: t('common.currency.cdf'),
    DJF: t('common.currency.djf'),
    EGP: t('common.currency.egp'),
    ERN: t('common.currency.ern'),
    SZL: t('common.currency.szl'),
    ETB: t('common.currency.etb'),
    KES: t('common.currency.kes'),
    LSL: t('common.currency.lsl'),
    LYD: t('common.currency.lyd'),
    MGA: t('common.currency.mga'),
    MWK: t('common.currency.mwk'),
    MUR: t('common.currency.mur'),
    MRU: t('common.currency.mru'),
    MAD: t('common.currency.mad'),
    MZN: t('common.currency.mzn'),
    NAD: t('common.currency.nad'),
    UGX: t('common.currency.ugx'),
    RWF: t('common.currency.rwf'),
    STN: t('common.currency.stn'),
    SCR: t('common.currency.scr'),
    SOS: t('common.currency.sos'),
    SDG: t('common.currency.sdg'),
    SSP: t('common.currency.ssp'),
    ZAR: t('common.currency.zar'),
    TZS: t('common.currency.tzs'),
    TND: t('common.currency.tnd'),
    ZMW: t('common.currency.zmw'),
    ZWG: t('common.currency.zwg'),
  }

  /** Le menu est un Modal (rendu hors de l'arbre, au-dessus de tout) — sa position est donc
   *  mesurée par rapport à l'écran au moment de l'ouverture, pas héritée du flux normal. */
  const openPicker = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ top: y + height + 8, left: x, width })
      setShowPicker(true)
    })
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-4">
        {onBack ? (
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
        ) : (
          <View className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card" />
        )}
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.countryAndCurrencyTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.stepTwoOfFour')}</Text>
        </View>
      </View>
      <View className="px-[22px] pb-5">
        <View className="h-[5px] rounded-full bg-fond-planche flex-row gap-1">
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-fond-planche rounded-full" />
          <View className="flex-1 bg-fond-planche rounded-full" />
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.countryLabel')}</Text>
          <Pressable
            ref={triggerRef}
            onPress={() => (showPicker ? setShowPicker(false) : openPicker())}
            className="h-[60px] rounded-2xl border-2 border-primary bg-bg-card flex-row items-center justify-between px-[18px]"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl leading-none">{selected.flag}</Text>
              <Text className="text-[17px] font-bold">{selected.name}</Text>
            </View>
            <ChevronDown size={18} color="#676E7E" />
          </Pressable>

          <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
            <Pressable style={{ flex: 1 }} onPress={() => setShowPicker(false)}>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: menuAnchor.top, left: menuAnchor.left, width: menuAnchor.width, maxHeight: 280 }}
                className="bg-bg-card border border-border rounded-2xl overflow-hidden"
              >
                <ScrollView showsVerticalScrollIndicator={false}>
                  {countries.map((c) => (
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
                      {c.id === selected.id && <Check size={16} color="#0E2038" />}
                    </Pressable>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.currencyLabel')}</Text>
          <View className="h-[60px] rounded-2xl border border-border-strong bg-bg-elevated flex-row items-center px-[18px] gap-3">
            <Text className="text-[17px] font-bold text-text-muted">{CURRENCY_LABELS[selected.currency]}</Text>
            <Text className="ml-auto text-[17px] font-extrabold text-primary">{selected.currency}</Text>
          </View>
        </View>

        <View className="flex-row gap-3 p-4 rounded-2xl bg-alerte-bg border border-[#EED9AE]">
          <TriangleAlert size={20} color="#9A7318" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-relaxed text-[#6B5410]">
            {t('auth.currencyFixedNotice')}
          </Text>
        </View>
      </ScrollView>

      <View className="px-[22px] pt-4 pb-10">
        <Pressable onPress={onContinue} className="w-full h-[62px] rounded-[18px] bg-primary items-center justify-center active:scale-95">
          <Text className="text-papier text-lg font-extrabold">{t('auth.continue')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
