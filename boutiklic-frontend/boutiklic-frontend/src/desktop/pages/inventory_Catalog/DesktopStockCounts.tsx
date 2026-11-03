import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Plus } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, isOpenStockCount, isSupportedLocale } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { stockCountsApi, type StockCountResponse } from '../../../lib/stockCountsApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { categoriesApi, type CategoryResponse } from '../../../lib/categoriesApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import StockCountStatusBadge from '../../components/StockCountStatusBadge'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import { useTopBar } from '../../hooks/useTopBar'

const selectClass = 'h-11 rounded-xl border border-border-strong bg-bg-card px-3 font-semibold outline-none focus:border-primary'

/** Inventaire physique — liste des comptages et lancement d'un nouveau (étude study/etude_inventaire_physique.md). Seul le propriétaire
 *  lance un comptage (STOCK_COUNT_MANAGE) ; les autres rôles ouvrent un comptage en cours pour saisir leurs quantités, le serveur
 *  tranche sur les permissions réelles. */
export default function DesktopStockCounts() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  useTopBar({ title: t('stockCounts.title') }, [t])

  const [counts, setCounts] = useState<StockCountResponse[]>([])
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startOpen, setStartOpen] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([stockCountsApi.list(), depotsApi.getAll().catch(() => [] as DepotResponse[]), categoriesApi.getAll().catch(() => [] as CategoryResponse[])])
      .then(([countList, depotList, categoryList]) => {
        setCounts(countList)
        setDepots(depotList)
        setCategories(categoryList)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])

  const depotName = useMemo(() => new Map(depots.map((d) => [d.id, d.name])), [depots])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const columns: TableColumn<StockCountResponse>[] = [
    { key: 'date', label: t('stockCounts.columns.date'), render: (c) => formatDateTime(c.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short' }) },
    { key: 'depot', label: t('stockCounts.columns.depot'), render: (c) => depotName.get(c.depotId) ?? '—' },
    {
      key: 'scope',
      label: t('stockCounts.columns.scope'),
      render: (c) => (c.categoryId ? categoryName.get(c.categoryId) ?? '—' : t('stockCounts.scopeAll')),
    },
    { key: 'status', label: t('stockCounts.columns.status'), render: (c) => <StockCountStatusBadge status={c.status} /> },
    { key: 'progress', label: t('stockCounts.columns.progress'), numeric: true, render: (c) => `${c.countedCount} / ${c.lineCount}` },
  ]

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm font-semibold text-text-muted max-w-[640px] min-w-0 flex-1 basis-[240px]">{t('stockCounts.subtitle')}</p>
        {isOwner && (
          <Button onClick={() => setStartOpen(true)} variant="accent" className="flex items-center gap-2">
            <Plus size={16} />
            {t('stockCounts.newCount')}
          </Button>
        )}
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{t('stockCounts.loadError')} {error}</div>}

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : counts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-6 sm:p-10 flex flex-col items-center gap-3 text-center">
          <ClipboardList size={32} className="text-text-dim" />
          <div className="font-display text-lg font-extrabold">{t('stockCounts.empty')}</div>
          {isOwner && <div className="text-sm font-semibold text-text-muted">{t('stockCounts.emptyOwnerHint')}</div>}
        </div>
      ) : (
        <Table columns={columns} rows={counts} getRowKey={(c) => c.id} onRowClick={(c) => navigate(`/stock/inventaire/${c.id}`)} />
      )}

      <StartStockCountModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        depots={depots}
        categories={categories}
        counts={counts}
        onStarted={(count) => navigate(`/stock/inventaire/${count.id}`)}
      />
    </div>
  )
}

interface StartStockCountModalProps {
  open: boolean
  onClose: () => void
  depots: DepotResponse[]
  categories: CategoryResponse[]
  counts: StockCountResponse[]
  onStarted: (count: StockCountResponse) => void
}

function StartStockCountModal({ open, onClose, depots, categories, counts, onStarted }: StartStockCountModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeDepots = depots.filter((d) => d.active)
  const [depotId, setDepotId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [blind, setBlind] = useState(true)
  const [note, setNote] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dépôt visé : celui choisi, sinon le dépôt par défaut (c'est ce que le serveur résout quand on n'en envoie pas).
  const targetDepotId = depotId || activeDepots.find((d) => d.isDefault)?.id || ''
  const openCount = counts.find((c) => c.depotId === targetDepotId && isOpenStockCount(c.status))

  const handleStart = async () => {
    if (starting || openCount) return
    setStarting(true)
    setError(null)
    try {
      const count = await stockCountsApi.start({
        depotId: depotId || undefined,
        categoryId: categoryId || undefined,
        blind,
        note: note.trim() || undefined,
      })
      onStarted(count)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title={t('stockCounts.start.title')}
      subtitle={t('stockCounts.start.subtitle')}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('stockCounts.dismiss')}</Button>
          <Button onClick={handleStart} loading={starting} disabled={!!openCount}>{t('stockCounts.start.submit')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {activeDepots.length > 1 && (
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
            {t('stockCounts.start.depot')}
            <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={selectClass}>
              {activeDepots.map((d) => (
                <option key={d.id} value={d.isDefault ? '' : d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
          {t('stockCounts.start.category')}
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
            <option value="">{t('stockCounts.start.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{`${'— '.repeat(c.depth)}${c.name}`}</option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2.5 text-sm font-semibold text-text">
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="w-4 h-4 mt-0.5 accent-primary" />
          <span className="flex flex-col">
            {t('stockCounts.start.blind')}
            <span className="text-xs font-medium text-text-dim">{t('stockCounts.start.blindHint')}</span>
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
          {t('stockCounts.start.note')}
          <input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('stockCounts.start.notePlaceholder')}
            className={selectClass}
          />
        </label>

        {openCount && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-alerte-bg text-alerte-text px-4 py-3 text-sm font-semibold">
            {t('stockCounts.openCountBanner')}
            <button type="button" className="font-extrabold underline" onClick={() => navigate(`/stock/inventaire/${openCount.id}`)}>
              {t('stockCounts.openCountOpen')}
            </button>
          </div>
        )}
        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
