import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Truck, Warehouse, CheckCircle2, Receipt, Download, Eye, Wallet, CreditCard, ArrowRight, TrendingUp,
} from 'lucide-react'
import { formatNumber, formatDate, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { suppliersApi, type SupplierResponse } from '../../../lib/suppliersApi'
import { inventoryApi, type StockIntakeResponse } from '../../../lib/inventoryApi'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { reportingApi } from '../../../lib/reportingApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { syncEngine } from '../../../lib/syncEngine'
import { useTenant } from '../../../hooks/useTenant'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { useTopBar } from '../../hooks/useTopBar'
import SupplierPaymentModalDesktop from './SupplierPaymentModalDesktop'
import SupplierAccountModalDesktop from './SupplierAccountModalDesktop'
import StockIntakeEditModalDesktop from './StockIntakeEditModalDesktop'

type RegistryFilter = 'ALL' | 'CREDIT' | 'CASH'
type SortKey = 'date' | 'amount'
const PAGE_SIZE = 8

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
}

const pillClass = (active: boolean) => `px-3.5 py-2 rounded-lg text-xs font-bold ${active ? 'bg-encre text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`

function lineSummary(intake: StockIntakeResponse, productMap: Map<string, ProductResponse>) {
  return intake.lines.map((l) => `${l.quantity} × ${productMap.get(l.productId)?.name ?? '—'}`).join(', ')
}

/** W19bis — refonte visuelle (étude study/web/fournisseur_web_page_redesign) : le maître-détail
 *  précédent (liste + panneau latéral toujours visible) devient un tableau de bord plein écran —
 *  4 tuiles KPI, colonne "Fournisseurs actifs" (cartes) + grand registre des arrivages avec carte
 *  du dernier bon mise en avant, filtres et pagination — même mouvement que DesktopClients.tsx
 *  (W7) et DesktopStock.tsx (W4). Le compte fournisseur complet (carnet, règlement) déménage dans
 *  une modale ouverte via /fournisseurs/:id (SupplierAccountModalDesktop), symétrique de
 *  ClientLedger dans DesktopClients.tsx, plutôt que de disparaître.
 *
 *  Écarts assumés vis-à-vis du mockup (rien à fabriquer côté API) :
 *  - Aucune échéance de dette fournisseur n'existe côté modèle (Supplier n'a qu'un solde global,
 *    symétrique inverse du carnet clients) : pas d'"Échéance globale" en tuile 1, pas de compte à
 *    rebours par fournisseur.
 *  - Le paiement fournisseur (RecordSupplierPaymentUseCase) réduit un solde agrégé, pas un bon
 *    précis : impossible de restituer un statut par BL (SOLDÉ/ACOMPTE/COMPTANT) ni un triptyque
 *    "Facturé/Acompte/Reste" par bon. Remplacé par une distinction réelle et déjà modélisée —
 *    StockIntake.supplierId nullable ("achat comptant sans fournisseur référencé", cf. javadoc) —
 *    d'où les filtres "À crédit fournisseur" / "Achats comptant" et le badge Crédit/Comptant par
 *    ligne, plus le solde *actuel* du fournisseur (pas figé au moment du bon) sur la carte mise en
 *    avant.
 *  - "N° de bon" (BL-2026-0318) n'existe pas côté API (StockIntakeResponse n'a qu'un UUID) :
 *    généré côté client à partir du rang chronologique de création (stable tant que la liste ne
 *    change pas), pas une vraie séquence serveur.
 *  - Carte "Protocole Dettes Marché Madina" retirée : business rule fictive du mockup, aucun champ
 *    de ce type n'existe (pas de marge préférentielle conditionnelle par fournisseur).
 *  - "Exporter l'état des dettes" réutilise reportingApi.dataExport() (même ZIP CSV que Stock →
 *    Exporter, qui inclut déjà la table `suppliers`) — pas d'export dédié "dettes fournisseurs".
 *  - Recherche déplacée dans la TopBar (searchValue/onSearchChange), comme DesktopStock.tsx/
 *    DesktopClients.tsx — pas de second champ dans la colonne de gauche. */
