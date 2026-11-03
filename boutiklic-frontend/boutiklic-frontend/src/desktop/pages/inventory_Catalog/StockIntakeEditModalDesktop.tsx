import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, X } from 'lucide-react'
import { currencyDecimals, formatNumber, type Locale } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { inventoryApi, type StockIntakeResponse, type StockIntakeLine } from '../../../lib/inventoryApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import MoneyInput from '../../components/MoneyInput'

interface EditableLine {
  productId: string
  /** Achat à l'unité : quantité et prix unitaire ; achat par lot : nombre de lots et prix du lot (unités par lot figées). */
  quantity: string
  unitPrice: string
  packCount: string
  unitsPerPack: number | null
  packPrice: string
}

const toNumber = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Détail d'un arrivage, avec correction des quantités / prix, retrait d'une ligne et suppression de l'arrivage.
 *  Le fournisseur, le dépôt et la date d'origine sont conservés : seul le contenu change. Le serveur ajuste le stock
 *  et la dette fournisseur de la différence, et refuse si du stock a déjà été écoulé. */
export default function StockIntakeEditModalDesktop({ intake, receiptNumber, subtitle, productName, locale, onClose, onChanged }: {
  intake: StockIntakeResponse | null
  receiptNumber: string
  subtitle?: string
  productName: (productId: string) => string
  locale: Locale
  onClose: () => void
  /** Appelé après une correction ou une suppression réussie, pour que l'écran parent recharge ses données. */
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [lines, setLines] = useState<EditableLine[]>([])
  // TVA payée au fournisseur (déductible) : proposée si la boutique applique la TVA, ou si l'arrivage en porte déjà (jamais masquée).
  const [deductibleVat, setDeductibleVat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (intake) {
      setLines(intake.lines.map((l) => ({
        productId: l.productId,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPurchasePrice),
        packCount: l.packCount != null ? String(l.packCount) : '',
        unitsPerPack: l.unitsPerPack,
        packPrice: l.packPrice != null ? String(l.packPrice) : '',
      })))
      setDeductibleVat(intake.deductibleVat ? String(intake.deductibleVat) : '')
      setConfirmingDelete(false)
      setError(null)
    }
  }, [intake])

  const lineTotal = (l: EditableLine) => (l.unitsPerPack != null ? toNumber(l.packCount) * toNumber(l.packPrice) : toNumber(l.quantity) * toNumber(l.unitPrice))
  const total = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines])
  const valid = lines.length > 0 && lines.every((l) => (l.unitsPerPack != null ? toNumber(l.packCount) >= 1 && toNumber(l.packPrice) >= 0 : toNumber(l.quantity) >= 1 && toNumber(l.unitPrice) >= 0))

  const showDeductibleVat = tenant.taxEnabled || !!intake?.deductibleVat
  const deductibleVatNum = showDeductibleVat ? toNumber(deductibleVat) : 0
  const deductibleVatTooHigh = deductibleVatNum > total

  const patch = (index: number, change: Partial<EditableLine>) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...change } : l)))

  const handleSave = async () => {
    if (!intake || !valid || submitting || deductibleVatTooHigh) return
    setSubmitting(true)
    setError(null)
    try {
      const payloadLines: StockIntakeLine[] = lines.map((l) =>
        l.unitsPerPack != null
          ? {
              productId: l.productId,
              quantity: Math.round(toNumber(l.packCount)) * l.unitsPerPack,
              unitPurchasePrice: toNumber(l.packPrice) / l.unitsPerPack,
              packCount: Math.round(toNumber(l.packCount)),
              unitsPerPack: l.unitsPerPack,
              packPrice: toNumber(l.packPrice),
            }
          : { productId: l.productId, quantity: Math.round(toNumber(l.quantity)), unitPurchasePrice: toNumber(l.unitPrice) },
      )
      await inventoryApi.updateIntake(intake.id, { lines: payloadLines, deductibleVat: showDeductibleVat ? deductibleVatNum : undefined })
      onChanged()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!intake || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await inventoryApi.deleteIntake(intake.id)
      onChanged()
    } catch (e) {
      setError(toErrorMessage(e))
      setConfirmingDelete(false)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-24 h-9 rounded-lg border border-border-strong bg-bg-card px-2 amount text-sm font-extrabold text-right outline-none focus:border-primary'

  return (
    <Modal open={!!intake} onClose={onClose} width={720} title={receiptNumber} subtitle={subtitle}>
      {intake && (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] font-semibold text-text-dim">{t('inventoryCatalog.editReceiptHint')}</p>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                  <th className="px-3 py-2">{t('inventoryCatalog.productNameLabel')}</th>
                  <th className="px-3 py-2 text-right">{t('resellerConsignment.quantityPlaceholder')}</th>
                  <th className="px-3 py-2 text-right">{t('inventoryCatalog.unitPurchasePricePlaceholder')}</th>
                  <th className="px-3 py-2 text-right">{t('inventoryCatalog.totalSpentLabel')}</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const isPack = l.unitsPerPack != null
                  return (
                    <tr key={l.productId + i} className="border-t border-border-hairline">
                      <td className="px-3 py-2 font-bold">
                        {productName(l.productId)}
                        {isPack && <span className="block text-[11px] font-semibold text-text-dim">× {l.unitsPerPack}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          inputMode="numeric"
                          className={inputClass}
                          value={isPack ? l.packCount : l.quantity}
                          onChange={(e) => patch(i, isPack ? { packCount: e.target.value.replace(/[^0-9]/g, '') } : { quantity: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          inputMode="decimal"
                          className={inputClass}
                          value={isPack ? l.packPrice : l.unitPrice}
                          onChange={(e) => patch(i, isPack ? { packPrice: e.target.value.replace(/[^0-9.,]/g, '') } : { unitPrice: e.target.value.replace(/[^0-9.,]/g, '') })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right amount font-extrabold">{formatNumber(lineTotal(l), locale)}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                          disabled={lines.length <= 1}
                          aria-label={t('inventoryCatalog.removeLineAria')}
                          title={t('inventoryCatalog.removeLineAria')}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg-elevated disabled:opacity-30"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between text-sm font-bold px-1">
            <span>{t('inventoryCatalog.receiptTotalAmountLabel')}</span>
            <span className="amount">{formatNumber(total, locale)}</span>
          </div>

          {showDeductibleVat && (
            <div className="flex flex-col gap-1">
              <MoneyInput label={t('inventoryCatalog.deductibleVatLabel') ?? ''} value={deductibleVat} onValueChange={setDeductibleVat} decimals={currencyDecimals(tenant.currency)} placeholder="0" />
              {deductibleVatTooHigh ? (
                <p className="text-[11px] font-semibold text-danger">{t('inventoryCatalog.deductibleVatTooHigh')}</p>
              ) : (
                <p className="text-[11px] text-text-muted leading-relaxed">{t('inventoryCatalog.deductibleVatHelp')}</p>
              )}
            </div>
          )}

          {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

          {confirmingDelete ? (
            <div className="rounded-xl border border-danger p-3.5 flex flex-col gap-2.5">
              <span className="text-[13px] font-bold text-danger">
                {intake.supplierId ? t('inventoryCatalog.confirmDeleteReceiptCredit') : t('inventoryCatalog.confirmDeleteReceipt')}
              </span>
              <div className="flex gap-2.5">
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={submitting} className="flex-1">
                  {t('inventoryCatalog.cancel')}
                </Button>
                <Button variant="danger" onClick={handleDelete} loading={submitting} className="flex-1">
                  {t('inventoryCatalog.deleteReceiptButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={() => setConfirmingDelete(true)} disabled={submitting} className="h-12 flex items-center gap-2">
                <Trash2 size={15} />
                {t('inventoryCatalog.deleteReceiptButton')}
              </Button>
              <Button onClick={handleSave} disabled={!valid || submitting || deductibleVatTooHigh} loading={submitting} className="h-12 flex-1">
                {t('inventoryCatalog.saveEditButton')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
