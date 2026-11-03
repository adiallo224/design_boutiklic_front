import { useEffect, useState } from 'react'
import { ChevronLeft, Check, Tag, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { resolveAmounts, toggleMethod as toggleMethodAmounts } from '@boutiklic/shared'
import type { SaleLine } from '../../types'
import type { PaymentMethod, PaymentSplit } from '../../lib/salesApi'
import { ManagerApprovalPendingError, type DiscountReason, type DiscountType, type GrantDiscountRequest } from '../../lib/discountsApi'
import { toE164Phone } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useTenant } from '../../hooks/useTenant'
import { formatSellingPrice } from '@boutiklic/shared'

/** Rabais choisi côté écran, envoyé au backend seulement à la confirmation (cf. CashierFlow.handleComplete). */
export interface DiscountInput extends GrantDiscountRequest {
  /** Montant retiré du total, calculé côté écran pour l'aperçu — recalculé par le backend à l'envoi. */
  amount: number
}

interface SaleValidationProps {
  total: number
  lines: SaleLine[]
  onBack: () => void
  onUpdateQuantity: (lineId: string, delta: number) => void
  onComplete: (
    payments: PaymentSplit[],
    debtCustomerName?: string,
    debtCustomerPhone?: string,
    discount?: DiscountInput,
  ) => Promise<void>
}

