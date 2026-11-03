import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Search, User, UserCheck, UserPlus, Pencil, UserX, Users } from 'lucide-react'
import { customerApi, type CustomerResponse, type CustomerType } from '../../../lib/customerApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useAuth } from '../../../hooks/useAuth'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { useTopBar } from '../../hooks/useTopBar'

type DirectoryFilter = 'ALL' | 'ENTREPRISE' | 'PARTICULIER' | 'ACTIVE'
const PAGE_SIZE = 10

/** Annuaire client (module customer, doc TVA §7 — question ouverte tranchée "oui" : un vrai
 *  annuaire client, pas seulement un snapshot BillingParty). Écran CRUD simple : le backend
 *  n'expose qu'une désactivation logique (pas de suppression physique). La maquette de référence
 *  (study/web/annuaire) affiche aussi des achats cumulés, un encours de crédit, un badge "VIP" et
 *  un bouton "Exporter" : aucun de ces champs n'existe côté API (CustomerResponse n'a ni montant
 *  d'achats, ni solde/encours, ni tiers VIP, et il n'y a pas d'endpoint d'export) — non repris,
 *  même logique que les écarts déjà documentés pour l'onglet Équipe. Les 3 cartes de stats et les
 *  filtres restent réels, calculés depuis les données déjà chargées. */
