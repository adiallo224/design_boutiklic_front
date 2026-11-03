import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Store, TrendingUp, Wallet, BookOpen, AlertTriangle, Clock, ChevronRight, Phone, Package, Download } from 'lucide-react'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { reportingApi, type DashboardResponse } from '../../../lib/reportingApi'
import { debtApi, type DebtorResponse } from '../../../lib/debtApi'
import { resellerApi, type ResellerResponse, type ResellersTotalResponse } from '../../../lib/resellerApi'
import { salesApi, type RefundSummaryResponse, type SaleHistoryItemResponse } from '../../../lib/salesApi'
import { sumByMethod } from '../../../lib/salePayments'
import { productsApi } from '../../../lib/productsApi'
import { categoriesApi } from '../../../lib/categoriesApi'
import { inventoryApi } from '../../../lib/inventoryApi'
import { teamApi, type TeamMemberResponse } from '../../../lib/teamApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { cacheDashboard, getCachedDashboard } from '../../../lib/reportCache'
import { useTopBar } from '../../hooks/useTopBar'
import CashCountModalDesktop from '../../components/CashCountModalDesktop'
import HorizontalScroller from '../../components/HorizontalScroller'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'

const METHOD_LABEL_KEY: Record<string, string> = {
  CASH: 'registerSales.methodCash',
  MOBILE_MONEY_ORANGE: 'registerSales.methodOrangeMoney',
  MOBILE_MONEY_WAVE: 'registerSales.methodWave',
  DEBT: 'registerSales.methodDebt',
  MIXED: 'registerSales.methodMixed',
}
const METHOD_DOT: Record<string, string> = {
  CASH: 'bg-success',
  MOBILE_MONEY_ORANGE: 'bg-warning',
  MOBILE_MONEY_WAVE: 'bg-primary',
  DEBT: 'bg-terracotta',
  MIXED: 'bg-text-dim',
}
const METHOD_BAR_COLOR: Record<string, string> = {
  CASH: '#0E7A52',
  MOBILE_MONEY_ORANGE: '#E69D3B',
  MOBILE_MONEY_WAVE: '#0E2038',
}

interface StockAlertRow {
  productId: string
  name: string
  imageUrl: string | null
  category: string
  quantity: number
  alertThreshold: number
}

function formatK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
}

/** Jours de retard sur une échéance (>=0) — même calcul que DesktopClients.tsx (daysUntil),
 *  dupliqué à dessein : pas de module utils partagé dans ce repo pour un helper aussi petit. */
function daysLate(dueDate: string | null): number {
  if (!dueDate) return 0
  const due = new Date(dueDate)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86400000))
}

function daysSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000))
}

/** W2 — Tableau de bord, refait à l'identique de study/web/dashboard_web_page_redesign (code.html /
 *  screen.png) plutôt que d'être une simple adaptation : mêmes 4 cartes KPI, même graphique
 *  ventes+marge à 2 barres, même panneau "à traiter en priorité" avec ruptures + recouvrements, même
 *  tableau des dernières ventes. Écarts assumés (rien côté API pour les couvrir) :
 *  - Pas de taux GNF/FCFA ni de bouton "Rapport Z" au sens propre : aucune conversion multi-devise
 *    n'existe, "Rapport Z" renvoie vers /statistiques/export (export PDF/Excel réel déjà en place).
 *  - Marge par jour sur le graphique : SaleHistoryItemResponse n'a pas le coût des marchandises
 *    (même écart déjà documenté dans DesktopStatistics.tsx) — la barre or applique le taux de marge
 *    du jour (profitToday/salesToday) à chaque jour de la semaine, à défaut d'une vraie marge
 *    quotidienne. Propriétaire uniquement (marge masquée pour les autres rôles).
 *  - Pas plus de sélecteur de période : le mockup n'en a pas (toujours "aujourd'hui" + tendance 7
 *    jours) — l'ancien sélecteur semaine/mois/personnalisé de ce fichier existe déjà en détail sur
 *    /statistiques (DesktopStatistics.tsx), pas dupliqué ici.
 *  - Pas de colonne "Action" (réimpression) sur le tableau de ventes : aucune intégration imprimante
 *    thermique n'existe côté app — même chose pour le pied "Imprimante connectée" et les raccourcis
 *    F2/F4/F9 du mockup, aucun des trois n'est câblé, retirés plutôt que laissés inertes.
 *  - "Ce qui se vend le mieux" (top produits) retiré de cet écran comme sur le mockup : reste
 *    disponible sur /statistiques. */
