import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Building2, Check, Package, Plus, Sparkles, Truck, X } from 'lucide-react'
import { formatDate, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { stockTransfersApi, type StockTransferResponse, type TransferDestinationResponse } from '../../../lib/stockTransfersApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import { useTopBar } from '../../hooks/useTopBar'

interface DraftLine {
  productId: string
  productName: string
  quantity: number
}

type Scope = 'intra' | 'inter'

const statusBadge: Record<StockTransferResponse['status'], { bg: string; text: string }> = {
  IN_TRANSIT: { bg: 'bg-alerte-bg', text: 'text-alerte-text' },
  RECEIVED: { bg: 'bg-succes-bg', text: 'text-succes-text' },
  CANCELLED: { bg: 'bg-bg-elevated', text: 'text-text-dim' },
}

/** Étude study/etude_multi_depots_transferts.md — transfert de stock entre deux dépôts (phase 3,
 *  même boutique) ou entre deux boutiques du même propriétaire (phase 4, réservé à OWNER côté
 *  serveur — PERM_STOCK_TRANSFER_SEND_CROSS_BOUTIQUE). Un transfert décrémente la source à l'envoi
 *  (create = send immédiat, pas de brouillon en V1) et n'incrémente la destination qu'à la
 *  confirmation de réception ("Réceptionner" ci-dessous) — jamais automatique, cf. étude §2.4. */
export default function DesktopStockTransfers() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { user } = useAuth()
  const { tenant } = useTenant()
  const isOwner = user?.role === 'OWNER'

  const [transfers, setTransfers] = useState<StockTransferResponse[]>([])
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [destinations, setDestinations] = useState<TransferDestinationResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [scope, setScope] = useState<Scope>('intra')
  const [sourceDepotId, setSourceDepotId] = useState('')
  const [destinationDepotId, setDestinationDepotId] = useState('')
  const [destinationTenantId, setDestinationTenantId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [lineProductId, setLineProductId] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [submitting, setSubmitting] = useState(false)

  useTopBar({ title: t('inventoryCatalog.stockTransfersTitle') }, [t])

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([
      stockTransfersApi.getAll(),
      depotsApi.getAll(),
      productsApi.search(),
      isOwner ? stockTransfersApi.getDestinations() : Promise.resolve([]),
    ])
      .then(([tr, d, p, dest]) => {
        setTransfers(tr)
        setDepots(d.filter((depot) => depot.active))
        setProducts(p)
        setDestinations(dest)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [isOwner])

  useEffect(load, [load])

  // Nom d'affichage d'un dépôt/boutique dans l'historique : la boutique courante connaît le nom de
  // ses propres dépôts, mais pas ceux d'une autre boutique — on retombe alors sur le nom de cette
  // boutique (déjà résolu via `destinations`, symétrique quel que soit le sens du transfert tant
  // qu'on est OWNER des deux) plutôt que rien du tout.
  const depotName = (id: string) => depots.find((d) => d.id === id)?.name
  const boutiqueName = (tenantId: string) => destinations.find((d) => d.tenantId === tenantId)?.name
  const sideLabel = (sideTenantId: string, sideDepotId: string) =>
    sideTenantId === tenant.id
      ? depotName(sideDepotId) ?? t('inventoryCatalog.supplierFallback')
      : boutiqueName(sideTenantId) ?? t('inventoryCatalog.supplierFallback')

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const canCreateIntra = depots.length > 1
  const canCreateInter = isOwner && destinations.length > 0
  const canCreate = tenant.multiDepotEnabled && (canCreateIntra || canCreateInter)

  const openCreate = () => {
    const defaultSource = depots.find((d) => d.isDefault)?.id ?? depots[0]?.id ?? ''
    setScope(canCreateIntra ? 'intra' : 'inter')
    setSourceDepotId(defaultSource)
    setDestinationDepotId(depots.find((d) => d.id !== defaultSource)?.id ?? '')
    setDestinationTenantId(destinations[0]?.tenantId ?? '')
    setLines([])
    setLineProductId('')
    setLineQty('1')
    setError(null)
    setCreating(true)
  }

  const destinationDepotOptions = depots.filter((d) => d.id !== sourceDepotId)

  const handleAddLine = () => {
    const product = productMap.get(lineProductId)
    const qty = Number(lineQty)
    if (!product || qty <= 0) return
    setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantity: qty }])
    setLineProductId('')
    setLineQty('1')
  }

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const canSend =
    lines.length > 0 && !!sourceDepotId && (scope === 'intra' ? !!destinationDepotId : !!destinationTenantId) && !submitting

  const handleSend = async () => {
    if (!canSend) return
    setSubmitting(true)
    setError(null)
    try {
      if (scope === 'intra') {
        await stockTransfersApi.send({
          sourceDepotId,
          destinationDepotId,
          lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
        })
      } else {
        await stockTransfersApi.sendInterBoutique({
          sourceDepotId,
          destinationTenantId,
          lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
        })
      }
      setCreating(false)
      load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceive = async (transferId: string) => {
    setActingId(transferId)
    setError(null)
    try {
      await stockTransfersApi.receive(transferId)
      load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setActingId(null)
    }
  }

  const handleCancel = async (transferId: string) => {
    setActingId(transferId)
    setError(null)
    try {
      await stockTransfersApi.cancel(transferId)
      load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-terracotta">
            <Truck size={14} />
            <span>{t('inventoryCatalog.stockTransfersEyebrow')}</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-text">{t('inventoryCatalog.stockTransfersTitle')}</h1>
          <p className="text-[13px] font-semibold text-text-dim mt-0.5">{t('inventoryCatalog.stockTransfersSubtitle')}</p>
        </div>
        {tenant.multiDepotEnabled && (
          <button
            type="button"
            onClick={openCreate}
            disabled={!canCreate}
            title={!canCreate ? t('inventoryCatalog.stockTransfersNeedsSecondDepot') : undefined}
            className="min-h-10 px-3.5 py-1.5 text-left rounded-xl bg-terracotta text-white flex items-center gap-2 text-sm font-bold disabled:opacity-40"
          >
            <Plus size={16} />
            {t('inventoryCatalog.newStockTransferCta')}
          </button>
        )}
      </div>

      {tenant.multiDepotEnabled && !canCreate && (
        <div className="p-3.5 rounded-xl bg-info-bg border border-info-border text-[13px] text-[#33465E]">
          {t('inventoryCatalog.stockTransfersNeedsSecondDepot')}
        </div>
      )}

      {!tenant.multiDepotEnabled && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-bg-elevated/60 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-text">{t('settings.multiDepotUpsellTitle')}</p>
              <p className="text-sm text-text-muted mt-0.5">{t('settings.multiDepotUpsellMessage')}</p>
            </div>
          </div>
          <Button variant="secondary" className="flex-shrink-0" disabled>
            {t('settings.contactSalesCta')}
          </Button>
        </div>
      )}

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : transfers.length === 0 ? (
        <div className="p-6 rounded-xl bg-bg-card border border-border text-sm font-semibold text-text-dim text-center">
          {t('inventoryCatalog.stockTransfersEmptyState')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {transfers.map((tr) => {
            const badge = statusBadge[tr.status]
            const isCrossBoutique = tr.sourceTenantId !== tr.destinationTenantId
            return (
              <div key={tr.id} className="p-4 rounded-xl bg-bg-card border border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-bg-elevated text-text-muted flex items-center justify-center flex-none">
                    {isCrossBoutique ? <Building2 size={16} /> : <Package size={16} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 text-sm font-bold text-text">
                      <span className="break-words min-w-0">{sideLabel(tr.sourceTenantId, tr.sourceDepotId)}</span>
                      <ArrowRight size={13} className="text-text-dim flex-none" />
                      <span className="break-words min-w-0">{sideLabel(tr.destinationTenantId, tr.destinationDepotId)}</span>
                    </div>
                    <div className="text-xs text-text-dim font-semibold mt-0.5">
                      {t('inventoryCatalog.unitsCount', { count: tr.totalUnits })} · {formatDate(new Date(tr.createdAt), locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap ${badge.bg} ${badge.text}`}>
                    {t(`inventoryCatalog.stockTransferStatus.${tr.status}`)}
                  </span>
                  {tr.status === 'IN_TRANSIT' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCancel(tr.id)}
                        disabled={actingId === tr.id}
                        className="min-h-8 py-1 px-3 rounded-lg border border-border-strong text-xs font-bold text-danger disabled:opacity-50"
                      >
                        {t('inventoryCatalog.cancelTransferCta')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReceive(tr.id)}
                        disabled={actingId === tr.id}
                        className="min-h-8 py-1 px-3 rounded-lg bg-primary text-papier text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={13} />
                        {t('inventoryCatalog.receiveTransferCta')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} width={560} title={t('inventoryCatalog.newStockTransferCta')}>
        <div className="flex flex-col gap-4">
            {canCreateIntra && canCreateInter && (
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-bg-elevated w-fit max-w-full">
                <button
                  type="button"
                  onClick={() => setScope('intra')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${scope === 'intra' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
                >
                  {t('inventoryCatalog.transferScopeIntra')}
                </button>
                <button
                  type="button"
                  onClick={() => setScope('inter')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${scope === 'inter' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
                >
                  {t('inventoryCatalog.transferScopeInter')}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.sourceDepotLabel')}</span>
                <select
                  value={sourceDepotId}
                  onChange={(e) => {
                    setSourceDepotId(e.target.value)
                    if (e.target.value === destinationDepotId) setDestinationDepotId('')
                  }}
                  className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                >
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {scope === 'intra' ? (
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.destinationDepotLabel')}</span>
                  <select
                    value={destinationDepotId}
                    onChange={(e) => setDestinationDepotId(e.target.value)}
                    className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                  >
                    <option value="">{t('inventoryCatalog.chooseArticlePlaceholder')}</option>
                    {destinationDepotOptions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.destinationBoutiqueLabel')}</span>
                  <select
                    value={destinationTenantId}
                    onChange={(e) => setDestinationTenantId(e.target.value)}
                    className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                  >
                    {destinations.map((d) => (
                      <option key={d.tenantId} value={d.tenantId}>{d.name} — {d.city}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {scope === 'inter' && (
              <p className="text-[12px] text-text-dim">{t('inventoryCatalog.interBoutiqueDepotHint')}</p>
            )}

            {lines.length > 0 && (
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                      <th className="px-3 py-2">{t('inventoryCatalog.productNameLabel')}</th>
                      <th className="px-3 py-2 text-right">{t('resellerConsignment.quantityPlaceholder')}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-t border-border-hairline">
                        <td className="px-3 py-2 font-bold break-words">{line.productName}</td>
                        <td className="px-3 py-2 text-right amount">{line.quantity}</td>
                        <td className="px-1 text-center">
                          <button type="button" onClick={() => removeLine(i)} className="w-6 h-6 rounded-full bg-bg-elevated inline-flex items-center justify-center">
                            <X size={12} className="text-text-dim" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-[1fr_80px_auto] sm:grid-cols-[1fr_100px_auto] gap-2.5 items-end">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.chooseArticlePlaceholder')}</span>
                <select value={lineProductId} onChange={(e) => setLineProductId(e.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary">
                  <option value="">{t('inventoryCatalog.chooseArticlePlaceholder')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} inputMode="numeric" className="amount" placeholder={t('resellerConsignment.quantityPlaceholder')} />
              <Button variant="secondary" onClick={handleAddLine} disabled={!lineProductId || Number(lineQty) <= 0}>
                <Plus size={15} />
              </Button>
            </div>

            {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

            <Button onClick={handleSend} disabled={!canSend} loading={submitting}>
              {t('inventoryCatalog.sendStockTransferCta')}
            </Button>
        </div>
      </Modal>
    </div>
  )
}
