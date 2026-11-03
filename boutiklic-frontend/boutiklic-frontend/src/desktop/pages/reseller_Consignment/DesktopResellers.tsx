import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Check, Package, Phone, Plus, Undo2, AlertCircle, ClipboardList, Users, Eye, Search, Download, Banknote, Printer, Pencil } from 'lucide-react'
import { formatNumber, formatDate, isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@boutiklic/shared'
import { resellerApi, type ResellerResponse, type ResellersTotalResponse, type ResellerLedgerResponse, type LedgerEntryResponse } from '../../../lib/resellerApi'
import { reportingApi } from '../../../lib/reportingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { useTenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import Pagination from '../../components/Pagination'
import Button from '../../components/Button'
import { useTopBar } from '../../hooks/useTopBar'
import NewConsignmentOutModalDesktop from './NewConsignmentOutModalDesktop'
import ResellerPaymentModalDesktop from './ResellerPaymentModalDesktop'

type StatusFilter = '' | 'OVERDUE' | 'ACTIVE' | 'SETTLED'
type SortKey = 'name' | 'amount' | 'activity'
type LedgerFilter = 'ALL' | 'OUT' | 'PAYMENTS'
const PAGE_SIZE = 10

/** Rotation décorative sur les 5 couleurs de marque (groupes A-E) pour distinguer les avatars au
 *  premier coup d'œil — purement visuel, l'urgence reste portée par la pastille "X jours" et la
 *  couleur du montant, pas par l'avatar (éviter de superposer deux systèmes de couleur au même
 *  endroit). Un revendeur soldé reste gris (#BDB1A3), même hors rotation. */
const AVATAR_PALETTE = ['bg-primary', 'bg-terracotta', 'bg-emeraude', 'bg-or', 'bg-violet']

const initials = (name: string) => name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

/** Index de palette dérivé de l'id (stable par revendeur, pas par position dans la page — le
 *  tableau réutilisable (components/Table.tsx) ne transmet pas l'index de ligne à `render`). */
function avatarIndex(resellerId: string): number {
  let sum = 0
  for (let i = 0; i < resellerId.length; i++) sum += resellerId.charCodeAt(i)
  return sum % AVATAR_PALETTE.length
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000))
}

/** Détail d'affichage d'une ligne du carnet (icône, couleur, libellé, sous-titre) — le PAYMENT
 *  encode déjà sa note dans le libellé (cf. entryPaymentWithNote), le CONSIGNMENT_OUT détaille ses
 *  lignes en sous-titre (ex. "Riz 25 kg ×120, huile 20 L ×40"). RETURN n'affiche pas de sous-titre :
 *  LedgerEntryResponse.lines n'est documenté que pour les sorties, pas de garantie qu'il soit
 *  peuplé pour un retour côté backend. */
function entryVisual(entry: LedgerEntryResponse, t: (key: string, options?: Record<string, unknown>) => string) {
  if (entry.type === 'CONSIGNMENT_OUT') {
    const subtitle = entry.lines.length > 0 ? entry.lines.map((l) => `${l.productName} ×${l.quantityOut}`).join(', ') : null
    return { Icon: Package, bg: '#F4E7D2', color: '#8A6A21', title: t('resellerConsignment.entryOut', { count: entry.itemCount ?? entry.lines.length }), subtitle, positive: false }
  }
  if (entry.type === 'RETURN') {
    return { Icon: Undo2, bg: '#EAF0F7', color: '#0E2038', title: t('resellerConsignment.entryReturn', { count: entry.itemCount ?? 0 }), subtitle: null, positive: true }
  }
  return {
    Icon: Check,
    bg: '#E6F1EC',
    color: '#0E7A52',
    title: entry.note ? t('resellerConsignment.entryPaymentWithNote', { note: entry.note }) : t('resellerConsignment.entryPayment'),
    subtitle: null,
    positive: true,
  }
}

