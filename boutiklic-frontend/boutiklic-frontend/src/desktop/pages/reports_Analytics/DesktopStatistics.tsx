import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, TrendingUp, TrendingDown, Lock } from 'lucide-react'
import { formatNumber, formatDate, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { reportingApi, type BilanResponse } from '../../../lib/reportingApi'
import { salesApi, type SaleHistoryItemResponse } from '../../../lib/salesApi'
import { paymentPortions } from '../../../lib/salePayments'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { fmtLocalDate } from '../../../components/PeriodDropdown'
import { useTopBar } from '../../hooks/useTopBar'
import VatReportCard from './VatReportCard'
import SalesReportsCard from './SalesReportsCard'

type PeriodMode = 'day' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom'
type DailyBar = { key: string; revenue: number; margin: number | null; isToday: boolean }

/** Au-delà, un graphique journalier n'a plus de sens visuel (ex. une année entière barre par
 *  barre) — masqué plutôt que regroupé par mois, non demandé. Même seuil que l'ancienne version. */
const MAX_DAILY_BARS = 31

const METHOD_COLORS: Record<string, string> = { CASH: '#0E2038', MOBILE_MONEY_ORANGE: '#D84E2A', MOBILE_MONEY_WAVE: '#E69D3B', DEBT: '#0E7A52' }
const METHOD_LABEL_KEY: Record<string, string> = {
  CASH: 'registerSales.methodCash', MOBILE_MONEY_ORANGE: 'registerSales.methodOrangeMoney',
  MOBILE_MONEY_WAVE: 'registerSales.methodWave', DEBT: 'registerSales.methodDebt',
}

function startOfDayIso(dateStr: string) { return `${dateStr}T00:00:00.000Z` }
function endOfDayIso(dateStr: string) { return `${dateStr}T23:59:59.999Z` }
function monthStart() { const now = new Date(); return fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)) }
function monthEnd() { const now = new Date(); return fmtLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
function last7DaysRange() { const to = new Date(); const from = new Date(to); from.setDate(to.getDate() - 6); return { from: fmtLocalDate(from), to: fmtLocalDate(to) } }
function previousMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: fmtLocalDate(start), to: fmtLocalDate(end) }
}

function rangeForMode(mode: PeriodMode, customFrom: string, customTo: string): { from: string; to: string } | null {
  const today = fmtLocalDate(new Date())
  switch (mode) {
    case 'day': return { from: today, to: today }
    case 'week': return last7DaysRange()
    case 'month': return { from: monthStart(), to: monthEnd() }
    case 'lastMonth': return previousMonthRange()
    case 'year': { const y = new Date().getFullYear(); return { from: `${y}-01-01`, to: `${y}-12-31` } }
    case 'custom': return customFrom && customTo ? { from: customFrom, to: customTo } : null
  }
}

/** Fenêtre de même durée immédiatement avant la période choisie, pour "+X% vs période
 *  précédente" (KPI1). Mois/année utilisent le mois/l'année civile précédente ; les autres
 *  décalent simplement d'une durée équivalente. */