export default function DesktopDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  const [topBarSearch, setTopBarSearch] = useState('')
  useTopBar(
    {
      searchValue: topBarSearch,
      onSearchChange: setTopBarSearch,
      searchPlaceholder: t('inventoryCatalog.searchProductPlaceholder'),
      onSearchSubmit: (q) => {
        if (q.trim()) navigate('/stock', { state: { initialSearchQuery: q.trim() } })
      },
    },
    [t, topBarSearch],
  )

  const [data, setData] = useState<DashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardAsOf, setDashboardAsOf] = useState<string | null>(null)
  const [debtors, setDebtors] = useState<DebtorResponse[]>([])
  const [history, setHistory] = useState<SaleHistoryItemResponse[]>([])
  // Remboursements du jour (date du retour) : déduits des espèces, comme dans le Journal de caisse.
  const [refundsToday, setRefundsToday] = useState<RefundSummaryResponse>({ cash: 0, credit: 0, debt: 0 })
  const [weekHistory, setWeekHistory] = useState<SaleHistoryItemResponse[]>([])
  const [resellerTotal, setResellerTotal] = useState<ResellersTotalResponse | null>(null)
  const [lateResellers, setLateResellers] = useState<ResellerResponse[]>([])
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [stockRows, setStockRows] = useState<StockAlertRow[]>([])
  const [showCashCountModal, setShowCashCountModal] = useState(false)

  // Hors ligne (NetworkError seulement) : repli sur le dernier instantané connu (cf. lib/reportCache.ts,
  // plan offline-first Phase 8) — jamais recalculé localement, juste affiché tel quel avec son
  // horodatage. Une erreur métier reste une vraie erreur (pas de repli).
  const refetchDashboard = () =>
    reportingApi
      .getDashboard()
      .then((d) => {
        cacheDashboard(d)
        setData(d)
        setDashboardAsOf(null)
      })
      .catch((e) => {
        if (e instanceof NetworkError) {
          const { data: cached, asOf } = getCachedDashboard()
          if (cached) {
            setData(cached)
            setDashboardAsOf(asOf)
            return
          }
        }
        setError(toErrorMessage(e))
      })

  useEffect(() => {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    Promise.all([
      refetchDashboard(),
      debtApi.getDebtors('urgency'),
      salesApi.getHistory(),
      salesApi.getHistory(weekStart.toISOString()),
      resellerApi.getTotal(),
      resellerApi.getResellers('late'),
      teamApi.getTeam().catch(() => [] as TeamMemberResponse[]),
      productsApi.search(),
      categoriesApi.getAll(),
      inventoryApi.getOverview('all'),
      salesApi.getRefundSummary(),
    ])
      .then(([, debtorList, todayHistory, weekHist, resellerTotals, resellers, teamList, productList, categoryList, stockLines, refunds]) => {
        setDebtors(debtorList)
        setHistory(todayHistory)
        setRefundsToday(refunds)
        setWeekHistory(weekHist)
        setResellerTotal(resellerTotals)
        setLateResellers(resellers)
        setOperatorName(teamList.find((m) => m.userId === user?.id)?.displayName ?? null)

        const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]))
        const stockByProductId = new Map(stockLines.map((s) => [s.productId, s]))
        const rows: StockAlertRow[] = productList
          .map((p): StockAlertRow | null => {
            const stock = stockByProductId.get(p.id)
            if (!stock || stock.quantity > stock.alertThreshold) return null
            return {
              productId: p.id,
              name: p.name,
              imageUrl: p.imageUrl,
              category: (p.categoryId && categoryNameById.get(p.categoryId)) || t('common.noCategory'),
              quantity: stock.quantity,
              alertThreshold: stock.alertThreshold,
            }
          })
          .filter((r): r is StockAlertRow => r !== null)
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, 3)
        setStockRows(rows)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCashCountRecorded = () => {
    setShowCashCountModal(false)
    refetchDashboard()
  }

  if (isLoading) {
    return <div className="p-8 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
  }
  if (!data) {
    return <div className="p-8 text-sm font-semibold text-danger">{error ?? t('reportsAnalytics.loadError')}</div>
  }

  const completedToday = history.filter((s) => s.status !== 'CANCELLED')
  // Même règle que le Journal de caisse : par TRANCHE de règlement (une vente mixte compte dans chacun de ses
  // modes, sa portion dette exclue) et espèces NETTES des remboursements en espèces — l'avoir et la réduction
  // de dette ne sortent aucun argent, ils n'apparaissent que dans « Remboursé ».
  const collectedByMethod: Record<string, number> = {
    CASH: sumByMethod(completedToday, 'CASH') - refundsToday.cash,
    MOBILE_MONEY_ORANGE: sumByMethod(completedToday, 'MOBILE_MONEY_ORANGE'),
    MOBILE_MONEY_WAVE: sumByMethod(completedToday, 'MOBILE_MONEY_WAVE'),
  }
  const collectedToday = collectedByMethod.CASH + collectedByMethod.MOBILE_MONEY_ORANGE + collectedByMethod.MOBILE_MONEY_WAVE
  // Pour la barre de répartition seulement : des espèces nettes négatives (plus de remboursements que d'espèces
  // encaissées) ne doivent pas produire de largeur négative.
  const barTotal = Object.values(collectedByMethod).reduce((sum, v) => sum + Math.max(0, v), 0)
  const totalRefunded = refundsToday.cash + refundsToday.credit + refundsToday.debt

  const salesDeltaPct = data.salesYesterday > 0 ? Math.round(((data.salesToday - data.salesYesterday) / data.salesYesterday) * 100) : null
  const marginRatio = isOwner && data.salesToday > 0 && data.profitToday != null ? data.profitToday / data.salesToday : null

  const maxRevenue = Math.max(...data.last7Days.map((d) => d.revenue), 1)
  const weekTotal = data.last7Days.reduce((s, d) => s + d.revenue, 0)
  const avgDaily = data.last7Days.length > 0 ? weekTotal / data.last7Days.length : 0
  const peakRevenue = Math.max(...data.last7Days.map((d) => d.revenue), 0)

  const weekCompleted = weekHistory.filter((s) => s.status !== 'CANCELLED')
  const avgBasket = weekCompleted.length > 0 ? weekCompleted.reduce((s, x) => s + x.totalAmount, 0) / weekCompleted.length : null

  const overdueDebtors = debtors.filter((d) => d.urgency === 'OVERDUE')
  const overdueResellers = lateResellers.filter((r) => r.urgency === 'OVERDUE')
  const shownDebtors = overdueDebtors.slice(0, 2)
  const shownResellers = overdueResellers.slice(0, 1)
  const priorityCount = stockRows.length + shownDebtors.length + shownResellers.length

  const recentSales = history.slice(0, 5)
  const salesColumns: TableColumn<SaleHistoryItemResponse>[] = [
    { key: 'time', label: t('registerSales.timeColumn'), render: (s) => <span className="amount text-text-dim">{new Date(s.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span> },
    { key: 'no', label: t('registerSales.numberColumn'), render: (s) => <span className="amount text-primary font-bold">#{s.saleId.slice(-6).toUpperCase()}</span> },
    { key: 'items', label: t('registerSales.itemsColumn'), numeric: true, render: (s) => t('reportsAnalytics.itemCount', { count: s.itemCount }) },
    {
      key: 'method',
      label: t('registerSales.howCustomerPays'),
      render: (s) => (
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${METHOD_DOT[s.paymentMethod] ?? 'bg-text-dim'}`} />
          {t(METHOD_LABEL_KEY[s.paymentMethod] ?? 'registerSales.methodCash')}
        </span>
      ),
    },
    { key: 'amount', label: t('registerSales.totalToPay'), numeric: true, render: (s) => <span className="amount font-extrabold">{formatNumber(s.totalAmount, locale)}</span> },
  ]

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-succes-bg text-succes-text flex-none">
            <Store size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-text break-words">{t('reportsAnalytics.operationalJournalTitle')}</h1>
              <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-[11px] font-extrabold uppercase tracking-wide text-text-muted">{t('reportsAnalytics.sessionActiveBadge')}</span>
            </div>
            <p className="text-[13px] font-semibold text-text-dim break-words">
              {tenant.name}{tenant.city ? ` · ${tenant.city}` : ''}{operatorName ? ` · ${operatorName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => navigate('/statistiques/export')} className="flex items-center gap-1.5 px-3.5 min-h-10 py-1.5 text-left rounded-xl bg-bg-card border border-border-strong text-sm font-extrabold text-text">
            <Download size={15} /> {t('reportsAnalytics.exportTab')}
          </button>
          <button type="button" onClick={() => setShowCashCountModal(true)} className="flex items-center gap-1.5 px-3.5 min-h-10 py-1.5 text-left rounded-xl bg-terracotta text-white text-sm font-extrabold">
            <Wallet size={15} /> {t('reportsAnalytics.countCashButton')}
          </button>
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      {dashboardAsOf && (
        <div className="text-[13px] font-semibold text-info-text">{t('reportsAnalytics.dashboardAsOf', { time: new Date(dashboardAsOf).toLocaleTimeString() })}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Carte 1 — Ventes du jour (indigo, bogolan) */}
        <div
          className="relative overflow-hidden rounded-2xl bg-primary text-papier p-4 flex flex-col justify-between gap-3 min-h-[168px]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(230,157,59,.14) 0 4px,transparent 4px 16px)' }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[.09em] text-papier/60">{t('reportsAnalytics.salesToday')}</span>
            {salesDeltaPct !== null && (
              <span className="flex items-center gap-1 bg-papier/15 px-2 py-1 rounded-lg text-[11px] font-extrabold text-[#8FD3AF] flex-none">
                <TrendingUp size={12} /> {salesDeltaPct >= 0 ? '+' : ''}{salesDeltaPct}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display amount text-[26px] sm:text-[32px] break-all font-extrabold text-or leading-none">{formatNumber(data.salesToday, locale)}</span>
            <span className="text-sm font-bold text-or">{tenant.currency}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-papier/75 break-words">
              <span className="w-1.5 h-1.5 rounded-full bg-or flex-none" />
              {t('reportsAnalytics.ticketsRecorded', { count: completedToday.length })}
            </span>
            {data.salesYesterday > 0 && (
              <span className="text-[11px] font-semibold text-papier/50 flex-none">{t('reportsAnalytics.vsYesterdayAmount', { value: formatK(data.salesYesterday) })}</span>
            )}
          </div>
        </div>

        {/* Carte 2 — Encaissé réel (caisse + mobile), répartition par moyen de paiement */}
        <div className="rounded-2xl bg-bg-card border border-border p-4 flex flex-col justify-between gap-2.5 min-h-[168px]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[.09em] text-text-dim">{t('reportsAnalytics.collectedRealLabel')}</span>
            <span className="p-2 rounded-xl bg-succes-bg text-succes-text flex-none"><Wallet size={17} /></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display amount text-2xl sm:text-[28px] break-all font-extrabold text-succes-text leading-none">{formatNumber(collectedToday, locale)}</span>
            <span className="text-sm font-bold text-succes-text">{tenant.currency}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-1.5 rounded-full bg-bg-elevated overflow-hidden flex">
              {(['CASH', 'MOBILE_MONEY_ORANGE', 'MOBILE_MONEY_WAVE'] as const).map((m) =>
                collectedByMethod[m] > 0 ? (
                  <div key={m} className="h-full" style={{ width: `${(collectedByMethod[m] / (barTotal || 1)) * 100}%`, background: METHOD_BAR_COLOR[m] }} />
                ) : null,
              )}
            </div>
            <HorizontalScroller variant="inline" gapClassName="gap-4" className="p-1" trackClassName="text-[11px] font-bold text-text-dim">
              <span className="flex-none whitespace-nowrap">{t('registerSales.methodCash')}: {formatK(collectedByMethod.CASH ?? 0)}</span>
              <span className="flex-none whitespace-nowrap">{t('registerSales.methodOrangeMoney')}: {formatK(collectedByMethod.MOBILE_MONEY_ORANGE ?? 0)}</span>
              <span className="flex-none whitespace-nowrap">{t('registerSales.methodWave')}: {formatK(collectedByMethod.MOBILE_MONEY_WAVE ?? 0)}</span>
              {totalRefunded > 0 && (
                <span className="flex-none whitespace-nowrap text-terracotta">{t('registerSales.refundedLabel')}: -{formatK(totalRefunded)}</span>
              )}
            </HorizontalScroller>
          </div>
        </div>

        {/* Carte 3 — Dettes clients */}
        <div className="rounded-2xl bg-bg-card border border-border p-4 flex flex-col justify-between gap-2.5 min-h-[168px]">
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[.09em] text-text-dim">{t('reportsAnalytics.customerDebtLabel')}</span>
              {overdueDebtors.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-warning" />}
            </span>
            <span className="p-2 rounded-xl flex-none" style={{ background: '#FEF4E6', color: '#8A6712' }}><BookOpen size={17} /></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display amount text-2xl sm:text-[28px] break-all font-extrabold leading-none" style={{ color: '#8A6712' }}>{formatNumber(data.outstandingDebt, locale)}</span>
            <span className="text-sm font-bold" style={{ color: '#8A6712' }}>{tenant.currency}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold text-text-dim break-words">{t('debtBook.clientsCount', { count: data.debtorCount })}</span>
            <button type="button" onClick={() => navigate('/clients')} className="flex-none flex items-center gap-0.5 text-[11px] font-extrabold uppercase tracking-wide text-terracotta">
              {t('reportsAnalytics.manageLink')} <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Carte 4 — Argent dehors (revendeurs) */}
        <div className="relative overflow-hidden rounded-2xl bg-bg-card border border-border p-4 pl-5 flex flex-col justify-between gap-2.5 min-h-[168px]">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-terracotta" />
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-extrabold uppercase tracking-[.09em] text-text-dim break-words">{t('reportsAnalytics.resellerOutstandingLabel')}</span>
            </span>
            <span className="p-2 rounded-xl bg-[#FDF1EC] text-terracotta flex-none"><Package size={17} /></span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display amount text-2xl sm:text-[28px] break-all font-extrabold text-terracotta leading-none">{formatNumber(resellerTotal?.totalOutstanding ?? 0, locale)}</span>
            <span className="text-sm font-bold text-terracotta">{tenant.currency}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-text break-words">{t('resellerConsignment.resellerCount', { count: resellerTotal?.resellerCount ?? 0 })}</span>
              {overdueResellers.length > 0 && <span className="text-[13px] font-semibold text-terracotta flex-none">({overdueResellers.length} {t('resellerConsignment.filterLate')})</span>}
            </div>
            <button type="button" onClick={() => navigate('/revendeurs')} className="flex-none flex items-center gap-0.5 text-[11px] font-extrabold uppercase tracking-wide text-terracotta">
              {t('reportsAnalytics.manageLink')} <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Colonne gauche — Ventes & marges */}
        <div className="lg:col-span-7 bg-bg-card rounded-2xl p-4 sm:p-5 shadow-sm border border-border flex flex-col justify-between gap-4 min-h-[440px] min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-extrabold text-text">{t('reportsAnalytics.salesMarginChartTitle')}</h2>
              <p className="text-[13px] font-semibold text-text-dim mt-0.5">{t('reportsAnalytics.salesMarginChartSubtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-text-dim uppercase"><span className="w-3 h-3 rounded bg-primary" />{t('reportsAnalytics.legendSales')}</span>
              {isOwner && marginRatio !== null && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-text-dim uppercase"><span className="w-3 h-3 rounded bg-or" />{t('reportsAnalytics.legendMargin')}</span>
              )}
            </div>
          </div>

          <div className="h-[190px] flex items-end gap-1.5 sm:gap-3">
            {data.last7Days.map((d, i) => {
              const salesHeight = Math.max(4, (d.revenue / maxRevenue) * 150)
              const marginHeight = marginRatio !== null ? Math.max(0, (d.revenue * marginRatio / maxRevenue) * 150) : 0
              const isPeak = d.revenue === peakRevenue && peakRevenue > 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                  {isPeak && (
                    <span className="px-1.5 py-0.5 rounded bg-alerte-bg text-alerte-text text-[9px] font-extrabold uppercase mb-0.5">
                      {t('reportsAnalytics.peakBadge', { value: formatK(d.revenue) })}
                    </span>
                  )}
                  <div className="w-full flex items-end justify-center gap-1" style={{ height: 150 }}>
                    <div className="w-1/2 rounded-t-md" style={{ height: salesHeight, background: d.isToday ? '#022448' : '#0E2038' }} />
                    {marginRatio !== null && <div className="w-1/3 rounded-t-md" style={{ height: marginHeight, background: '#E69D3B' }} />}
                  </div>
                  <div className={`text-[11px] ${d.isToday ? 'font-extrabold text-primary' : 'font-bold text-text-dim'}`}>{d.dayLabel}</div>
                  <div className="text-[10px] font-semibold text-text-dim">{formatK(d.revenue)}</div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 pt-3 bg-bg rounded-xl p-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.avgDailyLabel')}</span>
              <span className="amount text-[15px] font-extrabold text-text">{formatNumber(Math.round(avgDaily), locale)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.avgMarginRateLabel')}</span>
              <span className="amount text-[15px] font-extrabold text-or">{marginRatio !== null ? `${(marginRatio * 100).toFixed(1)}%` : '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.avgTicketLabel')}</span>
              <span className="amount text-[15px] font-extrabold text-primary">{avgBasket !== null ? formatNumber(Math.round(avgBasket), locale) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Colonne droite — À traiter en priorité */}
        <div className="lg:col-span-5 bg-bg-card rounded-2xl p-4 sm:p-5 shadow-sm border border-border flex flex-col justify-between gap-4 min-h-[440px] min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#FBE9E4] text-terracotta flex-none"><AlertTriangle size={17} /></span>
              <div>
                <h2 className="font-display text-base font-extrabold text-text">{t('home.sectionToHandle')}</h2>
                <p className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.priorityPanelSubtitle')}</p>
              </div>
            </div>
            {priorityCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#FBE9E4] text-terracotta text-[11px] font-extrabold flex-none">{t('reportsAnalytics.actionsCountBadge', { count: priorityCount })}</span>
            )}
          </div>

          {priorityCount === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[13px] font-semibold text-text-dim text-center">{t('home.allCaughtUp')}</div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
              {stockRows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase text-terracotta">
                      <AlertTriangle size={13} /> {t('reportsAnalytics.stockRuptureSectionTitle', { count: stockRows.length })}
                    </span>
                    <button type="button" onClick={() => navigate('/stock/alertes')} className="text-[11px] font-extrabold uppercase text-text-dim hover:underline">
                      {t('inventoryCatalog.order')}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {stockRows.map((r) => (
                      <button
                        key={r.productId}
                        type="button"
                        onClick={() => navigate('/stock/alertes')}
                        className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 p-2.5 rounded-xl bg-bg hover:bg-bg-elevated transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-none" />
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-[11px] font-extrabold text-text-dim flex-none">{r.name.slice(0, 2).toUpperCase()}</span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text break-words">{r.name}</p>
                            <p className="text-[11px] text-text-dim break-words">{r.category}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex-none ${r.quantity === 0 ? 'bg-[#FBE9E4] text-terracotta' : 'bg-alerte-bg text-alerte-text'}`}>
                          {r.quantity === 0 ? t('reportsAnalytics.noneRemaining') : `${r.quantity} · ${t('inventoryCatalog.alertThresholdDisplay', { threshold: r.alertThreshold })}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(shownDebtors.length > 0 || shownResellers.length > 0) && (
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase text-alerte-text">
                    <Clock size={13} /> {t('reportsAnalytics.overdueSectionTitle')}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {shownDebtors.map((d) => (
                      <button
                        key={d.customerPhone}
                        type="button"
                        onClick={() => navigate(`/clients/${encodeURIComponent(d.customerPhone)}`)}
                        className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 p-2.5 rounded-xl bg-bg hover:bg-bg-elevated transition-colors text-left"
                      >
                        <div className="flex-1 basis-[140px] min-w-0">
                          <p className="text-sm font-bold text-text break-words">{d.customerName}</p>
                          <p className="text-[11px] text-terracotta break-words">{t('debtBook.overdueByDays', { days: daysLate(d.nearestDueDate) })} · {d.customerPhone}</p>
                        </div>
                        <span className="amount text-sm font-extrabold text-terracotta flex-none">{formatNumber(d.totalRemaining, locale)}</span>
                        <a
                          href={`tel:${d.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          title={t('inventoryCatalog.call')}
                          className="p-1.5 rounded-lg bg-bg-card shadow-sm text-terracotta flex-none"
                        >
                          <Phone size={14} />
                        </a>
                      </button>
                    ))}
                    {shownResellers.map((r) => (
                      <button
                        key={r.resellerId}
                        type="button"
                        onClick={() => navigate(`/revendeurs/${encodeURIComponent(r.phone)}`)}
                        className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 p-2.5 rounded-xl bg-[#FDF1EC] hover:bg-[#FBE9E4] transition-colors text-left"
                      >
                        <div className="flex-1 basis-[140px] min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-terracotta break-words">{r.name}</span>
                            <span className="px-1 py-0.5 rounded bg-terracotta text-papier text-[9px] font-extrabold uppercase flex-none">{t('resellerConsignment.resellerSectionTitle')}</span>
                          </div>
                          <p className="text-[11px] text-terracotta break-words">{t('resellerConsignment.daysCount', { count: daysSince(r.lastActivityAt) })} · {t('resellerConsignment.openConsignmentCount', { count: r.openConsignmentCount })}</p>
                        </div>
                        <span className="amount text-sm font-extrabold text-terracotta flex-none">{formatNumber(r.totalRemaining, locale)}</span>
                        <a
                          href={`tel:${r.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          title={t('inventoryCatalog.call')}
                          className="p-1.5 rounded-lg bg-bg-card shadow-sm text-terracotta flex-none"
                        >
                          <Phone size={14} />
                        </a>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dernières ventes en direct */}
      <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-4 sm:p-5 flex flex-col gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-succes-text flex-none animate-pulse" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-extrabold text-text">{t('reportsAnalytics.recentSalesTitle')}</h2>
                <span className="px-2 py-0.5 rounded-full bg-succes-bg text-succes-text text-[11px] font-extrabold uppercase">{t('reportsAnalytics.recentSalesLiveBadge')}</span>
              </div>
              <p className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.recentSalesSubtitle')}</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/caisse/historique')} className="flex items-center gap-1 text-[13px] font-extrabold text-primary">
            {t('reportsAnalytics.viewFullJournal')} <ChevronRight size={14} />
          </button>
        </div>

        <Table columns={salesColumns} rows={recentSales} getRowKey={(s) => s.saleId} emptyMessage={t('reportsAnalytics.noSalesToday')} />
      </div>

      <CashCountModalDesktop open={showCashCountModal} currency={tenant.currency} onClose={() => setShowCashCountModal(false)} onRecorded={handleCashCountRecorded} />
    </div>
  )
}