/** W5 — refonte visuelle (étude study/web/renvendeur_web_page_redesign) : tableau pleine largeur
 *  (comme DesktopStock.tsx / DesktopClients.tsx) au lieu du maître-détail précédent, détail (carnet)
 *  déplacé dans une modale plutôt qu'un panneau latéral. "Encaisser" et "Nouvelle sortie" agissent
 *  directement depuis la ligne du tableau (ResellerResponse a déjà téléphone/nom/solde — pas besoin
 *  du carnet complet pour ces deux actions).
 *
 *  Écarts assumés vis-à-vis du mockup (rien à fabriquer côté API) :
 *  - Pas de colonne "Zone" ni de "Marchandises confiées" / "Total sorti" / "% remboursé" : aucun
 *    champ zone n'existe sur ResellerResponse, et totalOut/totalPaid ne sont exposés que dans le
 *    carnet détaillé (ResellerLedgerResponse) — les charger pour chaque ligne de la liste voudrait
 *    dire un appel API par revendeur (non scalable), gardés uniquement dans le détail.
 *  - "Recouvré ce mois" et "Cycle moyen de recouvrement" (mockup) n'ont pas d'équivalent API —
 *    remplacés par "En retard" et "Moyenne par revendeur", calculés côté client depuis la liste déjà
 *    chargée (même substitution que sur Clients et Dettes).
 *  - "Bordereau PDF" et le bandeau "Derniers versements encaissés aujourd'hui" retirés : aucun export
 *    dédié ni agrégat de versements du jour n'existe côté API.
 *  - "Dernier mouvement" affiche seulement une ancienneté ("il y a N jours", resellerApi.lastActivityAt
 *    déjà utilisé ainsi côté détail) — pas de description ("Versement 15M Espèces") : la liste n'a
 *    pas cette info, seul le carnet l'a. */