function previousRangeFor(mode: PeriodMode, range: { from: string; to: string }): { from: string; to: string } {
  const from = new Date(range.from)
  const to = new Date(range.to)
  if (mode === 'month') {
    const end = new Date(from.getFullYear(), from.getMonth(), 0)
    const start = new Date(end.getFullYear(), end.getMonth(), 1)
    return { from: fmtLocalDate(start), to: fmtLocalDate(end) }
  }
  if (mode === 'lastMonth') {
    const start = new Date(from.getFullYear(), from.getMonth() - 1, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    return { from: fmtLocalDate(start), to: fmtLocalDate(end) }
  }
  if (mode === 'year') return { from: `${from.getFullYear() - 1}-01-01`, to: `${from.getFullYear() - 1}-12-31` }
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const prevTo = new Date(from)
  prevTo.setDate(from.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevTo.getDate() - (spanDays - 1))
  return { from: fmtLocalDate(prevFrom), to: fmtLocalDate(prevTo) }
}

/** W8bis — refonte visuelle (étude study/web/statistique_web_page_redesign) : rapport plein écran
 *  à 6 filtres de période (Aujourd'hui/7 jours/Ce mois/Mois précédent/Année/Personnalisé), 4 KPI,
 *  graphique CA+Marge journalier, top produits rentables, heures de pointe et répartition des
 *  encaissements. Contrairement à l'ancien W8, la marge par jour et le classement produits par
 *  marge sur une période libre n'existaient pas côté API — ajoutés côté backend dans ce même lot
 *  (ReportingQueryAdapter.dailyBreakdownSeries/topProfitableProducts, champs additifs sur
 *  BilanReport/BilanResponse, aucun contrat existant modifié).
 *
 *  Écarts assumés vis-à-vis du mockup :
 *  - Rôle non-propriétaire : /reports/bilan exige PERM_REPORT_FINANCIAL_VIEW. Le CA, le ticket
 *    moyen, les heures de pointe et la répartition des encaissements restent dérivés de
 *    salesApi.getHistory() (accessible à tous les rôles, comme l'ancien W8) ; marge brute, barres
 *    de marge, top produits rentables et audit de caisse restent masqués (pas de fausse marge à
 *    zéro), avec une mention explicite plutôt qu'un silence.
 *  - "vs Fév 2026 (7 850 000 GNF)" du mockup nomme le mois précédent : généralisé en "vs période
 *    précédente", calculé pour n'importe quel mode (jour/semaine/mois/année/personnalisé) à partir
 *    du même historique de ventes, pas seulement pour "Ce mois".
 *  - "Conforme aux objectifs mensuels (104%)" retiré : aucun objectif de vente configurable
 *    n'existe côté modèle.
 *  - "Mobile Money cumulé : +8 pts en 6 mois" retiré : aucune série historique de répartition des
 *    encaissements n'est conservée pour calculer une tendance ; seul le cumul actuel est affiché.
 *  - "Audit de caisse conforme · 18:42" : CashCountResponse n'a pas d'horodatage, seulement une
 *    date de période — l'heure exacte est retirée, seul l'écart (bilan.cashGap) est montré.
 *  - Recommandations produit/caisse ("commande groupée fournisseur de Coyah", conseil d'horaires
 *    figé) généralisées en phrases dérivées des vrais chiffres du moment plutôt que du texte fixe
 *    du mockup. */
export default function DesktopStatistics() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant, formatCurrency } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  useTopBar({ title: t('desktopShell.nav.stats') }, [t])

  const [mode, setMode] = useState<PeriodMode>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [bilan, setBilan] = useState<BilanResponse | null>(null)
  const [history, setHistory] = useState<SaleHistoryItemResponse[]>([])
  const [previousRevenue, setPreviousRevenue] = useState<number | null>(null)
  const [refundedTotal, setRefundedTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const range = rangeForMode(mode, customFrom, customTo)

  useEffect(() => {
    if (!range) {
      setBilan(null)
      setHistory([])
      setRefundedTotal(0)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    const bilanRequest = !isOwner ? Promise.resolve(null) :
      mode === 'day' ? reportingApi.getBilan('day') :
      mode === 'month' ? reportingApi.getBilan('month') :
      mode === 'year' ? reportingApi.getBilan('year') :
      reportingApi.getBilanRange(range.from, range.to)
    Promise.all([
      salesApi.getHistory(startOfDayIso(range.from), endOfDayIso(range.to)),
      bilanRequest,
      salesApi.getRefundSummary(startOfDayIso(range.from), endOfDayIso(range.to)),
    ])
      .then(([h, b, refunds]) => {
        setHistory(h)
        setBilan(b)
        setRefundedTotal(refunds.cash + refunds.credit + refunds.debt)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customFrom, customTo, isOwner])

  useEffect(() => {
    if (!range) {
      setPreviousRevenue(null)
      return
    }
    const prev = previousRangeFor(mode, range)
    Promise.all([
      salesApi.getHistory(startOfDayIso(prev.from), endOfDayIso(prev.to)),
      salesApi.getRefundSummary(startOfDayIso(prev.from), endOfDayIso(prev.to)),
    ])
      .then(([h, refunds]) => setPreviousRevenue(
        h.filter((s) => s.status !== 'CANCELLED').reduce((s, x) => s + x.totalAmount, 0) - (refunds.cash + refunds.credit + refunds.debt),
      ))
      .catch(() => setPreviousRevenue(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, customFrom, customTo])

  const stats = useMemo(() => {
    const completed = history.filter((s) => s.status !== 'CANCELLED')
    const grossRevenue = completed.reduce((s, x) => s + x.totalAmount, 0)
    // Chiffre d'affaires NET des retours de la période (date du retour) — même règle que le bilan serveur, sinon
    // « marge % » (bilan.profit, net) serait divisée par un CA brut.
    const revenue = grossRevenue - refundedTotal
    const salesCount = completed.length
    // Panier moyen = taille d'un ticket au moment de la vente : reste calculé sur le brut.
    const avgTicket = salesCount > 0 ? Math.round(grossRevenue / salesCount) : 0

    const byDay = new Map<string, number>()
    const byHour = new Map<number, { count: number; revenue: number }>()
    const byMethod = new Map<string, number>()
    for (const s of completed) {
      const d = new Date(s.createdAt)
      const dayKey = d.toISOString().slice(0, 10)
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + s.totalAmount)
      const hour = d.getHours()
      const h = byHour.get(hour) ?? { count: 0, revenue: 0 }
      h.count += 1
      h.revenue += s.totalAmount
      byHour.set(hour, h)
      // Par tranche de règlement : une vente mixte contribue à chacun de ses modes (sinon « Mixte » fausserait
      // la répartition et le pourcentage mobile money).
      for (const p of paymentPortions(s)) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount)
    }

    const weekdayAgg = new Map<number, { total: number; days: Set<string> }>()
    for (const [dayKey, rev] of byDay) {
      const dow = new Date(dayKey).getUTCDay()
      const agg = weekdayAgg.get(dow) ?? { total: 0, days: new Set<string>() }
      agg.total += rev
      agg.days.add(dayKey)
      weekdayAgg.set(dow, agg)
    }
    let bestWeekday: { dow: number; avg: number } | null = null
    for (const [dow, agg] of weekdayAgg) {
      const avg = agg.total / agg.days.size
      if (!bestWeekday || avg > bestWeekday.avg) bestWeekday = { dow, avg }
    }

    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, ...(byHour.get(h) ?? { count: 0, revenue: 0 }) }))
    const peakHour = [...hourBuckets].sort((a, b) => b.count - a.count)[0] ?? null
    const methodBreakdown = Array.from(byMethod.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount)

    const dailyFallback: DailyBar[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rev]) => ({ key, revenue: rev, margin: null, isToday: key === new Date().toISOString().slice(0, 10) }))

    return { revenue, salesCount, avgTicket, hourBuckets, peakHour, bestWeekday, methodBreakdown, dailyFallback }
  }, [history, refundedTotal])

  const dailyBars: DailyBar[] = useMemo(() => {
    if (isOwner && bilan) {
      const todayKey = fmtLocalDate(new Date())
      return bilan.dailySeries.map((d) => ({ key: d.date, revenue: d.revenue, margin: d.margin, isToday: d.date === todayKey }))
    }
    return stats.dailyFallback
  }, [isOwner, bilan, stats.dailyFallback])

  const showDailyChart = dailyBars.length > 1 && dailyBars.length <= MAX_DAILY_BARS
  const maxDailyValue = Math.max(...dailyBars.map((d) => d.revenue), 1)
  const dailyAverage = dailyBars.length > 0 ? dailyBars.reduce((s, d) => s + d.revenue, 0) / dailyBars.length : 0

  const topProfitable = isOwner ? (bilan?.topProfitableProducts ?? []).slice(0, 5) : []
  const maxProductRevenue = Math.max(...topProfitable.map((p) => p.revenue), 1)
  const mostMarginProduct = topProfitable.length > 0 ? [...topProfitable].sort((a, b) => b.marginPercent - a.marginPercent)[0] : null

  const revenueDeltaPct = previousRevenue !== null && previousRevenue > 0 ? ((stats.revenue - previousRevenue) / previousRevenue) * 100 : null
  const methodTotal = stats.methodBreakdown.reduce((s, m) => s + m.amount, 0) || 1
  const mobileMoneyPct = Math.round(
    (stats.methodBreakdown.filter((m) => m.method === 'MOBILE_MONEY_ORANGE' || m.method === 'MOBILE_MONEY_WAVE').reduce((s, m) => s + m.amount, 0) / methodTotal) * 100,
  )

  const weekdayLabel = (dow: number) => new Date(2024, 0, 7 + dow).toLocaleDateString(locale, { weekday: 'long' })

  const PERIOD_PILLS: { id: PeriodMode; label: string }[] = [
    { id: 'day', label: t('components.period.today') },
    { id: 'week', label: t('reportsAnalytics.periodWeek') },
    { id: 'month', label: t('components.period.thisMonth') },
    { id: 'lastMonth', label: t('reportsAnalytics.periodLastMonth') },
    { id: 'year', label: t('reportsAnalytics.periodYearWithValue', { year: new Date().getFullYear() }) },
  ]

  const handleExport = async () => {
    if (!range || exporting || !isOwner) return
    setExporting(true)
    setError(null)
    try {
      const blob =
        mode === 'day' ? await reportingApi.export('day', 'pdf') :
        mode === 'month' ? await reportingApi.export('month', 'pdf') :
        mode === 'year' ? await reportingApi.export('year', 'pdf') :
        await reportingApi.exportRange(range.from, range.to, 'pdf')
      await downloadBlob(blob, `bilan-${range.to}.pdf`)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const reportRef = range ? `STAT-${range.to.replace(/-/g, '')}` : 'STAT-0000'

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-bg-card p-4 sm:p-5 rounded-2xl border border-border">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary bg-info-bg px-2 py-0.5 rounded-full">{t('reportsAnalytics.statsPageEyebrow')}</span>
            <span className="text-text-dim/50 text-xs">●</span>
            <span className="amount text-xs text-text-dim">{t('reportsAnalytics.reportRefLabel', { code: reportRef })}</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-primary tracking-tight">{t('reportsAnalytics.statsPageTitle')}</h1>
          {range && (
            <p className="text-[13px] font-semibold text-text-dim">
              {t('reportsAnalytics.statsPageSubtitle', { shop: tenant.name, from: formatDate(range.from, locale, { day: 'numeric', month: 'short', year: 'numeric' }), to: formatDate(range.to, locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex max-w-full p-1 bg-bg rounded-xl gap-1 flex-wrap">
            {PERIOD_PILLS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMode(p.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm ${mode === p.id ? 'bg-primary text-papier font-extrabold shadow-sm' : 'text-text-muted font-semibold hover:text-text'}`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm flex items-center gap-1 ${mode === 'custom' ? 'bg-primary text-papier font-extrabold shadow-sm' : 'text-text-muted font-semibold hover:text-text'}`}
            >
              {t('reportsAnalytics.periodCustom')}
            </button>
          </div>
          {mode === 'custom' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-border-strong bg-bg px-2 text-xs font-semibold outline-none focus:border-primary" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg border border-border-strong bg-bg px-2 text-xs font-semibold outline-none focus:border-primary" />
            </div>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={!isOwner || exporting || !range}
            title={!isOwner ? t('reportsAnalytics.financialDataOwnerOnlyNotice') : undefined}
            className="inline-flex items-center gap-2 bg-bg text-primary font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-bg-elevated transition-all shadow-sm disabled:opacity-40"
          >
            <Download size={16} />
            {exporting ? t('common.loading') : t('reportsAnalytics.exportPdfExcelButton')}
          </button>
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-bg-card rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between gap-2 min-h-36 min-w-0 border border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim">{t('reportsAnalytics.revenueLabel')}</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-primary tracking-tight">{formatNumber(stats.revenue, locale)}</span>
                <span className="text-[11px] font-extrabold text-text-dim">{tenant.currency}</span>
              </div>
            </div>
          </div>
          {revenueDeltaPct !== null ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${revenueDeltaPct >= 0 ? 'bg-succes-bg text-succes-text' : 'bg-[#FBE9E4] text-terracotta'}`}>
                {revenueDeltaPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {revenueDeltaPct >= 0 ? '+' : ''}{revenueDeltaPct.toFixed(1)}%
              </span>
              <span className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.vsPreviousPeriod', { amount: formatNumber(previousRevenue ?? 0, locale) })}</span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.validatedTicketsCaption', { count: stats.salesCount })}</span>
          )}
        </div>

        <div className="bg-bg-card rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between gap-2 min-h-36 min-w-0 border border-border">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim">{t('reportsAnalytics.profitWord')}</span>
            {!isOwner && <Lock size={14} className="text-text-dim" />}
          </div>
          {isOwner && bilan ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-succes-text tracking-tight">{formatNumber(bilan.profit, locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-succes-text">{stats.revenue > 0 ? ((bilan.profit / stats.revenue) * 100).toFixed(1) : '0.0'}%</span>
                <span className={`amount text-xs px-2 py-0.5 rounded-md font-bold ${bilan.profit >= 0 ? 'bg-succes-bg text-succes-text' : 'bg-[#FBE9E4] text-terracotta'}`}>
                  {bilan.profit >= 0 ? t('reportsAnalytics.profitableBadge') : t('reportsAnalytics.unprofitableBadge')}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.financialDataOwnerOnlyNotice')}</span>
          )}
        </div>

        <div className="bg-bg-card rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between gap-2 min-h-36 min-w-0 border border-border">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim">{t('reportsAnalytics.avgTicketLabel')}</span>
          <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-text tracking-tight">{formatCurrency(stats.avgTicket)}</span>
          <span className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.validatedTicketsCaption', { count: stats.salesCount })}</span>
        </div>

        <div className="bg-bg-card rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between gap-2 min-h-36 min-w-0 border border-border">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim">{t('reportsAnalytics.bestDayPeakLabel')}</span>
          {stats.bestWeekday ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-xl sm:text-2xl font-extrabold text-terracotta tracking-tight capitalize">{weekdayLabel(stats.bestWeekday.dow)}</span>
                {stats.peakHour && stats.peakHour.count > 0 && (
                  <span className="text-[11px] font-bold bg-alerte-bg text-alerte-text px-2 py-0.5 rounded-full">{t('reportsAnalytics.peakBadge', { value: `${stats.peakHour.hour}h00` })}</span>
                )}
              </div>
              <span className="amount text-xs font-bold text-text-dim">{t('reportsAnalytics.avgRevenuePerWeekday', { weekday: weekdayLabel(stats.bestWeekday.dow) })} · {formatNumber(Math.round(stats.bestWeekday.avg), locale)} {tenant.currency}</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-text-dim">{t('reportsAnalytics.noSalesToday')}</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div className="bg-bg-card p-4 sm:p-5 rounded-2xl border border-border flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-primary">{t('reportsAnalytics.dailyEvolutionTitle')}</span>
                    <span className="text-[11px] font-bold text-text-dim bg-bg px-2 py-0.5 rounded">{t('reportsAnalytics.daysBadge', { count: dailyBars.length })}</span>
                  </div>
                  <p className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.dailyEvolutionSubtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-bg px-3 py-1 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-primary" />
                    <span className="text-[11px] font-extrabold uppercase text-text">{t('reportsAnalytics.caTotalLegend')}</span>
                  </div>
                  {isOwner && bilan && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-or" />
                      <span className="text-[11px] font-extrabold uppercase text-text">{t('reportsAnalytics.margeNetteLegend')}</span>
                    </div>
                  )}
                </div>
              </div>

              {!showDailyChart ? (
                <div className="text-sm font-semibold text-text-dim py-6 text-center">{dailyBars.length === 0 ? t('reportsAnalytics.noSalesToday') : t('reportsAnalytics.chartTooLong')}</div>
              ) : (
                // Au-delà d'une quinzaine de barres (Ce mois/Mois précédent ≈ 30 jours), les libellés
                // "01 mars" empêchent les items flex-1 de rétrécir (min-width: auto par défaut) et le
                // graphique déborde de sa carte. Passe alors en largeur fixe + défilement horizontal
                // et n'affiche qu'un libellé sur N, comme le graphique des heures de pointe.
                (() => {
                  const dense = dailyBars.length > 14
                  const labelEvery = dense ? Math.ceil(dailyBars.length / 14) : 1
                  return (
                    <div className="h-64 overflow-x-auto overflow-y-hidden">
                      <div className="h-full flex items-end gap-1.5 px-1" style={dense ? { minWidth: `${dailyBars.length * 30}px` } : undefined}>
                        {dailyBars.map((d, i) => {
                          const revenueHeight = Math.max(2, (d.revenue / maxDailyValue) * 100)
                          const marginHeight = d.margin !== null && d.revenue > 0 ? Math.max(0, (d.margin / d.revenue) * revenueHeight) : 0
                          const showLabel = !dense || d.isToday || i % labelEvery === 0
                          return (
                            <div
                              key={d.key}
                              className={`${dense ? 'flex-none w-[22px]' : 'flex-1'} flex flex-col items-center h-full justify-end group cursor-pointer`}
                              title={`${formatDate(d.key, locale, { day: 'numeric', month: 'short' })} · ${formatNumber(d.revenue, locale)}${d.margin !== null ? ` (${formatNumber(d.margin, locale)} ${t('reportsAnalytics.profitWord').toLowerCase()})` : ''}`}
                            >
                              <div className="w-full max-w-[28px] rounded-t-md overflow-hidden flex flex-col justify-end bg-bg" style={{ height: '100%' }}>
                                <div className="w-full bg-primary hover:brightness-110 transition-all rounded-t-md" style={{ height: `${revenueHeight}%` }}>
                                  {marginHeight > 0 && <div className="w-full bg-or" style={{ height: `${marginHeight}%` }} />}
                                </div>
                              </div>
                              <span className={`amount text-[10.5px] mt-2 whitespace-nowrap ${d.isToday ? 'text-terracotta font-bold' : 'text-text-dim font-semibold'}`}>
                                {showLabel ? formatDate(d.key, locale, { day: '2-digit', month: 'short' }) : ''}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()
              )}

              {dailyBars.length > 0 && (
                <div className="flex items-center justify-between bg-bg p-3 rounded-xl text-xs">
                  <span className="font-semibold text-text">{t('reportsAnalytics.dailyAverageSentence', { amount: `${formatNumber(Math.round(dailyAverage), locale)} ${tenant.currency}` })}</span>
                </div>
              )}
            </div>

            <div className="bg-bg-card p-4 sm:p-5 rounded-2xl border border-border flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-col">
                  <h2 className="text-base font-extrabold text-primary">{t('reportsAnalytics.topProfitableTitle')}</h2>
                  <p className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.topProfitableSubtitle')}</p>
                </div>
                {isOwner && topProfitable.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-extrabold uppercase text-text-dim">{t('reportsAnalytics.sortByLabel')}:</span>
                    <span className="font-extrabold text-primary">{t('reportsAnalytics.sortedByRevenueDesc')}</span>
                  </div>
                )}
              </div>

              {!isOwner ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-text-dim py-4">
                  <Lock size={15} /> {t('reportsAnalytics.financialDataOwnerOnlyNotice')}
                </div>
              ) : topProfitable.length === 0 ? (
                <div className="text-sm font-semibold text-text-dim py-4 text-center">{t('reportsAnalytics.noTopProductsData')}</div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {topProfitable.map((p, i) => (
                      <div key={p.productName} className="bg-bg hover:bg-bg-elevated transition-all p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-bg-card flex items-center justify-center text-sm font-extrabold text-primary shadow-sm flex-none">{String(i + 1).padStart(2, '0')}</div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-text break-words">{p.productName}</span>
                            <span className="text-xs font-semibold text-text-dim">{t('registerSales.soldCount', { count: p.quantitySold })}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-5 md:flex-none">
                          <div className="flex flex-col text-left md:text-right">
                            <span className="text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.revenueLabel')}</span>
                            <span className="amount text-sm font-extrabold text-primary">{formatNumber(p.revenue, locale)}</span>
                          </div>
                          <div className="flex flex-col items-end w-24 sm:w-28 flex-none">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.marginColumnLabel')}</span>
                              <span className={`amount text-xs font-bold ${p.marginPercent >= 0 ? 'text-succes-text' : 'text-terracotta'}`}>{p.marginPercent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full ${p.marginPercent >= 0 ? 'bg-succes-text' : 'bg-terracotta'}`} style={{ width: `${Math.min(100, (p.revenue / maxProductRevenue) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {mostMarginProduct && (
                    <div className="bg-succes-bg/60 p-3 rounded-xl flex items-start gap-2.5">
                      <TrendingUp size={17} className="text-succes-text flex-none mt-0.5" />
                      <p className="text-xs font-semibold text-succes-text">
                        <strong>{t('reportsAnalytics.profitabilityObservationLabel')} :</strong>{' '}
                        {t('reportsAnalytics.profitabilityObservationText', { product: mostMarginProduct.productName, percent: mostMarginProduct.marginPercent })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="bg-bg-card p-4 sm:p-5 rounded-2xl border border-border flex flex-col gap-4">
              <div className="flex flex-col">
                <h3 className="text-base font-extrabold text-primary">{t('reportsAnalytics.peakHoursTitle')}</h3>
                <p className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.peakStoreHoursSubtitle')}</p>
              </div>
              <div className="flex items-end justify-between h-40 pt-4 px-1 bg-bg rounded-xl">
                {stats.hourBuckets.map((h) => (
                  <div key={h.hour} className="flex-1 h-full flex flex-col items-center justify-end gap-1" title={`${h.hour}h · ${h.count}`}>
                    <div
                      className="w-full max-w-[10px] rounded-t-sm"
                      style={{ height: `${Math.max(2, (h.count / Math.max(...stats.hourBuckets.map((b) => b.count), 1)) * 100)}%`, background: stats.peakHour && h.hour === stats.peakHour.hour && h.count > 0 ? '#E69D3B' : 'rgba(14,32,56,0.25)' }}
                    />
                    {h.hour % 3 === 0 && <span className="amount text-[9px] text-text-dim">{h.hour}h</span>}
                  </div>
                ))}
              </div>
              {stats.peakHour && stats.peakHour.count > 0 && (
                <div className="bg-alerte-bg p-3 rounded-xl flex items-start gap-2">
                  <TrendingUp size={16} className="text-alerte-text mt-0.5 flex-none" />
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold text-alerte-text">{t('reportsAnalytics.cashierStaffingTipTitle')}</span>
                    <p className="text-xs font-semibold text-alerte-text mt-0.5">{t('reportsAnalytics.cashierStaffingTipText', { peak: `${stats.peakHour.hour}h00` })}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-bg-card p-4 sm:p-5 rounded-2xl border border-border flex flex-col gap-4">
              <div className="flex flex-col">
                <h3 className="text-base font-extrabold text-primary">{t('reportsAnalytics.paymentBreakdownTitle')}</h3>
                <p className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.paymentMethodsSubtitle')}</p>
              </div>

              {stats.methodBreakdown.length === 0 ? (
                <div className="text-sm font-semibold text-text-dim">{t('reportsAnalytics.noSalesToday')}</div>
              ) : (
                <>
                  <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-bg-elevated">
                    {stats.methodBreakdown.map((m) => (
                      <div key={m.method} style={{ width: `${(m.amount / methodTotal) * 100}%`, background: METHOD_COLORS[m.method] ?? '#676E7E' }} title={`${t(METHOD_LABEL_KEY[m.method] ?? 'registerSales.methodCash')} (${Math.round((m.amount / methodTotal) * 100)}%)`} />
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    {stats.methodBreakdown.map((m) => {
                      const pct = Math.round((m.amount / methodTotal) * 100)
                      return (
                        <div key={m.method} className="flex items-center justify-between p-2 rounded-lg bg-bg/60">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-none" style={{ background: METHOD_COLORS[m.method] ?? '#676E7E' }} />
                            <span className="text-sm font-bold text-text">{t(METHOD_LABEL_KEY[m.method] ?? 'registerSales.methodCash')}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="amount text-sm font-extrabold text-text">{pct}%</span>
                            <span className="amount text-[11px] text-text-dim">{formatNumber(m.amount, locale)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="bg-bg p-3 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{t('reportsAnalytics.mobileMoneyCumulativeLabel', { percent: mobileMoneyPct })}</span>
                  </div>
                </>
              )}
            </div>

            {isOwner && range && <VatReportCard from={range.from} to={range.to} />}
            {isOwner && <SalesReportsCard />}

            {isOwner && (
              <div className="bg-bg-card p-4 rounded-2xl border border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-none ${bilan && bilan.cashGap !== null ? (bilan.cashGap === 0 ? 'bg-succes-bg text-succes-text' : 'bg-[#FBE9E4] text-terracotta') : 'bg-bg-elevated text-text-dim'}`}>
                    {bilan && bilan.cashGap !== null ? (bilan.cashGap === 0 ? '✓' : '!') : '—'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-text break-words">
                      {bilan && bilan.cashGap !== null ? (bilan.cashGap === 0 ? t('reportsAnalytics.cashAuditConformTitle') : t('reportsAnalytics.cashAuditDiscrepancyTitle')) : t('reportsAnalytics.noCashCountCaption')}
                    </span>
                    {bilan && bilan.cashGap !== null && <span className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.cashGapCaption', { amount: `${formatNumber(bilan.cashGap, locale)} ${tenant.currency}` })}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
