import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, Modal, Switch, ScrollView } from 'react-native'
import { ChevronLeft, ClipboardList, Plus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, formatDateTime, isOpenStockCount, isSupportedLocale } from '@boutiklic/shared'
import { useAuth } from '../../hooks/useAuth'
import { toErrorMessage } from '../../lib/apiClient'
import { stockCountsApi, type StockCountResponse } from '../../lib/stockCountsApi'
import { depotsApi, type DepotResponse } from '../../lib/depotsApi'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import SelectField from '../../components/SelectField'
import StockCountDetail from './StockCountDetail'

interface StockCountsProps {
  onBack: () => void
}

const STATUS_CLASSES: Record<StockCountResponse['status'], { bg: string; text: string }> = {
  COUNTING: { bg: 'bg-info-bg', text: 'text-primary' },
  PENDING_REVIEW: { bg: 'bg-alerte-bg', text: 'text-alerte-text' },
  VALIDATED: { bg: 'bg-succes-bg', text: 'text-succes-text' },
  CANCELLED: { bg: 'bg-bg-elevated', text: 'text-text-dim' },
}

/** Inventaire physique (mobile) — liste des comptages et lancement d'un nouveau (propriétaire). Écran auto-suffisant : charge ses
 *  propres données et ouvre le détail d'un comptage en place, comme StockTransfers. */
