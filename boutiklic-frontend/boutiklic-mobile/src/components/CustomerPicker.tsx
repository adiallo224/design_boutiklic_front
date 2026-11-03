import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { Search, X, UserCheck } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { customerApi, type CustomerResponse } from '../lib/customerApi'

interface CustomerPickerProps {
  /** Client actuellement lié (nom affiché en résumé) — null si saisie libre (aucun client choisi). */
  selectedName: string | null
  onSelect: (customer: CustomerResponse) => void
  onClear: () => void
}

/** Sélecteur de client depuis l'annuaire (module customer) — mirror mobile de
 *  desktop/components/CustomerPicker.tsx, utilisé partout où un acheteur se saisit (devis, facture).
 *  Ne remplace jamais la saisie libre : simple raccourci de préremplissage. */
export default function CustomerPicker({ selectedName, onSelect, onClear }: CustomerPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const timer = setTimeout(() => {
      customerApi
        .search(query || undefined)
        .then(setResults)
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [open, query])

  if (selectedName) {
    return (
      <View className="flex-row items-center gap-2 px-3.5 h-11 rounded-xl border border-primary bg-info-bg">
        <UserCheck size={15} color="#0E2038" />
        <Text className="flex-1 text-sm font-bold" numberOfLines={1}>
          {selectedName}
        </Text>
        <Pressable onPress={onClear}>
          <X size={15} color="#A2A9B8" />
        </Pressable>
      </View>
    )
  }

  return (
    <View className="gap-2">
      {!open ? (
        <Pressable onPress={() => setOpen(true)} className="flex-row items-center gap-1.5 h-9 px-3 rounded-lg border border-dashed border-border-strong self-start">
          <Search size={13} color="#676E7E" />
          <Text className="text-xs font-bold text-text-muted">{t('customerDirectory.chooseExistingCta')}</Text>
        </Pressable>
      ) : (
        <View className="gap-1.5 p-2.5 rounded-xl border border-border-strong bg-bg">
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('customerDirectory.chooseExistingPlaceholder')}
            className="h-9 rounded-lg bg-bg-card border border-border-strong px-3 text-sm"
          />
          <ScrollView className="max-h-44" showsVerticalScrollIndicator={false}>
            {loading ? (
              <Text className="text-xs text-text-dim px-2 py-1.5">{t('common.loading')}</Text>
            ) : results.length === 0 ? (
              <Text className="text-xs text-text-dim px-2 py-1.5">{t('customerDirectory.noMatch')}</Text>
            ) : (
              results.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onSelect(c)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="px-2 py-1.5 rounded-lg"
                >
                  <Text className="text-sm">
                    <Text className="font-bold">{c.name}</Text>
                    {c.phone ? <Text className="text-text-dim"> · {c.phone}</Text> : null}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
          <Pressable onPress={() => setOpen(false)} className="self-end">
            <Text className="text-xs font-bold text-text-dim">{t('customerDirectory.freeEntryCta')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
