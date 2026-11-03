import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, FileDown, FileUp, RotateCcw, Search, X } from 'lucide-react'
import {
  DEFAULT_LOCALE,
  INVENTORY_EXPORT_FORMATS,
  countGap,
  effectiveUnitCost,
  filterStockCountLines,
  formatDateTime,
  formatMoney,
  formatNumber,
  isSupportedLocale,
  parseCountedInput,
  stockCountGapValue,
  stockCountNetGapValue,
  stockCountProgressPercent,
  summarizeStockCount,
  type InventoryExportFormat,
  type StockCountLineFilter,
} from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { stockCountsApi, type StockCountLineResponse, type StockCountResponse } from '../../../lib/stockCountsApi'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { categoriesApi, type CategoryResponse } from '../../../lib/categoriesApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import StockCountStatusBadge from '../../components/StockCountStatusBadge'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import { useTopBar } from '../../hooks/useTopBar'
import StockCountImportModal from './StockCountImportModal'

const FORMAT_LABELS: Record<InventoryExportFormat, string> = { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' }
const FILTERS: StockCountLineFilter[] = ['all', 'uncounted', 'counted', 'gaps']

interface Row {
  line: StockCountLineResponse
  name: string
  barcode: string
  category: string
  /** undefined pour un article inactif ou inconnu du catalogue actif. */
  unitCost: number | undefined
}

type Confirm = 'validate' | 'cancel' | null

/** Copie de l'objet sans la clé donnée. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record }
  delete copy[key]
  return copy
}

/** Inventaire physique — détail d'un comptage : saisie des quantités (scan ou clavier), revue des écarts, validation.
 *  Saisie : chaque quantité est enregistrée dès qu'on quitte la cellule (le travail n'est jamais perdu), « Entrée » passe à l'article
 *  suivant en revenant sur la recherche, ce qui correspond au geste d'une douchette code-barres (scanner, taper la quantité, Entrée).
 *  Un comptage aveugle ne montre pas le stock système à qui n'a pas la permission de gestion (le serveur ne l'envoie pas).
 *  Lancer, rouvrir, valider et annuler sont réservés au propriétaire ; le serveur tranche sur les permissions réelles. */
export default function DesktopStockCountDetail() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { id: countId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const isOwner = user?.role === 'OWNER'

  useTopBar({ title: t('stockCounts.title') }, [t])

  const [count, setCount] = useState<StockCountResponse | null>(null)
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<StockCountLineFilter>('all')
  const [search, setSearch] = useState('')
  const [scanMiss, setScanMiss] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [importOpen, setImportOpen] = useState(false)

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([
      stockCountsApi.get(countId),
      productsApi.search().catch(() => [] as ProductResponse[]),
      categoriesApi.getAll().catch(() => [] as CategoryResponse[]),
      depotsApi.getAll().catch(() => [] as DepotResponse[]),
    ])
      .then(([loaded, productList, categoryList, depotList]) => {
        setCount(loaded)
        setProducts(productList)
        setCategories(categoryList)
        setDepots(depotList)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [countId])

  useEffect(load, [load])

  const rows: Row[] = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]))
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    return (count?.lines ?? [])
      .map((line): Row => {
        const product = productById.get(line.productId)
        return {
          line,
          name: product?.name ?? t('stockCounts.detail.inactiveProduct'),
          barcode: product?.barcode ?? '',
          category: (product?.categoryId && categoryName.get(product.categoryId)) || t('common.noCategory'),
          unitCost: product
            ? effectiveUnitCost({
                purchasePrice: product.purchasePrice,
                unitCost: product.unitCost,
                packSize: product.packSize,
                packPurchasePrice: product.packPurchasePrice,
              })
            : undefined,
        }
      })
      .sort((a, b) => a.category.localeCompare(b.category, locale) || a.name.localeCompare(b.name, locale))
  }, [count, products, categories, locale, t])

  const summary = useMemo(() => summarizeStockCount(rows.map((r) => r.line)), [rows])
  const unitCostById = useMemo(() => new Map(rows.map((r) => [r.line.productId, r.unitCost])), [rows])
  const netGapValue = useMemo(
    () => stockCountNetGapValue(rows.map((r) => r.line), (productId) => unitCostById.get(productId)),
    [rows, unitCostById],
  )

  const visibleRows = useMemo(() => {
    const byFilter = new Set(filterStockCountLines(rows.map((r) => r.line), filter).map((l) => l.productId))
    const query = search.trim().toLowerCase()
    return rows.filter(
      (r) => byFilter.has(r.line.productId) && (query === '' || r.name.toLowerCase().includes(query) || r.barcode.toLowerCase().includes(query)),
    )
  }, [rows, filter, search])

  const depotName = depots.find((d) => d.id === count?.depotId)?.name ?? ''
  const categoryLabel = categories.find((c) => c.id === count?.categoryId)?.name ?? t('stockCounts.scopeAll')
  const hasSystemQty = rows.some((r) => r.line.systemQty != null)
  const status = count?.status

  const run = async (action: string, fn: () => Promise<StockCountResponse>) => {
    if (busy) return
    setBusy(action)
    setError(null)
    setNotice(null)
    try {
      setCount(await fn())
      setDrafts({})
      setRowErrors({})
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(null)
      setConfirm(null)
    }
  }

  const setSaving = (productId: string, saving: boolean) =>
    setSavingIds((prev) => {
      const next = new Set(prev)
      if (saving) next.add(productId)
      else next.delete(productId)
      return next
    })

  /** Enregistre la saisie d'une ligne quand on la quitte : vide = retirer le comptage, nombre = le consigner. */
  const commitRow = async (line: StockCountLineResponse) => {
    const raw = drafts[line.productId]
    if (raw === undefined) return
    const parsed = parseCountedInput(raw)
    if (parsed === null) {
      setRowErrors((prev) => ({ ...prev, [line.productId]: t('stockCounts.detail.invalidQuantity') }))
      return
    }
    setRowErrors((prev) => without(prev, line.productId))
    const unchanged = parsed === 'empty' ? line.countedQty == null : parsed === line.countedQty
    if (unchanged) {
      setDrafts((prev) => without(prev, line.productId))
      return
    }
    setSaving(line.productId, true)
    try {
      const updated =
        parsed === 'empty'
          ? await stockCountsApi.clearCount(countId, line.productId)
          : await stockCountsApi.recordCounts(countId, [{ productId: line.productId, quantity: parsed }])
      setCount(updated)
      setDrafts((prev) => without(prev, line.productId))
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [line.productId]: toErrorMessage(e) }))
    } finally {
      setSaving(line.productId, false)
    }
  }

  /** Retire le comptage d'un article (il redevient « non compté »). */
  const clearRow = async (productId: string) => {
    setSaving(productId, true)
    try {
      setCount(await stockCountsApi.clearCount(countId, productId))
      setDrafts((prev) => without(prev, productId))
      setRowErrors((prev) => without(prev, productId))
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [productId]: toErrorMessage(e) }))
    } finally {
      setSaving(productId, false)
    }
  }

  const handleSearchEnter = () => {
    const code = search.trim()
    if (!code) return
    const exact = rows.find((r) => r.barcode !== '' && r.barcode === code)
    // Une saisie qui ressemble à un code-barres (chiffres seulement) n'est jamais devinée : un code inconnu doit le dire, pas viser un
    // autre article dont le code le contiendrait. Un nom partiel, lui, peut désigner la seule ligne restante.
    const looksLikeBarcode = /^\d{6,}$/.test(code)
    const target = exact ?? (!looksLikeBarcode && visibleRows.length === 1 ? visibleRows[0] : undefined)
    if (!target) {
      setScanMiss(code)
      return
    }
    setScanMiss(null)
    // Le filtre peut cacher la ligne ciblée : on le remet sur « Tous » avant de viser son champ.
    setFilter('all')
    requestAnimationFrame(() => inputRefs.current[target.line.productId]?.focus())
  }

  const handleSheet = async (format: InventoryExportFormat) => {
    if (busy) return
    setBusy('sheet')
    setError(null)
    try {
      const blob = await stockCountsApi.downloadSheet(countId, format)
      await downloadBlob(blob, `feuille-de-comptage-${new Date().toISOString().slice(0, 10)}.${format}`)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const gapClass = (gap: number | null) => (gap == null || gap === 0 ? 'text-text-muted' : gap < 0 ? 'text-danger' : 'text-succes-text')
  const signed = (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value, locale)}`

  const columns: TableColumn<Row>[] = [
    {
      key: 'article',
      label: t('stockCounts.columns.article'),
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-bold">{r.name}</span>
          <span className="text-xs font-medium text-text-dim">{r.category}</span>
        </div>
      ),
    },
    { key: 'barcode', label: t('stockCounts.columns.barcode'), render: (r) => <span className="text-text-muted">{r.barcode || '—'}</span> },
  ]

  if (hasSystemQty) {
    columns.push({
      key: 'system',
      label: t('stockCounts.columns.system'),
      numeric: true,
      render: (r) => (r.line.systemQty == null ? '—' : formatNumber(r.line.systemQty, locale)),
    })
  }

  if (status === 'COUNTING') {
    columns.push({
      key: 'counted',
      label: t('stockCounts.columns.counted'),
      numeric: true,
      width: '190px',
      render: (r) => {
        const productId = r.line.productId
        const value = drafts[productId] ?? (r.line.countedQty == null ? '' : String(r.line.countedQty))
        return (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {savingIds.has(productId) && <span className="text-xs font-semibold text-text-dim">{t('stockCounts.detail.saving')}</span>}
              <input
                ref={(el) => {
                  inputRefs.current[productId] = el
                }}
                value={value}
                inputMode="numeric"
                placeholder={t('stockCounts.detail.countedPlaceholder')}
                aria-invalid={!!rowErrors[productId]}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [productId]: e.target.value }))}
                onBlur={() => void commitRow(r.line)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  void commitRow(r.line)
                  setSearch('')
                  setScanMiss(null)
                  searchRef.current?.focus()
                }}
                className={`w-24 h-10 rounded-xl border bg-bg-card px-3 text-right font-extrabold tabular-nums outline-none focus:border-primary ${rowErrors[productId] ? 'border-danger' : 'border-border-strong'}`}
              />
              {r.line.countedQty != null && (
                <button
                  type="button"
                  title={t('stockCounts.detail.clear')}
                  aria-label={t('stockCounts.detail.clear')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void clearRow(productId)}
                  className="text-text-dim hover:text-danger"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {rowErrors[productId] && <span className="text-xs font-semibold text-danger">{rowErrors[productId]}</span>}
          </div>
        )
      },
    })
  } else {
    columns.push({
      key: 'counted',
      label: t('stockCounts.columns.counted'),
      numeric: true,
      render: (r) => (r.line.countedQty == null ? '—' : formatNumber(r.line.countedQty, locale)),
    })
    const isValidated = status === 'VALIDATED'
    columns.push({
      key: 'gap',
      label: isValidated ? t('stockCounts.columns.applied') : t('stockCounts.columns.gap'),
      numeric: true,
      render: (r) => {
        const gap = isValidated ? r.line.appliedDelta ?? null : countGap(r.line)
        return <span className={`font-extrabold ${gapClass(gap)}`}>{gap == null ? '—' : signed(gap)}</span>
      },
    })
    if (isOwner) {
      columns.push({
        key: 'gapValue',
        label: t('stockCounts.columns.gapValue'),
        numeric: true,
        render: (r) => {
          const gap = isValidated ? r.line.appliedDelta ?? null : countGap(r.line)
          if (gap == null || gap === 0 || r.unitCost == null) return '—'
          return <span className={gapClass(gap)}>{formatMoney(stockCountGapValue(gap, r.unitCost), tenant.currency, locale)}</span>
        },
      })
    }
  }

  if (isLoading) return <div className="p-4 sm:p-8 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
  if (!count) {
    return (
      <div className="p-4 sm:p-8 flex flex-col gap-3">
        <div className="text-[13px] font-semibold text-danger">{error ?? t('stockCounts.loadError')}</div>
        <Button variant="secondary" onClick={() => navigate('/stock/inventaire')} className="self-start">{t('stockCounts.back')}</Button>
      </div>
    )
  }

  const showSummary = status === 'PENDING_REVIEW' || status === 'VALIDATED'
  const tiles: { label: string; value: string }[] = [
    { label: t('stockCounts.summary.counted'), value: `${summary.counted} / ${summary.total}` },
    { label: t('stockCounts.summary.uncounted'), value: String(summary.uncounted) },
    { label: t('stockCounts.summary.withGap'), value: String(summary.withGap) },
    { label: t('stockCounts.summary.surplus'), value: formatNumber(summary.surplusUnits, locale) },
    { label: t('stockCounts.summary.shortage'), value: formatNumber(summary.shortageUnits, locale) },
  ]
  if (isOwner && hasSystemQty) tiles.push({ label: t('stockCounts.summary.netValue'), value: formatMoney(netGapValue, tenant.currency, locale) })

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => navigate('/stock/inventaire')} className="flex items-center gap-1.5 text-sm font-bold text-text-muted self-start">
          <ArrowLeft size={16} />
          {t('stockCounts.back')}
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="font-display text-xl sm:text-2xl font-extrabold break-words">{depotName ? `${depotName} · ${categoryLabel}` : categoryLabel}</h1>
              <StockCountStatusBadge status={count.status} />
              {count.blind && (
                <span className="inline-flex rounded-full bg-bg-elevated px-2.5 py-1 text-xs font-extrabold text-text-muted">{t('stockCounts.detail.blindBadge')}</span>
              )}
            </div>
            <div className="text-sm font-semibold text-text-muted">
              {t('stockCounts.detail.snapshot', { date: formatDateTime(count.snapshotAt, locale, { dateStyle: 'medium', timeStyle: 'short' }) })}
              {count.note ? ` · ${count.note}` : ''}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {status === 'COUNTING' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border-strong bg-bg-card pl-3 pr-1.5 min-h-11 py-1">
                  <FileDown size={16} className="text-text-muted" />
                  <span className="text-sm font-bold text-text-muted mr-1">{t('stockCounts.actions.sheet')}</span>
                  {INVENTORY_EXPORT_FORMATS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleSheet(f)}
                      className="h-8 px-2.5 rounded-lg text-xs font-extrabold text-primary hover:bg-info-bg disabled:opacity-40"
                    >
                      {FORMAT_LABELS[f]}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" onClick={() => setImportOpen(true)} className="flex items-center gap-2">
                  <FileUp size={16} />
                  {t('stockCounts.actions.import')}
                </Button>
                <Button
                  onClick={() => void run('submit', () => stockCountsApi.submit(countId))}
                  loading={busy === 'submit'}
                  disabled={summary.counted === 0 || !!busy}
                  title={summary.counted === 0 ? t('stockCounts.actions.submitNeedsCount') : undefined}
                  className="flex items-center gap-2"
                >
                  <Check size={16} />
                  {t('stockCounts.actions.submit')}
                </Button>
              </>
            )}
            {status === 'PENDING_REVIEW' && isOwner && (
              <>
                <Button variant="secondary" onClick={() => void run('reopen', () => stockCountsApi.reopen(countId))} loading={busy === 'reopen'} className="flex items-center gap-2">
                  <RotateCcw size={16} />
                  {t('stockCounts.actions.reopen')}
                </Button>
                <Button onClick={() => setConfirm('validate')} disabled={!!busy} className="flex items-center gap-2">
                  <Check size={16} />
                  {t('stockCounts.actions.validate')}
                </Button>
              </>
            )}
            {(status === 'COUNTING' || status === 'PENDING_REVIEW') && isOwner && (
              <Button variant="danger" onClick={() => setConfirm('cancel')} disabled={!!busy}>{t('stockCounts.actions.cancel')}</Button>
            )}
          </div>
        </div>
      </div>

      {status === 'COUNTING' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-sm font-bold">
            <span>{t('stockCounts.detail.progress', { counted: summary.counted, total: summary.total })}</span>
            <span className="text-text-muted">{stockCountProgressPercent(summary)} %</span>
          </div>
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${stockCountProgressPercent(summary)}%` }} />
          </div>
        </div>
      )}

      {status === 'PENDING_REVIEW' && !isOwner && (
        <div className="rounded-xl bg-alerte-bg text-alerte-text px-4 py-3 text-sm font-semibold">{t('stockCounts.detail.pendingReviewInfo')}</div>
      )}
      {status === 'VALIDATED' && <div className="rounded-xl bg-succes-bg text-succes-text px-4 py-3 text-sm font-semibold">{t('stockCounts.detail.validatedInfo')}</div>}
      {status === 'CANCELLED' && <div className="rounded-xl bg-bg-elevated text-text-muted px-4 py-3 text-sm font-semibold">{t('stockCounts.detail.cancelledInfo')}</div>}
      {notice && <div className="rounded-xl bg-succes-bg text-succes-text px-4 py-3 text-sm font-semibold">{notice}</div>}
      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      {showSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl bg-bg-card border border-border p-3 sm:p-4 min-w-0 flex flex-col gap-1">
              <span className="break-words text-xs font-extrabold tracking-wide text-text-dim">{tile.label}</span>
              <span className="font-display text-base sm:text-lg break-all font-extrabold tabular-nums">{tile.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f !== 'gaps' || hasSystemQty).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`h-9 px-3.5 rounded-full text-xs ${filter === f ? 'bg-primary text-papier font-extrabold' : 'bg-bg-card border border-border-strong text-text-muted font-bold'}`}
            >
              {t(`stockCounts.detail.filter.${f}`)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] basis-[260px] max-w-[420px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setScanMiss(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && status === 'COUNTING') {
                e.preventDefault()
                handleSearchEnter()
              }
            }}
            placeholder={t('stockCounts.detail.search')}
            className="w-full h-11 rounded-xl border border-border-strong bg-bg-card pl-9 pr-3 font-semibold outline-none focus:border-primary"
          />
        </div>
      </div>
      {scanMiss && <div className="text-[13px] font-semibold text-danger -mt-3">{t('stockCounts.detail.scanNotFound', { code: scanMiss })}</div>}

      <Table columns={columns} rows={visibleRows} getRowKey={(r) => r.line.productId} emptyMessage={t('stockCounts.detail.noLines')} />

      <Modal
        open={confirm === 'validate'}
        onClose={() => setConfirm(null)}
        width={480}
        title={t('stockCounts.confirm.validateTitle')}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>{t('stockCounts.confirm.keep')}</Button>
            <Button onClick={() => void run('validate', () => stockCountsApi.validate(countId))} loading={busy === 'validate'}>{t('stockCounts.confirm.validate')}</Button>
          </div>
        }
      >
        <p className="text-sm font-semibold text-text-muted break-words">
          {summary.withGap > 0 ? t('stockCounts.confirm.validateBody', { gaps: summary.withGap }) : t('stockCounts.confirm.validateNoGap')}
        </p>
      </Modal>

      <Modal
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        width={480}
        title={t('stockCounts.confirm.cancelTitle')}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>{t('stockCounts.confirm.keep')}</Button>
            <Button variant="danger" onClick={() => void run('cancel', () => stockCountsApi.cancel(countId))} loading={busy === 'cancel'}>{t('stockCounts.confirm.cancel')}</Button>
          </div>
        }
      >
        <p className="text-sm font-semibold text-text-muted break-words">{t('stockCounts.confirm.cancelBody')}</p>
      </Modal>

      <StockCountImportModal
        open={importOpen}
        countId={countId}
        onClose={() => setImportOpen(false)}
        onApplied={(imported) => {
          setImportOpen(false)
          setNotice(t('stockCounts.import.done', { count: imported }))
          load()
        }}
      />
    </div>
  )
}