export default function StockCounts({ onBack }: StockCountsProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  const [counts, setCounts] = useState<StockCountResponse[]>([])
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [startOpen, setStartOpen] = useState(false)
  const [depotId, setDepotId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [blind, setBlind] = useState(true)
  const [note, setNote] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [countList, depotList, categoryList] = await Promise.all([
        stockCountsApi.list(),
        depotsApi.getAll().catch(() => [] as DepotResponse[]),
        categoriesApi.getAll().catch(() => [] as CategoryResponse[]),
      ])
      setCounts(countList)
      setDepots(depotList.filter((d) => d.active))
      setCategories(categoryList)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const depotName = useMemo(() => new Map(depots.map((d) => [d.id, d.name])), [depots])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  // Dépôt visé : celui choisi, sinon le dépôt par défaut (ce que le serveur résout quand on n'en envoie pas).
  const targetDepotId = depotId || depots.find((d) => d.isDefault)?.id || ''
  const openCount = counts.find((c) => c.depotId === targetDepotId && isOpenStockCount(c.status))

  const depotOptions = depots.map((d) => ({ label: d.name, value: d.isDefault ? '' : d.id }))
  const categoryOptions = [
    { label: t('stockCounts.start.allCategories'), value: '' },
    ...categories.map((c) => ({ label: `${'— '.repeat(c.depth)}${c.name}`, value: c.id })),
  ]

  const handleStart = async () => {
    if (starting || openCount) return
    setStarting(true)
    setStartError(null)
    try {
      const count = await stockCountsApi.start({
        depotId: depotId || undefined,
        categoryId: categoryId || undefined,
        blind,
        note: note.trim() || undefined,
      })
      setStartOpen(false)
      setSelectedId(count.id)
    } catch (e) {
      setStartError(toErrorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  if (selectedId) {
    return (
      <StockCountDetail
        countId={selectedId}
        onBack={() => {
          setSelectedId(null)
          void load()
        }}
      />
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={onBack} accessibilityLabel={t('stockCounts.back')} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <Text className="text-[19px] font-extrabold tracking-tight">{t('stockCounts.title')}</Text>
        </View>
        {isOwner && (
          <Pressable onPress={() => setStartOpen(true)} accessibilityLabel={t('stockCounts.newCount')} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
            <Plus size={18} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <Text className="px-5 pb-3 text-[13px] font-semibold text-text-muted">{t('stockCounts.subtitle')}</Text>
      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{t('stockCounts.loadError')} {error}</Text>}

      {isLoading ? (
        <Text className="px-5 text-sm font-semibold text-text-dim">{t('common.loading')}</Text>
      ) : counts.length === 0 ? (
        <View className="mx-5 mt-4 rounded-2xl border border-dashed border-border-strong bg-bg-card p-8 items-center gap-2">
          <ClipboardList size={28} color="#8A8178" />
          <Text className="text-base font-extrabold">{t('stockCounts.empty')}</Text>
          {isOwner && <Text className="text-[13px] font-semibold text-text-muted text-center">{t('stockCounts.emptyOwnerHint')}</Text>}
        </View>
      ) : (
        <FlatList
          data={counts}
          keyExtractor={(c: StockCountResponse) => c.id}
          contentContainerClassName="px-5 pb-8 gap-2.5"
          renderItem={({ item }: { item: StockCountResponse }) => {
            const colors = STATUS_CLASSES[item.status]
            return (
              <Pressable onPress={() => setSelectedId(item.id)} className="rounded-2xl border border-border bg-bg-card px-4 py-3.5 gap-1.5">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[15px] font-extrabold" numberOfLines={1}>
                    {`${depotName.get(item.depotId) ?? '—'} · ${item.categoryId ? categoryName.get(item.categoryId) ?? '—' : t('stockCounts.scopeAll')}`}
                  </Text>
                  <View className={`px-2.5 py-1 rounded-full ${colors.bg}`}>
                    <Text className={`text-[11px] font-extrabold ${colors.text}`}>{t(`stockCounts.status.${item.status}`)}</Text>
                  </View>
                </View>
                <Text className="text-xs font-semibold text-text-dim">
                  {formatDateTime(item.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                  {' · '}
                  {t('stockCounts.progressShort', { counted: item.countedCount, total: item.lineCount })}
                </Text>
              </Pressable>
            )
          }}
        />
      )}

      <Modal visible={startOpen} transparent animationType="slide" onRequestClose={() => setStartOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="bg-bg rounded-t-3xl max-h-[85%]" contentContainerClassName="px-5 pt-5 pb-8 gap-3.5" keyboardShouldPersistTaps="handled">
            <Text className="text-lg font-extrabold">{t('stockCounts.start.title')}</Text>
            <Text className="text-[13px] font-semibold text-text-muted">{t('stockCounts.start.subtitle')}</Text>

            {depots.length > 1 && (
              <View className="gap-1.5">
                <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('stockCounts.start.depot')}</Text>
                <SelectField value={depotId} onChange={setDepotId} options={depotOptions} />
              </View>
            )}

            <View className="gap-1.5">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('stockCounts.start.category')}</Text>
              <SelectField value={categoryId} onChange={setCategoryId} options={categoryOptions} />
            </View>

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-bold">{t('stockCounts.start.blind')}</Text>
                <Text className="text-xs font-medium text-text-dim">{t('stockCounts.start.blindHint')}</Text>
              </View>
              <Switch value={blind} onValueChange={setBlind} />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('stockCounts.start.note')}</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                maxLength={500}
                placeholder={t('stockCounts.start.notePlaceholder')}
                className="h-12 rounded-xl border border-border-strong bg-bg-card px-3.5 text-sm font-semibold"
              />
            </View>

            {openCount && (
              <View className="flex-row items-center justify-between gap-3 rounded-xl bg-alerte-bg px-3.5 py-3">
                <Text className="flex-1 text-[13px] font-semibold text-alerte-text">{t('stockCounts.start.openCountBanner')}</Text>
                <Pressable
                  onPress={() => {
                    setStartOpen(false)
                    setSelectedId(openCount.id)
                  }}
                >
                  <Text className="text-[13px] font-extrabold text-alerte-text underline">{t('stockCounts.start.openCountOpen')}</Text>
                </Pressable>
              </View>
            )}
            {startError && <Text className="text-[13px] font-semibold text-danger">{startError}</Text>}

            <Pressable
              onPress={() => void handleStart()}
              disabled={starting || !!openCount}
              className="h-[52px] rounded-xl bg-primary items-center justify-center disabled:opacity-40"
            >
              <Text className="text-papier text-sm font-extrabold">{starting ? '…' : t('stockCounts.start.submit')}</Text>
            </Pressable>
            <Pressable onPress={() => setStartOpen(false)} className="h-[46px] items-center justify-center">
              <Text className="text-[13px] font-extrabold text-text-muted">{t('stockCounts.dismiss')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}
