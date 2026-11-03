import { useEffect, useState } from 'react'
import { Check, Printer, Tag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { resolveAmounts, toggleMethod as toggleMethodAmounts } from '@boutiklic/shared'
import type { SaleLine } from '../../../types'
import type { PaymentMethod, PaymentSplit } from '../../../lib/salesApi'
import { ManagerApprovalPendingError, type DiscountReason, type DiscountType } from '../../../lib/discountsApi'
import type { DiscountInput } from '../../../pages/register_Sales/SaleValidation'
import { toE164Phone } from '../../../lib/authApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import HorizontalScroller from '../../components/HorizontalScroller'

interface SaleValidationModalDesktopProps {
  open: boolean
  total: number
  lines: SaleLine[]
  onClose: () => void
  onComplete: (
    payments: PaymentSplit[],
    debtCustomerName?: string,
    debtCustomerPhone?: string,
    discount?: DiscountInput,
  ) => Promise<void>
  onCompleted: (printReceipt: boolean) => void
  /** Moyen de paiement présélectionné (cf. boutons rapides Espèces/Orange M./Wave du panier
   *  CaisseDesktop.tsx) — juste une valeur de départ, l'écran reste modifiable normalement. */
  initialMethod?: PaymentMethod
  /** Client attribué depuis la carte du panier (CaisseDesktop.tsx) — ne pré-remplit que les champs
   *  dette (nom/tél) ; l'API n'a aucune notion de "client attribué" hors dette. */
  initialDebtCustomer?: { name: string; phone: string }
}

function roundUpTo(n: number, step: number): number {
  return Math.ceil(n / step) * step
}

/** W14 — modale d'encaissement (760px). Même contrat que SaleValidation.tsx (aucune logique de
 *  vente dupliquée : createSale/addLine/complete/rabais/relais gérant restent dans CashierFlow),
 *  mais ajoute un vrai "montant reçu / monnaie à rendre" pour le CASH — CompleteSaleRequest.amountPaid
 *  accepte déjà n'importe quelle valeur ≥ total côté backend, le mobile envoyait juste toujours
 *  amountPaid = total. Pas d'"association client" hors dette : aucun champ de ce type n'existe côté
 *  API pour les autres moyens de paiement. */
export default function SaleValidationModalDesktop({ open, total, lines, onClose, onComplete, onCompleted, initialMethod, initialDebtCustomer }: SaleValidationModalDesktopProps) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const methods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'CASH', label: t('registerSales.methodCash'), icon: '💵' },
    { id: 'MOBILE_MONEY_ORANGE', label: t('registerSales.methodOrangeMoney'), icon: '📱' },
    { id: 'MOBILE_MONEY_WAVE', label: t('registerSales.methodWave'), icon: '🌊' },
    { id: 'DEBT', label: t('registerSales.methodDebt'), icon: '📒' },
  ]
  const REASON_LABELS: Record<DiscountReason, string> = {
    LOYAL_CUSTOMER: t('registerSales.discountReasonLoyalCustomer'),
    PRODUCT_DEFECT: t('registerSales.discountReasonProductDefect'),
    NEGOTIATION: t('registerSales.discountReasonNegotiation'),
    PRICING_ERROR: t('registerSales.discountReasonPricingError'),
    OTHER: t('registerSales.discountReasonOther'),
  }

  /** Montant saisi par moyen de paiement actif — présence de la clé = moyen sélectionné (écran B3,
   *  paiement fractionné). Quand CASH est le SEUL moyen actif, ce champ porte le "montant reçu" et
   *  tolère un sur-paiement (monnaie rendue) — sinon (mixte ou seul non-CASH) il doit correspondre
   *  exactement à la part allouée à ce moyen. */
  const [amounts, setAmounts] = useState<Partial<Record<PaymentMethod, number>>>({ CASH: total })
  const [debtName, setDebtName] = useState('')
  const [debtPhone, setDebtPhone] = useState('')
  const [printReceipt, setPrintReceipt] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const [showDiscountPanel, setShowDiscountPanel] = useState(false)
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState<DiscountReason>('LOYAL_CUSTOMER')
  const [discountNote, setDiscountNote] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountInput | null>(null)

  const netTotal = total - (appliedDiscount?.amount ?? 0)

  useEffect(() => {
    if (!open) return
    setAmounts({ [initialMethod ?? 'CASH']: total })
    setDebtName(initialMethod === 'DEBT' ? (initialDebtCustomer?.name ?? '') : '')
    setDebtPhone(initialMethod === 'DEBT' ? (initialDebtCustomer?.phone ?? '') : '')
    setPrintReceipt(true)
    setSubmitting(false)
    setError(null)
    setShowDiscountPanel(false)
    setDiscountValue('')
    setDiscountNote('')
    setAppliedDiscount(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Un seul moyen actif ET non-CASH : reste aligné automatiquement sur le total net (rabais compris)
  // — reproduit le comportement historique (aucune ressaisie requise). Le cas CASH seul est géré à
  // part (receivedAmount ci-dessous, tolère un sur-paiement). Plusieurs moyens : répartition manuelle.
  useEffect(() => {
    setAmounts((prev) => {
      const keys = Object.keys(prev) as PaymentMethod[]
      return keys.length === 1 && keys[0] !== 'CASH' ? { [keys[0]]: netTotal } : prev
    })
     
  }, [netTotal])

  // CASH absorbe automatiquement le reste en paiement mixte (cf. resolveAmounts) : les autres moyens
  // restent tels que saisis, seul CASH est dérivé à chaque frappe/ajout/retrait. Sans effet sur le cas
  // CASH seul (isCashSolo), qui garde sa saisie libre + rendu de monnaie.
  const resolved = resolveAmounts(amounts, netTotal)
  const activeMethods = methods.filter((m) => amounts[m.id] !== undefined)
  const isCashSolo = activeMethods.length === 1 && activeMethods[0].id === 'CASH'
  const isDebt = amounts.DEBT !== undefined && (amounts.DEBT ?? 0) > 0
  const debtInvalid = isDebt && (debtName.trim().length === 0 || debtPhone.trim().length < 8)
  const receivedAmount = amounts.CASH ?? netTotal
  const change = isCashSolo ? Math.max(0, receivedAmount - netTotal) : 0
  const cashInvalid = isCashSolo && receivedAmount < netTotal
  const sumEntered = activeMethods.reduce((s, m) => s + (resolved[m.id] ?? 0), 0)
  const remaining = netTotal - sumEntered
  // CASH peut légitimement retomber à 0 quand les autres moyens couvrent déjà tout — seuls les moyens
  // saisis à la main doivent être strictement positifs.
  const paymentsInvalid = activeMethods.length === 0
    || (isCashSolo ? cashInvalid : activeMethods.some((m) => m.id !== 'CASH' && (resolved[m.id] ?? 0) <= 0) || remaining !== 0)

  const toggleMethod = (id: PaymentMethod) => {
    if (lines.length === 0) return
    setAmounts((prev) => toggleMethodAmounts(prev, id, netTotal))
  }

  const setAmountFor = (id: PaymentMethod, value: number) => {
    setAmounts((prev) => ({ ...prev, [id]: value }))
  }

  const parsedDiscountValue = parseFloat(discountValue.replace(',', '.')) || 0
  const previewDiscountAmount =
    parsedDiscountValue <= 0 ? 0 : discountType === 'PERCENTAGE' ? Math.round((total * parsedDiscountValue) / 100) : Math.round(parsedDiscountValue)

  const applyDiscount = () => {
    if (previewDiscountAmount <= 0 || previewDiscountAmount > total) return
    setAppliedDiscount({ type: discountType, value: parsedDiscountValue, reason: discountReason, reasonNote: discountNote.trim() || undefined, amount: previewDiscountAmount })
    setShowDiscountPanel(false)
    setDiscountValue('')
    setDiscountNote('')
  }

  const handleConfirm = async () => {
    if (debtInvalid || paymentsInvalid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payments: PaymentSplit[] = activeMethods
        .filter((m) => (resolved[m.id] ?? 0) > 0)
        .map((m) => ({ method: m.id, amount: resolved[m.id] ?? 0 }))
      await onComplete(
        payments,
        isDebt ? debtName.trim() : undefined,
        isDebt ? toE164Phone(debtPhone.trim()) : undefined,
        appliedDiscount ?? undefined,
      )
      setSubmitting(false)
      onCompleted(printReceipt)
    } catch (e) {
      if (e instanceof ManagerApprovalPendingError) {
        setSubmitting(false)
        return
      }
      setError(toErrorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={760} title={t('registerSales.validateTitle')}>
      <div className="flex flex-col gap-4">

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-4 sm:p-5 rounded-2xl bg-primary">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-extrabold tracking-widest text-[#A9BDD6]">{t('registerSales.totalToPay')}</span>
            {appliedDiscount && (
              <span className="amount text-sm font-semibold text-[#A9BDD6] line-through">{total.toLocaleString('fr-FR')}</span>
            )}
          </div>
          <span className="amount text-2xl sm:text-3xl font-extrabold text-papier break-all">{netTotal.toLocaleString('fr-FR')} {tenant.currency}</span>
        </div>
        
        {appliedDiscount ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-bg-elevated text-sm">
            <span className="font-semibold text-terracotta min-w-0 break-words">
              {t('registerSales.discountLabel', { reason: REASON_LABELS[appliedDiscount.reason] })}
              {appliedDiscount.type === 'PERCENTAGE' ? ` (${appliedDiscount.value}%)` : ''} · −{appliedDiscount.amount.toLocaleString('fr-FR')}
            </span>
            <button type="button" onClick={() => setAppliedDiscount(null)} className="text-text-dim flex-none">
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        ) : isOnline && lines.length > 0 && !showDiscountPanel ? (
          <button
            type="button"
            onClick={() => setShowDiscountPanel(true)}
            className="self-start flex items-center gap-2 text-terracotta text-sm font-bold"
          >
            <Tag size={15} /> {t('registerSales.grantDiscount')}
          </button>
        ) : null}

        {showDiscountPanel && (
          <div className="p-4 rounded-xl bg-bg-elevated flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-2">
              {(['PERCENTAGE', 'AMOUNT'] as DiscountType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDiscountType(type)}
                  className={`flex-1 min-w-[90px] min-h-10 rounded-lg text-sm font-bold ${discountType === type ? 'bg-primary text-papier' : 'border border-border-strong text-text-muted'}`}
                >
                  {type === 'PERCENTAGE' ? '%' : tenant.currency}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
              <Input
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder={discountType === 'PERCENTAGE' ? t('registerSales.discountValuePlaceholderPercentage') : t('registerSales.discountValuePlaceholderAmount')}
                inputMode="decimal"
                className="amount"
              />
              <select
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value as DiscountReason)}
                className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
              >
                {(Object.keys(REASON_LABELS) as DiscountReason[]).map((r) => (
                  <option key={r} value={r}>{REASON_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {discountReason === 'OTHER' && (
              <Input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} placeholder={t('registerSales.discountNotePlaceholder')} />
            )}
            {previewDiscountAmount > total && <div className="text-[13px] font-semibold text-danger">{t('registerSales.discountExceedsTotal')}</div>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowDiscountPanel(false)}>
                {t('registerSales.cancel')}
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={applyDiscount}
                disabled={previewDiscountAmount <= 0 || previewDiscountAmount > total}
              >
                {t('registerSales.applyDiscount', { amount: previewDiscountAmount.toLocaleString('fr-FR') })}
              </Button>
            </div>
          </div>
        )}

        {activeMethods.length > 1 && <div className="text-[13px] font-semibold text-text-dim">{t('registerSales.howCustomerPaysHint')}</div>}
        <HorizontalScroller gapClassName="gap-2.5">
          {methods.map((m) => {
            const active = lines.length > 0 && amounts[m.id] !== undefined
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMethod(m.id)}
                disabled={lines.length === 0}
                className={`flex-none w-[110px] p-3.5 rounded-xl flex flex-col gap-2 disabled:opacity-50 ${active ? 'border-2 border-success bg-succes-bg' : 'border border-border-strong bg-bg-card'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{m.icon}</span>
                  {active && (
                    <span className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
                      <Check size={10} strokeWidth={4} className="text-papier" />
                    </span>
                  )}
                </div>
                <span className={`text-sm ${active ? 'font-extrabold text-succes-text' : 'font-bold'}`}>{m.label}</span>
              </button>
            )
          })}
        </HorizontalScroller>

        {isCashSolo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.amountReceivedLabel')}</span>
              <Input
                value={String(receivedAmount)}
                onChange={(e) => setAmountFor('CASH', parseFloat(e.target.value.replace(/[^0-9,]/g, '').replace(',', '.')) || 0)}
                placeholder={netTotal.toLocaleString('fr-FR')}
                inputMode="decimal"
                className="amount text-lg"
              />
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setAmountFor('CASH', netTotal)} className="px-2.5 py-1.5 rounded-lg bg-bg-elevated text-xs font-bold">
                  {t('registerSales.exactAmount')}
                </button>
                {[1000, 5000, 10000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setAmountFor('CASH', roundUpTo(netTotal, step))}
                    className="px-2.5 py-1.5 rounded-lg bg-bg-elevated text-xs font-bold amount"
                  >
                    {roundUpTo(netTotal, step).toLocaleString('fr-FR')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.changeDue')}</span>
              <div className="min-h-11 py-1 rounded-xl bg-bg-elevated flex items-center px-3.5 amount text-lg font-extrabold text-success break-all">
                {change.toLocaleString('fr-FR')} {tenant.currency}
              </div>
            </div>
          </div>
        )}

        {activeMethods.length > 1 && (
          <div className="flex flex-col gap-2">
            {activeMethods.map((m) => {
              const isAutoCash = m.id === 'CASH'
              return (
                <div key={m.id} className={`min-h-11 py-1 rounded-xl flex items-center px-3.5 gap-2.5 border border-border-strong ${isAutoCash ? 'bg-bg-elevated' : 'bg-bg'}`}>
                  <span className="text-lg">{m.icon}</span>
                  <span className="flex-1 min-w-0 text-sm font-bold text-text-muted break-words">
                    {m.label}
                    {isAutoCash && <span className="ml-1.5 text-[11px] font-semibold text-text-dim">{t('registerSales.cashAuto')}</span>}
                  </span>
                  <input
                    value={resolved[m.id] ?? 0}
                    onChange={(e) => setAmountFor(m.id, parseFloat(e.target.value.replace(/[^0-9,]/g, '').replace(',', '.')) || 0)}
                    readOnly={isAutoCash}
                    inputMode="decimal"
                    className={`amount w-24 sm:w-28 flex-none text-right font-extrabold outline-none bg-transparent ${isAutoCash ? 'text-text-dim' : ''}`}
                  />
                </div>
              )
            })}
            <div className={`text-[13px] font-semibold text-center ${remaining === 0 ? 'text-success' : 'text-danger'}`}>
              {remaining === 0
                ? t('registerSales.fullyAllocated')
                : remaining < 0
                  ? t('registerSales.exceedsTotal', { amount: Math.abs(remaining).toLocaleString('fr-FR') })
                  : t('registerSales.remainingToAllocate', { amount: remaining.toLocaleString('fr-FR') })}
            </div>
          </div>
        )}

        {isDebt && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input value={debtName} onChange={(e) => setDebtName(e.target.value)} placeholder={t('registerSales.customerNamePlaceholder')} />
            <div className="h-11 rounded-xl flex items-center px-3.5 gap-2.5 border border-border-strong bg-bg">
              <span className="amount text-sm font-bold text-text-muted">+224</span>
              <div className="w-px h-5 bg-border-strong" />
              <input
                value={debtPhone}
                onChange={(e) => setDebtPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="620 12 34 56"
                inputMode="numeric"
                className="amount flex-1 font-bold outline-none bg-transparent"
              />
            </div>
          </div>
        )}

        <label className="flex items-start gap-2.5 text-sm font-semibold text-text-muted cursor-pointer select-none">
          <input type="checkbox" checked={printReceipt} onChange={(e) => setPrintReceipt(e.target.checked)} className="w-4 h-4 mt-0.5 flex-none accent-primary" />
          <Printer size={15} />
          {t('registerSales.printReceiptToggle')}
        </label>

        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

        <Button onClick={handleConfirm} disabled={submitting || debtInvalid || paymentsInvalid || lines.length === 0} loading={submitting} className="min-h-14 text-base">
          {t('registerSales.confirmAmount', { amount: netTotal.toLocaleString('fr-FR') })}
        </Button>
      </div>
    </Modal>
  )
}
