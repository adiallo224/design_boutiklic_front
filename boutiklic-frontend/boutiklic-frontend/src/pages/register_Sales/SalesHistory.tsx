import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { salesApi, type SaleHistoryItemResponse } from '../../lib/salesApi'
import { hasPaidDebtPortion } from '../../lib/saleCancelGuard'
import { hasPaymentMethod } from '../../lib/salePayments'
import { toErrorMessage } from '../../lib/apiClient'
import PeriodDropdown, { currentWeekRange, fmtLocalDate, type Period } from '../../components/PeriodDropdown'
import SaleReturn from './SaleReturn'

type Filter = 'TOUT' | 'CASH' | 'MOBILE' | 'MIXED' | 'DETTE'

function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}
function endOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`
}
function monthStart(): string {
  const now = new Date()
  return fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))
}
function monthEnd(): string {
  const now = new Date()
  return fmtLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const LONG_PRESS_MS = 600

export default function SalesHistory({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const SUMMARY_LABELS: Record<Period, string> = {
    today: t('registerSales.summaryToday'),
    week: t('registerSales.summaryWeek'),
    month: t('registerSales.summaryMonth'),
    custom: t('registerSales.summaryCustom'),
  }
  const PAYMENT_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    CASH: { label: t('registerSales.methodCash'), bg: '#E6F1EC', color: '#1F5C43' },
    MOBILE_MONEY_ORANGE: { label: t('registerSales.methodOrangeMoney'), bg: '#F4E3DE', color: '#8F3B23' },
    MOBILE_MONEY_WAVE: { label: t('registerSales.methodWave'), bg: '#E4EAF2', color: '#0E2038' },
    DEBT: { label: t('registerSales.methodDebt'), bg: '#FEF4E6', color: '#8A6712' },
    MIXED: { label: t('registerSales.methodMixed'), bg: '#EDE6D0', color: '#6B5F4E' },
  }
  const { formatCurrency } = useTenant()
  const [filter, setFilter] = useState<Filter>('TOUT')
  const [sales, setSales] = useState<SaleHistoryItemResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [returnSale, setReturnSale] = useState<{ id: string; time: string } | null>(null)
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const isCustomReady = customFrom !== '' && customTo !== ''

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  const load = async () => {
    if (period === 'custom' && !isCustomReady) {
      setSales([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [from, to] =
        period === 'today' ? [undefined, undefined] :
        period === 'week' ? [startOfDayIso(currentWeekRange().from), endOfDayIso(currentWeekRange().to)] :
        period === 'month' ? [startOfDayIso(monthStart()), endOfDayIso(monthEnd())] :
        [startOfDayIso(customFrom), endOfDayIso(customTo)]
      const history = await salesApi.getHistory(from, to)
      setSales(history)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [period, customFrom, customTo])

  if (returnSale) {
    return <SaleReturn saleId={returnSale.id} time={returnSale.time} onBack={() => setReturnSale(null)} />
  }

  const filtered = sales.filter((s) => {
    if (filter === 'TOUT') return true
    // Par tranche de règlement : une vente mixte (ex. espèces + dette) apparaît sous chacun de ses modes ET sous « Mixte ».
    if (filter === 'CASH') return hasPaymentMethod(s, 'CASH')
    if (filter === 'MOBILE') return hasPaymentMethod(s, 'MOBILE_MONEY_ORANGE') || hasPaymentMethod(s, 'MOBILE_MONEY_WAVE')
    if (filter === 'MIXED') return s.paymentMethod === 'MIXED'
    return hasPaymentMethod(s, 'DEBT')
  })

  const completedSales = sales.filter((s) => s.status !== 'CANCELLED')
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalSales = completedSales.length

  const startLongPress = (sale: SaleHistoryItemResponse) => {
    if (sale.status === 'CANCELLED') return
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      setCancelling({ id: sale.saleId, reason: '' })
    }, LONG_PRESS_MS)
  }
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }
  const handleTap = (sale: SaleHistoryItemResponse) => {
    if (longPressTriggered.current || sale.status === 'CANCELLED') return
    setReturnSale({ id: sale.saleId, time: formatTime(sale.createdAt) })
  }

  const confirmCancel = async () => {
    if (!cancelling || cancelling.reason.trim().length === 0) return
    setCancelSubmitting(true)
    setError(null)
    try {
      if (await hasPaidDebtPortion(cancelling.id)) {
        setError(t('registerSales.cannotCancelPaidDebtSale'))
        setCancelling(null)
        return
      }
      await salesApi.cancel(cancelling.id, cancelling.reason.trim())
      setCancelling(null)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCancelSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col bg-bg">
      <div className="flex-none px-5 pt-2.5 pb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="text-[21px] font-extrabold tracking-tight">{t('registerSales.history')}</div>
        </div>
        <PeriodDropdown
          period={period}
          onPeriodChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <div className="flex-none px-5 pb-3.5">
        <div
          className="p-4 rounded-[18px] bg-primary flex items-center justify-between"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,253,250,.05) 0 3px,transparent 3px 14px)' }}
        >
          <div className="flex flex-col gap-1">
            <div className="text-[11px] font-extrabold tracking-widest text-papier/60">{SUMMARY_LABELS[period]}</div>
            <div className="amount text-2xl font-extrabold text-papier">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="amount text-lg font-extrabold text-warning">{totalSales}</div>
            <div className="text-[11px] font-bold text-papier/60">{t('registerSales.salesCountLabel')}</div>
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pb-3 flex gap-2">
        {[
          { id: 'TOUT' as const, label: t('registerSales.filterAll') },
          { id: 'CASH' as const, label: t('registerSales.methodCash') },
          { id: 'MOBILE' as const, label: t('registerSales.filterMobile') },
          { id: 'MIXED' as const, label: t('registerSales.methodMixed') },
          { id: 'DETTE' as const, label: t('registerSales.methodDebt') },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`px-4 py-2.5 rounded-[11px] text-sm font-bold ${filter === c.id ? 'bg-primary text-papier' : 'bg-bg-card border border-border-strong text-[#5C5147]'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <div className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</div>}

      <div className="flex-1 px-5 flex flex-col gap-2.5">
        {isLoading ? (
          <div className="text-[13px] font-semibold text-text-dim text-center py-6">{t('common.loading')}</div>
        ) : period === 'custom' && !isCustomReady ? (
          <div className="text-[13px] font-semibold text-text-dim text-center py-6">{t('registerSales.chooseDateRange')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-[13px] font-semibold text-text-dim text-center py-6">{t('registerSales.noSalesYet')}</div>
        ) : (
          filtered.map((sale) => {
            const cancelled = sale.status === 'CANCELLED'
            const payment = PAYMENT_LABELS[sale.paymentMethod] ?? { label: sale.paymentMethod, bg: '#EDE6D0', color: '#6B5F4E' }
            const badge = cancelled ? (sale.cancelledBy ? t('registerSales.cancelledByLabel', { name: sale.cancelledBy }) : t('registerSales.cancelledLabel')) : payment.label
            const badgeBg = cancelled ? '#F7E3E1' : payment.bg
            const badgeColor = cancelled ? '#8F3B23' : payment.color
            return (
              <button
                key={sale.saleId}
                onClick={() => handleTap(sale)}
                onPointerDown={() => startLongPress(sale)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                className={`flex items-center gap-3.5 p-3.5 rounded-2xl bg-bg-card text-left ${cancelled ? 'border border-dashed border-[#E0B9B1] opacity-75' : 'border border-border'}`}
              >
                <div className={`amount text-sm font-extrabold w-11 flex-none ${cancelled ? 'line-through' : ''}`}>{formatTime(sale.createdAt)}</div>
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className={`text-[15px] font-bold ${cancelled ? 'line-through' : ''}`}>{t('registerSales.itemCount', { count: sale.itemCount })}</div>
                  <div className="self-start px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold" style={{ background: badgeBg, color: badgeColor }}>
                    {badge}
                  </div>
                </div>
                <div className={`amount text-base font-extrabold ${cancelled ? 'line-through' : ''}`}>{sale.totalAmount.toLocaleString('fr-FR')},00</div>
              </button>
            )
          })
        )}
      </div>

      {cancelling ? (
        <div className="flex-none px-5 pt-3 pb-9 flex flex-col gap-2.5">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.cancelReasonTitle')}</div>
          <input
            value={cancelling.reason}
            onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })}
            placeholder={t('registerSales.cancelReasonPlaceholder')}
            className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold outline-none focus:border-primary"
          />
          <div className="flex gap-2.5">
            <button onClick={() => setCancelling(null)} className="flex-1 h-[52px] rounded-2xl border border-border-strong text-text-muted font-bold">
              {t('registerSales.cancel')}
            </button>
            <button
              onClick={confirmCancel}
              disabled={cancelSubmitting || cancelling.reason.trim().length === 0}
              className="flex-[1.5] h-[52px] rounded-2xl bg-danger text-papier font-extrabold disabled:opacity-50"
            >
              {cancelSubmitting ? t('registerSales.cancelling') : t('registerSales.confirmCancellation')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-none px-5 pt-3 pb-4">
          <div className="min-h-[52px] rounded-2xl border border-border-strong bg-bg-card flex items-center justify-center px-4 py-2.5 text-center text-sm font-bold text-[#5C5147]">
            {t('registerSales.longPressToCancel')}
          </div>
        </div>
      )}
    </div>
  )
}