export default function SaleValidation({ total, lines, onBack, onUpdateQuantity, onComplete }: SaleValidationProps) {
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
   *  paiement fractionné). CASH pré-sélectionné pour couvrir le cas courant (un seul tap + confirmer). */
  const [amounts, setAmounts] = useState<Partial<Record<PaymentMethod, number>>>({ CASH: total })
  const [debtName, setDebtName] = useState('')
  const [debtPhone, setDebtPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const [showDiscountPanel, setShowDiscountPanel] = useState(false)
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState<DiscountReason>('LOYAL_CUSTOMER')
  const [discountNote, setDiscountNote] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountInput | null>(null)

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

  const parsedDiscountValue = parseFloat(discountValue.replace(',', '.')) || 0
  const previewDiscountAmount =
    parsedDiscountValue <= 0 ? 0 : discountType === 'PERCENTAGE' ? Math.round((total * parsedDiscountValue) / 100) : Math.round(parsedDiscountValue)

  const netTotal = total - (appliedDiscount?.amount ?? 0)

  // Un seul moyen actif : reste aligné automatiquement sur le total net (rabais compris) — reproduit
  // le comportement historique (aucune ressaisie requise). Plusieurs moyens : répartition manuelle.
  useEffect(() => {
    setAmounts((prev) => {
      const keys = Object.keys(prev) as PaymentMethod[]
      return keys.length === 1 ? { [keys[0]]: netTotal } : prev
    })
  }, [netTotal])

  // CASH absorbe automatiquement le reste en paiement mixte (cf. resolveAmounts) : les autres moyens
  // restent tels que saisis, seul CASH est dérivé à chaque frappe/ajout/retrait.
  const resolved = resolveAmounts(amounts, netTotal)
  const activeMethods = methods.filter((m) => amounts[m.id] !== undefined)
  const sumEntered = activeMethods.reduce((s, m) => s + (resolved[m.id] ?? 0), 0)
  const remaining = netTotal - sumEntered
  const isDebt = amounts.DEBT !== undefined && (amounts.DEBT ?? 0) > 0
  const debtInvalid = isDebt && (debtName.trim().length === 0 || debtPhone.trim().length < 8)
  // CASH peut légitimement retomber à 0 quand les autres moyens couvrent déjà tout — seuls les moyens
  // saisis à la main doivent être strictement positifs.
  const paymentsInvalid =
    activeMethods.length === 0 || activeMethods.some((m) => m.id !== 'CASH' && (resolved[m.id] ?? 0) <= 0) || remaining !== 0

  const toggleMethod = (id: PaymentMethod) => {
    if (lines.length === 0) return
    setAmounts((prev) => toggleMethodAmounts(prev, id, netTotal))
  }

  const setAmountFor = (id: PaymentMethod, raw: string) => {
    const value = parseFloat(raw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
    setAmounts((prev) => ({ ...prev, [id]: value }))
  }

  const applyDiscount = () => {
    if (previewDiscountAmount <= 0 || previewDiscountAmount > total) return
    setAppliedDiscount({
      type: discountType,
      value: parsedDiscountValue,
      reason: discountReason,
      reasonNote: discountNote.trim() || undefined,
      amount: previewDiscountAmount,
    })
    setShowDiscountPanel(false)
    setDiscountValue('')
    setDiscountNote('')
  }

  const removeDiscount = () => setAppliedDiscount(null)

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
    } catch (e) {
      // Rabais hors seuil : la modale de relais gérant (rendue par CashierFlow) prend le relais
      // visuellement — pas d'erreur à afficher ici, juste réarmer le bouton pour un nouvel essai.
      if (e instanceof ManagerApprovalPendingError) {
        setSubmitting(false)
        return
      }
      setError(toErrorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col bg-bg">
      <div className="flex-none flex items-center gap-3.5 px-5 pt-4 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <div className="text-[19px] font-extrabold tracking-tight">{t('registerSales.validateTitle')}</div>
      </div>

      <div className="flex-1 px-5 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        <div className="rounded-[20px] bg-bg-card border border-border overflow-hidden">
          {lines.map((line, i) => (
            <div key={line.id} className={`flex items-center gap-3 p-3.5 ${i < lines.length - 1 ? 'border-b border-border-hairline' : ''}`}>
              <div className="w-[42px] h-[42px] rounded-xl bg-bg-elevated flex items-center justify-center text-lg flex-none">📦</div>
              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-bold truncate">{line.productName}</div>
                  {line.promotionId && <Tag size={12} className="text-terracotta flex-none" />}
                </div>
                <div className="text-[13px] text-text-dim">
                  {line.quantity} ×{' '}
                  {line.catalogPrice != null && (
                    <span className="line-through mr-1">{formatSellingPrice(line.catalogPrice, 'fr', tenant.sellingPriceDecimals)}</span>
                  )}
                  <span className={line.catalogPrice != null ? 'text-terracotta font-bold' : ''}>{formatSellingPrice(line.unitPrice, 'fr', tenant.sellingPriceDecimals)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onUpdateQuantity(line.id, -1)} className="w-7 h-7 rounded-[9px] border border-border-strong flex items-center justify-center text-text-muted font-extrabold">
                  −
                </button>
                <div className="text-base font-extrabold min-w-[14px] text-center">{line.quantity}</div>
                <button onClick={() => onUpdateQuantity(line.id, 1)} className="w-7 h-7 rounded-[9px] bg-primary flex items-center justify-center text-papier font-extrabold">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>


        {appliedDiscount ? (
          <div className="flex flex-col gap-2 px-[18px] py-4 rounded-2xl bg-bg-elevated">
            <div className="flex items-center justify-between text-sm text-text-dim">
              <div className="font-semibold">{t('registerSales.subtotal')}</div>
              <div className="amount font-bold">{total.toLocaleString('fr-FR')},00</div>
            </div>
            <div className="flex items-center justify-between text-sm text-terracotta">
              <div className="font-semibold">
                {t('registerSales.discountLabel', { reason: REASON_LABELS[appliedDiscount.reason] })}
                {appliedDiscount.type === 'PERCENTAGE' ? ` (${appliedDiscount.value}%)` : ''}
              </div>
              <div className="flex items-center gap-2">
                <div className="amount font-bold">−{appliedDiscount.amount.toLocaleString('fr-FR')},00</div>
                <button onClick={removeDiscount} aria-label={t('registerSales.discount')} className="text-text-dim">
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border-hairline">
              <div className="text-[15px] font-bold text-[#5C5147]">{t('registerSales.totalToPay')}</div>
              <div className="amount text-2xl font-extrabold">{netTotal.toLocaleString('fr-FR')},00 {tenant.currency}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-[18px] py-4 rounded-2xl bg-bg-elevated">
            <div className="text-[15px] font-bold text-[#5C5147]">{t('registerSales.totalToPay')}</div>
            <div className="amount text-2xl font-extrabold">{total.toLocaleString('fr-FR')},00 {tenant.currency}</div>
          </div>
        )}

        {isOnline && lines.length > 0 && !appliedDiscount && !showDiscountPanel && (
          <button
            onClick={() => setShowDiscountPanel(true)}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-border-strong text-terracotta text-sm font-bold"
          >
            <Tag size={16} /> {t('registerSales.grantDiscount')}
          </button>
        )}

        {!isOnline && (
          <div className="text-center text-[13px] font-semibold text-text-dim">{t('registerSales.discountUnavailableOffline')}</div>
        )}

        {showDiscountPanel && (
          <div className="p-4 rounded-[17px] bg-bg-card border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold">{t('registerSales.discountPanelTitle')}</div>
              <button onClick={() => setShowDiscountPanel(false)} className="text-text-dim">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              {(['PERCENTAGE', 'AMOUNT'] as DiscountType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setDiscountType(type)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${discountType === type ? 'bg-primary text-papier' : 'border border-border-strong text-text-muted'}`}
                >
                  {type === 'PERCENTAGE' ? '%' : tenant.currency}
                </button>
              ))}
            </div>
            <input
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder={discountType === 'PERCENTAGE' ? t('registerSales.discountValuePlaceholderPercentage') : t('registerSales.discountValuePlaceholderAmount')}
              inputMode="decimal"
              className="amount h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-bold outline-none focus:border-primary"
            />
            <select
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value as DiscountReason)}
              className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold outline-none focus:border-primary"
            >
              {(Object.keys(REASON_LABELS) as DiscountReason[]).map((r) => (
                <option key={r} value={r}>{REASON_LABELS[r]}</option>
              ))}
            </select>
            {discountReason === 'OTHER' && (
              <input
                value={discountNote}
                onChange={(e) => setDiscountNote(e.target.value)}
                placeholder={t('registerSales.discountNotePlaceholder')}
                className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold outline-none focus:border-primary"
              />
            )}
            {previewDiscountAmount > total && (
              <div className="text-[13px] font-semibold text-danger">{t('registerSales.discountExceedsTotal')}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscountPanel(false)}
                className="flex-1 py-2.5 rounded-xl border border-border-strong text-text-muted font-bold"
              >
                {t('registerSales.cancel')}
              </button>
              <button
                onClick={applyDiscount}
                disabled={previewDiscountAmount <= 0 || previewDiscountAmount > total}
                className="flex-1 py-2.5 rounded-xl bg-terracotta text-papier font-extrabold disabled:opacity-50"
              >
                {t('registerSales.applyDiscount', { amount: previewDiscountAmount.toLocaleString('fr-FR') })}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.howCustomerPays')}</div>
          {activeMethods.length > 1 && <div className="text-[13px] font-semibold text-text-dim">{t('registerSales.howCustomerPaysHint')}</div>}
          <div className="grid grid-cols-2 gap-2.5">
            {methods.map((m) => {
              const active = lines.length > 0 && amounts[m.id] !== undefined
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMethod(m.id)}
                  disabled={lines.length === 0}
                  className={`p-4 rounded-2xl flex flex-col gap-2 disabled:opacity-50 ${active ? 'border-2 border-success bg-succes-bg' : 'border border-border-strong bg-bg-card'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xl">{m.icon}</div>
                    {active && (
                      <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                        <Check size={12} strokeWidth={4} className="text-papier" />
                      </div>
                    )}
                  </div>
                  <div className={`text-base ${active ? 'font-extrabold text-succes-text' : 'font-bold'}`}>{m.label}</div>
                </button>
              )
            })}
          </div>

          {activeMethods.length > 1 && (
            <div className="flex flex-col gap-2">
              {activeMethods.map((m) => {
                const isAutoCash = m.id === 'CASH'
                return (
                  <div key={m.id} className={`h-[52px] rounded-2xl flex items-center px-4 gap-2.5 border border-border-strong ${isAutoCash ? 'bg-bg-elevated' : 'bg-bg-card'}`}>
                    <div className="text-lg">{m.icon}</div>
                    <div className="flex-1 text-sm font-bold text-text-muted">
                      {m.label}
                      {isAutoCash && <span className="ml-1.5 text-[11px] font-semibold text-text-dim">{t('registerSales.cashAuto')}</span>}
                    </div>
                    <input
                      value={resolved[m.id] ?? 0}
                      onChange={(e) => setAmountFor(m.id, e.target.value)}
                      readOnly={isAutoCash}
                      inputMode="decimal"
                      className={`amount w-28 text-right font-extrabold outline-none bg-transparent ${isAutoCash ? 'text-text-dim' : ''}`}
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
        </div>

        {isDebt && (
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.clientTitle')}</div>
            <input
              value={debtName}
              onChange={(e) => setDebtName(e.target.value)}
              placeholder={t('registerSales.customerNamePlaceholder')}
              className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold outline-none focus:border-primary"
            />
            <div className="h-[52px] rounded-2xl flex items-center px-4 gap-2.5 border border-border-strong bg-bg-card">
              <div className="amount text-base font-bold text-text-muted">+224</div>
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
      </div>

      <div className="flex-none px-5 pt-4 pb-9 flex flex-col gap-2.5">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={handleConfirm}
          disabled={submitting || debtInvalid || paymentsInvalid || lines.length === 0}
          className="h-16 rounded-[18px] bg-success text-papier text-lg font-extrabold flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          <Check size={22} strokeWidth={2.6} />
          {submitting ? t('registerSales.recording') : t('registerSales.confirmAmount', { amount: netTotal.toLocaleString('fr-FR') })}
        </button>
        <div className="text-center text-[13px] font-semibold text-text-dim">{t('registerSales.onlineRecording')}</div>
      </div>
    </div>
  )
}
