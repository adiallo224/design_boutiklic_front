import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldBan, ShoppingBag } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, formatMoney, isSupportedLocale } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { useTenant } from '../../../hooks/useTenant'
import { toErrorMessage } from '../../../lib/apiClient'
import { fulfillmentTone, orderTone, paymentTone } from '../../../lib/onlineOrderActions'
import { onlineOrdersApi, type OrderStatus, type OrderSummary, type PaymentStatus } from '../../../lib/onlineOrdersApi'
import Button from '../../components/Button'
import OrderBadge from '../../components/OrderBadge'
import Pagination from '../../components/Pagination'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import { useTopBar } from '../../hooks/useTopBar'
import BlocklistModal from './BlocklistModal'

const PAGE_SIZE = 20
const STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED']
const PAYMENTS: PaymentStatus[] = ['UNPAID', 'PENDING', 'PAID', 'FAILED']
/** Qui peut gérer la liste noire (même règle que ONLINE_ORDER_MANAGE côté serveur). */
const MANAGE_ROLES = ['OWNER', 'SELLER']

/** Commandes en ligne — liste filtrée et paginée côté serveur. Accessible au propriétaire, au vendeur et au superviseur (lecture seule pour ce dernier). */
export default function DesktopOnlineOrders() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const entitlements = useEntitlements()
  const { tenant } = useTenant()
  const { user } = useAuth()
  const canManage = MANAGE_ROLES.includes(user?.role ?? '')

  useTopBar({ title: t('onlineOrders.title') }, [t])

  const [rows, setRows] = useState<OrderSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [payment, setPayment] = useState<PaymentStatus | ''>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blocklistOpen, setBlocklistOpen] = useState(false)

  const included = entitlements.has('ONLINE_STORE')

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    onlineOrdersApi
      .list({ status: status || undefined, paymentStatus: payment || undefined, page: page - 1, size: PAGE_SIZE })
      .then((result) => {
        setRows(result.items)
        setTotal(result.total)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [status, payment, page])

  useEffect(() => {
    if (entitlements.loaded && included) load()
    else if (entitlements.loaded) setIsLoading(false)
  }, [entitlements.loaded, included, load])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const changeFilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const columns: TableColumn<OrderSummary>[] = [
    { key: 'number', label: t('onlineOrders.columns.number'), render: (o) => <span className="font-extrabold whitespace-nowrap">{o.orderNumber}</span> },
    { key: 'buyer', label: t('onlineOrders.columns.buyer'), render: (o) => (<div className="min-w-0"><div className="font-bold break-words">{o.buyerName}</div><div className="text-xs font-semibold text-text-muted">{o.buyerPhone}</div></div>) },
    { key: 'total', label: t('onlineOrders.columns.total'), numeric: true, align: 'right', render: (o) => formatMoney(o.total, o.currency, locale, tenant.sellingPriceDecimals) },
    { key: 'mode', label: t('onlineOrders.columns.mode'), render: (o) => t(`onlineOrders.method.${o.deliveryMethod}`) },
    { key: 'status', label: t('onlineOrders.columns.status'), render: (o) => <OrderBadge tone={orderTone(o.status)} label={t(`onlineOrders.status.${o.status}`)} /> },
    { key: 'payment', label: t('onlineOrders.columns.payment'), render: (o) => <OrderBadge tone={paymentTone(o.paymentStatus)} label={t(`onlineOrders.payment.${o.paymentStatus}`)} /> },
    { key: 'fulfillment', label: t('onlineOrders.columns.fulfillment'), render: (o) => <OrderBadge tone={fulfillmentTone(o.fulfillmentStatus)} label={t(`onlineOrders.fulfillment.${o.fulfillmentStatus}`)} /> },
    { key: 'placed', label: t('onlineOrders.columns.placed'), render: (o) => formatDateTime(o.placedAt, locale, { dateStyle: 'short', timeStyle: 'short' }) },
  ]

  if (entitlements.loaded && !included) {
    return (
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-6 sm:p-10 flex flex-col items-center gap-3 text-center">
          <ShoppingBag size={32} className="text-text-dim" />
          <div className="font-display text-lg font-extrabold">{t('onlineStore.notIncludedTitle')}</div>
          <div className="text-sm font-semibold text-text-muted max-w-[480px]">{t('onlineStore.notIncludedText')}</div>
        </div>
      </div>
    )
  }

  const selectClass = 'h-11 w-full px-3 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary'

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap min-w-0">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('onlineOrders.filters.status')}</span>
            <select value={status} onChange={(e) => changeFilter(() => setStatus(e.target.value as OrderStatus | ''))} className={selectClass}>
              <option value="">{t('onlineOrders.filters.all')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`onlineOrders.status.${s}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('onlineOrders.filters.payment')}</span>
            <select value={payment} onChange={(e) => changeFilter(() => setPayment(e.target.value as PaymentStatus | ''))} className={selectClass}>
              <option value="">{t('onlineOrders.filters.all')}</option>
              {PAYMENTS.map((p) => <option key={p} value={p}>{t(`onlineOrders.payment.${p}`)}</option>)}
            </select>
          </label>
        </div>
        {canManage && (
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => setBlocklistOpen(true)}>
            <ShieldBan size={16} />
            {t('onlineOrders.blocklist.open')}
          </Button>
        )}
      </div>

      {error && <div role="alert" className="text-[13px] font-semibold text-danger">{t('onlineOrders.loadError')} {error}</div>}

      {isLoading || !entitlements.loaded ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-6 sm:p-10 flex flex-col items-center gap-3 text-center">
          <ShoppingBag size={32} className="text-text-dim" />
          <div className="font-display text-lg font-extrabold">{status || payment ? t('onlineOrders.emptyFiltered') : t('onlineOrders.empty')}</div>
          {!status && !payment && <div className="text-sm font-semibold text-text-muted">{t('onlineOrders.emptyHint')}</div>}
        </div>
      ) : (
        <>
          <Table columns={columns} rows={rows} getRowKey={(o) => o.id} onRowClick={(o) => navigate(`/commandes-en-ligne/${o.id}`)} />
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            rangeLabel={t('onlineOrders.showingRange', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}
          />
        </>
      )}

      <BlocklistModal open={blocklistOpen} onClose={() => setBlocklistOpen(false)} />
    </div>
  )
}
