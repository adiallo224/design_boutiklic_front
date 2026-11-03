import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { PaymentMethod, PaymentSplit } from '../../../lib/salesApi'
import { salesApi } from '../../../lib/salesApi'
import { toE164Phone } from '../../../lib/authApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import HorizontalScroller from '../../components/HorizontalScroller'

interface QuoteSalePaymentModalDesktopProps {
  open: boolean
  /** Vente brouillon créée automatiquement à l'acceptation du devis (Quote.markAccepted côté
   *  serveur) — cf. billing QuoteCommandService.accept. */
  saleId: string | null
  onClose: () => void
  onCompleted: () => void
}

function roundUpTo(n: number, step: number): number {
  return Math.ceil(n / step) * step
}

/** Bouton "Encaisser" sur un devis accepté (circuit Devis → Vente → Facture) : complète la vente
 *  brouillon liée au devis pour pouvoir ensuite générer la facture (InvoiceModalDesktop exige une
 *  vente COMPLETED). Version allégée de SaleValidationModalDesktop.tsx (même sélection de moyen de
 *  paiement CASH/Mobile Money/Dette) : pas de panneau de rabais (le prix du devis est déjà figé à
 *  l'acceptation, le renégocier à l'encaissement n'a pas de sens) ni de lignes de panier à afficher
 *  (on encaisse un total, pas un article par article). Pas de repli hors-ligne façon syncEngine :
 *  l'opération de file COMPLETE_SALE recrée une vente de zéro (create+lignes+complete) — inadapté ici
 *  puisque la vente existe déjà côté serveur — donc même comportement que les autres actions devis
 *  (send/refuse/accept dans DesktopQuotes.tsx) : erreur affichée telle quelle si hors ligne. */
export default function QuoteSalePaymentModalDesktop({ open, saleId, onClose, onCompleted }: QuoteSalePaymentModalDesktopProps) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const methods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'CASH', label: t('registerSales.methodCash'), icon: '💵' },
    { id: 'MOBILE_MONEY_ORANGE', label: t('registerSales.methodOrangeMoney'), icon: '📱' },
    { id: 'MOBILE_MONEY_WAVE', label: t('registerSales.methodWave'), icon: '🌊' },
    { id: 'DEBT', label: t('registerSales.methodDebt'), icon: '📒' },
  ]

  const [loadingTotal, setLoadingTotal] = useState(false)
  const [total, setTotal] = useState(0)
  const [amounts, setAmounts] = useState<Partial<Record<PaymentMethod, number>>>({ CASH: 0 })
  const [debtName, setDebtName] = useState('')
  const [debtPhone, setDebtPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !saleId) return
    setLoadingTotal(true)
    setError(null)
    setDebtName('')
    setDebtPhone('')
    setSubmitting(false)
    salesApi
      .getById(saleId)
      // Source de vérité = la vente elle-même (pas quote.totalTtc) : c'est exactement ce que le
      // serveur exigera comme somme des tranches de paiement à la complétion.
      .then((sale) => {
        setTotal(sale.totalAmount)
        setAmounts({ CASH: sale.totalAmount })
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoadingTotal(false))
  }, [open, saleId])

  const activeMethods = methods.filter((m) => amounts[m.id] !== undefined)
  const isCashSolo = activeMethods.length === 1 && activeMethods[0].id === 'CASH'
  const isDebt = amounts.DEBT !== undefined && (amounts.DEBT ?? 0) > 0
  const debtInvalid = isDebt && (debtName.trim().length === 0 || debtPhone.trim().length < 8)
  const receivedAmount = amounts.CASH ?? total
  const change = isCashSolo ? Math.max(0, receivedAmount - total) : 0
  const cashInvalid = isCashSolo && receivedAmount < total
  const sumEntered = activeMethods.reduce((s, m) => s + (amounts[m.id] ?? 0), 0)
  const remaining = total - sumEntered
  const paymentsInvalid = activeMethods.length === 0
    || (isCashSolo ? cashInvalid : activeMethods.some((m) => (amounts[m.id] ?? 0) <= 0) || remaining !== 0)

  const toggleMethod = (id: PaymentMethod) => {
    setAmounts((prev) => {
      if (prev[id] !== undefined) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      const sumOthers = Object.values(prev).reduce((s: number, v) => s + (v ?? 0), 0)
      return { ...prev, [id]: Math.max(total - sumOthers, 0) }
    })
  }

  const setAmountFor = (id: PaymentMethod, value: number) => {
    setAmounts((prev) => ({ ...prev, [id]: value }))
  }

  const handleConfirm = async () => {
    if (!saleId || debtInvalid || paymentsInvalid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payments: PaymentSplit[] = activeMethods.map((m) => ({ method: m.id, amount: amounts[m.id] ?? 0 }))
      await salesApi.complete(saleId, {
        payments,
        currency: tenant.currency,
        debtCustomerName: isDebt ? debtName.trim() : undefined,
        debtCustomerPhone: isDebt ? toE164Phone(debtPhone.trim()) : undefined,
      })
      onCompleted()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={640} title={t('billing.collectPaymentTitle')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-4 sm:p-5 rounded-2xl bg-primary">
          <span className="text-xs font-extrabold tracking-widest text-[#A9BDD6]">{t('registerSales.totalToPay')}</span>
          <span className="amount text-2xl sm:text-3xl font-extrabold text-papier break-all">{loadingTotal ? '…' : total.toLocaleString('fr-FR')} {tenant.currency}</span>
        </div>

        <HorizontalScroller gapClassName="gap-2.5">
          {methods.map((m) => {
            const active = amounts[m.id] !== undefined
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMethod(m.id)}
                disabled={loadingTotal}
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
                placeholder={total.toLocaleString('fr-FR')}
                inputMode="decimal"
                className="amount text-lg"
              />
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => setAmountFor('CASH', total)} className="px-2.5 py-1.5 rounded-lg bg-bg-elevated text-xs font-bold">
                  {t('registerSales.exactAmount')}
                </button>
                {[1000, 5000, 10000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setAmountFor('CASH', roundUpTo(total, step))}
                    className="px-2.5 py-1.5 rounded-lg bg-bg-elevated text-xs font-bold amount"
                  >
                    {roundUpTo(total, step).toLocaleString('fr-FR')}
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
            {activeMethods.map((m) => (
              <div key={m.id} className="min-h-11 py-1 rounded-xl flex items-center px-3.5 gap-2.5 border border-border-strong bg-bg">
                <span className="text-lg">{m.icon}</span>
                <span className="flex-1 min-w-0 text-sm font-bold text-text-muted break-words">{m.label}</span>
                <input
                  value={amounts[m.id] ?? 0}
                  onChange={(e) => setAmountFor(m.id, parseFloat(e.target.value.replace(/[^0-9,]/g, '').replace(',', '.')) || 0)}
                  inputMode="decimal"
                  className="amount w-24 sm:w-28 flex-none text-right font-extrabold outline-none bg-transparent"
                />
              </div>
            ))}
            <div className={`text-[13px] font-semibold text-center ${remaining === 0 ? 'text-success' : 'text-danger'}`}>
              {remaining === 0 ? t('registerSales.fullyAllocated') : t('registerSales.remainingToAllocate', { amount: remaining.toLocaleString('fr-FR') })}
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

        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

        <Button
          onClick={handleConfirm}
          disabled={submitting || loadingTotal || debtInvalid || paymentsInvalid}
          loading={submitting}
          className="min-h-14 text-base"
        >
          {t('registerSales.confirmAmount', { amount: total.toLocaleString('fr-FR') })}
        </Button>
      </div>
    </Modal>
  )
}
