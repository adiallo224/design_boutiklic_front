import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, Modal, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Check, ChevronLeft, FileDown, ScanBarcode, Search } from 'lucide-react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  countGap,
  filterStockCountLines,
  formatDateTime,
  isSupportedLocale,
  parseCountedInput,
  stockCountProgressPercent,
  summarizeStockCount,
  type StockCountLineFilter,
} from '@boutiklic/shared'
import { useAuth } from '../../hooks/useAuth'
import { NetworkError, toErrorMessage } from '../../lib/apiClient'
import { getAccessToken, getActiveTenantId } from '../../lib/session'
import { productsApi, type ProductResponse } from '../../lib/productsApi'
import { stockCountsApi, type StockCountLineResponse, type StockCountResponse } from '../../lib/stockCountsApi'
import {
  clearPendingCounts,
  loadPendingCounts,
  removePendingCounts,
  setPendingCount,
  type PendingCounts,
} from '../../lib/stockCountDraft'
import { enqueueCountEntry, queuedCountProductIds } from '../../lib/stockCountSync'
import { syncEngine } from '../../lib/syncEngine'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'

interface StockCountDetailProps {
  countId: string
  onBack: () => void
}

interface Row {
  line: StockCountLineResponse
  name: string
  barcode: string
  /** Quantité comptée effective : la saisie en attente d'envoi l'emporte sur celle du serveur. */
  counted: number | null
  isPending: boolean
}

const FILTERS: StockCountLineFilter[] = ['all', 'uncounted', 'counted', 'gaps']
const SHEET_FORMATS = ['pdf', 'xlsx', 'csv'] as const
const FORMAT_LABELS: Record<(typeof SHEET_FORMATS)[number], string> = { pdf: 'PDF', xlsx: 'Excel', csv: 'CSV' }

const STATUS_CLASSES: Record<StockCountResponse['status'], { bg: string; text: string }> = {
  COUNTING: { bg: 'bg-info-bg', text: 'text-primary' },
  PENDING_REVIEW: { bg: 'bg-alerte-bg', text: 'text-alerte-text' },
  VALIDATED: { bg: 'bg-succes-bg', text: 'text-succes-text' },
  CANCELLED: { bg: 'bg-bg-elevated', text: 'text-text-dim' },
}

/** Inventaire physique (mobile) — saisie au scan caméra, revue des écarts et validation (étude study/etude_inventaire_physique.md, phases 4 et 5).
 *  Geste principal : « Scanner » -> la quantité à saisir s'ouvre pour l'article trouvé -> Enregistrer -> la caméra se rouvre (scan continu).
 *  Une quantité qui ne part pas faute de réseau est mise dans la file d'opérations (outbox : idempotente, rejouée automatiquement au retour du
 *  réseau) AVEC l'heure de saisie de l'appareil, et gardée dans le brouillon local (lib/stockCountDraft) pour être affichée « À envoyer » :
 *  le compteur ne perd jamais ce qu'il a tapé, et la validation sait que la saisie précède les ventes survenues depuis.
 *  Lancer, rouvrir, valider et annuler sont réservés au propriétaire ; le serveur tranche sur les permissions réelles. L'import d'un fichier
 *  rempli reste un geste du poste de travail. */
