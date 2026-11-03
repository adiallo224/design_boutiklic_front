import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, Linking } from 'react-native'
import { ChevronLeft, Phone, ChevronDown, ChevronUp, Undo2 } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { resellerApi, type ResellerLedgerResponse, type LedgerEntryResponse } from '../../lib/resellerApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useTenant } from '../../hooks/useTenant'
import ResellerPayment from './ResellerPayment'
import NewConsignmentOut from './NewConsignmentOut'
import { formatDateTime } from '../../lib/dateFormat'

interface ResellerDetailProps {
  resellerPhone: string
  onBack: () => void
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function entryLabel(entry: LedgerEntryResponse, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (entry.type === 'CONSIGNMENT_OUT') return t('resellerConsignment.entryOut', { count: entry.itemCount ?? entry.lines.length })
  if (entry.type === 'RETURN') return t('resellerConsignment.entryReturn', { count: entry.itemCount ?? 0 })
  return entry.note ? t('resellerConsignment.entryPaymentWithNote', { note: entry.note }) : t('resellerConsignment.entryPayment')
}

export default function ResellerDetail({ resellerPhone, onBack }: ResellerDetailProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [ledger, setLedger] = useState<ResellerLedgerResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'payment' | 'newConsignment'>('idle')

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})
  const [submittingReturn, setSubmittingReturn] = useState(false)
  const [returnError, setReturnError] = useState<string | null>(null)

  const load = () => {
    setIsLoading(true)
    setError(null)
    resellerApi
      .getLedger(resellerPhone)
      .then(setLedger)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [resellerPhone])

  if (mode === 'payment') {
    if (!ledger) return null
    return (
      <ResellerPayment
        resellerPhone={resellerPhone}
        resellerName={ledger.name}
        remainingAmount={ledger.totalRemaining}
        onBack={() => setMode('idle')}
        onDone={() => {
          setMode('idle')
          load()
        }}
      />
    )
  }

  if (mode === 'newConsignment') {
    return <NewConsignmentOut presetResellerPhone={resellerPhone} onBack={() => setMode('idle')} onCompleted={load} />
  }

  const toggleExpand = (entry: LedgerEntryResponse) => {
    if (entry.type !== 'CONSIGNMENT_OUT') return
    setReturnError(null)
    setExpandedId((cur) => (cur === entry.consignmentOutId ? null : entry.consignmentOutId))
    setReturnQty({})
  }

  const submitReturn = async (entry: LedgerEntryResponse) => {
    const lines = entry.lines.map((l) => ({ lineId: l.lineId, quantity: Number(returnQty[l.lineId] ?? 0) })).filter((l) => l.quantity > 0)
    if (lines.length === 0 || submittingReturn) return
    setSubmittingReturn(true)
    setReturnError(null)
    try {
      await resellerApi.recordReturn(resellerPhone, entry.consignmentOutId, { lines })
      setExpandedId(null)
      setReturnQty({})
      load()
    } catch (e) {
      setReturnError(toErrorMessage(e))
    } finally {
      setSubmittingReturn(false)
    }
  }

  if (isLoading && !ledger) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }

  if (!ledger) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-danger">{error ?? t('resellerConsignment.resellerNotFound')}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="px-5 pt-4 pb-2 flex-row items-center gap-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="w-11 h-11 rounded-2xl bg-primary items-center justify-center">
          <Text className="text-[15px] font-extrabold text-papier">{initials(ledger.name)}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-extrabold tracking-tight" numberOfLines={1}>
            {ledger.name}
          </Text>
          <Text className="amount text-[13px] font-semibold text-text-muted">{t('resellerConsignment.resellerPhoneLine', { phone: ledger.phone })}</Text>
        </View>
        <Pressable onPress={() => Linking.openURL(`tel:${ledger.phone}`)} className="w-10 h-10 rounded-xl bg-succes-bg items-center justify-center">
          <Phone size={18} color="#1F5C43" />
        </Pressable>
      </View>

      <View className="px-5 pt-3 pb-3.5 gap-2.5">
        <View className="p-[17px] rounded-[20px] bg-encre gap-1">
          <Text className="text-xs font-extrabold tracking-widest text-papier/55">{t('resellerConsignment.remainingToRecover')}</Text>
          <Text className="amount text-[32px] font-extrabold text-papier tracking-tight">{formatNumber(ledger.totalRemaining, locale)} {tenant.currency}</Text>
        </View>
        <View className="flex-row gap-2.5">
          <View className="flex-1 p-3.5 rounded-[17px] bg-bg-card border border-border gap-0.5">
            <Text className="text-[11.5px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.totalOutLabel')}</Text>
            <Text className="amount text-[17px] font-extrabold tracking-tight">{formatNumber(ledger.totalOut, locale)}</Text>
          </View>
          <View className="flex-1 p-3.5 rounded-[17px] bg-bg-card border border-border gap-0.5">
            <Text className="text-[11.5px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.totalPaidLabel')}</Text>
            <Text className="amount text-[17px] font-extrabold tracking-tight text-succes-text">{formatNumber(ledger.totalPaid, locale)}</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-extrabold tracking-widest text-text-dim mb-0.5">{t('resellerConsignment.ledgerTitle')}</Text>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {ledger.entries.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('resellerConsignment.noMovement')}</Text>
        ) : (
          ledger.entries.map((entry, i) => {
            const positive = entry.type !== 'CONSIGNMENT_OUT'
            const isOut = entry.type === 'CONSIGNMENT_OUT'
            const isExpanded = isOut && expandedId === entry.consignmentOutId
            return (
              <View key={i} className="rounded-2xl bg-bg-card border border-border overflow-hidden">
                <Pressable onPress={() => toggleExpand(entry)} disabled={!isOut} className="flex-row items-center gap-3 p-3.5">
                  <View className="w-9 h-9 rounded-[11px] items-center justify-center" style={{ backgroundColor: positive ? '#E6F1EC' : '#F4E7D2' }}>
                    <Text className="text-sm font-extrabold" style={{ color: positive ? '#1F5C43' : '#6B5410' }}>
                      {positive ? '+' : '📦'}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-bold" numberOfLines={1}>
                      {entryLabel(entry, t)}
                    </Text>
                    <Text className="text-[13px] text-text-dim">{formatDateTime(entry.date, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text className={`amount text-[15px] font-extrabold ${positive ? 'text-succes-text' : ''}`}>
                    {positive ? '+' : ''}
                    {formatNumber(entry.amount, locale)}
                  </Text>
                  {isOut && (isExpanded ? <ChevronUp size={17} color="#A2A9B8" /> : <ChevronDown size={17} color="#A2A9B8" />)}
                </Pressable>

                {isExpanded && (
                  <View className="px-3.5 pb-3.5 gap-2">
                    {entry.lines.map((line) => {
                      const stillOut = line.quantityOut - line.quantityReturned
                      return (
                        <View key={line.lineId} className="flex-row items-center gap-3 p-2.5 rounded-xl bg-bg-elevated">
                          <View className="flex-1 gap-0.5">
                            <Text className="text-sm font-bold" numberOfLines={1}>
                              {line.productName}
                            </Text>
                            <Text className="amount text-xs font-semibold text-text-dim">
                              {t('resellerConsignment.lineQuantityOut', { count: line.quantityOut })}{line.quantityReturned > 0 ? ` · ${t('resellerConsignment.lineQuantityReturned', { count: line.quantityReturned })}` : ''} · {t('resellerConsignment.lineQuantityStillOut', { count: stillOut })}
                            </Text>
                          </View>
                          <TextInput
                            keyboardType="number-pad"
                            editable={stillOut > 0}
                            value={returnQty[line.lineId] ?? ''}
                            onChangeText={(v) => {
                              const num = Math.max(0, Math.min(stillOut, Number(v) || 0))
                              setReturnQty((prev) => ({ ...prev, [line.lineId]: num === 0 ? '' : String(num) }))
                            }}
                            placeholder="0"
                            className="w-16 h-9 rounded-lg border border-border-strong bg-bg-card px-2 amount text-sm font-extrabold text-center disabled:opacity-40"
                          />
                        </View>
                      )
                    })}
                    {returnError && <Text className="text-[13px] font-semibold text-danger">{returnError}</Text>}
                    <Pressable
                      onPress={() => submitReturn(entry)}
                      disabled={submittingReturn || entry.lines.every((l) => !returnQty[l.lineId] || Number(returnQty[l.lineId]) <= 0)}
                      className="h-10 rounded-xl bg-bg-card border-2 border-encre items-center justify-center flex-row gap-1.5 disabled:opacity-40"
                    >
                      <Undo2 size={15} color="#111418" />
                      <Text className="text-sm font-extrabold">{submittingReturn ? t('resellerConsignment.recording') : t('resellerConsignment.confirmReturn')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      <View className="px-5 pt-3 pb-9 flex-row gap-2.5">
        <Pressable onPress={() => setMode('newConsignment')} className="flex-1 h-[58px] rounded-[17px] border-2 border-encre bg-bg-card items-center justify-center">
          <Text className="text-[15.5px] font-extrabold">{t('resellerConsignment.consignmentOutButton')}</Text>
        </Pressable>
        <Pressable onPress={() => setMode('payment')} disabled={ledger.totalRemaining <= 0} className="flex-[1.35] h-[58px] rounded-[17px] bg-success items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-[16.5px] font-extrabold">{t('resellerConsignment.collectTitle')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
