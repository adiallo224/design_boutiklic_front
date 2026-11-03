import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, ChevronDown, ChevronUp, CalendarRange } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { suppliersApi, type SupplierResponse } from '../../lib/suppliersApi'
import { productsApi, type ProductResponse } from '../../lib/productsApi'
import { inventoryApi, type StockIntakeResponse } from '../../lib/inventoryApi'
import { toErrorMessage } from '../../lib/apiClient'
import SelectField from '../../components/SelectField'
import DateField from '../../components/DateField'
import { formatDate } from '../../lib/dateFormat'

interface ArrivalsListProps {
  onBack: () => void
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateInput(d)
}

function monthStart(): string {
  const d = new Date()
  d.setDate(1)
  return toDateInput(d)
}

export default function ArrivalsList({ onBack }: ArrivalsListProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useTenant()

  const PRESETS: { id: string; label: string; from: string | null; to: string | null }[] = [
    { id: 'all', label: t('inventoryCatalog.presetAll'), from: null, to: null },
    { id: '7d', label: t('inventoryCatalog.presetWeek'), from: daysAgo(7), to: null },
    { id: 'month', label: t('inventoryCatalog.presetMonth'), from: monthStart(), to: null },
  ]
  const [intakes, setIntakes] = useState<StockIntakeResponse[]>([])
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    Promise.all([inventoryApi.getIntakes(), suppliersApi.getAll(), productsApi.search()])
      .then(([i, s, p]) => {
        setIntakes(i)
        setSuppliers(s)
        setProducts(p)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const activePreset = PRESETS.find((p) => p.from === dateFrom && p.to === dateTo)?.id ?? null

  const filtered = intakes
    .filter((i) => {
      if (supplierFilter === '') return true
      if (supplierFilter === 'none') return i.supplierId === null
      return i.supplierId === supplierFilter
    })
    .filter((i) => {
      const d = i.createdAt.slice(0, 10)
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      return true
    })
    .sort((a, b) => (sortOrder === 'desc' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setDateFrom(preset.from)
    setDateTo(preset.to)
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.arrivalsHistoryTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">
            {t('inventoryCatalog.arrivalCount', { count: filtered.length })}
          </Text>
        </View>
      </View>

      <View className="px-5 pb-2.5 flex-row items-center gap-2">
        <View className="flex-1">
          <SelectField
            value={supplierFilter}
            onChange={setSupplierFilter}
            options={[{ label: t('inventoryCatalog.allSuppliers'), value: '' }, { label: t('inventoryCatalog.noSupplier'), value: 'none' }, ...suppliers.map((s) => ({ label: s.name, value: s.id }))]}
            placeholder={t('inventoryCatalog.allSuppliers')}
          />
        </View>
        <Pressable onPress={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))} className="w-[44px] h-[44px] rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          {sortOrder === 'desc' ? <ChevronDown size={18} color="#111418" /> : <ChevronUp size={18} color="#111418" />}
        </Pressable>
      </View>

      <View className="px-5 pb-2.5 flex-row gap-2">
        {PRESETS.map((p) => (
          <Pressable key={p.id} onPress={() => applyPreset(p.id)} className={`flex-1 px-3 py-2 rounded-[11px] items-center ${activePreset === p.id ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
            <Text className={`text-sm font-bold ${activePreset === p.id ? 'text-papier' : 'text-[#5C5147]'}`}>{p.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setShowCustomRange((v) => !v)}
          className={`flex-1 px-3 py-2 rounded-[11px] items-center flex-row justify-center gap-1.5 ${activePreset === null ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}
        >
          <CalendarRange size={15} color={activePreset === null ? '#FFFDFA' : '#5C5147'} />
          <Text className={`text-sm font-bold ${activePreset === null ? 'text-papier' : 'text-[#5C5147]'}`}>{t('inventoryCatalog.customRange')}</Text>
        </Pressable>
      </View>

      {showCustomRange && (
        <View className="px-5 pb-2.5 flex-row gap-2.5">
          <DateField
            value={dateFrom ?? ''}
            onChange={setDateFrom}
            placeholder={t('inventoryCatalog.fromDatePlaceholder')}
            className="flex-1 h-[44px] rounded-xl border border-border-strong bg-bg-card px-3 justify-center"
          />
          <DateField
            value={dateTo ?? ''}
            onChange={setDateTo}
            placeholder={t('inventoryCatalog.toDatePlaceholder')}
            className="flex-1 h-[44px] rounded-xl border border-border-strong bg-bg-card px-3 justify-center"
          />
        </View>
      )}

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('common.loading')}</Text>
        ) : filtered.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('inventoryCatalog.noArrivalsYet')}</Text>
        ) : (
          filtered.map((intake) => {
            const supplier = intake.supplierId ? supplierMap.get(intake.supplierId) : undefined
            const isExpanded = expandedId === intake.id
            return (
              <View key={intake.id} className="rounded-2xl bg-bg-card border border-border overflow-hidden">
                <Pressable onPress={() => setExpandedId(isExpanded ? null : intake.id)} className="flex-row items-center gap-3 p-3.5">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-bold">{formatDate(intake.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                    <Text className="text-[13px] font-semibold text-text-dim">
                      {intake.supplierId ? (supplier?.name ?? t('inventoryCatalog.supplierFallback')) : t('inventoryCatalog.noSupplier')} · {t('inventoryCatalog.unitsCount', { count: intake.totalUnits })}
                    </Text>
                  </View>
                  <Text className="amount text-base font-extrabold">{formatCurrency(intake.totalAmount)}</Text>
                  {isExpanded ? <ChevronUp size={18} color="#A2A9B8" /> : <ChevronDown size={18} color="#A2A9B8" />}
                </Pressable>
                {isExpanded && (
                  <View className="px-3.5 pb-3.5 gap-2">
                    {intake.lines.map((line, i) => {
                      const product = productMap.get(line.productId)
                      return (
                        <View key={i} className="flex-row items-center gap-3 p-2.5 rounded-xl bg-bg-elevated">
                          <View className="w-9 h-9 rounded-lg bg-bg-card items-center justify-center">
                            <Text className="text-base">📦</Text>
                          </View>
                          <View className="flex-1 gap-0.5">
                            <Text className="text-sm font-bold" numberOfLines={1}>
                              {product?.name ?? t('inventoryCatalog.deletedProduct')}
                            </Text>
                            <Text className="amount text-xs font-semibold text-text-dim">
                              {line.quantity} × {formatCurrency(line.unitPurchasePrice)}
                            </Text>
                          </View>
                          <Text className="amount text-sm font-extrabold">{formatCurrency(line.lineTotal)}</Text>
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