export default function StockCountDetail({ countId, onBack }: StockCountDetailProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  const [count, setCount] = useState<StockCountResponse | null>(null)
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [pending, setPending] = useState<PendingCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [filter, setFilter] = useState<StockCountLineFilter>('all')
  const [search, setSearch] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [continuousScan, setContinuousScan] = useState(true)

  const [entryProductId, setEntryProductId] = useState<string | null>(null)
  const [entryFromScan, setEntryFromScan] = useState(false)
  const [entryText, setEntryText] = useState('')
  const [entryError, setEntryError] = useState<string | null>(null)

  const status = count?.status

  const flushPending = useCallback(
    async (current: PendingCounts): Promise<boolean> => {
      const entries = Object.entries(current)
      if (entries.length === 0) return true
      const numbers = entries.filter(([, value]) => value !== null).map(([productId, value]) => ({ productId, quantity: value as number }))
      const clears = entries.filter(([, value]) => value === null).map(([productId]) => productId)
      try {
        let latest: StockCountResponse | null = null
        if (numbers.length > 0) latest = await stockCountsApi.recordCounts(countId, numbers)
        for (const productId of clears) latest = await stockCountsApi.clearCount(countId, productId)
        if (latest) setCount(latest)
        setPending(await removePendingCounts(countId, entries.map(([productId]) => productId)))
        setNotice(null)
        return true
      } catch (e) {
        if (e instanceof NetworkError) setNotice(t('stockCounts.detail.pendingStillOffline'))
        else setError(toErrorMessage(e))
        return false
      }
    },
    [countId, t],
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [loaded, productList, draft] = await Promise.all([
        stockCountsApi.get(countId),
        productsApi.search().catch(() => [] as ProductResponse[]),
        loadPendingCounts(countId),
      ])
      setCount(loaded)
      setProducts(productList)
      if (loaded.status !== 'COUNTING' && Object.keys(draft).length > 0) {
        // Le comptage est passé en revue ou clos pendant que l'appareil était hors ligne : ces saisies n'ont plus d'objet. (Les opérations de
        // la file, elles, restent visibles dans les opérations en échec : rien n'est perdu en silence.)
        await clearPendingCounts(countId)
        setPending({})
      } else {
        setPending(draft)
        // Des saisies attendaient d'être envoyées (coupure ou app fermée) : on retente tout de suite, en silence si le réseau manque encore.
        if (Object.keys(draft).length > 0) await sendPending()
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countId, flushPending])

  useEffect(() => {
    void load()
  }, [load])

  /** Relit le comptage et le brouillon sans écran de chargement (après un envoi, ou quand la file change). Sans réseau : seulement le brouillon. */
  const refreshQuiet = useCallback(async () => {
    try {
      const [loaded, draft] = await Promise.all([stockCountsApi.get(countId), loadPendingCounts(countId)])
      setCount(loaded)
      if (loaded.status !== 'COUNTING' && Object.keys(draft).length > 0) {
        await clearPendingCounts(countId)
        setPending({})
      } else {
        setPending(draft)
      }
    } catch {
      setPending(await loadPendingCounts(countId))
    }
  }, [countId])

  // La file change (saisie ajoutée, opération synchronisée ou retirée) : l'affichage « À envoyer » suit.
  useEffect(() => {
    const unsubscribe = syncEngine.subscribeOutboxChanges(() => {
      void refreshQuiet()
    })
    return () => {
      unsubscribe()
    }
  }, [refreshQuiet])

  const rows: Row[] = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]))
    return (count?.lines ?? [])
      .map((line): Row => {
        const product = productById.get(line.productId)
        const isPending = status === 'COUNTING' && line.productId in pending
        return {
          line,
          name: product?.name ?? t('stockCounts.detail.inactiveProduct'),
          barcode: product?.barcode ?? '',
          counted: isPending ? pending[line.productId] : line.countedQty,
          isPending,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [count, products, pending, status, locale, t])

  const values = useMemo(() => rows.map((r) => ({ productId: r.line.productId, systemQty: r.line.systemQty, countedQty: r.counted })), [rows])
  const summary = useMemo(() => summarizeStockCount(values), [values])
  const hasSystemQty = rows.some((r) => r.line.systemQty != null)
  const pendingCount = Object.keys(pending).length

  const visibleRows = useMemo(() => {
    const allowed = new Set(filterStockCountLines(values, filter).map((v) => v.productId))
    const query = search.trim().toLowerCase()
    return rows.filter((r) => allowed.has(r.line.productId) && (query === '' || r.name.toLowerCase().includes(query) || r.barcode.includes(query)))
  }, [rows, values, filter, search])

  /** Envoie une quantité (ou son retrait) ; sans réseau elle est gardée dans le brouillon local. Renvoie false si le serveur la refuse. */
  const saveEntry = async (productId: string, value: number | null): Promise<boolean> => {
    try {
      const updated = value === null ? await stockCountsApi.clearCount(countId, productId) : await stockCountsApi.recordCounts(countId, [{ productId, quantity: value }])
      setCount(updated)
      setPending(await removePendingCounts(countId, [productId]))
      setNotice(null)
      return true
    } catch (e) {
      if (e instanceof NetworkError) {
        // Brouillon d'abord (l'affichage), puis la file : son changement déclenche le rafraîchissement de l'écran.
        setPending(await setPendingCount(countId, productId, value))
        await enqueueCountEntry(countId, productId, value)
        setNotice(t('stockCounts.detail.savedOnDevice'))
        return true
      }
      setEntryError(toErrorMessage(e))
      return false
    }
  }

  const openEntry = (row: Row, fromScan: boolean) => {
    setEntryProductId(row.line.productId)
    setEntryFromScan(fromScan)
    setEntryText(row.counted == null ? '' : String(row.counted))
    setEntryError(null)
  }

  const closeEntry = () => {
    setEntryProductId(null)
    setEntryError(null)
  }

  const submitEntry = async () => {
    if (!entryProductId) return
    const parsed = parseCountedInput(entryText)
    if (parsed === null) {
      setEntryError(t('stockCounts.entry.invalid'))
      return
    }
    const row = rows.find((r) => r.line.productId === entryProductId)
    const target = parsed === 'empty' ? null : parsed
    if (target === (row?.counted ?? null)) {
      closeEntry()
      return
    }
    const saved = await saveEntry(entryProductId, target)
    if (!saved) return
    const scanned = entryFromScan
    closeEntry()
    // Scan continu : après chaque quantité, la caméra se rouvre pour l'article suivant.
    if (scanned && continuousScan) setShowScanner(true)
  }

  const removeEntry = async () => {
    if (!entryProductId) return
    if (await saveEntry(entryProductId, null)) closeEntry()
  }

  const handleDetected = (code: string) => {
    setShowScanner(false)
    const product = products.find((p) => p.barcode === code)
    const row = product ? rows.find((r) => r.line.productId === product.id) : undefined
    if (!row) {
      setNotice(t('stockCounts.detail.scanNotFound', { code }))
      return
    }
    setNotice(null)
    openEntry(row, true)
  }

  const run = async (action: string, fn: () => Promise<StockCountResponse>) => {
    if (busy) return
    setBusy(action)
    setError(null)
    setNotice(null)
    try {
      setCount(await fn())
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  /**
   * Envoie ce qui attend : la file d'abord (sans effet hors ligne), puis, pour les saisies du brouillon qui n'ont AUCUNE opération en file
   * (orphelines), un envoi direct. Renvoie true quand il ne reste plus rien à envoyer.
   */
  const sendPending = async (): Promise<boolean> => {
    await syncEngine.processOutbox()
    let draft = await loadPendingCounts(countId)
    if (Object.keys(draft).length > 0) {
      const queued = await queuedCountProductIds(countId)
      const orphans = Object.fromEntries(Object.entries(draft).filter(([productId]) => !queued.has(productId)))
      if (Object.keys(orphans).length > 0) await flushPending(orphans)
      draft = await loadPendingCounts(countId)
    }
    await refreshQuiet()
    const done = Object.keys(draft).length === 0
    setNotice(done ? null : t('stockCounts.detail.pendingStillOffline'))
    return done
  }

  const handleSubmit = async () => {
    // Terminer avant que les saisies soient parties les ferait refuser (le comptage ne serait plus en saisie) : on envoie d'abord.
    if (pendingCount > 0 && !(await sendPending())) {
      setError(t('stockCounts.detail.pendingBlocksSubmit'))
      return
    }
    await run('submit', () => stockCountsApi.submit(countId))
  }

  const confirmValidate = () =>
    Alert.alert(
      t('stockCounts.confirm.validateTitle'),
      summary.withGap > 0 ? t('stockCounts.confirm.validateBody', { gaps: summary.withGap }) : t('stockCounts.confirm.validateNoGap'),
      [
        { text: t('stockCounts.confirm.keep'), style: 'cancel' },
        { text: t('stockCounts.confirm.validate'), onPress: () => void run('validate', () => stockCountsApi.validate(countId)) },
      ],
    )

  const confirmCancel = () =>
    Alert.alert(t('stockCounts.confirm.cancelTitle'), t('stockCounts.confirm.cancelBody'), [
      { text: t('stockCounts.confirm.keep'), style: 'cancel' },
      { text: t('stockCounts.confirm.cancel'), style: 'destructive', onPress: () => void run('cancel', () => stockCountsApi.cancel(countId)) },
    ])

  /** Écrit la feuille dans le cache puis ouvre la feuille de partage de l'OS (imprimer le PDF, remplir l'Excel ailleurs). */
  const shareSheet = async (format: (typeof SHEET_FORMATS)[number]) => {
    if (busy) return
    setBusy('sheet')
    setError(null)
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
      const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
      const destination = new File(Paths.cache, `feuille-de-comptage-${new Date().toISOString().slice(0, 10)}.${format}`)
      const file = await File.downloadFileAsync(`${apiBase}${stockCountsApi.sheetPath(countId, format)}`, destination, {
        headers: { Authorization: `Bearer ${token ?? ''}`, 'X-Tenant-ID': tenantId ?? '' },
        idempotent: true,
      })
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri)
    } catch {
      setError(t('stockCounts.actions.sheetFailed'))
    } finally {
      setBusy(null)
    }
  }

  const entryRow = entryProductId ? rows.find((r) => r.line.productId === entryProductId) : undefined

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="text-sm font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }

  if (!count) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-danger">{error ?? t('stockCounts.loadError')}</Text>
      </View>
    )
  }

  const statusColors = STATUS_CLASSES[count.status]
  const percent = stockCountProgressPercent(summary)

  const header = (
    <View className="gap-3 pb-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable onPress={onBack} accessibilityLabel={t('stockCounts.back')} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[19px] font-extrabold tracking-tight" numberOfLines={1}>{t('stockCounts.title')}</Text>
            <Text className="text-xs font-semibold text-text-dim" numberOfLines={1}>
              {t('stockCounts.detail.snapshot', { date: formatDateTime(count.snapshotAt, locale, { dateStyle: 'medium', timeStyle: 'short' }) })}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          {count.blind && (
            <View className="px-2 py-1 rounded-full bg-bg-elevated">
              <Text className="text-[11px] font-extrabold text-text-muted">{t('stockCounts.detail.blindBadge')}</Text>
            </View>
          )}
          <View className={`px-2.5 py-1 rounded-full ${statusColors.bg}`}>
            <Text className={`text-[11px] font-extrabold ${statusColors.text}`}>{t(`stockCounts.status.${count.status}`)}</Text>
          </View>
        </View>
      </View>

      {status === 'COUNTING' && (
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-bold">{t('stockCounts.detail.progress', { counted: summary.counted, total: summary.total })}</Text>
            <Text className="text-xs font-bold text-text-muted">{percent} %</Text>
          </View>
          <View className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <View className="h-full bg-primary" style={{ width: `${percent}%` }} />
          </View>
        </View>
      )}

      {status === 'PENDING_REVIEW' && !isOwner && (
        <Text className="rounded-xl bg-alerte-bg text-alerte-text px-3.5 py-3 text-[13px] font-semibold">{t('stockCounts.detail.pendingReviewInfo')}</Text>
      )}
      {status === 'VALIDATED' && <Text className="rounded-xl bg-succes-bg text-succes-text px-3.5 py-3 text-[13px] font-semibold">{t('stockCounts.detail.validatedInfo')}</Text>}
      {status === 'CANCELLED' && <Text className="rounded-xl bg-bg-elevated text-text-muted px-3.5 py-3 text-[13px] font-semibold">{t('stockCounts.detail.cancelledInfo')}</Text>}

      {pendingCount > 0 && status === 'COUNTING' && (
        <View className="flex-row items-center justify-between gap-3 rounded-xl bg-alerte-bg px-3.5 py-3">
          <Text className="flex-1 text-[13px] font-semibold text-alerte-text">{t('stockCounts.detail.pendingBanner', { count: pendingCount })}</Text>
          <Pressable onPress={() => void sendPending()} className="px-3 py-2 rounded-lg bg-primary">
            <Text className="text-xs font-extrabold text-papier">{t('stockCounts.detail.retryPending')}</Text>
          </Pressable>
        </View>
      )}
      {notice && <Text className="text-[13px] font-semibold text-alerte-text">{notice}</Text>}
      {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

      {(status === 'PENDING_REVIEW' || status === 'VALIDATED') && (
        <View className="flex-row flex-wrap gap-2">
          {[
            [t('stockCounts.summary.withGap'), summary.withGap],
            [t('stockCounts.summary.surplus'), summary.surplusUnits],
            [t('stockCounts.summary.shortage'), summary.shortageUnits],
            [t('stockCounts.summary.uncounted'), summary.uncounted],
          ].map(([label, value]) => (
            <View key={String(label)} className="flex-1 min-w-[45%] rounded-xl bg-bg-card border border-border px-3 py-2.5">
              <Text className="text-[11px] font-extrabold text-text-dim">{label}</Text>
              <Text className="text-lg font-extrabold">{value}</Text>
            </View>
          ))}
        </View>
      )}

      {status === 'COUNTING' && (
        <View className="gap-2.5">
          <Pressable onPress={() => setShowScanner(true)} className="h-[52px] rounded-xl bg-primary flex-row items-center justify-center gap-2">
            <ScanBarcode size={18} color="#FFFDFA" />
            <Text className="text-papier text-sm font-extrabold">{t('stockCounts.detail.scan')}</Text>
          </Pressable>
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold text-text-muted">{t('stockCounts.detail.continuousScan')}</Text>
            <Switch value={continuousScan} onValueChange={setContinuousScan} />
          </View>
        </View>
      )}

      <View className="flex-row items-center gap-2 h-11 rounded-xl border border-border-strong bg-bg-card px-3">
        <Search size={16} color="#8A8178" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('stockCounts.detail.search')}
          className="flex-1 text-sm font-semibold"
        />
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {FILTERS.filter((f) => f !== 'gaps' || hasSystemQty).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`h-9 px-3.5 rounded-full items-center justify-center ${filter === f ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}
          >
            <Text className={`text-xs ${filter === f ? 'text-papier font-extrabold' : 'text-text-muted font-bold'}`}>{t(`stockCounts.detail.filter.${f}`)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )

  const footer = (
    <View className="gap-2.5 pt-4 pb-8">
      {status === 'COUNTING' && (
        <>
          <View className="flex-row items-center gap-2">
            <FileDown size={16} color="#5C5147" />
            <Text className="text-[13px] font-bold text-text-muted flex-1">{t('stockCounts.actions.sheet')}</Text>
            {SHEET_FORMATS.map((format) => (
              <Pressable key={format} onPress={() => void shareSheet(format)} disabled={!!busy} className="px-3 py-2 rounded-lg border border-border-strong bg-bg-card">
                <Text className="text-xs font-extrabold text-primary">{FORMAT_LABELS[format]}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={summary.counted === 0 || !!busy}
            className="h-[52px] rounded-xl bg-primary flex-row items-center justify-center gap-2 disabled:opacity-40"
          >
            <Check size={18} color="#FFFDFA" />
            <Text className="text-papier text-sm font-extrabold">{t('stockCounts.actions.submit')}</Text>
          </Pressable>
          {summary.counted === 0 && <Text className="text-xs font-semibold text-text-dim text-center">{t('stockCounts.actions.submitNeedsCount')}</Text>}
        </>
      )}
      {status === 'PENDING_REVIEW' && isOwner && (
        <>
          <Pressable onPress={confirmValidate} disabled={!!busy} className="h-[52px] rounded-xl bg-primary items-center justify-center disabled:opacity-40">
            <Text className="text-papier text-sm font-extrabold">{t('stockCounts.actions.validate')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void run('reopen', () => stockCountsApi.reopen(countId))}
            disabled={!!busy}
            className="h-[48px] rounded-xl border border-border-strong bg-bg-card items-center justify-center disabled:opacity-40"
          >
            <Text className="text-sm font-extrabold">{t('stockCounts.actions.reopen')}</Text>
          </Pressable>
        </>
      )}
      {(status === 'COUNTING' || status === 'PENDING_REVIEW') && isOwner && (
        <Pressable onPress={confirmCancel} disabled={!!busy} className="h-[48px] rounded-xl items-center justify-center disabled:opacity-40">
          <Text className="text-sm font-extrabold text-danger">{t('stockCounts.actions.cancel')}</Text>
        </Pressable>
      )}
    </View>
  )

  return (
    <View className="flex-1 bg-bg">
      <FlatList
        data={visibleRows}
        keyExtractor={(row: Row) => row.line.productId}
        contentContainerClassName="px-5 pt-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={<Text className="text-sm font-semibold text-text-dim text-center py-6">{t('stockCounts.detail.noLines')}</Text>}
        renderItem={({ item }: { item: Row }) => {
          const gap = status === 'VALIDATED' ? item.line.appliedDelta : countGap({ systemQty: item.line.systemQty, countedQty: item.counted })
          return (
            <Pressable
              onPress={() => status === 'COUNTING' && openEntry(item, false)}
              className="flex-row items-center justify-between gap-3 py-3 border-b border-border"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold" numberOfLines={1}>{item.name}</Text>
                <Text className="text-xs font-medium text-text-dim" numberOfLines={1}>
                  {[item.barcode, item.line.systemQty != null ? t('stockCounts.detail.systemQty', { qty: item.line.systemQty }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View className="items-end gap-0.5">
                {item.isPending && (
                  <View className="px-1.5 py-0.5 rounded bg-alerte-bg">
                    <Text className="text-[10px] font-extrabold text-alerte-text">{t('stockCounts.detail.pendingBadge')}</Text>
                  </View>
                )}
                <Text className={`text-[15px] font-extrabold ${item.counted == null ? 'text-text-dim' : ''}`}>
                  {item.counted == null ? t('stockCounts.detail.notCounted') : t('stockCounts.detail.countedQty', { qty: item.counted })}
                </Text>
                {gap != null && gap !== 0 && (
                  <Text className={`text-xs font-extrabold ${gap < 0 ? 'text-danger' : 'text-succes-text'}`}>{gap > 0 ? `+${gap}` : gap}</Text>
                )}
              </View>
            </Pressable>
          )
        }}
      />

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onDetected={handleDetected} />

      <Modal visible={!!entryRow} transparent animationType="slide" onRequestClose={closeEntry}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/40">
          <View className="bg-bg rounded-t-3xl px-5 pt-5 pb-8 gap-3">
            <Text className="text-lg font-extrabold" numberOfLines={2}>{entryRow?.name}</Text>
            {entryRow?.line.systemQty != null && (
              <Text className="text-[13px] font-semibold text-text-muted">{t('stockCounts.detail.systemQty', { qty: entryRow.line.systemQty })}</Text>
            )}
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('stockCounts.entry.quantity')}</Text>
            <TextInput
              value={entryText}
              onChangeText={(text: string) => {
                setEntryText(text)
                setEntryError(null)
              }}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={() => void submitEntry()}
              className="h-14 rounded-xl border border-border-strong bg-bg-card px-4 text-2xl font-extrabold text-right"
            />
            {entryError && <Text className="text-[13px] font-semibold text-danger">{entryError}</Text>}
            <Pressable onPress={() => void submitEntry()} className="h-[52px] rounded-xl bg-primary items-center justify-center">
              <Text className="text-papier text-sm font-extrabold">{t('stockCounts.entry.save')}</Text>
            </Pressable>
            <View className="flex-row gap-2.5">
              {entryRow?.counted != null && (
                <Pressable onPress={() => void removeEntry()} className="flex-1 h-[46px] rounded-xl border border-border-strong bg-bg-card items-center justify-center">
                  <Text className="text-[13px] font-extrabold text-danger">{t('stockCounts.entry.remove')}</Text>
                </Pressable>
              )}
              <Pressable onPress={closeEntry} className="flex-1 h-[46px] rounded-xl items-center justify-center">
                <Text className="text-[13px] font-extrabold text-text-muted">{t('stockCounts.dismiss')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