export default function DesktopCustomers() {
  const { t } = useTranslation()
  const { user } = useAuth()
  // L'exonération de TVA est un choix fiscal : réservé au propriétaire (comme côté serveur).
  const isOwner = user?.role === 'OWNER'

  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DirectoryFilter>('ALL')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState<CustomerResponse | 'new' | null>(null)
  const [formType, setFormType] = useState<CustomerType>('PARTICULIER')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formTaxId, setFormTaxId] = useState('')
  const [formExempt, setFormExempt] = useState(false)
  const [formExemptReason, setFormExemptReason] = useState('')

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    customerApi
      .search()
      .then(setCustomers)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])

  useTopBar({ title: t('customerDirectory.pageEyebrow') }, [t])

  const entrepriseCount = useMemo(() => customers.filter((c) => c.type === 'ENTREPRISE').length, [customers])
  const activeCount = useMemo(() => customers.filter((c) => c.active).length, [customers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      if (filter === 'ENTREPRISE' && c.type !== 'ENTREPRISE') return false
      if (filter === 'PARTICULIER' && c.type !== 'PARTICULIER') return false
      if (filter === 'ACTIVE' && !c.active) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.taxId ?? '').toLowerCase().includes(q)
    })
  }, [customers, search, filter])

  useEffect(() => setPage(1), [search, filter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setFormType('PARTICULIER')
    setFormName('')
    setFormPhone('')
    setFormAddress('')
    setFormTaxId('')
    setFormExempt(false)
    setFormExemptReason('')
    setEditing('new')
  }

  const openEdit = (c: CustomerResponse) => {
    setFormType(c.type)
    setFormName(c.name)
    setFormPhone(c.phone ?? '')
    setFormAddress(c.address ?? '')
    setFormTaxId(c.taxId ?? '')
    setFormExempt(c.taxExempt)
    setFormExemptReason(c.taxExemptionReason ?? '')
    setEditing(c)
  }

  const handleSave = async () => {
    if (formName.trim().length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const payload = {
        type: formType,
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        taxId: formType === 'ENTREPRISE' ? formTaxId.trim() || undefined : undefined,
      }
      const wantsExemption = isOwner && formExempt
      if (editing === 'new') {
        let created = await customerApi.create(payload)
        if (wantsExemption) created = await customerApi.changeTaxExemption(created.id, true, formExemptReason.trim())
        setCustomers((prev) => [created, ...prev])
      } else if (editing) {
        let updated = await customerApi.update(editing.id, payload)
        const exemptionChanged = isOwner && (formExempt !== updated.taxExempt || (formExempt && formExemptReason.trim() !== (updated.taxExemptionReason ?? '')))
        if (exemptionChanged) updated = await customerApi.changeTaxExemption(updated.id, formExempt, formExemptReason.trim())
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      setEditing(null)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async (c: CustomerResponse) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await customerApi.deactivate(c.id)
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: false } : x)))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: TableColumn<CustomerResponse>[] = [
    {
      key: 'name',
      label: t('customerDirectory.nameColumn'),
      render: (c) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs flex-none ${c.type === 'ENTREPRISE' ? 'bg-alerte-bg text-alerte-text' : 'bg-info-bg text-primary'}`}>
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-text">{c.name}</span>
            {c.taxExempt && (
              <span title={c.taxExemptionReason ?? undefined} className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-succes-bg text-succes-text">
                {t('customerDirectory.taxExemptBadge')}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${c.type === 'ENTREPRISE' ? 'bg-alerte-bg text-alerte-text' : 'bg-bg-elevated text-text-muted'}`}>
              {c.type === 'ENTREPRISE' ? t('customerDirectory.proBadge') : t('billing.buyerTypeParticulier')}
            </span>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: t('customerDirectory.phoneColumn'), render: (c) => c.phone ?? '—' },
    { key: 'address', label: t('customerDirectory.addressColumn'), render: (c) => c.address ?? '—' },
    {
      key: 'taxId',
      label: t('customerDirectory.taxIdColumn'),
      render: (c) => (c.taxId ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] bg-bg-elevated text-text border border-border">{c.taxId}</span>
      ) : (
        <span className="text-xs text-text-dim italic">{t('customerDirectory.taxIdNotProvided')}</span>
      )),
    },
    {
      key: 'status',
      label: t('customerDirectory.statusColumn'),
      align: 'center',
      render: (c) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${c.active ? 'bg-succes-bg text-succes-text' : 'bg-bg-elevated text-text-dim'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-success' : 'bg-text-dim'}`} />
          {c.active ? t('customerDirectory.active') : t('customerDirectory.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => openEdit(c)} className="p-1.5 text-text-dim hover:text-primary hover:bg-bg-elevated rounded-lg transition-colors" title={t('customerDirectory.editCta')}>
            <Pencil size={15} />
          </button>
          {c.active && (
            <button type="button" onClick={() => handleDeactivate(c)} className="p-1.5 text-text-dim hover:text-danger hover:bg-bg-elevated rounded-lg transition-colors" title={t('customerDirectory.deactivateCta')}>
              <UserX size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const FILTERS: { id: DirectoryFilter; label: string }[] = [
    { id: 'ALL', label: t('customerDirectory.filterAll') },
    { id: 'ENTREPRISE', label: t('customerDirectory.filterEntreprise') },
    { id: 'PARTICULIER', label: t('customerDirectory.filterParticulier') },
    { id: 'ACTIVE', label: t('customerDirectory.filterActiveOnly') },
  ]

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="font-display text-xl sm:text-3xl font-extrabold text-text">{t('customerDirectory.pageTitle')}</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">{t('customerDirectory.pageSubtitle')}</p>
        </div>
        <Button variant="accent" onClick={openCreate} className="self-start md:self-auto">
          <span className="flex items-center gap-1.5"><UserPlus size={16} /> {t('customerDirectory.newCustomerCta')}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('customerDirectory.totalClientsLabel')}</span>
            <span className="p-1.5 bg-bg-elevated rounded-lg text-text-muted"><Users size={16} /></span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text">{customers.length}</div>
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('customerDirectory.proAccountsLabel')}</span>
            <span className="p-1.5 bg-alerte-bg rounded-lg text-alerte-text"><Building2 size={16} /></span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-2xl font-extrabold text-text">{entrepriseCount}</span>
            <span className="text-xs text-text-dim">{t('customerDirectory.proAccountsSubtitle', { count: customers.length - entrepriseCount })}</span>
          </div>
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('customerDirectory.activeAccountsLabel')}</span>
            <span className="p-1.5 bg-succes-bg rounded-lg text-succes-text"><UserCheck size={16} /></span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-2xl font-extrabold text-text">{activeCount}</span>
            <span className="text-xs text-text-dim">{t('customerDirectory.activeAccountsSubtitle', { count: customers.length })}</span>
          </div>
        </div>
      </div>

      <div className="bg-bg-card p-3 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customerDirectory.searchPlaceholder')}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-strong bg-bg text-sm font-semibold outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto scroll-smooth pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                filter === f.id ? 'bg-bg-elevated text-text' : 'text-text-muted hover:bg-bg-elevated/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : (
        <>
          <Table
            columns={columns}
            rows={pageRows}
            getRowKey={(c) => c.id}
            emptyMessage={t('customerDirectory.emptyState')}
          />

          {filtered.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeLabel={t('customerDirectory.showingRangeClients', {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, filtered.length),
                total: filtered.length,
              })}
            />
          )}
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} width={480} title={editing === 'new' ? t('customerDirectory.newCustomerModalTitle') : t('customerDirectory.editCustomerModalTitle')}>
        <div className="flex flex-col gap-3">
          <div className="p-1 rounded-xl bg-bg-elevated flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setFormType('PARTICULIER')}
              className={`flex-1 min-w-[130px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${formType === 'PARTICULIER' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
            >
              <User size={16} /> {t('billing.buyerTypeParticulier')}
            </button>
            <button
              type="button"
              onClick={() => setFormType('ENTREPRISE')}
              className={`flex-1 min-w-[130px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${formType === 'ENTREPRISE' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
            >
              <Building2 size={16} /> {t('billing.buyerTypeEntreprise')}
            </button>
          </div>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t('billing.buyerNamePlaceholder') ?? ''} autoFocus />
          <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder={t('billing.buyerPhonePlaceholder') ?? ''} />
          <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder={t('billing.buyerAddressPlaceholder') ?? ''} />
          {formType === 'ENTREPRISE' && (
            <Input value={formTaxId} onChange={(e) => setFormTaxId(e.target.value)} placeholder={t('billing.buyerTaxIdPlaceholder') ?? ''} />
          )}
          {isOwner && (
            <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-bg">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={formExempt} onChange={(e) => setFormExempt(e.target.checked)} className="h-4 w-4 mt-0.5 flex-none accent-primary" />
                <span className="text-sm font-bold text-text break-words min-w-0">{t('customerDirectory.taxExemptLabel')}</span>
              </label>
              {formExempt && (
                <>
                  <Input value={formExemptReason} onChange={(e) => setFormExemptReason(e.target.value)} placeholder={t('customerDirectory.taxExemptReasonPlaceholder') ?? ''} maxLength={255} />
                  <p className="text-[11px] text-text-muted leading-relaxed">{t('customerDirectory.taxExemptHelp')}</p>
                </>
              )}
            </div>
          )}
          <Button onClick={handleSave} disabled={formName.trim().length === 0 || (isOwner && formExempt && formExemptReason.trim().length === 0) || busy} loading={busy}>
            {t('customerDirectory.saveCta')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
