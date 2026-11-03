import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { debtApi } from '../../../lib/debtApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { syncEngine } from '../../../lib/syncEngine'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface DebtPaymentModalDesktopProps {
  open: boolean
  customerPhone: string
  customerName: string
  remainingAmount: number
  onClose: () => void
  onDone: () => void
  /** Mode correction d'un remboursement déjà enregistré : préremplit et appelle PUT (pas de reçu SMS). */
  editing?: { paymentId: string; amount: number; method: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'; note: string | null }
}

/** W21 — même gabarit que W20 (ResellerPaymentModalDesktop), en indigo (cf. spec). Dette en
 *  cours / après paiement en vis-à-vis, reçu par SMS en option (notifyCustomer, déjà supporté par
 *  debtApi.recordPayment côté mobile). */
export default function DebtPaymentModalDesktop({ open, customerPhone, customerName, remainingAmount, onClose, onDone, editing }: DebtPaymentModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const methods: { id: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'; label: string; icon: string }[] = [
    { id: 'CASH', label: t('debtBook.methodCash'), icon: '💵' },
    { id: 'MOBILE_MONEY_ORANGE', label: t('debtBook.methodOrangeMoney'), icon: '📱' },
    { id: 'MOBILE_MONEY_WAVE', label: t('debtBook.methodWave'), icon: '🌊' },
  ]
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<typeof methods[number]['id']>('CASH')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(editing ? String(editing.amount) : String(Math.min(150000, remainingAmount)))
      setMethod(editing?.method ?? 'CASH')
      setNotifyCustomer(true)
      setError(null)
    }
  }, [open, remainingAmount, editing?.paymentId])

  const paid = parseInt(amount.replace(',', ''), 10) || 0
  // En correction, le solde actuel inclut déjà l'ancien remboursement : on le rajoute avant de retrancher le nouveau.
  const maxAmount = remainingAmount + (editing?.amount ?? 0)
  const remaining = Math.max(0, maxAmount - paid)

  const handleSubmit = async () => {
    if (paid <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    const payload = { amount: paid, currency: tenant.currency, paymentMethod: method, notifyCustomer }
    try {
      if (editing) {
        await debtApi.updatePayment(customerPhone, editing.paymentId, { amount: paid, currency: tenant.currency, paymentMethod: method, note: editing.note })
        onDone()
        return
      }
      try {
        await debtApi.recordPayment(customerPhone, payload)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('PAY_DEBT', JSON.stringify({ customerPhone, ...payload }))
      }
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={720} title={editing ? t('debtBook.editRepaymentTitle') : t('debtBook.repaymentTitle')} subtitle={t('debtBook.owesLabel', { name: customerName, amount: formatNumber(maxAmount, locale) })}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <div className="min-w-0 p-4 rounded-xl bg-bg-elevated flex flex-col gap-1">
            <span className="break-words text-xs font-extrabold tracking-widest text-text-dim">{t('debtBook.balanceDue')}</span>
            <span className="amount text-lg sm:text-xl break-all font-extrabold">{formatNumber(maxAmount, locale)}</span>
          </div>
          <div className="min-w-0 p-4 rounded-xl bg-info-bg flex flex-col gap-1">
            <span className="break-words text-xs font-extrabold tracking-widest text-primary">{t('resellerConsignment.afterPaymentLabel')}</span>
            <span className="amount text-lg sm:text-xl break-all font-extrabold text-primary">{formatNumber(remaining, locale)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('debtBook.paysTodayLabel')}</span>
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ''))} inputMode="decimal" className="amount text-xl sm:text-2xl h-14" autoFocus />
          <div className="flex flex-wrap gap-2">
            {[50000, 150000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className={`px-3.5 min-h-10 py-1 rounded-lg text-sm font-bold ${paid === v ? 'bg-primary text-papier' : 'bg-bg-elevated text-text-muted'}`}
              >
                {formatNumber(v, locale)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(String(maxAmount))}
              className={`px-3.5 min-h-10 py-1 rounded-lg text-sm font-bold ${paid === maxAmount ? 'bg-primary text-papier' : 'bg-bg-elevated text-text-muted'}`}
            >
              {t('debtBook.settleAll')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`flex-1 min-w-[130px] min-h-12 py-1 px-2 rounded-xl flex items-center justify-center gap-1.5 text-sm ${
                method === m.id ? 'border-2 border-primary bg-info-bg text-primary font-extrabold' : 'border border-border-strong bg-bg-card text-[#5C5147] font-bold'
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {!editing && <label className="flex items-start gap-2.5 text-sm font-semibold text-text-muted cursor-pointer select-none">
          <span className={`w-5 h-5 flex-none rounded-md flex items-center justify-center ${notifyCustomer ? 'bg-primary' : 'border-2 border-border-strong'}`}>
            {notifyCustomer && <Check size={12} strokeWidth={4} className="text-papier" />}
          </span>
          <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} className="hidden" />
          {t('debtBook.sendWhatsappReceipt')}
        </label>}

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleSubmit} disabled={submitting || paid <= 0} loading={submitting} className="min-h-12">
          {editing ? t('debtBook.saveEditButton') : t('debtBook.recordPayment')}
        </Button>
      </div>
    </Modal>
  )
}
