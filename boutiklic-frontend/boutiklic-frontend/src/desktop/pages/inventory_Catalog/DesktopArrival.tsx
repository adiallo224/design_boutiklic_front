import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { currencyDecimals, formatNumber, effectiveUnitCost, formatUnitCost, intakeCostIgnored, intakeLineTotal, intakeLineUnitCost, isSupportedLocale, mergePreselection, roundHalfUp, unitCostFromPack, DEFAULT_LOCALE, type LabelPreselection } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { labelsNavigation } from '../../../lib/labelPrint'
import { suppliersApi, type SupplierResponse } from '../../../lib/suppliersApi'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { inventoryApi, type StockIntakeLine } from '../../../lib/inventoryApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { syncEngine } from '../../../lib/syncEngine'
import Button from '../../components/Button'
import Input from '../../components/Input'
import MoneyInput from '../../components/MoneyInput'
import Modal from '../../components/Modal'
import { useTopBar } from '../../hooks/useTopBar'

interface DraftLine extends StockIntakeLine {
  productName: string
  salePrice: number
}

/** W17 — arrivage/réception fournisseur. Le spec dessine aussi un n° de bon et un mode de
 *  règlement (crédit/payé, échéance, acompte) : CreateStockIntakeRequest n'a que
 *  supplierId/currency/lines côté API, ces champs ne persisteraient nulle part — non construits
 *  (cf. plan bureau, zones grises). Coût total / valeur de vente / marge attendue sont calculés
 *  côté client à partir des prix déjà chargés (productsApi.search), pas de nouvel appel. */
