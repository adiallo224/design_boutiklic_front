import { useMemo, useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Phone, Plus, Receipt, Search, CreditCard, Clock, AlertCircle, Users, MessageSquareOff, Eye, Pencil } from 'lucide-react'
import { formatNumber, formatDate, isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@boutiklic/shared'
import { debtApi, type DebtorResponse, type DebtorsTotalResponse, type DebtorDetailResponse, type LedgerEntryResponse } from '../../../lib/debtApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import Pagination from '../../components/Pagination'
import { useTopBar } from '../../hooks/useTopBar'
import DebtPaymentModalDesktop from './DebtPaymentModalDesktop'
import EditManualDebtModalDesktop from './EditManualDebtModalDesktop'
import NewDebtModalDesktop from './NewDebtModalDesktop'

type LedgerFilter = 'ALL' | 'PURCHASES' | 'PAYMENTS'
type StatusFilter = '' | 'OVERDUE' | 'DUE_SOON'
type SortKey = 'name' | 'amount' | 'aging'
const PAGE_SIZE = 10

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

const initials = (name: string) => name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

/** Couleurs par palier d'urgence — mêmes teintes que DebtBook.tsx (mobile) pour rester cohérent
 *  entre plateformes : l'avatar porte lui-même le signal (contrairement à Revendeurs, où l'urgence
 *  n'a que deux états — en retard ou pas — ici il y en a trois, ça vaut la peine de le lire d'un
 *  coup d'œil sur l'avatar plutôt que sur une seule pastille). */
function urgencyMeta(debtor: DebtorResponse, t: (key: string, options?: Record<string, unknown>) => string, locale: Locale) {
  const days = daysUntil(debtor.nearestDueDate)
  if (debtor.urgency === 'OVERDUE') {
    return { avatarBg: '#F7E3E1', avatarText: '#8F3B23', label: t('debtBook.overdueByDays', { days: Math.abs(days ?? 0) }), labelColor: '#C6362F', labelBg: '#FBE9E4' }
  }
  if (debtor.urgency === 'DUE_SOON') {
    return { avatarBg: '#FEF4E6', avatarText: '#8A6712', label: t('debtBook.dueInDays', { days: days ?? 0 }), labelColor: '#8A6712', labelBg: '#FEF4E6' }
  }
  return {
    avatarBg: '#E6F1EC', avatarText: '#1F5C43',
    label: debtor.nearestDueDate ? t('debtBook.dueOn', { date: formatDate(debtor.nearestDueDate, locale) }) : t('debtBook.noDueDate'),
    labelColor: '#676E7E', labelBg: '#F2EAE0',
  }
}

/** W7 — refonte visuelle (étude study/web/clients_dettes_web_page_redesign) : tableau pleine
 *  largeur (comme DesktopStock.tsx) au lieu du maître-détail précédent, avec panneau de détail
 *  (carnet/ledger) déplacé dans une modale plutôt qu'un panneau latéral — le clic sur une ligne (ou
 *  l'icône "Voir le détail") ouvre /clients/:phone comme avant, juste dans un autre conteneur.
 *  "Encaisser" agit désormais directement depuis la ligne du tableau (DebtorResponse a déjà tout ce
 *  qu'il faut : téléphone, nom, solde — pas besoin de charger le carnet complet pour encaisser).
 *
 *  Écarts assumés vis-à-vis du mockup (rien à fabriquer côté API) :
 *  - Pas de colonne "Quartier & Profil" ni de "Plafond accordé" : aucun champ adresse/profession ni
 *    aucune notion de plafond de crédit n'existe côté client (déjà documenté avant cette refonte).
 *  - Pas de "Dernier achat crédit" / "Dernier versement" en colonne : il faudrait charger le carnet
 *    de chaque débiteur (N appels) pour peupler une liste — non scalable, gardé uniquement dans le
 *    détail (une fois le client ouvert, un seul appel).
 *  - "Rappel SMS groupé" reste indisponible (bouton désactivé, même motif que "Relancer" sur la
 *    fiche client) : aucun canal SMS/relance n'est connecté côté app.
 *  - Pas de "Taux de recouvrement" ni de bandeau "SMS Orange/MTN activé" en pied de page : aucune
 *    donnée de ce type n'est exposée côté API.
 *  - "Délai moyen" et "Moyenne par débiteur" sont calculés côté client à partir de la liste déjà
 *    chargée (jours de retard moyens des débiteurs en retard ; solde total / nombre de débiteurs) —
 *    substituts réels aux stats "Recouvré ce mois" et "Plafond global" du mockup, qui n'ont pas
 *    d'équivalent API. */
export default function DesktopClients() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { phone: customerPhone } = useParams<{ phone: string }>()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [sortKey, setSortKey] = useState<SortKey>('aging')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [debtors, setDebtors] = useState<DebtorResponse[]>([])
  const [total, setTotal] = useState<DebtorsTotalResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newDebtOpen, setNewDebtOpen] = useState(false)
  const [payingDebtor, setPayingDebtor] = useState<DebtorResponse | null>(null)

  // Le tri se fait maintenant côté client (colonnes cliquables du tableau réutilisable, comme
  // DesktopStock.tsx) — un seul ordre de récupération stable côté serveur suffit ici.
  const loadList = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([debtApi.getDebtors('urgency'), debtApi.getTotal()])
      .then(([d, tt]) => {
        setDebtors(d)
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
      searchPlaceholder: t('debtBook.searchPlaceholder'),
    },
    [t, search],
  )

  useEffect(() => setPage(1), [search, statusFilter, sortKey, sortDir])

  const overdueDebtors = debtors.filter((d) => d.urgency === 'OVERDUE')
  const dueSoonDebtors = debtors.filter((d) => d.urgency === 'DUE_SOON')
  const overdueTotal = overdueDebtors.reduce((s, d) => s + d.totalRemaining, 0)
  const dueSoonTotal = dueSoonDebtors.reduce((s, d) => s + d.totalRemaining, 0)
  const avgDaysLate = overdueDebtors.length > 0
    ? Math.round(overdueDebtors.reduce((s, d) => s + Math.abs(daysUntil(d.nearestDueDate) ?? 0), 0) / overdueDebtors.length)
    : null
  const avgPerDebtor = (total?.debtorCount ?? 0) > 0 ? (total?.totalOutstanding ?? 0) / total!.debtorCount : 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = debtors.filter((d) => {
      const matchesSearch = !q || d.customerName.toLowerCase().includes(q) || d.customerPhone.includes(q)
      const matchesStatus = statusFilter === '' ? true : d.urgency === statusFilter
      return matchesSearch && matchesStatus
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'amount': return (a.totalRemaining - b.totalRemaining) * dir
        // Jours jusqu'à échéance (négatif = en retard) — pas d'échéance renvoyé en dernier, peu importe le sens.
        case 'aging': return ((daysUntil(a.nearestDueDate) ?? 9999) - (daysUntil(b.nearestDueDate) ?? 9999)) * dir
        default: return a.customerName.localeCompare(b.customerName) * dir
      }
    })
  }, [debtors, search, statusFilter, sortKey, sortDir])

  const onSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key as SortKey)
      setSortDir('asc')
    }
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const detailDebtor = debtors.find((d) => d.customerPhone === customerPhone)

  const columns: TableColumn<DebtorResponse>[] = [
    {
      key: 'name',
      label: t('debtBook.contactColumn'),
      sortable: true,
      render: (d) => {
        const m = urgencyMeta(d, t, locale)
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold flex-none" style={{ background: m.avatarBg, color: m.avatarText }}>
              {initials(d.customerName)}
            </div>
            <div className="min-w-0">
              <div className="font-bold truncate">{d.customerName}</div>
              <div className="amount text-[11px] text-text-dim truncate">{d.customerPhone}</div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'amount',
      label: t('debtBook.debtDueColumn'),
      numeric: true,
      sortable: true,
      render: (d) => <span className={`amount font-extrabold ${d.urgency === 'OVERDUE' ? 'text-terracotta' : ''}`}>{formatNumber(d.totalRemaining, locale)}</span>,
    },
    {
      key: 'aging',
      label: t('debtBook.agingColumn'),
      sortable: true,
      render: (d) => {
        const m = urgencyMeta(d, t, locale)
        return <span className="px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap" style={{ background: m.labelBg, color: m.labelColor }}>{m.label}</span>
      },
    },
    {
      key: 'actions',
      label: t('debtBook.actionsColumn'),
      align: 'right',
      render: (d) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {d.totalRemaining > 0 && (
            <button type="button" onClick={() => setPayingDebtor(d)} className="px-3 h-8 rounded-lg bg-emeraude text-papier text-xs font-bold flex-none">
              {t('debtBook.cashIn')}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(`/clients/${encodeURIComponent(d.customerPhone)}`)}
            title={t('debtBook.viewLedgerAction')}
            className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-text-muted flex-none"
          >
            <Eye size={14} />
          </button>
          <a
            href={`tel:${d.customerPhone}`}
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
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-text">{t('debtBook.headerTitle')}</h1>
            <span className="px-2 py-0.5 rounded-full bg-[#FBE9E4] text-terracotta text-[11px] font-extrabold uppercase">{t('debtBook.activeDebtsBadge', { count: total?.debtorCount ?? 0 })}</span>
            {overdueDebtors.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-alerte-bg text-alerte-text text-[11px] font-extrabold uppercase">{t('debtBook.overdueCountSuffix', { count: overdueDebtors.length })}</span>
            )}
          </div>
          <p className="text-xs sm:text-[13px] break-words font-semibold text-text-dim">
            {t('debtBook.registerSubtitle')} · {tenant.name}{tenant.neighborhood ? ` (${tenant.neighborhood})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled title={t('debtBook.remindUnavailable')} className="min-h-10 px-3.5 py-1.5 text-left rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text-muted opacity-60">
            <MessageSquareOff size={16} />
            {t('debtBook.groupReminderButton')}
          </button>
          <button type="button" onClick={() => setNewDebtOpen(true)} className="min-h-10 px-3.5 py-1.5 text-left rounded-xl bg-terracotta text-white flex items-center gap-2 text-sm font-bold">
            <Plus size={16} />
            {t('debtBook.newDebtTitle')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('debtBook.outstandingLabel')}</span>
            <CreditCard size={17} className="text-terracotta" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-terracotta">{formatNumber(total?.totalOutstanding ?? 0, locale)}</span>
          <span className="text-xs sm:text-[13px] font-semibold text-text-dim break-words">
            {t('debtBook.clientsCount', { count: total?.debtorCount ?? 0 })}
            {avgDaysLate !== null ? ` · ${t('debtBook.avgDaysLateCaption', { count: avgDaysLate, days: avgDaysLate })}` : ''}
          </span>
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('debtBook.overdueKpiLabel')}</span>
            <AlertCircle size={17} className="text-danger" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-danger">{overdueDebtors.length}</span>
          {overdueDebtors.length > 0 && <span className="text-xs sm:text-xs sm:text-[13px] break-words font-semibold text-text-dim break-words">{formatNumber(overdueTotal, locale)} {tenant.currency}</span>}
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('debtBook.dueSoonKpiLabel')}</span>
            <Clock size={17} className="text-alerte-text" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-alerte-text">{dueSoonDebtors.length}</span>
          {dueSoonDebtors.length > 0 && <span className="text-xs sm:text-xs sm:text-[13px] break-words font-semibold text-text-dim break-words">{formatNumber(dueSoonTotal, locale)} {tenant.currency}</span>}
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('debtBook.avgPerDebtorLabel')}</span>
            <Users size={17} className="text-primary" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-text">{formatNumber(Math.round(avgPerDebtor), locale)}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" onClick={() => setStatusFilter('')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === '' ? 'bg-encre text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}>
            {t('debtBook.filterAllClients')} {debtors.length}
          </button>
          <button type="button" onClick={() => setStatusFilter('OVERDUE')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === 'OVERDUE' ? 'bg-encre text-papier' : 'bg-[#FBE9E4] text-terracotta'}`}>
            {t('debtBook.filterOverdue')} {overdueDebtors.length}
          </button>
          <button type="button" onClick={() => setStatusFilter('DUE_SOON')} className={`px-3.5 py-2 rounded-lg text-sm font-bold ${statusFilter === 'DUE_SOON' ? 'bg-encre text-papier' : 'bg-alerte-bg text-alerte-text'}`}>
            {t('debtBook.filterDueSoon')} {dueSoonDebtors.length}
          </button>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('debtBook.searchPlaceholder')}
            className="h-10 w-full sm:w-56 pl-9 pr-3 rounded-xl border border-border-strong bg-bg-card font-semibold text-sm outline-none focus:border-primary"
          />
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
                  {t('debtBook.showingRangeClients', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, filtered.length), total: filtered.length })}
                  {' · '}
                  {t('debtBook.activeDebtsTotalSuffix', { amount: formatNumber(total?.totalOutstanding ?? 0, locale) })}
                </>
              }
            />
          )}

          <Table
            columns={columns}
            rows={pageRows}
            getRowKey={(d) => d.customerPhone}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={(d) => navigate(`/clients/${encodeURIComponent(d.customerPhone)}`)}
            rowClassName={(d) => (d.urgency === 'OVERDUE' ? 'bg-[#FDF1EC]' : d.urgency === 'DUE_SOON' ? 'bg-[#FDF6EA]' : '')}
            emptyMessage={t('debtBook.emptyState')}
          />
        </>
      )}

      <Modal open={!!detailDebtor} onClose={() => navigate('/clients')} width={820} title={detailDebtor?.customerName}>
        {detailDebtor && <ClientLedger debtor={detailDebtor} locale={locale} onPay={() => setPayingDebtor(detailDebtor)} onChanged={loadList} />}
      </Modal>

      <NewDebtModalDesktop open={newDebtOpen} onClose={() => setNewDebtOpen(false)} onCreated={() => { setNewDebtOpen(false); loadList() }} />

      {payingDebtor && (
        <DebtPaymentModalDesktop
          open={!!payingDebtor}
          customerPhone={payingDebtor.customerPhone}
          customerName={payingDebtor.customerName}
          remainingAmount={payingDebtor.totalRemaining}
          onClose={() => setPayingDebtor(null)}
          onDone={() => {
            setPayingDebtor(null)
            loadList()
          }}
        />
      )}
    </div>
  )
}

