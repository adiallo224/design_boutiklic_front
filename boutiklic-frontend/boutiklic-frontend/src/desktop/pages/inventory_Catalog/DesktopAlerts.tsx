import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { effectiveUnitCost, formatDate as formatDateShared, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { productsApi } from '../../../lib/productsApi'
import { categoriesApi } from '../../../lib/categoriesApi'
import { inventoryApi, type StockLineResponse } from '../../../lib/inventoryApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import KpiCard from '../../../components/KpiCard'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import { useTopBar } from '../../hooks/useTopBar'

interface AlertRow {
  productId: string
  name: string
  category: string
  quantity: number
  alertThreshold: number
  /** Coût unitaire EXACT (un article en lot : prix du lot / unités, sans arrondi) — sert à estimer le coût de réassort. */
  unitCost: number
  lastRestockAt: string | null
}

/** W18 — liste de courses. Le spec dessine aussi une colonne "autonomie en jours" et un
 *  "fournisseur habituel" : ni l'un ni l'autre ne sont dérivables à coût raisonnable aujourd'hui
 *  (il faudrait un appel salesApi.getById par vente historique pour la vélocité produit — non
 *  scalable ; aucun lien produit→fournisseur n'existe côté API) — remplacés par "dernier réappro"
 *  (StockLineResponse.lastRestockAt, déjà disponible) plutôt que d'inventer un chiffre. Signalé
 *  comme écart au plan bureau. */
export default function DesktopAlerts() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { formatCurrency } = useTenant()

  useTopBar({ title: t('reportsAnalytics.stockAlertsTitle') }, [t])

  const [rows, setRows] = useState<AlertRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([productsApi.search(), categoriesApi.getAll(), inventoryApi.getOverview('all')])
      .then(([productList, categoryList, stockLines]) => {
        const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]))
        const stockByProductId = new Map(stockLines.map((s: StockLineResponse) => [s.productId, s]))
        const merged = productList
          .map((p): AlertRow | null => {
            const stock = stockByProductId.get(p.id)
            if (!stock) return null
            if (stock.quantity > stock.alertThreshold) return null
            return {
              productId: p.id,
              name: p.name,
              category: (p.categoryId && categoryNameById.get(p.categoryId)) || t('common.noCategory'),
              quantity: stock.quantity,
              alertThreshold: stock.alertThreshold,
              unitCost: effectiveUnitCost(p),
              lastRestockAt: stock.lastRestockAt,
            }
          })
          .filter((r): r is AlertRow => r !== null)
        setRows(merged)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [t])

  const ruptureRows = rows.filter((r) => r.quantity === 0)
  const lowStockRows = rows.filter((r) => r.quantity > 0)
  const restockCost = rows.reduce((s, r) => s + Math.max(0, r.alertThreshold - r.quantity) * r.unitCost, 0)

  const columns: TableColumn<AlertRow>[] = [
    { key: 'name', label: t('inventoryCatalog.productNameLabel'), render: (r) => <span className="font-bold">{r.name}</span> },
    { key: 'category', label: t('inventoryCatalog.categoryLabel'), render: (r) => r.category },
    { key: 'quantity', label: t('desktopShell.nav.stock'), numeric: true, render: (r) => <span className={r.quantity === 0 ? 'text-danger font-extrabold' : 'text-alerte-text font-extrabold'}>{r.quantity}</span> },
    { key: 'alertThreshold', label: t('inventoryCatalog.alertThresholdColumnLabel'), numeric: true, render: (r) => r.alertThreshold },
    {
      key: 'lastRestockAt',
      label: t('inventoryCatalog.lastRestockLabel'),
      render: (r) => (r.lastRestockAt ? formatDateShared(new Date(r.lastRestockAt), locale, { day: 'numeric', month: 'long' }) : '—'),
    },
    {
      key: 'action',
      label: '',
      align: 'right',
      render: () => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate('/stock/arrivage')
          }}
          className="px-3 py-1.5 rounded-lg bg-primary text-papier text-xs font-extrabold whitespace-nowrap"
        >
          {t('inventoryCatalog.order')}
        </button>
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3">
        <KpiCard variant="terracotta" label={t('inventoryCatalog.outOfStockBadge')} value={String(ruptureRows.length)} />
        <KpiCard variant="gold" label={t('inventoryCatalog.stockAlertBadge')} value={String(lowStockRows.length)} />
        <KpiCard variant="indigo" label={t('inventoryCatalog.restockCostLabel')} value={formatCurrency(restockCost)} />
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : (
        <Table
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.productId}
          rowClassName={(r) => (r.quantity === 0 ? 'bg-[#FDF1EC]' : 'bg-[#FDF6EA]')}
          emptyMessage={t('home.allCaughtUp')}
        />
      )}
    </div>
  )
}