export default function DesktopArrival() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const priceDecimals = currencyDecimals(tenant.currency)
  const { user } = useAuth()
  /** Impression d'étiquettes : propriétaire et vendeurs, comme la modification d'article. */
  const canPrintLabels = user?.role === 'OWNER' || user?.role === 'SELLER'

  useTopBar({ title: t('inventoryCatalog.newArrivalTitle') }, [t])

  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [supplierId, setSupplierId] = useState('')
  // Sélecteur affiché seulement si la boutique a plus d'un dépôt (phase 2b de l'étude
  // study/etude_multi_depots_transferts.md §2.2) — la quasi-totalité des boutiques n'en ont qu'un
  // (le dépôt par défaut) et n'ont aucune raison de voir apparaître ce choix.
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [depotId, setDepotId] = useState('')
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  const [products, setProducts] = useState<ProductResponse[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [lineProductId, setLineProductId] = useState('')
  // En mode lot, lineQty est le NOMBRE DE LOTS (et non d'unités) : les unités en stock = lots × unités par lot.
  const [lineQty, setLineQty] = useState('1')
  const [lineUnitPrice, setLineUnitPrice] = useState('')
  const [linePackMode, setLinePackMode] = useState(false)
  const [lineUnitsPerPack, setLineUnitsPerPack] = useState('')
  const [linePackPrice, setLinePackPrice] = useState('')

  // TVA payée au fournisseur sur cet arrivage (déductible) — saisie à part du coût d'achat, proposée seulement si la boutique applique la TVA.
  const [deductibleVat, setDeductibleVat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Arrivage enregistré : on propose d'imprimer les étiquettes des unités reçues (quantité = unités de chaque ligne). */
  const [recorded, setRecorded] = useState<{ items: LabelPreselection[]; units: number } | null>(null)

  useEffect(() => {
    Promise.all([suppliersApi.getAll(), productsApi.search(), depotsApi.getAll()])
      .then(([s, p, d]) => {
        setSuppliers(s)
        setProducts(p)
        const activeDepots = d.filter((depot) => depot.active)
        setDepots(activeDepots)
        // Le <select> ci-dessous n'a pas d'option vide (contrairement au fournisseur) : le
        // navigateur sélectionne visuellement le premier dépôt de la liste dès qu'elle est rendue —
        // sans ceci, l'état resterait vide et enverrait "aucun dépôt choisi" en désaccord avec ce
        // que l'écran affiche.
        setDepotId(activeDepots.find((depot) => depot.isDefault)?.id ?? activeDepots[0]?.id ?? '')
      })
      .catch((e) => setError(toErrorMessage(e)))
  }, [])

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0)
  const costTotal = lines.reduce((s, l) => s + intakeLineTotal(l), 0)
  const saleValue = lines.reduce((s, l) => s + l.quantity * l.salePrice, 0)
  const expectedMargin = saleValue - costTotal

  const handleCreateSupplier = async () => {
    if (newSupplierName.trim().length === 0) return
    setCreatingSupplier(true)
    setError(null)
    const payload = { name: newSupplierName.trim(), phone: newSupplierPhone.trim() || undefined, currency: tenant.currency }
    try {
      const supplier = await suppliersApi.create(payload)
      setSuppliers((prev) => [...prev, supplier])
      setSupplierId(supplier.id)
      setShowNewSupplier(false)
      setNewSupplierName('')
      setNewSupplierPhone('')
    } catch (e) {
      if (e instanceof NetworkError) {
        await syncEngine.enqueue('CREATE_SUPPLIER', JSON.stringify(payload))
        setError(t('inventoryCatalog.supplierQueuedOffline'))
        setShowNewSupplier(false)
        setNewSupplierName('')
        setNewSupplierPhone('')
      } else {
        setError(toErrorMessage(e))
      }
    } finally {
      setCreatingSupplier(false)
    }
  }

  const handleProductPicked = (productId: string) => {
    setLineProductId(productId)
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (product.packSize != null && product.packPurchasePrice != null) {
      // Un article acheté en lot est réceptionné en lot par défaut (1 lot), avec le lot connu de sa fiche.
      setLinePackMode(true)
      setLineQty('1')
      setLineUnitsPerPack(String(product.packSize))
      setLinePackPrice(String(product.packPurchasePrice))
    } else {
      setLinePackMode(false)
      setLineUnitPrice(String(product.purchasePrice))
    }
  }

  const linePackSizeNum = Number(lineUnitsPerPack) || 0
  const linePackPriceNum = Number(linePackPrice) || 0
  const lineQtyNum = Number(lineQty)
  const lineUnitCost = unitCostFromPack(linePackPriceNum, linePackSizeNum)
  const canAddLine = linePackMode
    ? !!lineProductId && lineQtyNum >= 1 && linePackSizeNum >= 1 && linePackPrice !== ''
    : !!lineProductId && lineQtyNum > 0 && lineUnitPrice !== ''

  /** En méthode manuelle, l'arrivage ne change jamais le coût de la fiche : prévient quand le coût de la ligne diffère de celui de la fiche. */
  const ignoredCost = (line: DraftLine) => {
    const product = products.find((p) => p.id === line.productId)
    if (!product) return null
    const sheet = effectiveUnitCost(product)
    const lineCost = intakeLineUnitCost(line)
    return intakeCostIgnored(tenant.costMethod, lineCost, sheet)
      ? { sheet: formatUnitCost(sheet, locale), line: formatUnitCost(lineCost, locale) }
      : null
  }

  const handleAddLine = () => {
    const product = products.find((p) => p.id === lineProductId)
    if (!product || !canAddLine) return
    if (linePackMode) {
      // Quantité (unités) et coût unitaire sont DÉRIVÉS du lot, comme côté serveur (qui ignore ce qu'on lui envoie ici).
      setLines((prev) => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: lineQtyNum * linePackSizeNum,
        unitPurchasePrice: roundHalfUp(lineUnitCost),
        packCount: lineQtyNum,
        unitsPerPack: linePackSizeNum,
        packPrice: linePackPriceNum,
        salePrice: product.salePrice,
      }])
    } else {
      const unitPrice = Number(lineUnitPrice)
      if (unitPrice < 0) return
      setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantity: lineQtyNum, unitPurchasePrice: unitPrice, salePrice: product.salePrice }])
    }
    setLineProductId('')
    setLineQty('1')
    setLineUnitPrice('')
    setLinePackMode(false)
    setLineUnitsPerPack('')
    setLinePackPrice('')
  }

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const deductibleVatNum = tenant.taxEnabled ? parseFloat(deductibleVat) || 0 : 0
  const deductibleVatTooHigh = deductibleVatNum > costTotal

  const handleSubmit = async () => {
    if (lines.length === 0 || submitting || deductibleVatTooHigh) return
    setSubmitting(true)
    setError(null)
    const payload = {
      supplierId: supplierId || undefined,
      currency: tenant.currency,
      lines: lines.map(({ productId, quantity, unitPurchasePrice, packCount, unitsPerPack, packPrice }) => ({ productId, quantity, unitPurchasePrice, packCount, unitsPerPack, packPrice })),
      depotId: depotId || undefined,
      deductibleVat: deductibleVatNum > 0 ? deductibleVatNum : undefined,
    }
    try {
      try {
        await inventoryApi.createIntake(payload)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('CREATE_STOCK_INTAKE', JSON.stringify({ ...payload, occurredAt: new Date().toISOString() }))
      }
      if (canPrintLabels) {
        setRecorded({
          items: mergePreselection(lines.map((l) => ({ productId: l.productId, copies: l.quantity }))),
          units: lines.reduce((sum, l) => sum + l.quantity, 0),
        })
      } else {
        navigate('/stock')
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4 min-w-0">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.supplierLabel')}</span>
          {showNewSupplier ? (
            <div className="p-4 rounded-xl border border-border-strong bg-bg-card flex flex-col gap-2.5">
              <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder={t('inventoryCatalog.supplierNamePlaceholder')} />
              <Input value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder={t('inventoryCatalog.phoneOptionalPlaceholder')} />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowNewSupplier(false)}>{t('inventoryCatalog.cancel')}</Button>
                <Button className="flex-1" onClick={handleCreateSupplier} disabled={creatingSupplier || newSupplierName.trim().length === 0} loading={creatingSupplier}>
                  {t('inventoryCatalog.create')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="flex-1 min-w-[180px] h-11 rounded-xl border border-border-strong bg-bg-card px-3.5 font-bold outline-none">
                <option value="">{t('inventoryCatalog.noSupplier')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewSupplier(true)} className="px-3.5 h-11 rounded-xl bg-bg-elevated text-xs font-bold text-primary flex-none">
                + {t('inventoryCatalog.newSupplierCta')}
              </button>
            </div>
          )}
        </div>

        {depots.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.depotNameLabel')}</span>
            <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className="w-full sm:w-auto h-11 rounded-xl border border-border-strong bg-bg-card px-3.5 font-bold outline-none">
              {depots.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.isDefault ? ` (${t('settings.defaultDepotBadge')})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.receivedItemsHeader', { count: lines.length })}</span>
          {lines.length > 0 && (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                    <th className="px-3 py-2">{t('inventoryCatalog.productNameLabel')}</th>
                    <th className="px-3 py-2 text-right">{t('resellerConsignment.quantityPlaceholder')}</th>
                    <th className="px-3 py-2 text-right">{t('inventoryCatalog.unitPurchasePricePlaceholder')}</th>
                    <th className="px-3 py-2 text-right">{t('inventoryCatalog.totalSpentLabel')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t border-border-hairline">
                      <td className="px-3 py-2 font-bold">
                        {line.productName}
                        {ignoredCost(line) && (
                          <div className="text-[11px] font-semibold leading-snug text-[#8A6712]">{t('inventoryCatalog.intakeCostIgnored', ignoredCost(line)!)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right amount">
                        {line.quantity}
                        {line.packCount != null && (
                          <div className="text-[11px] font-semibold text-text-dim">{t('inventoryCatalog.packLineSummary', { count: line.packCount, units: line.unitsPerPack })}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right amount">
                        {formatUnitCost(line.packCount != null && line.unitsPerPack != null && line.packPrice != null ? unitCostFromPack(line.packPrice, line.unitsPerPack) : line.unitPurchasePrice, locale)}
                      </td>
                      <td className="px-3 py-2 text-right amount font-extrabold">{formatNumber(intakeLineTotal(line), locale)}</td>
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
          {lines.length > 0 && (tenant.costMethod === 'LAST_PRICE' || tenant.costMethod === 'WEIGHTED_AVERAGE') && (
            <p className="text-xs leading-relaxed text-text-muted">{t(`inventoryCatalog.intakeCostWillUpdate.${tenant.costMethod}`)}</p>
          )}

          <div className={`grid gap-2.5 items-end ${linePackMode ? 'grid-cols-2 md:grid-cols-[1fr_100px_120px_140px_auto]' : 'grid-cols-2 md:grid-cols-[1fr_120px_140px_auto]'}`}>
            <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1 min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.chooseArticlePlaceholder')}</span>
              <select value={lineProductId} onChange={(e) => handleProductPicked(e.target.value)} className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary">
                <option value="">{t('inventoryCatalog.chooseArticlePlaceholder')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} inputMode="numeric" className="amount" placeholder={linePackMode ? t('inventoryCatalog.packCountPlaceholder') : t('resellerConsignment.quantityPlaceholder')} />
            {linePackMode ? (
              <>
                <Input value={lineUnitsPerPack} onChange={(e) => setLineUnitsPerPack(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="amount" placeholder={t('inventoryCatalog.packSizeLabel')} />
                <MoneyInput value={linePackPrice} onValueChange={setLinePackPrice} decimals={priceDecimals} placeholder={t('inventoryCatalog.packPriceLabel')} />
              </>
            ) : (
              <MoneyInput value={lineUnitPrice} onValueChange={setLineUnitPrice} decimals={priceDecimals} placeholder={t('inventoryCatalog.unitPurchasePricePlaceholder')} />
            )}
            <Button variant="secondary" onClick={handleAddLine} disabled={!canAddLine} className="col-span-2 md:col-span-1">
              <Plus size={15} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer select-none">
              <input type="checkbox" checked={linePackMode} onChange={(e) => setLinePackMode(e.target.checked)} className="w-[18px] h-[18px] rounded accent-primary" />
              {t('inventoryCatalog.packToggleLabel')}
            </label>
            {linePackMode && linePackSizeNum >= 1 && linePackPrice !== '' && (
              <span className="text-xs font-semibold text-text-dim" data-testid="arrival-pack-summary">
                {t('inventoryCatalog.packLineSummary', { count: lineQtyNum || 0, units: linePackSizeNum })} = {(lineQtyNum || 0) * linePackSizeNum} · {t('inventoryCatalog.unitCostLabel')} {formatUnitCost(lineUnitCost, locale)} {tenant.currency}
              </span>
            )}
          </div>
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-xl bg-bg-card border border-border flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-text-muted">{t('inventoryCatalog.totalSpentLabel')}</span>
            <span className="amount font-extrabold">{formatNumber(costTotal, locale)}</span>
          </div>
          {tenant.taxEnabled && (
            <div className="flex flex-col gap-1 pb-1">
              <MoneyInput label={t('inventoryCatalog.deductibleVatLabel') ?? ''} value={deductibleVat} onValueChange={setDeductibleVat} decimals={priceDecimals} placeholder="0" />
              {deductibleVatTooHigh ? (
                <p className="text-[11px] font-semibold text-danger">{t('inventoryCatalog.deductibleVatTooHigh')}</p>
              ) : (
                <p className="text-[11px] text-text-muted leading-relaxed">{t('inventoryCatalog.deductibleVatHelp')}</p>
              )}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-text-muted">{t('inventoryCatalog.salePriceLabel')}</span>
            <span className="amount font-extrabold">{formatNumber(saleValue, locale)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-border-hairline">
            <span className="font-bold text-succes-text">{t('inventoryCatalog.estimatedProfitLabel')}</span>
            <span className="amount font-extrabold text-succes-text">{formatNumber(expectedMargin, locale)}</span>
          </div>
          <div className="text-xs text-text-dim">{t('inventoryCatalog.unitsAddedToStock', { count: totalUnits })}</div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting || lines.length === 0 || deductibleVatTooHigh} loading={submitting} className="h-12">
          {t('inventoryCatalog.validateArrival')}
        </Button>
      </div>

      <Modal
        open={recorded !== null}
        onClose={() => navigate('/stock')}
        width={480}
        title={t('labels.arrival.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => navigate('/stock')}>
              {t('labels.arrival.skip')}
            </Button>
            <Button
              onClick={() => {
                if (!recorded) return
                const target = labelsNavigation(recorded.items)
                navigate(target.to, target.state ? { state: target.state } : undefined)
              }}
            >
              {t('labels.arrival.print')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted leading-relaxed">
          {t('labels.arrival.message', { count: recorded?.items.length ?? 0, units: recorded?.units ?? 0 })}
        </p>
      </Modal>
    </div>
  )
}
