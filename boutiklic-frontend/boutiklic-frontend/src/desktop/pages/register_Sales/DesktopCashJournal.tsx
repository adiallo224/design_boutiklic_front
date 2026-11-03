import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Download, Printer, Lock, Wallet, Users, RefreshCw, Cloud, CloudOff,
  CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight,
} from 'lucide-react'
import { formatNumber, formatDate, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { salesApi, type RefundSummaryResponse, type SaleHistoryItemResponse } from '../../../lib/salesApi'
import { debtApi, type DebtorsTotalResponse } from '../../../lib/debtApi'
import { reportingApi, type DashboardResponse } from '../../../lib/reportingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { hasPaymentMethod, sumByMethod } from '../../../lib/salePayments'
import { useTenant } from '../../../hooks/useTenant'
import { userApi, type CurrentUserResponse } from '../../../lib/userApi'
import { useOutbox } from '../../../hooks/useOutbox'
import { fmtLocalDate } from '../../../components/PeriodDropdown'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import HorizontalScroller from '../../components/HorizontalScroller'
import CashCountModalDesktop from '../../components/CashCountModalDesktop'
import { useTopBar } from '../../hooks/useTopBar'

/** Nombre de tickets du jour affichés en aperçu — le reste (toutes périodes, filtres, retours,
 *  annulations, factures) vit dans l'Historique (/caisse/historique). */
const RECENT_SALES_COUNT = 5

const NO_REFUNDS: RefundSummaryResponse = { cash: 0, credit: 0, debt: 0 }

const METHOD_COLORS: Record<string, string> = { CASH: '#0E7A52', MOBILE_MONEY_ORANGE: '#D84E2A', MOBILE_MONEY_WAVE: '#0E2038', DEBT: '#D84E2A', MIXED: '#676E7E' }
const METHOD_LABEL_KEY: Record<string, string> = {
  CASH: 'registerSales.methodCash', MOBILE_MONEY_ORANGE: 'registerSales.methodOrangeMoney',
  MOBILE_MONEY_WAVE: 'registerSales.methodWave', DEBT: 'registerSales.methodDebt', MIXED: 'registerSales.methodMixed',
}

function startOfDayIso(dateStr: string) { return `${dateStr}T00:00:00.000Z` }
function endOfDayIso(dateStr: string) { return `${dateStr}T23:59:59.999Z` }
function closureKey(tenantId: string) { return `boutiklic_journal_closed_${tenantId}_${fmtLocalDate(new Date())}` }

interface MethodBreakdownItem { key: string; label: string; value: string; labelClass: string; valueClass: string }

/** Montants par mode de règlement (Espèces, Orange Money, Wave…) dans la tuile « Encaissé réel ». */
function MethodBreakdownStrip({ items }: { items: MethodBreakdownItem[] }) {
  return (
    <HorizontalScroller variant="inline" gapClassName="gap-0" className="mt-3 p-1.5" trackClassName="snap-x snap-mandatory text-center">
      {items.map((it, i) => (
        <div key={it.key} className={`flex flex-col flex-none basis-1/3 snap-start px-1 ${i > 0 ? 'border-l border-border' : ''}`}>
          <span className={`text-[9px] uppercase font-bold whitespace-nowrap ${it.labelClass}`}>{it.label}</span>
          <span className={`amount text-xs font-bold ${it.valueClass}`}>{it.value}</span>
        </div>
      ))}
    </HorizontalScroller>
  )
}

/** W15 — Journal de caisse, recentré sur la JOURNÉE (étude study/web/journal_caisse_web_page_redesign) :
 *  4 tuiles KPI, décompte de caisse, état de synchronisation, ticket Z et clôture. Tout ce qui relève de
 *  la consultation et de la correction des ventes (autres périodes, filtres, recherche, retours,
 *  annulations, factures) est dans l'Historique (DesktopSalesHistory) : un seul chemin de correction, au
 *  lieu de deux écrans qui listaient les mêmes ventes. Ici, seulement un aperçu des derniers tickets du
 *  jour, avec un lien vers l'Historique.
 *
 *  "Clôturer la journée" reste sans équivalent serveur (StockIntake/Sale n'ont aucune notion de clôture) —
 *  toujours traité en frontend seul : imprime + pose un marqueur local par boutique/jour. Export = CSV
 *  généré côté client à partir des ventes du jour déjà chargées.
 *
 *  Écarts assumés vis-à-vis du mockup (rien à fabriquer côté API) :
 *  - "Sceau d'Audit Certifié" (signature SHA-256, "SQLITE OK") retiré : aucun mécanisme de
 *    signature/scellement cryptographique du journal n'existe côté app — remplacé par un panneau
 *    réel d'état de synchronisation (useOutbox : opérations en attente/échouées), utile pour la
 *    même intention (« puis-je faire confiance à ce journal ? ») sans rien inventer.
 *  - "Décompte de Fin de Journée" en 4 étapes (fond de caisse, sorties/dépenses…) simplifié à 2 :
 *    aucune notion de fond de caisse (flottant d'ouverture) ni de sorties/dépenses n'existe côté
 *    modèle. Remplacé par le vrai mécanisme déjà en place ailleurs (Tableau de bord, Statistiques) :
 *    espèces attendues (ventes en espèces du jour, par tranche de règlement, moins les remboursements en
 *    espèces) vs espèces comptées (`dashboard.cashCollectedToday`, saisi via "Compter la caisse" —
 *    CashCountModalDesktop déjà réel) et l'écart (`cashGapToday`).
 *  - "Réimprimer" par ticket retiré : aucune impression thermique ciblée par vente n'existe
 *    côté app (seul `window.print()` de la page entière, déjà utilisé par "Imprimer ticket Z"). */
export default function DesktopCashJournal() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant, activeTenantId } = useTenant()
  const { pendingCount, failedCount, isSyncing, sync } = useOutbox()
  const [me, setMe] = useState<CurrentUserResponse | null>(null)

  useTopBar({ title: t('registerSales.cashJournalTitle') }, [t])

  const [todaySales, setTodaySales] = useState<SaleHistoryItemResponse[]>([])
  // Remboursements (retours d'articles) datés du jour du RETOUR : sans eux, un retour en espèces laisse les
  // espèces attendues trop hautes et crée un faux écart au comptage du tiroir.
  const [todayRefunds, setTodayRefunds] = useState<RefundSummaryResponse>(NO_REFUNDS)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [debtTotal, setDebtTotal] = useState<DebtorsTotalResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCashCount, setShowCashCount] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closed, setClosed] = useState(() => localStorage.getItem(closureKey(activeTenantId)) !== null)

  const loadCore = useCallback(() => {
    setIsLoading(true)
    setError(null)
    const todayStr = fmtLocalDate(new Date())
    Promise.all([
      salesApi.getHistory(startOfDayIso(todayStr), endOfDayIso(todayStr)),
      salesApi.getRefundSummary(startOfDayIso(todayStr), endOfDayIso(todayStr)),
      reportingApi.getDashboard().catch(() => null),
      debtApi.getTotal().catch(() => null),
    ])
      .then(([sales, refunds, d, dt]) => {
        setTodaySales(sales)
        setTodayRefunds(refunds)
        setDashboard(d)
        setDebtTotal(dt)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(loadCore, [loadCore])
  useEffect(() => { userApi.getMe().then(setMe).catch(() => undefined) }, [])

  const stats = useMemo(() => {
    const completed = todaySales.filter((s) => s.status !== 'CANCELLED')
    const grossTotal = completed.reduce((s, x) => s + x.totalAmount, 0)
    const ticketCount = completed.length
    const avgTicket = ticketCount > 0 ? Math.round(grossTotal / ticketCount) : 0
    // Par tranche de règlement (payments), pas par paymentMethod : une vente MIXED contribue à chacun de ses
    // modes — sinon elle n'apparaîtrait dans aucun total (espèces, Orange, Wave, dette).
    // Espèces NETTES des remboursements en espèces (seul ce mode sort du tiroir) ; l'avoir et la réduction de
    // dette ne sortent aucun argent — ils n'apparaissent que dans « Remboursé ».
    const cashTotal = sumByMethod(completed, 'CASH') - todayRefunds.cash
    const orangeTotal = sumByMethod(completed, 'MOBILE_MONEY_ORANGE')
    const waveTotal = sumByMethod(completed, 'MOBILE_MONEY_WAVE')
    const debtSalesTotal = sumByMethod(completed, 'DEBT')
    const debtSalesCount = completed.filter((s) => hasPaymentMethod(s, 'DEBT')).length
    return { grossTotal, ticketCount, avgTicket, cashTotal, orangeTotal, waveTotal, debtSalesTotal, debtSalesCount, collectedTotal: cashTotal + orangeTotal + waveTotal }
  }, [todaySales, todayRefunds])

  const sortedSales = useMemo(() => [...todaySales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [todaySales])
  const recentSales = sortedSales.slice(0, RECENT_SALES_COUNT)

  const handleExportCsv = () => {
    const header = ['Heure', 'N°', 'Articles', 'Moyen', 'Statut', 'Montant']
    const rows = sortedSales.map((s) => [
      new Date(s.createdAt).toLocaleString(locale),
      s.saleId.slice(-6).toUpperCase(),
      String(s.itemCount),
      t(METHOD_LABEL_KEY[s.paymentMethod] ?? 'registerSales.methodCash'),
      s.status,
      String(s.totalAmount),
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    void downloadBlob(blob, `journal-caisse-${fmtLocalDate(new Date())}.csv`)
  }

  const handleConfirmClose = () => {
    localStorage.setItem(closureKey(activeTenantId), new Date().toISOString())
    setClosed(true)
    setShowCloseConfirm(false)
    window.print()
  }

  const columns: TableColumn<SaleHistoryItemResponse>[] = [
    {
      key: 'time',
      label: t('registerSales.timeColumn'),
      render: (s) => <span className={`amount text-text-muted ${s.status === 'CANCELLED' ? 'line-through text-text-dim' : ''}`}>{formatDate(s.createdAt, locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>,
    },
    {
      key: 'no',
      label: t('registerSales.numberColumn'),
      render: (s) => (
        <span className={`amount text-xs font-bold px-2 py-1 rounded-md border ${hasPaymentMethod(s, 'DEBT') ? 'bg-[#FBE9E4] text-terracotta border-terracotta/30' : 'bg-bg-elevated text-primary border-border-strong'}`}>
          #{s.saleId.slice(-6).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'articles',
      label: t('registerSales.articlesColumn'),
      render: (s) => <span className="text-sm font-semibold text-text-muted">{t('registerSales.itemCount', { count: s.itemCount })}</span>,
    },
    {
      key: 'method',
      label: t('registerSales.paymentColumn'),
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold" style={{ background: `${METHOD_COLORS[s.paymentMethod] ?? '#676E7E'}1A`, color: METHOD_COLORS[s.paymentMethod] ?? '#676E7E' }}>
          {t(METHOD_LABEL_KEY[s.paymentMethod] ?? 'registerSales.methodCash')}
          {s.status === 'CANCELLED' && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#F7E3E1] text-[#8F3B23]">{t('registerSales.cancelledLabel')}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      label: t('registerSales.amountColumnGnf'),
      numeric: true,
      render: (s) => <span className={`font-extrabold ${s.status === 'CANCELLED' ? 'line-through text-text-dim' : ''}`}>{formatNumber(s.totalAmount, locale)}</span>,
    },
  ]

  const totalRefunded = todayRefunds.cash + todayRefunds.credit + todayRefunds.debt
  const cashExpected = stats.cashTotal
  const cashGap = dashboard?.cashGapToday ?? null
  const cashCounted = dashboard?.cashCollectedToday ?? null

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-papier text-[11px] font-extrabold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-or animate-pulse" />
              {t('registerSales.sessionActiveLabel')}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-succes-text bg-succes-bg px-2 py-0.5 rounded-full">
              <Lock size={11} /> {formatDate(new Date(), locale, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-text tracking-tight">{t('registerSales.cashJournalTitle')}</h1>
          <div className="flex items-center gap-2 text-text-muted text-sm flex-wrap">
            <span className="font-bold text-terracotta">{formatDate(new Date(), locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" />
            <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-text font-bold text-xs">{t('registerSales.salesRecordedBadge', { count: stats.ticketCount })}</span>
            {me?.displayName && (
              <>
                <span className="w-1 h-1 rounded-full bg-border-strong" />
                <span>
                  {t('registerSales.operatorPrefixLabel')} <strong className="text-primary font-display">{me.displayName}</strong> ({tenant.name}
                  {tenant.neighborhood ? ` - ${tenant.neighborhood}` : ''})
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleExportCsv} className="flex items-center text-left gap-1.5 px-3.5 py-2.5 rounded-xl bg-bg-card border border-border-strong text-text font-bold text-[13px] hover:border-primary transition-all">
            <Download size={16} className="text-text-muted" />
            {t('registerSales.exportJournalButton')}
          </button>
          <button type="button" onClick={() => window.print()} className="flex items-center text-left gap-1.5 px-3.5 py-2.5 rounded-xl bg-bg-card border border-border-strong text-text font-bold text-[13px] hover:border-or transition-all">
            <Printer size={16} className="text-or" />
            {t('registerSales.printZTicketButton')}
          </button>
          {closed ? (
            <span className="flex items-center text-left gap-1.5 px-3.5 py-2.5 rounded-xl bg-succes-bg text-succes-text font-bold text-[13px]">
              <Lock size={16} /> {t('registerSales.dayAlreadyClosed')}
            </span>
          ) : (
            <button type="button" onClick={() => setShowCloseConfirm(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terracotta hover:brightness-95 text-papier font-bold text-sm shadow-sm transition-all">
              <Lock size={18} />
              {t('registerSales.closeDay')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="print-area flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-primary text-papier p-4 sm:p-5 rounded-2xl min-w-0 shadow-elevated flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-or">{t('registerSales.grossSalesKpiLabel')}</span>
                <span className="px-2 py-0.5 rounded-full bg-papier/10 text-papier text-[11px] font-bold border border-papier/15">{t('registerSales.itemCount', { count: stats.ticketCount })}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-[28px] sm:text-[34px] break-all font-extrabold leading-none tracking-tight">{formatNumber(stats.grossTotal, locale)}</span>
                <span className="text-or text-sm font-bold">{tenant.currency}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-papier/10 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
              <span className="text-papier/70">{t('registerSales.avgTicketOfDayLabel')} :</span>
              <span className="amount font-bold text-tertiary-fixed bg-black/20 px-2 py-0.5 rounded">{formatNumber(stats.avgTicket, locale)} {tenant.currency}</span>
            </div>
          </div>

          <div className="bg-bg-card p-4 sm:p-5 rounded-2xl min-w-0 border border-border border-t-4 border-t-succes-text shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-succes-text">{t('registerSales.realCollectedKpiLabel')}</span>
                <span className="px-2 py-0.5 rounded-full bg-succes-bg text-succes-text text-[10px] font-extrabold">{t('registerSales.availableBadge')}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-2xl sm:text-3xl break-all font-extrabold text-succes-text leading-none tracking-tight">{formatNumber(stats.collectedTotal, locale)}</span>
                <span className="text-text-dim text-sm font-bold">{tenant.currency}</span>
              </div>
            </div>
            <MethodBreakdownStrip
              items={[
                { key: 'cash', label: t('registerSales.methodCash'), value: formatNumber(stats.cashTotal, locale), labelClass: 'text-text-dim', valueClass: 'text-text' },
                { key: 'orange', label: t('registerSales.methodOrangeMoney'), value: formatNumber(stats.orangeTotal, locale), labelClass: 'text-terracotta', valueClass: 'text-terracotta' },
                { key: 'wave', label: t('registerSales.methodWave'), value: formatNumber(stats.waveTotal, locale), labelClass: 'text-primary', valueClass: 'text-primary' },
                ...(totalRefunded > 0
                  ? [{ key: 'refunds', label: t('registerSales.refundedLabel'), value: `-${formatNumber(totalRefunded, locale)}`, labelClass: 'text-terracotta', valueClass: 'text-terracotta' }]
                  : []),
              ]}
            />
          </div>

          <div className="bg-bg-card p-4 sm:p-5 rounded-2xl min-w-0 border border-border border-t-4 border-t-terracotta shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-terracotta">{t('registerSales.debtSalesKpiLabel')}</span>
                <span className="px-2 py-0.5 rounded bg-[#FBE9E4] text-terracotta text-[10px] font-extrabold">{t('registerSales.toRecoverBadge')}</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-2xl sm:text-3xl break-all font-extrabold text-terracotta leading-none tracking-tight">{formatNumber(stats.debtSalesTotal, locale)}</span>
                <span className="text-text-dim text-sm font-bold">{tenant.currency}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
              <span className="text-text-muted">{t('registerSales.itemCount', { count: stats.debtSalesCount })}</span>
              {debtTotal && (
                <span className="font-bold text-terracotta flex items-center gap-1 bg-[#FBE9E4] px-2 py-0.5 rounded">
                  <Users size={13} /> {t('registerSales.activeDebtorsCaption', { count: debtTotal.debtorCount })}
                </span>
              )}
            </div>
          </div>

          <div className="bg-bg-card p-4 sm:p-5 rounded-2xl min-w-0 border border-border border-t-4 border-t-primary shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">{t('registerSales.cashDrawerKpiLabel')}</span>
                {cashGap !== null ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${cashGap === 0 ? 'bg-succes-bg text-succes-text' : 'bg-[#FBE9E4] text-terracotta'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cashGap === 0 ? 'bg-succes-text' : 'bg-terracotta'}`} /> {t('reportsAnalytics.cashGapLabel')} : {formatNumber(cashGap, locale)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-text-dim text-[10px] font-extrabold">{t('reportsAnalytics.notCountedYet')}</span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-2xl sm:text-3xl break-all font-extrabold text-primary leading-none tracking-tight">{formatNumber(stats.cashTotal, locale)}</span>
                <span className="text-text-dim text-sm font-bold">{tenant.currency}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
              <span className="text-text-muted">{t('registerSales.physicalControlLabel')}</span>
              {cashGap !== null ? (
                <span className={`font-bold flex items-center gap-1 ${cashGap === 0 ? 'text-succes-text' : 'text-terracotta'}`}>
                  {cashGap === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {cashGap === 0 ? t('registerSales.balanceRigorousLabel') : t('registerSales.gapDetectedLabel')}
                </span>
              ) : (
                <span className="font-bold text-text-dim">{t('registerSales.totalCollectedLabel')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h2 className="font-display text-base font-extrabold text-text">{t('reportsAnalytics.recentSalesTitle')}</h2>
              <p className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.recentSalesSubtitle')}</p>
            </div>
            <button type="button" onClick={() => navigate('/caisse/historique')} className="no-print flex items-center gap-1 text-[13px] font-extrabold text-primary">
              {t('registerSales.viewAllSalesLink')} <ChevronRight size={14} />
            </button>
          </div>
          {isLoading ? (
            <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
          ) : (
            <Table
              columns={columns}
              rows={recentSales}
              getRowKey={(s) => s.saleId}
              rowClassName={(s) => (hasPaymentMethod(s, 'DEBT') ? 'bg-[#FDF1EC]' : '')}
              emptyMessage={t('reportsAnalytics.noSalesToday')}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bg-bg-card p-4 sm:p-6 min-w-0 rounded-2xl border border-border shadow-sm flex flex-col justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-info-bg flex items-center justify-center text-primary flex-none">
                  <Wallet size={20} />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-display font-extrabold text-[16px] text-text">{t('registerSales.cashDecompteTitle')}</h3>
                  <span className="text-xs text-text-muted">{t('registerSales.cashDecompteSubtitle')}</span>
                </div>
              </div>
              {cashGap !== null ? (
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold ${cashGap === 0 ? 'bg-succes-bg text-succes-text' : 'bg-[#FBE9E4] text-terracotta'}`}>
                  {cashGap === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {cashGap === 0 ? t('registerSales.conformNoGapBadge') : `${t('reportsAnalytics.cashGapLabel')} : ${formatNumber(cashGap, locale)}`}
                </span>
              ) : (
                <Button variant="accent" onClick={() => setShowCashCount(true)} className="h-9 px-4 text-xs">
                  {t('reportsAnalytics.countCashButton')}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-bg p-3 sm:p-4 rounded-xl border border-border">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-text-dim font-bold tracking-wider">{t('registerSales.expectedCashLabel')}</span>
                <span className="font-display font-extrabold text-xl text-text mt-1">{formatNumber(cashExpected, locale)}</span>
                <span className="text-[11px] text-text-muted">{tenant.currency} · {formatDate(new Date(), locale, { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-succes-text font-bold tracking-wider">{t('registerSales.countedCashLabel')}</span>
                <span className="font-display font-extrabold text-xl text-succes-text mt-1">{cashCounted !== null ? formatNumber(cashCounted, locale) : '—'}</span>
                <span className="text-[11px] text-text-muted">{cashCounted !== null ? tenant.currency : t('reportsAnalytics.notCountedYet')}</span>
              </div>
              <div className="flex flex-col bg-bg-card p-2.5 rounded-lg border border-primary/30">
                <span className="text-[10px] uppercase text-primary font-bold tracking-wider">{t('reportsAnalytics.cashGapLabel')}</span>
                <span className={`font-display font-extrabold text-xl sm:text-2xl break-all mt-0.5 ${cashGap === 0 ? 'text-succes-text' : cashGap !== null ? 'text-terracotta' : 'text-text-dim'}`}>
                  {cashGap !== null ? formatNumber(cashGap, locale) : '—'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px] bg-bg p-3 rounded-xl border border-border">
              <div className="flex items-center gap-2 text-text-muted">
                <span className="text-or">ⓘ</span>
                <span>{t('registerSales.mobileWalletNotice', { orange: `${formatNumber(stats.orangeTotal, locale)} ${tenant.currency}`, wave: `${formatNumber(stats.waveTotal, locale)} ${tenant.currency}` })}</span>
              </div>
              <div className="font-extrabold text-primary break-words">
                {t('registerSales.totalCollectedLabel')} : <span className="text-text">{formatNumber(stats.collectedTotal, locale)} {tenant.currency}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-bg-card p-4 sm:p-6 min-w-0 rounded-2xl border border-border shadow-sm flex flex-col justify-between gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className={pendingCount === 0 && failedCount === 0 ? 'text-succes-text' : 'text-alerte-text'} />
                <h3 className="font-display font-extrabold text-[16px] text-text">{t('registerSales.syncStatusTitle')}</h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-none ${pendingCount === 0 && failedCount === 0 ? 'bg-succes-bg text-succes-text' : 'bg-alerte-bg text-alerte-text'}`}>
                {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : pendingCount === 0 && failedCount === 0 ? <Cloud size={18} /> : <CloudOff size={18} />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-text">
                  {isSyncing ? t('desktopShell.topBar.syncing') : pendingCount === 0 && failedCount === 0 ? t('registerSales.syncedNoPending') : ''}
                </span>
                {(pendingCount > 0 || failedCount > 0) && !isSyncing && (
                  <span className="text-xs font-semibold text-text-muted">
                    {[pendingCount > 0 ? t('registerSales.pendingSyncCaption', { count: pendingCount }) : null, failedCount > 0 ? t('registerSales.failedSyncCaption', { count: failedCount }) : null].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-papier font-display font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Printer size={18} className="text-or" />
              {t('registerSales.printZTicketButton')}
            </button>
            {(pendingCount > 0 || failedCount > 0) && (
              <button type="button" onClick={() => sync()} disabled={isSyncing} className="w-full py-2.5 rounded-xl border border-border-strong text-text text-sm font-bold disabled:opacity-50">
                {t('registerSales.syncNowButton')}
              </button>
            )}
          </div>
        </div>
      </div>

      <CashCountModalDesktop open={showCashCount} currency={tenant.currency} onClose={() => setShowCashCount(false)} onRecorded={() => { setShowCashCount(false); loadCore() }} />

      <Modal
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        width={480}
        title={t('registerSales.closeDayModalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCloseConfirm(false)}>{t('registerSales.cancel')}</Button>
            <Button onClick={handleConfirmClose}>{t('registerSales.confirmCloseDay')}</Button>
          </>
        }
      >
        <p className="text-sm font-semibold text-text-muted leading-relaxed break-words">
          {t('registerSales.closeDayModalBody', { sales: `${formatNumber(stats.grossTotal, locale)} ${tenant.currency}`, cash: `${formatNumber(cashExpected, locale)} ${tenant.currency}` })}
        </p>
      </Modal>
    </div>
  )
}
