import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import type { SaleLine } from '../../types'
import type { DiscountInput } from './SaleValidation'
import type { DiscountReason } from '../../lib/discountsApi'
import type { PaymentSplit } from '../../lib/salesApi'
import type { TaxSummary } from './CashierFlow'

interface ReceiptProps {
  /** Sous-total brut (somme des lignes, avant rabais). */
  total: number
  lines: SaleLine[]
  /** Une entrée par moyen de paiement utilisé (écran B3, paiement fractionné). */
  payments: PaymentSplit[]
  /** true si la vente a été mise en file (lib/outbox) faute de réseau — pas encore de numéro de
   *  ticket serveur, elle sera envoyée dès la reconnexion. */
  pending: boolean
  discount?: DiscountInput
  /** Récap HT/TVA/TTC (doc TVA §3.3) — null si aucune ligne de la vente n'a de TVA applicable. */
  taxSummary?: TaxSummary | null
  onClose: () => void
}

export default function Receipt({ total, lines, payments, pending, discount, taxSummary, onClose }: ReceiptProps) {
  const { t } = useTranslation()
  const REASON_LABELS: Record<DiscountReason, string> = {
    LOYAL_CUSTOMER: t('registerSales.discountReasonLoyalCustomer'),
    PRODUCT_DEFECT: t('registerSales.discountReasonProductDefect'),
    NEGOTIATION: t('registerSales.discountReasonNegotiation'),
    PRICING_ERROR: t('registerSales.discountReasonPricingError'),
    OTHER: t('registerSales.discountReasonOther'),
  }
  const METHOD_LABELS: Record<string, string> = {
    CASH: t('registerSales.methodCash'),
    MOBILE_MONEY_ORANGE: t('registerSales.methodOrangeMoney'),
    MOBILE_MONEY_WAVE: t('registerSales.methodWave'),
    DEBT: t('registerSales.methodDebt'),
  }
  const { tenant, formatCurrency } = useTenant()
  const ticketId = Date.now().toString().slice(-4)
  const now = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const netTotal = total - (discount?.amount ?? 0)
  // Un sur-paiement (monnaie rendue) n'est possible que sur une vente payée en espèces uniquement.
  const isSingleCash = payments.length === 1 && payments[0].method === 'CASH'
  const change = isSingleCash && payments[0].amount > netTotal ? payments[0].amount - netTotal : 0
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  const receiptText = [
    tenant.name.toUpperCase(),
    [tenant.city, tenant.phone].filter(Boolean).join(' · '),
    `${now} · ${t('registerSales.ticketNumber', { id: ticketId })}`,
    '',
    ...lines.map((l) => `${l.productName} ×${l.quantity} — ${l.lineTotal.toLocaleString('fr-FR')}`),
    '',
    discount ? `${t('registerSales.subtotal')} : ${total.toLocaleString('fr-FR')}` : null,
    discount ? `${t('registerSales.discount')} : −${discount.amount.toLocaleString('fr-FR')}` : null,
    `${t('registerSales.total')} : ${formatCurrency(netTotal)}`,
  ].filter((line): line is string => line !== null).join('\n')

  const handleShare = async () => {
    setShareFeedback(null)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${t('registerSales.ticketItems')} ${tenant.name}`, text: receiptText })
      } catch {
        // Annulation par l'utilisateur (AbortError) ou échec silencieux — pas d'erreur à afficher.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(receiptText)
      setShareFeedback(t('registerSales.receiptCopied'))
    } catch {
      setShareFeedback(t('registerSales.receiptShareFailed'))
    }
  }

  return (
    <div
      className="flex flex-col bg-success relative overflow-hidden"
      style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,253,250,.05) 0 3px,transparent 3px 14px)' }}
    >
      <div className="flex-none flex flex-col items-center gap-3 pt-5 pb-5">
        <div className="w-[66px] h-[66px] rounded-full bg-papier/20 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-papier flex items-center justify-center">
            <Check size={26} strokeWidth={3} className="text-success" />
          </div>
        </div>
        <div className="font-display text-2xl font-extrabold text-papier">{pending ? t('registerSales.saleSavedOffline') : t('registerSales.saleSaved')}</div>
      </div>

      {pending && (
        <div className="flex-none mx-5 mb-3 p-3.5 rounded-2xl bg-papier/15 border border-papier/30 text-[13px] font-semibold text-papier text-center">
          {t('registerSales.offlinePendingNotice')}
        </div>
      )}

      <div className="flex-1 px-5 flex flex-col">
        <div className="bg-bg-card rounded-t-[20px] p-5 pb-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-0.5 pb-3.5 border-b border-dashed border-[#DDD2C3]">
            <div className="font-display text-lg font-extrabold tracking-tight">{tenant.name.toUpperCase()}</div>
            <div className="text-xs font-semibold text-text-dim">{[tenant.city, tenant.phone].filter(Boolean).join(' · ')}</div>
            <div className="amount text-xs font-semibold text-text-dim">{now} · {pending ? t('registerSales.pendingSyncLabel') : t('registerSales.ticketNumber', { id: ticketId })}</div>
          </div>
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <div key={line.id} className="flex justify-between text-[15px]">
                <div className="font-semibold">{line.productName} ×{line.quantity}</div>
                <div className="amount font-bold">{line.lineTotal.toLocaleString('fr-FR')},00</div>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-[#DDD2C3] pt-3.5 flex flex-col gap-1.5">
            {discount && (
              <>
                <div className="flex justify-between text-sm text-[#5C5147]">
                  <div className="font-semibold">{t('registerSales.subtotal')}</div>
                  <div className="amount font-bold">{total.toLocaleString('fr-FR')},00</div>
                </div>
                <div className="flex justify-between text-sm text-terracotta">
                  <div className="font-semibold">{t('registerSales.discountLabel', { reason: REASON_LABELS[discount.reason] })}</div>
                  <div className="amount font-bold">−{discount.amount.toLocaleString('fr-FR')},00</div>
                </div>
              </>
            )}
            <div className="flex justify-between items-baseline">
              <div className="text-[15px] font-extrabold">{t('registerSales.total')}</div>
              <div className="amount text-2xl font-extrabold">{formatCurrency(netTotal)}</div>
            </div>
            {taxSummary && (
              <div className="flex flex-col gap-0.5 pt-1 text-xs text-[#8A7E6E]">
                <div className="flex justify-between">
                  <span>{t('registerSales.taxTotalHt')}</span>
                  <span className="amount">{taxSummary.totalHt.toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('registerSales.taxTotalAmount')}</span>
                  <span className="amount">{taxSummary.totalTax.toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{t('registerSales.taxTotalTtc')}</span>
                  <span className="amount">{taxSummary.totalTtc.toLocaleString('fr-FR')}</span>
                </div>
              </div>
            )}
            {payments.map((p) => (
              <div key={p.method} className="flex justify-between text-sm text-[#5C5147]">
                <div className="font-semibold">{METHOD_LABELS[p.method] ?? p.method}</div>
                <div className="amount font-bold">{p.amount.toLocaleString('fr-FR')},00</div>
              </div>
            ))}
            {change > 0 && (
              <div className="flex justify-between text-sm text-success">
                <div className="font-bold">{t('registerSales.changeDue')}</div>
                <div className="amount font-extrabold">{change.toLocaleString('fr-FR')},00</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3.5 pt-3 border-t border-dashed border-[#DDD2C3]">
            <div className="w-16 h-16 flex-none bg-encre rounded-lg p-1.5">
              <div className="w-full h-full rounded-sm" style={{ background: 'repeating-conic-gradient(#FFFDFA 0 25%, #111418 0 50%)', backgroundSize: '16px 16px' }} />
            </div>
            <div className="text-[13px] leading-relaxed text-[#5C5147]">{t('registerSales.qrHint')}</div>
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pt-4 pb-9 flex flex-col gap-2.5">
        {shareFeedback && <div className="text-center text-[13px] font-semibold text-papier">{shareFeedback}</div>}
        <div className="flex gap-2.5">
          <button onClick={handleShare} className="flex-1 h-[58px] rounded-2xl bg-papier text-succes-text text-base font-extrabold flex items-center justify-center gap-2">
            {t('registerSales.share')}
          </button>
          <button onClick={() => window.print()} className="flex-1 h-[58px] rounded-2xl bg-papier/15 border border-papier/35 text-papier text-base font-bold flex items-center justify-center gap-2">
            {t('registerSales.print')}
          </button>
        </div>
        <button onClick={onClose} className="h-[60px] rounded-2xl bg-warning text-encre text-lg font-extrabold">
          {t('registerSales.newSale')}
        </button>
      </div>
    </div>
  )
}
