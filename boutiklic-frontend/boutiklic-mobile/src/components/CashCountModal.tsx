import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Modal } from 'react-native'
import { Wallet } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { salesApi } from '../lib/salesApi'
import { toErrorMessage } from '../lib/apiClient'

interface CashCountModalProps {
  open: boolean
  currency: string
  onClose: () => void
  onRecorded: () => void
}

/** Modale de comptage physique de caisse (écran E1) — mirror RN de CashCountModal côté web.
 * Alimente l'écart de caisse : sans cette saisie, "Encaissé"/"Écart" restent "Pas encore compté". */
export default function CashCountModal({ open, currency, onClose, onRecorded }: CashCountModalProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setNote('')
      setError(null)
    }
  }, [open])

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0

  const handleSubmit = async () => {
    if (parsedAmount <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await salesApi.recordCashCount({ countedAmount: parsedAmount, currency, note: note.trim() || undefined })
      onRecorded()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} className="bg-black/40 items-center justify-center px-5" onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-[20px] bg-bg-card border border-border-strong p-5 gap-3.5">
          <View className="flex-row items-center gap-2.5">
            <View className="w-10 h-10 rounded-xl bg-[#FEF4E6] items-center justify-center">
              <Wallet size={18} color="#8A6712" />
            </View>
            <View className="gap-0.5">
              <Text className="text-[15px] font-extrabold">{t('components.cashCount.title')}</Text>
              <Text className="text-[13px] font-semibold text-text-dim">{t('components.cashCount.subtitle')}</Text>
            </View>
          </View>

          <TextInput
            autoFocus
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
            placeholder={t('components.cashCount.amountPlaceholder')}
            keyboardType="decimal-pad"
            className="amount h-12 px-4 rounded-xl border border-border-strong bg-bg font-bold"
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('components.cashCount.notePlaceholder')}
            className="h-12 px-4 rounded-xl border border-border-strong bg-bg text-[15px] font-semibold"
          />
          {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

          <View className="flex-row gap-2.5">
            <Pressable onPress={onClose} className="flex-1 h-12 rounded-xl border border-border-strong bg-bg items-center justify-center">
              <Text className="text-[15px] font-bold">{t('components.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={parsedAmount <= 0 || submitting}
              className="flex-1 h-12 rounded-xl bg-primary items-center justify-center disabled:opacity-40"
            >
              <Text className="text-papier text-[15px] font-extrabold">{submitting ? '...' : t('components.cashCount.save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
