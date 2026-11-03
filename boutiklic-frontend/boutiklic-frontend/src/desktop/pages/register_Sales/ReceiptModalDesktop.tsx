import { useEffect, useState } from 'react'
import { Check, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../../hooks/useTenant'
import type { SaleLine } from '../../../types'
import type { DiscountInput } from '../../../pages/register_Sales/SaleValidation'
import type { DiscountReason } from '../../../lib/discountsApi'
import type { PaymentSplit } from '../../../lib/salesApi'
import type { TaxSummary } from '../../../pages/register_Sales/CashierFlow'
import Modal from '../../components/Modal'
import Button from '../../components/Button'

interface ReceiptModalDesktopProps {
  open: boolean
  total: number
  lines: SaleLine[]
  /** Une entrée par moyen de paiement utilisé (écran B3, paiement fractionné). */
  payments: PaymentSplit[]
  pending: boolean
  discount?: DiscountInput
  /** Récap HT/TVA/TTC (doc TVA §3.3) — null si aucune ligne de la vente n'a de TVA applicable. */
  taxSummary?: TaxSummary | null
  autoPrint: boolean
  onClose: () => void
}

/** W14 (suite) — confirmation d'encaissement, même contenu que Receipt.tsx (mobile) porté en
 *  modale, avec `.print-area` pour la feuille d'impression bureau (cf. print.css, Lot 0).
 *  `autoPrint` vient de l'interrupteur "Imprimer le reçu automatiquement" de la modale
 *  d'encaissement. */
export default function ReceiptModalDesktop({ open, total, lines, payments, pending, discount, taxSummary, autoPrint, onClose }: ReceiptModalDesktopProps) {
  const { t } = useTranslation()
  const { tenant, formatCurrency } = useTenant()
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
  const [ticketId] = useState(() => Date.now().toString().slice(-4))
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const now = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const netTotal = total - (discount?.amount ?? 0)
  const isSingleCash = payments.length === 1 && payments[0].method === 'CASH'
  const change = isSingleCash && payments[0].amount > netTotal ? payments[0].amount - netTotal : 0

  useEffect(() => {
    if (open && autoPrint && !pending) {
      const timer = setTimeout(() => window.print(), 300)
      return () => clearTimeout(timer)
    }
  }, [open, autoPrint, pending])

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
    try {
      await navigator.clipboard.writeText(receiptText)
      setShareFeedback(t('registerSales.receiptCopied'))
    } catch {
      setShareFeedback(t('registerSales.receiptShareFailed'))
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={420} title={pending ? t('registerSales.saleSavedOffline') : t('registerSales.saleSaved')}>
      <div className="flex flex-col gap-4 print-area">
        <div className="flex flex-col items-center gap-2 no-print">
          <div className="w-12 h-12 rounded-full bg-succes-bg flex items-center justify-center">
            <Check size={22} strokeWidth={3} className="text-success" />
          </div>
        </div>

        {pending && (
          <div className="p-3 rounded-xl bg-alerte-bg border border-[#EED9AE] text-[13px] font-semibold text-alerte-text text-center no-print">
            {t('registerSales.offlinePendingNotice')}
          </div>
        )}

        <div className="flex flex-col items-center gap-0.5 pb-3 border-b border-dashed border-[#DDD2C3]">
          <div className="font-display text-base font-extrabold tracking-tight">{tenant.name.toUpperCase()}</div>
          <div className="text-xs font-semibold text-text-dim">{[tenant.city, tenant.phone].filter(Boolean).join(' · ')}</div>
          <div className="amount text-xs font-semibold text-text-dim">{now} · {pending ? t('registerSales.pendingSyncLabel') : t('registerSales.ticketNumber', { id: ticketId })}</div>
        </div>

        <div className="flex flex-col gap-2">
          {lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3 text-sm">
              <span className="font-semibold min-w-0 break-words">{line.productName} ×{line.quantity}</span>
              <span className="amount font-bold">{line.lineTotal.toLocaleString('fr-FR')}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-[#DDD2C3] pt-3 flex flex-col gap-1.5">
          {discount && (
            <>
              <div className="flex justify-between gap-3 text-sm text-[#5C5147]">
                <span className="font-semibold">{t('registerSales.subtotal')}</span>
                <span className="amount font-bold">{total.toLocaleString('fr-FR')}</span>
              </div>
              <div className="flex justify-between text-sm text-terracotta">
                <span className="font-semibold">{t('registerSales.discountLabel', { reason: REASON_LABELS[discount.reason] })}</span>
                <span className="amount font-bold">−{discount.amount.toLocaleString('fr-FR')}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-extrabold">{t('registerSales.total')}</span>
            <span className="amount text-xl font-extrabold">{formatCurrency(netTotal)}</span>
          </div>
          {taxSummary && (
            <div className="flex flex-col gap-0.5 pt-1 text-xs text-text-dim">
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
              <span className="font-semibold">{METHOD_LABELS[p.method] ?? p.method}</span>
              <span className="amount font-bold">{p.amount.toLocaleString('fr-FR')}</span>
            </div>
          ))}
          {change > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span className="font-bold">{t('registerSales.changeDue')}</span>
              <span className="amount font-extrabold">{change.toLocaleString('fr-FR')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 no-print">
          {shareFeedback && <div className="text-center text-[13px] font-semibold text-text-muted">{shareFeedback}</div>}
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" className="flex-1 min-w-[130px]" onClick={handleShare}>
              {t('registerSales.share')}
            </Button>
            <Button variant="secondary" className="flex-1 min-w-[130px]" onClick={() => window.print()}>
              <Printer size={15} className="inline mr-1.5" />
              {t('registerSales.print')}
            </Button>
          </div>
          <Button variant="accent" onClick={onClose} className="min-h-12">
            {t('registerSales.newSale')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