/** Une ligne est modifiable si c'est un remboursement, ou l'ouverture d'une dette manuelle (sans vente
 *  associée : le montant d'une dette issue d'une vente reste celui de la vente). */
function isEditableEntry(entry: LedgerEntryResponse): boolean {
  if (entry.type === 'REPAYMENT') return !!entry.paymentId && !!entry.paymentMethod
  return entry.type === 'CREDIT_PURCHASE' && !entry.saleId && !!entry.debtId
}

function movementVisual(entry: LedgerEntryResponse, t: (key: string, options?: Record<string, unknown>) => string) {
  const positive = entry.type === 'REPAYMENT'
  if (positive) {
    return { Icon: Check, bg: '#E6F1EC', color: '#0E7A52', title: entry.note ? `${t('debtBook.repaymentTitle')} · ${entry.note}` : t('debtBook.repaymentTitle'), positive }
  }
  return { Icon: Receipt, bg: '#F4E7D2', color: '#8A6A21', title: entry.note ? `${t('debtBook.creditPurchase')} · ${entry.note}` : t('debtBook.creditPurchase'), positive }
}

/** Contenu de la modale de détail (carnet du client) — un seul appel getLedger() par ouverture,
 *  pas de N+1 : cette vue n'existe que quand un client précis est sélectionné (cf. commentaire de
 *  DesktopClients ci-dessus sur pourquoi ces colonnes n'apparaissent pas dans le tableau). */