export default function DesktopResellers() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { id: resellerPhone } = useParams<{ id: string }>()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [sortKey, setSortKey] = useState<SortKey>('activity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [resellers, setResellers] = useState<ResellerResponse[]>([])
  const [total, setTotal] = useState<ResellersTotalResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [consignmentModal, setConsignmentModal] = useState<{ open: boolean; presetPhone?: string }>({ open: false })
  const [payingReseller, setPayingReseller] = useState<ResellerResponse | null>(null)
  const [showPayPicker, setShowPayPicker] = useState(false)
  // Incrémenté après un versement / une sortie pour recharger le carnet ouvert en modale de détail.
  const [ledgerVersion, setLedgerVersion] = useState(0)
  const [payPickerQuery, setPayPickerQuery] = useState('')
  const [exporting, setExporting] = useState(false)

  const loadList = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([resellerApi.getResellers('late'), resellerApi.getTotal()])
      .then(([r, tt]) => {
        setResellers(r)
        setTotal(tt)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(loadList, [loadList])

  useTopBar(
    {
      searchValue: search,
      onSearchChange: setSearch,
      searchPlaceholder: t('resellerConsignment.searchPlaceholder'),
    },
    [t, search],
  )

  // F3 ouvre "Nouvelle sortie" au clavier physique — action globale (pas besoin d'un revendeur
  // sélectionné), contrairement à "Encaisser" qui dépend d'une ligne précise et n'a donc pas
  // d'équivalent clavier ici.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F3') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      setConsignmentModal({ open: true })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Même export que Stock (Réglages -> Exporter mes données) : un ZIP de CSV ventes/stock/dettes/
  // fournisseurs, pas un bordereau PDF dédié aux revendeurs — aucun endpoint de ce type n'existe.
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await reportingApi.dataExport()
      await downloadBlob(blob, `boutiklic-revendeurs-${new Date().toISOString().slice(0, 10)}.zip`)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => setPage(1), [search, statusFilter, sortKey, sortDir])

  const overdueResellers = resellers.filter((r) => r.urgency === 'OVERDUE')
  const settledResellers = resellers.filter((r) => r.settled)
  const activeResellers = resellers.filter((r) => !r.settled && r.urgency !== 'OVERDUE')
  const overdueTotal = overdueResellers.reduce((s, r) => s + r.totalRemaining, 0)
  const avgPerReseller = (total?.resellerCount ?? 0) > 0 ? (total?.totalOutstanding ?? 0) / total!.resellerCount : 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = resellers.filter((r) => {
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.phone.includes(q)
      const matchesStatus =
        statusFilter === '' ? true :
        statusFilter === 'OVERDUE' ? r.urgency === 'OVERDUE' :
        statusFilter === 'SETTLED' ? r.settled :
        !r.settled && r.urgency !== 'OVERDUE'
      return matchesSearch && matchesStatus
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'amount': return (a.totalRemaining - b.totalRemaining) * dir
        case 'activity': return (new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()) * dir
        default: return a.name.localeCompare(b.name) * dir
      }
    })
  }, [resellers, search, statusFilter, sortKey, sortDir])

  const onSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key as SortKey)
      setSortDir('asc')
    }
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const detailReseller = resellers.find((r) => r.phone === resellerPhone)

  const columns: TableColumn<ResellerResponse>[] = [
    {
      key: 'name',
      label: t('resellerConsignment.contactColumn'),
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold text-papier flex-none ${r.settled ? '' : AVATAR_PALETTE[avatarIndex(r.resellerId)]}`}
            style={r.settled ? { background: '#BDB1A3' } : undefined}
          >
            {initials(r.name)}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{r.name}</div>
            <div className="amount text-[11px] text-text-dim truncate">{r.phone}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: t('resellerConsignment.balanceDueColumn'),
      numeric: true,
      sortable: true,
      render: (r) => <span className={`amount font-extrabold ${r.urgency === 'OVERDUE' ? 'text-terracotta' : ''}`}>{formatNumber(r.totalRemaining, locale)}</span>,
    },
    {
      key: 'status',
      label: t('resellerConsignment.statusColumn'),
      render: (r) =>
        r.settled ? (
          <span className="px-2 py-1 rounded-md bg-succes-bg text-succes-text text-xs font-bold">{t('resellerConsignment.upToDate')}</span>
        ) : r.urgency === 'OVERDUE' ? (
          <span className="px-2 py-1 rounded-md bg-[#FBE9E4] text-terracotta text-xs font-bold whitespace-nowrap">{t('resellerConsignment.daysCount', { count: daysAgo(r.lastActivityAt) })}</span>
        ) : (
          <span className="text-xs font-semibold text-text-dim">{t('resellerConsignment.openConsignmentCount', { count: r.openConsignmentCount })}</span>
        ),
    },
    {
      key: 'activity',
      label: t('resellerConsignment.lastMovementColumn'),
      sortable: true,
      render: (r) => <span className="text-xs font-semibold text-text-dim whitespace-nowrap">{t('resellerConsignment.daysCount', { count: daysAgo(r.lastActivityAt) })}</span>,
    },
    {
      key: 'actions',
      label: t('resellerConsignment.actionsColumn'),
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.totalRemaining > 0 && (
            <button type="button" onClick={() => setPayingReseller(r)} className="px-3 h-8 rounded-lg bg-emeraude text-papier text-xs font-bold flex-none">
              {t('resellerConsignment.collectTitle')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConsignmentModal({ open: true, presetPhone: r.phone })}
            title={t('resellerConsignment.newOutAction')}
            className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-text-muted flex-none"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/revendeurs/${encodeURIComponent(r.phone)}`)}
            title={t('resellerConsignment.viewLedgerAction')}
            className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-text-muted flex-none"
          >
            <Eye size={14} />
          </button>
          <a
            href={`tel:${r.phone}`}
            title={t('inventoryCatalog.call')}
            className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-succes-text flex-none"
          >
            <Phone size={14} />
          </a>
        </div>
      ),
    },
  ]

  return (
    <div className="p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-extrabold text-text">{t('resellerConsignment.headerTitle')}</h1>
            <span className="px-2 py-0.5 rounded-full bg-[#FBE9E4] text-terracotta text-[11px] font-extrabold uppercase">{t('resellerConsignment.activeConsignmentsBadge', { count: total?.openConsignmentCount ?? 0 })}</span>
            {overdueResellers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-alerte-bg text-alerte-text text-[11px] font-extrabold uppercase">{t('resellerConsignment.filterLate')} {overdueResellers.length}</span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-text-dim">{t('resellerConsignment.registerSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleExport} disabled={exporting} className="min-h-10 px-3.5 py-1.5 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text disabled:opacity-50">
            <Download size={16} />
            {t('resellerConsignment.exportButton')}
          </button>
          <button type="button" onClick={() => setShowPayPicker(true)} className="min-h-10 px-3.5 py-1.5 rounded-xl bg-emeraude text-papier flex items-center gap-2 text-sm font-bold">
            <Banknote size={16} />
            {t('resellerConsignment.collectTitle')}
          </button>
          <button type="button" onClick={() => setConsignmentModal({ open: true })} className="min-h-10 px-3.5 py-1.5 rounded-xl bg-terracotta text-white flex items-center gap-2 text-sm font-bold">
            <Plus size={16} />
            {t('resellerConsignment.newConsignmentButton')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('resellerConsignment.moneyOutside')}</span>
            <Package size={17} className="text-terracotta" />
          </div>
          <span className="font-display amount text-3xl font-extrabold text-terracotta">{formatNumber(total?.totalOutstanding ?? 0, locale)}</span>
          <span className="text-[13px] font-semibold text-text-dim">
            {t('resellerConsignment.resellerCount', { count: total?.resellerCount ?? 0 })} · {t('resellerConsignment.openConsignmentCountSuffix', { count: total?.openConsignmentCount ?? 0 })}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('resellerConsignment.overdueKpiLabel')}</span>
            <AlertCircle size={17} className="text-danger" />
          </div>
          <span className="font-display amount text-3xl font-extrabold text-danger">{overdueResellers.length}</span>
          {overdueResellers.length > 0 && <span className="text-[13px] font-semibold text-text-dim">{formatNumber(overdueTotal, locale)} {tenant.currency}</span>}
        </div>

        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('resellerConsignment.activeBonsKpiLabel')}</span>
            <ClipboardList size={17} className="text-alerte-text" />
          </div>
          <span className="font-display amount text-3xl font-extrabold text-alerte-text">{total?.openConsignmentCount ?? 0}</span>
          <span className="text-[13px] font-semibold text-text-dim">{activeResellers.length} {t('resellerConsignment.filterActive').toLowerCase()}</span>
        </div>

        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('resellerConsignment.avgPerResellerLabel')}</span>
            <Users size={17} className="text-primary" />
          </div>
          <span className="font-display amount text-3xl font-extrabold text-text">{formatNumber(Math.round(avgPerReseller), locale)}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" onClick={() => setStatusFilter('')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === '' ? 'bg-encre text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}>
            {t('resellerConsignment.filterAll')} {resellers.length}
          </button>
          <button type="button" onClick={() => setStatusFilter('OVERDUE')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === 'OVERDUE' ? 'bg-encre text-papier' : 'bg-[#FBE9E4] text-terracotta'}`}>
            {t('resellerConsignment.filterLate')} {overdueResellers.length}
          </button>
          <button type="button" onClick={() => setStatusFilter('ACTIVE')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === 'ACTIVE' ? 'bg-encre text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}>
            {t('resellerConsignment.filterActive')} {activeResellers.length}
          </button>
          <button type="button" onClick={() => setStatusFilter('SETTLED')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === 'SETTLED' ? 'bg-encre text-papier' : 'bg-succes-bg text-succes-text'}`}>
            {t('resellerConsignment.filterSettled')} {settledResellers.length}
          </button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('resellerConsignment.filterByNamePlaceholder')}
              className="h-10 w-full sm:w-64 pl-9 pr-3 rounded-xl border border-border-strong bg-bg-card font-semibold text-sm outline-none focus:border-primary"
            />
          </div>
          <button type="button" disabled title={t('desktopShell.topBar.notYetAvailable')} className="h-10 w-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center text-text-dim opacity-50 flex-none">
            <Printer size={16} />
          </button>
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : (
        <>
          {filtered.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeLabel={
                <>
                  {t('resellerConsignment.showingRangeResellers', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, filtered.length), total: filtered.length })}
                  {' · '}
                  {t('resellerConsignment.activeDebtsTotalSuffix', { amount: formatNumber(total?.totalOutstanding ?? 0, locale) })}
                </>
              }
            />
          )}

          <Table
            columns={columns}
            rows={pageRows}
            getRowKey={(r) => r.resellerId}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={(r) => navigate(`/revendeurs/${encodeURIComponent(r.phone)}`)}
            rowClassName={(r) => (r.urgency === 'OVERDUE' ? 'bg-[#FDF1EC]' : r.settled ? 'opacity-60' : '')}
            emptyMessage={t('resellerConsignment.emptyState')}
          />
        </>
      )}

      <Modal open={!!detailReseller} onClose={() => navigate('/revendeurs')} width={820} title={detailReseller?.name}>
        {detailReseller && (
          <ResellerLedger
            phone={detailReseller.phone}
            reloadKey={ledgerVersion}
            locale={locale}
            onPay={() => setPayingReseller(detailReseller)}
            onOpenConsignment={() => setConsignmentModal({ open: true, presetPhone: detailReseller.phone })}
            onChanged={loadList}
          />
        )}
      </Modal>

      <NewConsignmentOutModalDesktop
        open={consignmentModal.open}
        presetResellerPhone={consignmentModal.presetPhone}
        onClose={() => setConsignmentModal({ open: false })}
        onCompleted={() => {
          setConsignmentModal({ open: false })
          setLedgerVersion((v) => v + 1)
          loadList()
        }}
      />

      <Modal
        open={showPayPicker}
        onClose={() => {
          setShowPayPicker(false)
          setPayPickerQuery('')
        }}
        width={480}
        title={t('resellerConsignment.collectTitle')}
      >
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              autoFocus
              value={payPickerQuery}
              onChange={(e) => setPayPickerQuery(e.target.value)}
              placeholder={t('resellerConsignment.searchPlaceholder')}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-strong bg-bg font-semibold text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {(() => {
              const q = payPickerQuery.trim().toLowerCase()
              const matches = resellers.filter((r) => r.totalRemaining > 0 && (!q || r.name.toLowerCase().includes(q) || r.phone.includes(q)))
              if (matches.length === 0) return <div className="p-4 text-[13px] font-semibold text-text-dim text-center">{t('resellerConsignment.collectPickerEmptyState')}</div>
              return matches.map((r) => (
                <button
                  key={r.resellerId}
                  type="button"
                  onClick={() => {
                    setPayingReseller(r)
                    setShowPayPicker(false)
                    setPayPickerQuery('')
                  }}
                  className="p-2.5 rounded-xl bg-bg hover:bg-bg-elevated text-left flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{r.name}</div>
                    <div className="amount text-xs text-text-dim truncate">{r.phone}</div>
                  </div>
                  <span className={`amount text-sm font-extrabold flex-none ${r.urgency === 'OVERDUE' ? 'text-terracotta' : ''}`}>{formatNumber(r.totalRemaining, locale)}</span>
                </button>
              ))
            })()}
          </div>
        </div>
      </Modal>

      {payingReseller && (
        <ResellerPaymentModalDesktop
          open={!!payingReseller}
          resellerPhone={payingReseller.phone}
          resellerName={payingReseller.name}
          remainingAmount={payingReseller.totalRemaining}
          onClose={() => setPayingReseller(null)}
          onDone={() => {
            setPayingReseller(null)
            setLedgerVersion((v) => v + 1)
            loadList()
          }}
        />
      )}
    </div>
  )
}

