import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Ban } from 'lucide-react'
import { isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { salesApi, type SaleHistoryItemResponse } from '../../../lib/salesApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { hasPaidDebtPortion } from '../../../lib/saleCancelGuard'
import { hasPaymentMethod } from '../../../lib/salePayments'
import PeriodDropdown, { currentWeekRange, fmtLocalDate, type Period } from '../../../components/PeriodDropdown'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { useTopBar } from '../../hooks/useTopBar'
import SaleReturnModalDesktop from './SaleReturnModalDesktop'
import InvoiceModalDesktop from './InvoiceModalDesktop'
import { FileText } from 'lucide-react'

type MethodFilter = 'TOUT' | 'CASH' | 'MOBILE' | 'MIXED' | 'DETTE'
const PAGE_SIZE = 25

const PAYMENT_LABEL_KEY: Record<string, string> = {
  CASH: 'registerSales.methodCash', MOBILE_MONEY_ORANGE: 'registerSales.methodOrangeMoney',
  MOBILE_MONEY_WAVE: 'registerSales.methodWave', DEBT: 'registerSales.methodDebt', MIXED: 'registerSales.methodMixed',
}
const PAYMENT_DOT: Record<string, string> = { CASH: 'bg-success', MOBILE_MONEY_ORANGE: 'bg-warning', MOBILE_MONEY_WAVE: 'bg-primary', DEBT: 'bg-terracotta', MIXED: 'bg-text-dim' }

function startOfDayIso(dateStr: string) { return `${dateStr}T00:00:00.000Z` }
function endOfDayIso(dateStr: string) { return `${dateStr}T23:59:59.999Z` }
function monthStart() { const now = new Date(); return fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)) }
function monthEnd() { const now = new Date(); return fmtLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }

/** W36 — historique toutes périodes, recherche par n° de ticket, pagination (règle "toutes
 *  périodes"). Distinct de W15 (DesktopCashJournal, journal du jour à imprimer/clôturer) : ici on
 *  navigue/consulte ET on corrige (retour d'articles, annulation d'une vente, facture) — c'est l'unique
 *  endroit de correction ; le Journal de caisse n'imprime/ne clôture que la journée. Pas de colonne "vendeur" — cf.
 *  SaleHistoryItemResponse (salesApi.ts), qui n'expose que cashierId (aucun nom résolu côté API). */