function ClientLedger({ debtor, locale, onPay, onChanged }: { debtor: DebtorResponse; locale: Locale; onPay: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  const [ledger, setLedger] = useState<DebtorDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('ALL')
  // Ligne du carnet en cours de correction (remboursement ou dette manuelle) — ouvre la modale correspondante.
  const [editingEntry, setEditingEntry] = useState<LedgerEntryResponse | null>(null)

  // `debtor.totalRemaining` en dépendance (pas seulement le téléphone) : après un versement,
  // DesktopClients.loadList() rafraîchit la liste des débiteurs, ce qui fait remonter un nouveau
  // `totalRemaining` ici et redéclenche le rechargement du carnet — sans ça la modale resterait
  // affichée avec l'ancien solde tant qu'elle reste ouverte.
  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    debtApi.getLedger(debtor.customerPhone).then(setLedger).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
  }, [debtor.customerPhone, debtor.totalRemaining])

  useEffect(load, [load])

  const days = daysUntil(debtor.nearestDueDate)
  const overdueLabel = debtor.urgency === 'OVERDUE' ? t('debtBook.overdueByDays', { days: Math.abs(days ?? 0) }) : debtor.urgency === 'DUE_SOON' ? t('debtBook.dueInDays', { days: days ?? 0 }) : null

  /** Dette après chaque mouvement, calculée en remontant depuis le solde actuel — l'API ne
   *  renvoie que le montant de chaque mouvement, pas le solde courant. */
  const runningBalances = useMemo(() => {
    if (!ledger) return []
    let balance = ledger.totalRemaining
    const balances: number[] = []
    for (const entry of ledger.entries) {
      balances.push(balance)
      balance -= entry.type === 'REPAYMENT' ? -entry.amount : entry.amount
    }
    return balances
  }, [ledger])

  const visibleEntries = (ledger?.entries ?? [])
    .map((entry, i) => ({ entry, balance: runningBalances[i] }))
    .filter(({ entry }) => (ledgerFilter === 'PURCHASES' ? entry.type !== 'REPAYMENT' : ledgerFilter === 'PAYMENTS' ? entry.type === 'REPAYMENT' : true))

  if (isLoading && !ledger) return <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
  if (!ledger) return <div className="text-sm font-semibold text-danger">{error ?? t('debtBook.customerNotFound')}</div>

  const lastActivity = ledger.entries[0]?.date

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="amount text-sm text-text-muted flex-1 min-w-[140px] break-all">{debtor.customerPhone}</div>
        <a href={`tel:${debtor.customerPhone}`} className="min-h-9 px-3 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold flex-none">
          <Phone size={14} className="text-succes-text" />
          {t('inventoryCatalog.call')}
        </a>
        <button type="button" disabled title={t('debtBook.remindUnavailable')} className="min-h-9 px-3 rounded-xl border border-border-strong bg-bg-card text-sm font-bold opacity-50 flex-none">
          {t('debtBook.remind')}
        </button>
        <button type="button" onClick={onPay} disabled={ledger.totalRemaining <= 0} className="min-h-9 px-4 rounded-xl bg-emeraude text-papier text-sm font-bold disabled:opacity-50 flex-none">
          {t('debtBook.cashIn')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-[1.3] basis-full sm:basis-[220px] min-w-0 p-4 rounded-2xl bg-terracotta text-papier relative overflow-hidden flex flex-col gap-1">
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 4px,transparent 4px 16px)' }} />
          <span className="relative text-[11px] font-extrabold tracking-widest text-[#F4CDC1]">{t('debtBook.balanceDue')}</span>
          <span className="relative font-display amount text-[26px] font-extrabold leading-none">{formatNumber(ledger.totalRemaining, locale)}</span>
          <span className="relative text-xs font-bold text-[#F4CDC1] mt-0.5">{overdueLabel ?? ' '}</span>
        </div>
        <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-elevated flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-wider text-text-dim">{t('debtBook.totalPurchasedLabel')}</span>
          <span className="amount text-lg sm:text-xl break-all font-extrabold">{formatNumber(ledger.totalOriginal, locale)}</span>
        </div>
        <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-elevated flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-wider text-text-dim">{t('debtBook.totalPaidStatLabel')}</span>
          <span className="amount text-lg sm:text-xl break-all font-extrabold text-succes-text">{formatNumber(ledger.totalPaid, locale)}</span>
        </div>
        <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-elevated flex flex-col gap-1">
          <span className="text-[11px] font-extrabold tracking-wider text-text-dim">{t('debtBook.lastActivityStatLabel')}</span>
          <span className="text-lg sm:text-xl font-extrabold">{lastActivity ? formatDate(new Date(lastActivity), locale, { day: 'numeric', month: 'short' }) : '—'}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card flex flex-col overflow-hidden">
        <div className="flex-none flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-border bg-bg">
          <span className="text-[15px] font-extrabold">{t('debtBook.historyLabel')}</span>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['ALL', t('debtBook.ledgerFilterAll')],
              ['PURCHASES', t('debtBook.ledgerFilterPurchases')],
              ['PAYMENTS', t('debtBook.ledgerFilterPayments')],
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
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim">{t('debtBook.dateColumn')}</span>
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim">{t('debtBook.movementColumn')}</span>
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim text-right">{t('debtBook.amountColumn')}</span>
          <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim text-right">{t('debtBook.debtColumn')}</span>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {error && <div className="p-4 text-[13px] font-semibold text-danger">{error}</div>}
          {visibleEntries.length === 0 ? (
            <div className="p-6 text-sm font-semibold text-text-dim text-center">{t('debtBook.noMovement')}</div>
          ) : (
            visibleEntries.map(({ entry, balance }, i) => {
              const { Icon, bg, color, title, positive } = movementVisual(entry, t)
              const editable = isEditableEntry(entry)
              return (
                <div
                  key={i}
                  role={editable ? 'button' : undefined}
                  tabIndex={editable ? 0 : undefined}
                  aria-label={editable ? t('debtBook.editRowAria') : undefined}
                  onClick={editable ? () => setEditingEntry(entry) : undefined}
                  onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingEntry(entry) } } : undefined}
                  className={`grid grid-cols-[0.9fr_1.8fr_1fr_1fr] sm:grid-cols-[1fr_2.3fr_1.1fr_1.1fr] gap-2 sm:gap-4 px-3 sm:px-5 py-3 items-center ${i > 0 ? 'border-t border-border-hairline' : ''} ${editable ? 'cursor-pointer hover:bg-bg-elevated' : ''}`}
                >
                  <span className="text-xs sm:text-[13px] font-bold text-text-muted">{formatDate(new Date(entry.date), locale, { day: 'numeric', month: 'short' })}</span>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: bg }}>
                      <Icon size={15} style={{ color }} strokeWidth={2.4} />
                    </span>
                    <span className="text-[13.5px] font-extrabold break-words min-w-0">{title}</span>
                    {editable && (
                      <span className="ml-auto flex-none w-8 h-8 rounded-lg flex items-center justify-center text-text-muted">
                        <Pencil size={14} />
                      </span>
                    )}
                  </span>
                  <span className={`amount text-xs sm:text-[13.5px] break-all font-extrabold text-right ${positive ? 'text-succes-text' : 'text-terracotta'}`}>{positive ? '+' : ''}{formatNumber(entry.amount, locale)}</span>
                  <span className="amount text-xs sm:text-[13.5px] break-all font-extrabold text-right">{formatNumber(Math.max(0, balance), locale)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {editingEntry?.type === 'REPAYMENT' && editingEntry.paymentId && editingEntry.paymentMethod && (
        <DebtPaymentModalDesktop
          open
          customerPhone={debtor.customerPhone}
          customerName={ledger.customerName}
          remainingAmount={ledger.totalRemaining}
          editing={{ paymentId: editingEntry.paymentId, amount: editingEntry.amount, method: editingEntry.paymentMethod, note: editingEntry.note }}
          onClose={() => setEditingEntry(null)}
          onDone={() => { setEditingEntry(null); load(); onChanged() }}
        />
      )}

      {editingEntry?.type === 'CREDIT_PURCHASE' && editingEntry.debtId && (
        <EditManualDebtModalDesktop
          open
          debtId={editingEntry.debtId}
          customerName={ledger.customerName}
          initialAmount={editingEntry.amount}
          initialDueDate={editingEntry.dueDate}
          onClose={() => setEditingEntry(null)}
          onDone={() => { setEditingEntry(null); load(); onChanged() }}
        />
      )}
    </div>
  )
}