/** Contenu de la modale de détail (carnet du revendeur) — un seul appel getLedger() par ouverture,
 *  pas de N+1 : cette vue n'existe que quand un revendeur précis est sélectionné (cf. commentaire de
 *  DesktopResellers ci-dessus sur pourquoi ces colonnes n'apparaissent pas dans le tableau). */
function ResellerLedger({
  phone, reloadKey, locale, onChanged, onOpenConsignment, onPay,
}: {
  phone: string
  reloadKey: number
  locale: Locale
  onChanged: () => void
  onOpenConsignment: () => void
  onPay: () => void
}) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [ledger, setLedger] = useState<ResellerLedgerResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})
  const [submittingReturn, setSubmittingReturn] = useState(false)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [editingPayment, setEditingPayment] = useState<LedgerEntryResponse | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    resellerApi.getLedger(phone).then(setLedger).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
  }, [phone])

  useEffect(load, [load, reloadKey])
  useEffect(() => {
    setLedgerFilter('ALL')
    setExpandedId(null)
  }, [phone])

  /** Solde après chaque mouvement, calculé en remontant depuis le solde actuel (aucun endpoint ne
   *  le renvoie ligne à ligne) — même principe que la colonne "solde dû" de DesktopSuppliers.tsx.
   *  entries[0] = le plus récent, donc son solde-après est le solde actuel du revendeur. */
  const runningBalances = useMemo(() => {
    if (!ledger) return []
    let balance = ledger.totalRemaining
    const balances: number[] = []
    for (const entry of ledger.entries) {
      balances.push(balance)
      balance -= entry.type === 'CONSIGNMENT_OUT' ? entry.amount : -entry.amount
    }
    return balances
  }, [ledger])

  const visibleEntries = (ledger?.entries ?? [])
    .map((entry, i) => ({ entry, balance: runningBalances[i] }))
    .filter(({ entry }) => (ledgerFilter === 'OUT' ? entry.type === 'CONSIGNMENT_OUT' : ledgerFilter === 'PAYMENTS' ? entry.type !== 'CONSIGNMENT_OUT' : true))

  const toggleExpand = (entry: LedgerEntryResponse) => {
    if (entry.type !== 'CONSIGNMENT_OUT') return
    setReturnError(null)
    setExpandedId((cur) => (cur === entry.consignmentOutId ? null : entry.consignmentOutId))
    setReturnQty({})
  }

  const submitReturn = async (entry: LedgerEntryResponse) => {
    const lines = entry.lines.map((l) => ({ lineId: l.lineId, quantity: Number(returnQty[l.lineId] ?? 0) })).filter((l) => l.quantity > 0)
    if (lines.length === 0 || submittingReturn) return
    setSubmittingReturn(true)
    setReturnError(null)
    try {
      await resellerApi.recordReturn(phone, entry.consignmentOutId, { lines })
      setExpandedId(null)
      setReturnQty({})
      load()
      onChanged()
    } catch (e) {
      setReturnError(toErrorMessage(e))
    } finally {
      setSubmittingReturn(false)
    }
  }

  if (isLoading && !ledger) return <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
  if (!ledger) return <div className="text-sm font-semibold text-danger">{error ?? t('resellerConsignment.resellerNotFound')}</div>

  const lastActivity = ledger.entries[0]?.date

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="amount text-sm text-text-muted flex-1 min-w-[140px] break-words">{t('resellerConsignment.resellerPhoneLine', { phone: ledger.phone })}</div>
        <a href={`tel:${ledger.phone}`} className="min-h-9 px-3 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold flex-none">
          <Phone size={14} className="text-succes-text" />
          {t('inventoryCatalog.call')}
        </a>
        <Button variant="accent" onClick={onOpenConsignment} className="min-h-9 flex-none">
          <Plus size={14} className="inline mr-1.5" />
          {t('resellerConsignment.newConsignmentButton')}
        </Button>
        <button type="button" onClick={onPay} disabled={ledger.totalRemaining <= 0} className="min-h-9 px-4 rounded-xl bg-emeraude text-papier text-sm font-bold disabled:opacity-50 flex-none">
          {t('resellerConsignment.collectTitle')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-[1.3] basis-full sm:basis-[220px] min-w-0 p-4 rounded-2xl bg-encre text-papier flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-widest text-[#A79B8D]">{t('resellerConsignment.remainingToRecover')}</span>
          <span className="font-display amount text-[26px] font-extrabold leading-none">{formatNumber(ledger.totalRemaining, locale)}</span>
          <span className="text-xs font-bold text-[#A79B8D] mt-0.5">{tenant.currency}</span>
        </div>
        <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-elevated flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.totalOutLabel')}</span>
          <span className="amount text-lg sm:text-xl font-extrabold break-all">{formatNumber(ledger.totalOut, locale)}</span>
        </div>
        <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-elevated flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.totalPaidLabel')}</span>
          <span className="amount text-lg sm:text-xl font-extrabold break-all text-succes-text">{formatNumber(ledger.totalPaid, locale)}</span>
        </div>
        <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-elevated flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.lastActivityStatLabel')}</span>
          <span className="text-lg sm:text-xl font-extrabold">{lastActivity ? formatDate(new Date(lastActivity), locale, { day: 'numeric', month: 'short' }) : '—'}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card flex flex-col overflow-hidden">
        <div className="flex-none flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-border bg-bg">
          <span className="text-[15px] font-extrabold">{t('resellerConsignment.ledgerTitle')}</span>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['ALL', t('resellerConsignment.ledgerFilterAll')],
              ['OUT', t('resellerConsignment.ledgerFilterOut')],
              ['PAYMENTS', t('resellerConsignment.ledgerFilterPayments')],
            ] as [LedgerFilter, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLedgerFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ledgerFilter === id ? 'bg-encre text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-none grid grid-cols-[0.9fr_1.8fr_1fr_1fr] sm:grid-cols-[1fr_2.3fr_1.1fr_1.1fr] gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 border-b border-border">
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.dateColumn')}</span>
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim">{t('resellerConsignment.movementColumn')}</span>
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim text-right">{t('resellerConsignment.amountColumn')}</span>
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim text-right">{t('resellerConsignment.balanceColumn')}</span>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {error && <div className="p-4 text-[13px] font-semibold text-danger">{error}</div>}
          {visibleEntries.length === 0 ? (
            <div className="p-6 text-sm font-semibold text-text-dim text-center">{t('resellerConsignment.noMovement')}</div>
          ) : (
            visibleEntries.map(({ entry, balance }, i) => {
              const { Icon, bg, color, title, subtitle, positive } = entryVisual(entry, t)
              const isOut = entry.type === 'CONSIGNMENT_OUT'
              const isExpanded = isOut && expandedId === entry.consignmentOutId
              return (
                <div key={i} className={i > 0 ? 'border-t border-border-hairline' : ''}>
                  <div
                    role={isOut ? 'button' : undefined}
                    tabIndex={isOut ? 0 : undefined}
                    onClick={() => toggleExpand(entry)}
                    onKeyDown={(e) => { if (isOut && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleExpand(entry) } }}
                    className={`w-full grid grid-cols-[0.9fr_1.8fr_1fr_1fr] sm:grid-cols-[1fr_2.3fr_1.1fr_1.1fr] gap-2 sm:gap-4 px-3 sm:px-5 py-3 items-center text-left ${isOut ? 'cursor-pointer' : ''}`}
                  >
                    <span className="text-xs sm:text-[13px] font-bold text-text-muted">{formatDate(new Date(entry.date), locale, { day: 'numeric', month: 'short' })}</span>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: bg }}>
                        <Icon size={15} style={{ color }} strokeWidth={2.4} />
                      </span>
                      <span className="min-w-0">
                        <span className="text-xs sm:text-[13.5px] font-extrabold break-words block">{title}</span>
                        {subtitle && <span className="text-[11px] sm:text-[11.5px] font-semibold text-text-dim break-words block">{subtitle}</span>}
                      </span>
                      {isOut && (isExpanded ? <ChevronUp size={14} className="text-text-dim flex-none ml-auto" /> : <ChevronDown size={14} className="text-text-dim flex-none ml-auto" />)}
                      {entry.type === 'PAYMENT' && entry.paymentId && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingPayment(entry) }}
                          aria-label={t('resellerConsignment.editPaymentAria')}
                          title={t('resellerConsignment.editPaymentAria')}
                          className="ml-auto flex-none w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg-elevated"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </span>
                    <span className={`amount text-xs sm:text-[13.5px] break-all font-extrabold text-right ${positive ? 'text-succes-text' : ''}`}>{positive ? '+' : ''}{formatNumber(entry.amount, locale)}</span>
                    <span className="amount text-xs sm:text-[13.5px] break-all font-extrabold text-right">{formatNumber(Math.max(0, balance), locale)}</span>
                  </div>

                  {isExpanded && (
                    <div className="px-3 sm:px-5 pb-4 flex flex-col gap-2 bg-bg">
                      {entry.lines.map((line) => {
                        const stillOut = line.quantityOut - line.quantityReturned
                        return (
                          <div key={line.lineId} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-card border border-border-hairline">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold break-words">{line.productName}</div>
                              <div className="amount text-xs text-text-dim">
                                {t('resellerConsignment.lineQuantityOut', { count: line.quantityOut })}{line.quantityReturned > 0 ? ` · ${t('resellerConsignment.lineQuantityReturned', { count: line.quantityReturned })}` : ''} · {t('resellerConsignment.lineQuantityStillOut', { count: stillOut })}
                              </div>
                            </div>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={stillOut}
                              disabled={stillOut === 0}
                              value={returnQty[line.lineId] ?? ''}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(stillOut, Number(e.target.value) || 0))
                                setReturnQty((prev) => ({ ...prev, [line.lineId]: v === 0 ? '' : String(v) }))
                              }}
                              placeholder="0"
                              className="w-16 h-9 rounded-lg border border-border-strong bg-bg-card px-2 amount text-sm font-extrabold text-center outline-none focus:border-primary disabled:opacity-40"
                            />
                          </div>
                        )
                      })}
                      {returnError && <div className="text-[13px] font-semibold text-danger">{returnError}</div>}
                      <button
                        type="button"
                        onClick={() => submitReturn(entry)}
                        disabled={submittingReturn || entry.lines.every((l) => !returnQty[l.lineId] || Number(returnQty[l.lineId]) <= 0)}
                        className="h-9 rounded-lg bg-bg-card border-2 border-encre flex items-center justify-center gap-1.5 text-xs font-extrabold disabled:opacity-40"
                      >
                        <Undo2 size={13} />
                        {submittingReturn ? t('resellerConsignment.recording') : t('resellerConsignment.confirmReturn')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {editingPayment && editingPayment.paymentId && editingPayment.paymentMethod && (
        <ResellerPaymentModalDesktop
          open
          resellerPhone={phone}
          resellerName={ledger.name}
          remainingAmount={ledger.totalRemaining}
          editing={{ paymentId: editingPayment.paymentId, amount: editingPayment.amount, method: editingPayment.paymentMethod, note: editingPayment.note }}
          onClose={() => setEditingPayment(null)}
          onDone={() => {
            setEditingPayment(null)
            load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}