export default function DesktopSuppliers() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { id: routeSupplierId } = useParams<{ id: string }>()

  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [intakes, setIntakes] = useState<StockIntakeResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  const [registryFilter, setRegistryFilter] = useState<RegistryFilter>('ALL')
  const [filterSupplierId, setFilterSupplierId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [viewingLines, setViewingLines] = useState<StockIntakeResponse | null>(null)
  const [payingSupplier, setPayingSupplier] = useState<SupplierResponse | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([suppliersApi.getAll(), inventoryApi.getIntakes(), productsApi.search()])
      .then(([s, i, p]) => {
        setSuppliers(s)
        setIntakes(i)
        setProducts(p)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])

  useTopBar(
    { searchValue: search, onSearchChange: setSearch, searchPlaceholder: t('inventoryCatalog.suppliersSearchPlaceholder') },
    [t, search],
  )

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])

  const suppliersMeta = useMemo(() => {
    const map = new Map<string, { lastIntakeAt: string | null; productNames: string[] }>()
    const bySupplier = new Map<string, StockIntakeResponse[]>()
    for (const intake of intakes) {
      if (!intake.supplierId) continue
      const list = bySupplier.get(intake.supplierId) ?? []
      list.push(intake)
      bySupplier.set(intake.supplierId, list)
    }
    for (const [supplierId, list] of bySupplier) {
      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const names: string[] = []
      for (const intake of sorted) {
        for (const line of intake.lines) {
          const name = productMap.get(line.productId)?.name
          if (name && !names.includes(name)) names.push(name)
          if (names.length >= 3) break
        }
        if (names.length >= 3) break
      }
      map.set(supplierId, { lastIntakeAt: sorted[0]?.createdAt ?? null, productNames: names })
    }
    return map
  }, [intakes, productMap])

  const receiptNumbers = useMemo(() => {
    const map = new Map<string, string>()
    const ascending = [...intakes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    ascending.forEach((intake, i) => {
      const year = new Date(intake.createdAt).getFullYear()
      map.set(intake.id, `BL-${year}-${String(i + 1).padStart(4, '0')}`)
    })
    return map
  }, [intakes])

  const totalDue = suppliers.reduce((s, x) => s + x.balanceDue, 0)
  const dueCount = suppliers.filter((s) => s.balanceDue > 0).length

  const currentYear = new Date().getFullYear()
  const intakesThisYear = useMemo(() => intakes.filter((i) => new Date(i.createdAt).getFullYear() === currentYear), [intakes, currentYear])
  const purchasedThisYear = intakesThisYear.reduce((s, i) => s + i.totalAmount, 0)
  const unitsThisYear = intakesThisYear.reduce((s, i) => s + i.totalUnits, 0)
  const regularSupplierCount = new Set(intakesThisYear.map((i) => i.supplierId).filter((id): id is string => !!id)).size

  const creditPurchasesAllTime = intakes.filter((i) => i.supplierId).reduce((s, i) => s + i.totalAmount, 0)
  const totalPaid = Math.max(0, creditPurchasesAllTime - totalDue)
  const paymentRate = creditPurchasesAllTime > 0 ? (totalPaid / creditPurchasesAllTime) * 100 : 100

  const lastIntake = useMemo(() => [...intakes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null, [intakes])
  const lastIntakeSupplier = lastIntake?.supplierId ? supplierMap.get(lastIntake.supplierId) ?? null : null
  const lastIntakeProductNames = useMemo(() => {
    if (!lastIntake) return []
    const names: string[] = []
    for (const line of lastIntake.lines) {
      const name = productMap.get(line.productId)?.name
      if (name && !names.includes(name)) names.push(name)
    }
    return names.slice(0, 3)
  }, [lastIntake, productMap])

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q))
  }, [suppliers, search])

  const creditCount = intakes.filter((i) => i.supplierId).length
  const cashCount = intakes.filter((i) => !i.supplierId).length

  const filteredIntakes = useMemo(() => {
    let rows = intakes
    if (registryFilter === 'CREDIT') rows = rows.filter((i) => i.supplierId)
    if (registryFilter === 'CASH') rows = rows.filter((i) => !i.supplierId)
    if (filterSupplierId) rows = rows.filter((i) => i.supplierId === filterSupplierId)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => (sortKey === 'amount' ? (a.totalAmount - b.totalAmount) * dir : a.createdAt.localeCompare(b.createdAt) * dir))
  }, [intakes, registryFilter, filterSupplierId, sortKey, sortDir])

  useEffect(() => setPage(1), [registryFilter, filterSupplierId])

  const onSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key as SortKey)
      setSortDir('desc')
    }
  }

  const pageCount = Math.max(1, Math.ceil(filteredIntakes.length / PAGE_SIZE))
  const pageRows = filteredIntakes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleCreate = async () => {
    if (newName.trim().length === 0 || savingNew) return
    setSavingNew(true)
    const payload = { name: newName.trim(), phone: newPhone.trim() || undefined, location: newLocation.trim() || undefined, currency: tenant.currency }
    try {
      const supplier = await suppliersApi.create(payload)
      setCreating(false)
      setNewName('')
      setNewPhone('')
      setNewLocation('')
      await load()
      navigate(`/fournisseurs/${supplier.id}`)
    } catch (e) {
      if (e instanceof NetworkError) {
        await syncEngine.enqueue('CREATE_SUPPLIER', JSON.stringify(payload))
        setError(t('inventoryCatalog.supplierQueuedOffline'))
        setCreating(false)
        setNewName('')
        setNewPhone('')
        setNewLocation('')
      } else {
        setError(toErrorMessage(e))
      }
    } finally {
      setSavingNew(false)
    }
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await reportingApi.dataExport()
      await downloadBlob(blob, `boutiklic-fournisseurs-${new Date().toISOString().slice(0, 10)}.zip`)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const columns: TableColumn<StockIntakeResponse>[] = [
    {
      key: 'date',
      label: t('inventoryCatalog.receiptNumberColumn'),
      sortable: true,
      render: (i) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-primary text-sm">{receiptNumbers.get(i.id)}</span>
          <span className="amount text-[11px] text-text-dim">{formatDate(new Date(i.createdAt), locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      ),
    },
    {
      key: 'supplier',
      label: t('inventoryCatalog.supplierLabel'),
      render: (i) => (i.supplierId ? supplierMap.get(i.supplierId)?.name ?? t('inventoryCatalog.supplierFallback') : <span className="text-text-dim italic">{t('inventoryCatalog.cashPurchaseLabel')}</span>),
    },
    {
      key: 'goods',
      label: t('inventoryCatalog.goodsColumn'),
      render: (i) => <span className="text-[13px] text-text-muted line-clamp-1 max-w-xs block">{lineSummary(i, productMap)}</span>,
    },
    {
      key: 'amount',
      label: t('inventoryCatalog.purchaseValueColumn'),
      numeric: true,
      sortable: true,
      render: (i) => <span className="font-extrabold">{formatNumber(i.totalAmount, locale)}</span>,
    },
    {
      key: 'type',
      label: t('inventoryCatalog.typeColumn'),
      align: 'center',
      render: (i) =>
        i.supplierId ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-info-bg text-primary text-[10px] font-extrabold uppercase">{t('inventoryCatalog.creditBadge')}</span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full bg-succes-bg text-succes-text text-[10px] font-extrabold uppercase">{t('inventoryCatalog.cashBadge')}</span>
        ),
    },
    {
      key: 'actions',
      label: t('inventoryCatalog.actionColumn'),
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setViewingLines(i)} title={t('inventoryCatalog.editReceiptCta')} className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-text-muted flex-none">
            <Eye size={14} />
          </button>
          {i.supplierId && (
            <button type="button" onClick={() => navigate(`/fournisseurs/${i.supplierId}`)} title={t('inventoryCatalog.viewSupplierAccountCta')} className="w-8 h-8 rounded-lg border border-border-strong bg-bg-card flex items-center justify-center text-primary flex-none">
              <Wallet size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-terracotta">
            <Truck size={14} />
            <span className="text-[11px] font-extrabold uppercase tracking-wider">{t('inventoryCatalog.suppliersPageEyebrow')}</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-text">{t('inventoryCatalog.suppliersPageTitle')}</h1>
          <p className="text-xs sm:text-[13px] font-semibold text-text-dim max-w-2xl mt-0.5">{t('inventoryCatalog.suppliersPageSubtitle', { currency: tenant.currency })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleExport} disabled={exporting} className="min-h-10 px-3.5 py-1.5 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text text-left disabled:opacity-50">
            <Download size={16} className="flex-none" />
            {t('inventoryCatalog.exportDebtsButton')}
          </button>
          <button type="button" onClick={() => navigate('/stock/arrivage')} className="min-h-10 px-3.5 py-1.5 rounded-xl bg-terracotta text-white flex items-center gap-2 text-sm font-bold text-left">
            <Plus size={16} />
            {t('inventoryCatalog.newArrivalReceiptCta')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border border-l-4 border-l-terracotta flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-terracotta">{t('inventoryCatalog.totalOwedLabel')}</span>
            <span className="p-1.5 rounded-lg bg-[#FBE9E4] text-terracotta"><Receipt size={16} /></span>
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-terracotta">{formatNumber(totalDue, locale)}</span>
          <span className="text-[13px] font-semibold text-text-dim">
            {t('inventoryCatalog.supplierCount', { count: suppliers.length })}
            {dueCount > 0 ? ` · ${t('inventoryCatalog.suppliersDueSuffix', { count: dueCount })}` : ''}
          </span>
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.kpiPurchasedLabel', { year: currentYear })}</span>
            <span className="p-1.5 rounded-lg bg-bg-elevated text-text-muted"><Warehouse size={16} /></span>
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-text">{formatNumber(purchasedThisYear, locale)}</span>
          <span className="text-[13px] font-semibold text-text-dim">
            {t('inventoryCatalog.suppliersRegularCaption', { count: regularSupplierCount })} · {t('inventoryCatalog.suppliersVolumeCaption', { count: unitsThisYear })}
          </span>
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-succes-text">{t('inventoryCatalog.kpiSettlementsLabel')}</span>
            <span className="p-1.5 rounded-lg bg-succes-bg text-succes-text"><CheckCircle2 size={16} /></span>
          </div>
          <span className="font-display amount text-2xl sm:text-3xl font-extrabold break-all text-text">{formatNumber(totalPaid, locale)}</span>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-succes-text">
            <TrendingUp size={13} />
            {t('inventoryCatalog.suppliersPaymentRateCaption', { value: paymentRate.toFixed(1) })} · {dueCount === 0 ? t('inventoryCatalog.suppliersHealthyCreditCaption') : t('inventoryCatalog.suppliersWatchCreditCaption')}
          </span>
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-primary">{t('inventoryCatalog.kpiLastReceiptLabel')}</span>
            <span className="p-1.5 rounded-lg bg-info-bg text-primary"><Truck size={16} /></span>
          </div>
          {lastIntake ? (
            <>
              <span className="font-display text-xl xl:text-2xl font-extrabold text-primary tracking-tight break-all">{receiptNumbers.get(lastIntake.id)}</span>
              <span className="text-[13px] break-words font-semibold text-text-dim">
                {t('inventoryCatalog.lastReceiptUnitsCaption', { units: lastIntake.totalUnits, products: lastIntakeProductNames.join(', ') || t('inventoryCatalog.supplierFallback') })}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-text-dim">{t('inventoryCatalog.noReceiptYet')}</span>
          )}
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="flex-1 flex flex-col xl:flex-row gap-5 items-start">
        <div className="w-full xl:w-[400px] xl:shrink-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-0.5">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="font-display text-base sm:text-lg font-extrabold text-text">{t('inventoryCatalog.suppliersActiveTitle')}</span>
              <span className="px-2 py-0.5 rounded-full bg-bg-elevated font-extrabold text-[11px] text-text-muted">{t('inventoryCatalog.supplierCount', { count: suppliers.length })}</span>
            </div>
            <button type="button" onClick={() => setCreating(true)} className="text-primary hover:text-primary-dark text-sm font-extrabold flex items-center gap-1 flex-none whitespace-nowrap">
              <Plus size={14} /> {t('inventoryCatalog.add')}
            </button>
          </div>

          {filterSupplierId && (
            <div className="flex flex-wrap items-center justify-between px-3 py-2 rounded-lg bg-info-bg text-primary text-xs font-bold gap-2">
              <span className="min-w-0 break-words">{t('inventoryCatalog.filteredBySupplierCaption', { name: supplierMap.get(filterSupplierId)?.name ?? '' })}</span>
              <button type="button" onClick={() => setFilterSupplierId(null)} className="flex-none underline">{t('inventoryCatalog.clearReceiptsFilterCta')}</button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isLoading ? (
              <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-4 rounded-xl bg-bg-card border border-border text-sm font-semibold text-text-dim">{t('inventoryCatalog.suppliersEmptyState')}</div>
            ) : (
              filteredSuppliers.map((s) => {
                const meta = suppliersMeta.get(s.id)
                const hasDebt = s.balanceDue > 0
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/fournisseurs/${s.id}`)}
                    className="p-3.5 rounded-xl border border-border bg-bg-card hover:bg-bg-elevated cursor-pointer transition-colors relative overflow-hidden"
                  >
                    {hasDebt && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-terracotta" />}
                    <div className={`flex flex-wrap items-start justify-between gap-2 ${hasDebt ? 'pl-2' : ''}`}>
                      <div className="flex gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold flex-none ${hasDebt ? 'bg-[#FBE9E4] text-terracotta' : 'bg-succes-bg text-succes-text'}`}>
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-sm font-extrabold break-words">{s.name}</span>
                          <span className="text-xs text-text-dim break-words">{s.location ?? t('inventoryCatalog.noContactInfo')}</span>
                          {s.phone && (
                            <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()} className="amount text-[11px] text-text-dim/80 break-all hover:text-primary">
                              {s.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${hasDebt ? 'bg-[#FBE9E4] text-terracotta' : 'bg-succes-bg text-succes-text'}`}>
                        {hasDebt ? t('inventoryCatalog.supplierDebtBadge') : t('inventoryCatalog.supplierUpToDateBadge')}
                      </span>
                    </div>

                    {hasDebt && (
                      <div className={`mt-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5 bg-bg/70 p-2 rounded-lg ${hasDebt ? 'ml-2' : ''}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.supplierBalanceDueLabel')}</span>
                          <span className="amount text-base font-extrabold text-terracotta">{formatNumber(s.balanceDue, locale)}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.lastReceiptShortLabel')}</span>
                          <span className="text-xs font-bold text-text-muted">{meta?.lastIntakeAt ? formatDate(new Date(meta.lastIntakeAt), locale, { day: 'numeric', month: 'short' }) : '—'}</span>
                        </div>
                      </div>
                    )}

                    <div className={`mt-2 flex flex-wrap items-center justify-between text-[11px] text-text-dim gap-2 ${hasDebt ? 'pl-2' : ''}`}>
                      <span className="min-w-0 break-words">
                        {meta && meta.productNames.length > 0
                          ? `${t('inventoryCatalog.suppliersProductsLabel')} : ${meta.productNames.join(', ')}`
                          : !hasDebt && meta?.lastIntakeAt
                            ? `${t('inventoryCatalog.lastReceiptShortLabel')} : ${formatDate(new Date(meta.lastIntakeAt), locale, { day: 'numeric', month: 'short' })}`
                            : t('inventoryCatalog.noReceiptYet')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFilterSupplierId(s.id)
                          setRegistryFilter('ALL')
                        }}
                        className="font-extrabold text-primary flex items-center gap-0.5 shrink-0"
                      >
                        {t('inventoryCatalog.filterReceiptsCta')} <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 flex flex-col gap-3">
          <div className="bg-bg-card p-2.5 rounded-xl border border-border flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setRegistryFilter('ALL')} className={pillClass(registryFilter === 'ALL')}>{t('inventoryCatalog.registryFilterAll')} · {intakes.length}</button>
            <button type="button" onClick={() => setRegistryFilter('CREDIT')} className={pillClass(registryFilter === 'CREDIT')}>{t('inventoryCatalog.registryFilterCredit')} · {creditCount}</button>
            <button type="button" onClick={() => setRegistryFilter('CASH')} className={pillClass(registryFilter === 'CASH')}>{t('inventoryCatalog.registryFilterCash')} · {cashCount}</button>
          </div>

          {lastIntake && (
            <div className="bg-bg-card rounded-xl border border-border p-4 min-w-0 flex flex-col gap-3">
              <div className="flex flex-col min-w-0 lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={`p-2.5 rounded-xl flex-none ${lastIntake.supplierId ? 'bg-info-bg text-primary' : 'bg-succes-bg text-succes-text'}`}>
                    <Truck size={18} />
                  </span>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-text break-all">{receiptNumbers.get(lastIntake.id)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${lastIntake.supplierId ? 'bg-info-bg text-primary' : 'bg-succes-bg text-succes-text'}`}>
                        {lastIntake.supplierId ? t('inventoryCatalog.creditBadge') : t('inventoryCatalog.cashBadge')}
                      </span>
                      <span className="amount text-[11px] text-text-dim">
                        {t('inventoryCatalog.receiptReceivedOnCaption', { date: formatDate(new Date(lastIntake.createdAt), locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold text-text-dim mt-0.5">
                      {lastIntake.supplierId
                        ? t('inventoryCatalog.supplierColonLabel', { name: lastIntakeSupplier?.name ?? t('inventoryCatalog.supplierFallback') })
                        : t('inventoryCatalog.cashPurchaseLabel')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setViewingLines(lastIntake)} className="flex items-center gap-1.5 text-left bg-bg text-text px-3 py-2 rounded-lg text-xs font-extrabold border border-border-strong">
                    <Eye size={14} /> {t('inventoryCatalog.viewLineDetailsCta')}
                  </button>
                  {lastIntake.supplierId && (
                    <button
                      type="button"
                      onClick={() => lastIntakeSupplier && setPayingSupplier(lastIntakeSupplier)}
                      disabled={!lastIntakeSupplier || lastIntakeSupplier.balanceDue <= 0}
                      title={!lastIntakeSupplier || lastIntakeSupplier.balanceDue <= 0 ? t('inventoryCatalog.noBalanceToSettleTooltip') : undefined}
                      className="flex items-center gap-1.5 text-left bg-terracotta text-papier px-3.5 py-2 rounded-lg text-xs font-extrabold disabled:opacity-40"
                    >
                      <CreditCard size={14} /> {t('inventoryCatalog.paySupplierCta')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-bg p-2.5 rounded-xl">
                {lastIntake.lines.slice(0, 3).map((line) => (
                  <div key={line.productId} className="flex items-center justify-between gap-2 min-w-0 p-2.5 bg-bg-card rounded-lg">
                    <span className="text-xs font-bold text-text break-words min-w-0">{productMap.get(line.productId)?.name ?? t('inventoryCatalog.supplierFallback')}</span>
                    <span className="text-xs font-extrabold text-primary flex-none">{t('inventoryCatalog.unitsCount', { count: line.quantity })}</span>
                  </div>
                ))}
                {lastIntake.lines.length > 3 && (
                  <button type="button" onClick={() => setViewingLines(lastIntake)} className="flex items-center justify-center p-2.5 bg-bg-card rounded-lg text-xs font-extrabold text-primary">
                    +{lastIntake.lines.length - 3}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.receiptTotalAmountLabel')}</span>
                  <span className="amount text-base sm:text-lg font-extrabold text-text">{formatNumber(lastIntake.totalAmount, locale)}</span>
                </div>
                {lastIntake.supplierId ? (
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-terracotta">{t('inventoryCatalog.supplierCurrentBalanceLabel')}</span>
                    <span className="amount text-base sm:text-lg font-extrabold text-terracotta">{formatNumber(lastIntakeSupplier?.balanceDue ?? 0, locale)}</span>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-succes-bg text-succes-text text-xs font-extrabold">{t('inventoryCatalog.paidCashChip')}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim px-0.5">{t('inventoryCatalog.receiptsHistoryTitle')}</span>

            {pageRows.length > 0 && (
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                rangeLabel={t('inventoryCatalog.showingRangeReceipts', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, filteredIntakes.length), total: filteredIntakes.length })}
              />
            )}

            <Table
              columns={columns}
              rows={pageRows}
              getRowKey={(i) => i.id}
              onRowClick={(i) => setViewingLines(i)}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              rowClassName={(i) => (i.supplierId && (supplierMap.get(i.supplierId)?.balanceDue ?? 0) > 0 ? 'bg-[#FDF1EC]' : '')}
              emptyMessage={t('inventoryCatalog.emptyReceiptsFiltered')}
            />
          </div>
        </div>
      </div>

      <StockIntakeEditModalDesktop
        intake={viewingLines}
        receiptNumber={viewingLines ? receiptNumbers.get(viewingLines.id) ?? '' : ''}
        subtitle={viewingLines ? formatDate(new Date(viewingLines.createdAt), locale, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined}
        productName={(productId) => productMap.get(productId)?.name ?? t('inventoryCatalog.supplierFallback')}
        locale={locale}
        onClose={() => setViewingLines(null)}
        onChanged={() => {
          setViewingLines(null)
          load()
          setReloadToken((v) => v + 1)
        }}
      />

      <Modal open={creating} onClose={() => setCreating(false)} width={440} title={t('inventoryCatalog.newSupplierModalTitle')}>
        <div className="flex flex-col gap-3">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('inventoryCatalog.supplierNamePlaceholder')} autoFocus />
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder={t('inventoryCatalog.phoneOptionalPlaceholder')} />
          <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder={t('inventoryCatalog.locationOptionalPlaceholder')} />
          <Button onClick={handleCreate} disabled={newName.trim().length === 0 || savingNew} loading={savingNew}>
            {t('inventoryCatalog.create')}
          </Button>
        </div>
      </Modal>

      <SupplierAccountModalDesktop
        supplierId={routeSupplierId ?? null}
        locale={locale}
        reloadToken={reloadToken}
        onClose={() => navigate('/fournisseurs')}
        onPay={(s) => setPayingSupplier(s)}
        onChanged={load}
      />

      <SupplierPaymentModalDesktop
        supplier={payingSupplier}
        onClose={() => setPayingSupplier(null)}
        onDone={() => {
          setPayingSupplier(null)
          load()
          setReloadToken((v) => v + 1)
        }}
      />
    </div>
  )
}