export default function DesktopSalesHistory() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { formatCurrency } = useTenant()

  useTopBar({ title: t('registerSales.history') }, [t])

  const [period, setPeriod] = useState<Period>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const isCustomReady = customFrom !== '' && customTo !== ''
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('TOUT')
  const [ticketQuery, setTicketQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sales, setSales] = useState<SaleHistoryItemResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null)
  const [invoiceSaleId, setInvoiceSaleId] = useState<string | null>(null)
  const { user } = useAuth()
  // Annuler une vente entière est réservé au propriétaire (PERM_SALE_CANCEL côté serveur) ; le retour d'articles,
  // lui, reste ouvert au vendeur.
  const canCancel = user?.role === 'OWNER'
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const load = () => {
    if (period === 'custom' && !isCustomReady) {
      setSales([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    const [from, to] =
      period === 'today' ? [undefined, undefined] :
      period === 'week' ? [startOfDayIso(currentWeekRange().from), endOfDayIso(currentWeekRange().to)] :
      period === 'month' ? [startOfDayIso(monthStart()), endOfDayIso(monthEnd())] :
      [startOfDayIso(customFrom), endOfDayIso(customTo)]
    salesApi.getHistory(from, to).then(setSales).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
  }

  useEffect(load, [period, customFrom, customTo])
  useEffect(() => setPage(1), [period, customFrom, customTo, methodFilter, ticketQuery])

  const filtered = useMemo(() => {
    const q = ticketQuery.trim().toLowerCase()
    return sales.filter((s) => {
      // Par tranche de règlement : une vente mixte (ex. espèces + dette) apparaît sous chacun de ses modes ET sous « Mixte ».
      if (methodFilter === 'CASH' && !hasPaymentMethod(s, 'CASH')) return false
      if (methodFilter === 'MOBILE' && !hasPaymentMethod(s, 'MOBILE_MONEY_ORANGE') && !hasPaymentMethod(s, 'MOBILE_MONEY_WAVE')) return false
      if (methodFilter === 'MIXED' && s.paymentMethod !== 'MIXED') return false
      if (methodFilter === 'DETTE' && !hasPaymentMethod(s, 'DEBT')) return false
      if (q && !s.saleId.slice(-6).toLowerCase().includes(q)) return false
      return true
    })
  }, [sales, methodFilter, ticketQuery])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /** Ouvre la saisie du motif, sauf si la dette liée a déjà été en partie payée (annulation refusée). */
  const startCancel = async (saleId: string) => {
    setError(null)
    try {
      if (await hasPaidDebtPortion(saleId)) {
        setError(t('registerSales.cannotCancelPaidDebtSale'))
        return
      }
    } catch (e) {
      setError(toErrorMessage(e))
      return
    }
    setCancelReason('')
    setCancelSaleId(saleId)
  }

  const confirmCancel = async () => {
    if (!cancelSaleId || cancelReason.trim().length === 0) return
    setCancelSubmitting(true)
    setError(null)
    try {
      await salesApi.cancel(cancelSaleId, cancelReason.trim())
      setCancelSaleId(null)
      load()
    } catch (e) {
      setCancelSaleId(null)
      setError(toErrorMessage(e))
    } finally {
      setCancelSubmitting(false)
    }
  }

  const columns: TableColumn<SaleHistoryItemResponse>[] = [
    { key: 'time', label: t('registerSales.timeColumn'), render: (s) => <span className={`amount ${s.status === 'CANCELLED' ? 'line-through text-text-dim' : ''}`}>{new Date(s.createdAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> },
    { key: 'no', label: t('registerSales.numberColumn'), render: (s) => <span className="amount text-text-dim">#{s.saleId.slice(-6).toUpperCase()}</span> },
    { key: 'items', label: t('registerSales.itemsColumn'), numeric: true, render: (s) => s.itemCount },
    {
      key: 'method',
      label: t('registerSales.howCustomerPays'),
      render: (s) => (
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${PAYMENT_DOT[s.paymentMethod] ?? 'bg-text-dim'}`} />
          {t(PAYMENT_LABEL_KEY[s.paymentMethod] ?? 'registerSales.methodCash')}
        </span>
      ),
    },
    {
      key: 'status',
      label: '',
      render: (s) =>
        s.status === 'CANCELLED' ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#F7E3E1] text-[#8F3B23]">{s.cancelledBy ? t('registerSales.cancelledByLabel', { name: s.cancelledBy }) : t('registerSales.cancelledLabel')}</span>
        ) : null,
    },
    { key: 'amount', label: t('registerSales.totalToPay'), numeric: true, render: (s) => <span className={s.status === 'CANCELLED' ? 'line-through text-text-dim' : 'font-extrabold'}>{formatCurrency(s.totalAmount)}</span> },
    {
      key: 'invoice',
      label: '',
      render: (s) =>
        s.status === 'CANCELLED' ? null : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setInvoiceSaleId(s.saleId)
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-primary hover:bg-bg-card"
            title={t('billing.generateInvoiceAction') ?? undefined}
          >
            <FileText size={13} />
            {t('billing.generateInvoiceAction')}
          </button>
        ),
    },
    {
      key: 'cancel',
      label: '',
      render: (s) =>
        canCancel && s.status !== 'CANCELLED' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void startCancel(s.saleId)
            }}
            title={t('registerSales.cancel')}
            className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-danger flex-none"
          >
            <Ban size={14} />
          </button>
        ) : null,
    },
  ]

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={ticketQuery}
            onChange={(e) => setTicketQuery(e.target.value)}
            placeholder={t('registerSales.searchByTicketPlaceholder')}
            className="h-10 w-full sm:w-56 pl-9 pr-3 rounded-xl border border-border-strong bg-bg-card font-semibold text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['TOUT', 'CASH', 'MOBILE', 'MIXED', 'DETTE'] as MethodFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setMethodFilter(f)}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold ${methodFilter === f ? 'bg-primary text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}
            >
              {f === 'TOUT' ? t('registerSales.filterAll') : f === 'CASH' ? t('registerSales.methodCash') : f === 'MOBILE' ? t('registerSales.filterMobile') : f === 'MIXED' ? t('registerSales.methodMixed') : t('registerSales.methodDebt')}
            </button>
          ))}
        </div>
        <div className="hidden sm:block flex-1" />
        <PeriodDropdown period={period} onPeriodChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : period === 'custom' && !isCustomReady ? (
        <div className="text-sm font-semibold text-text-dim">{t('registerSales.chooseDateRange')}</div>
      ) : (
        <>
          {filtered.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeLabel={t('registerSales.showingRangeSales', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, filtered.length), total: filtered.length })}
            />
          )}

          <Table
            columns={columns}
            rows={pageRows}
            getRowKey={(s) => s.saleId}
            onRowClick={(s) => (s.status !== 'CANCELLED' ? setReturnSaleId(s.saleId) : undefined)}
            rowClassName={(s) => (s.status === 'CANCELLED' ? 'opacity-70' : '')}
            emptyMessage={t('registerSales.noSalesYet')}
          />
        </>
      )}

      <SaleReturnModalDesktop
        open={!!returnSaleId}
        saleId={returnSaleId}
        onClose={() => setReturnSaleId(null)}
        onDone={() => {
          setReturnSaleId(null)
          load()
        }}
      />

      <InvoiceModalDesktop
        open={!!invoiceSaleId}
        saleId={invoiceSaleId}
        onClose={() => setInvoiceSaleId(null)}
      />

      <Modal
        open={!!cancelSaleId}
        onClose={() => setCancelSaleId(null)}
        width={480}
        title={t('registerSales.cancelReasonTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelSaleId(null)}>{t('registerSales.cancel')}</Button>
            <Button onClick={confirmCancel} disabled={cancelSubmitting || cancelReason.trim().length === 0}>
              {cancelSubmitting ? t('registerSales.cancelling') : t('registerSales.confirmCancellation')}
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder={t('registerSales.cancelReasonPlaceholder')}
          className="h-11 w-full rounded-xl border border-border-strong bg-bg-card px-4 font-semibold text-sm outline-none focus:border-primary"
        />
      </Modal>
    </div>
  )
}
