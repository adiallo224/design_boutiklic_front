import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { resellerApi } from '../../../lib/resellerApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface ResellerPaymentModalDesktopProps {
  open: boolean
  resellerPhone: string
  resellerName: string
  remainingAmount: number
  onClose: () => void
  onDone: () => void
  /** Mode correction d'un versement déjà enregistré : préremplit montant / moyen et appelle PUT au lieu de POST. */
  editing?: { paymentId: string; amount: number; method: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'; note?: string | null }
}

/** W20 — modale 720px : reste à récupérer / après versement en vis-à-vis, montant au clavier
 *  physique (pas de pavé tactile), raccourcis dont "Tout solder", moyen. Le versement s'applique
 *  aux sorties les plus anciennes d'abord côté backend ; le stock n'est pas affecté (cf. spec). */
export default function ResellerPaymentModalDesktop({ open, resellerPhone, resellerName, remainingAmount, onClose, onDone, editing }: ResellerPaymentModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const methods: { id: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'; label: string; icon: string }[] = [
    { id: 'CASH', label: t('resellerConsignment.methodCash'), icon: '💵' },
    { id: 'MOBILE_MONEY_ORANGE', label: t('resellerConsignment.methodOrangeMoney'), icon: '📱' },
    { id: 'MOBILE_MONEY_WAVE', label: t('resellerConsignment.methodWave'), icon: '🌊' },
  ]
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<typeof methods[number]['id']>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(editing ? String(editing.amount) : String(Math.min(150000, remainingAmount)))
      setMethod(editing?.method ?? 'CASH')
      setError(null)
    }
  }, [open, remainingAmount, editing?.paymentId])

  const paid = parseInt(amount.replace(',', ''), 10) || 0
  // En correction, le reste actuel inclut déjà l'ancien versement : on le rajoute avant de retrancher le nouveau.
  const remaining = Math.max(0, remainingAmount + (editing?.amount ?? 0) - paid)
  const maxAmount = remainingAmount + (editing?.amount ?? 0)

  const handleSubmit = async () => {
    if (paid <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = { amount: paid, currency: tenant.currency, paymentMethod: method }
      if (editing) await resellerApi.updatePayment(resellerPhone, editing.paymentId, { ...payload, note: editing.note ?? undefined })
      else await resellerApi.recordPayment(resellerPhone, payload)
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={720} title={editing ? t('resellerConsignment.editPaymentTitle') : t('resellerConsignment.collectTitle')} subtitle={t('resellerConsignment.owesAmount', { name: resellerName, amount: formatNumber(maxAmount, locale) })}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <div className="min-w-0 p-4 rounded-xl bg-bg-elevated flex flex-col gap-1">
            <span className="break-words text-xs font-extrabold tracking-widest text-text-dim">{t('resellerConsignment.totalOutLabel')}</span>
            <span className="amount text-lg sm:text-xl break-all font-extrabold">{formatNumber(maxAmount, locale)}</span>
          </div>
          <div className="min-w-0 p-4 rounded-xl bg-succes-bg flex flex-col gap-1">
            <span className="break-words text-xs font-extrabold tracking-widest text-succes-text">{t('resellerConsignment.afterPaymentLabel')}</span>
            <span className="amount text-lg sm:text-xl break-all font-extrabold text-succes-text">{formatNumber(remaining, locale)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('resellerConsignment.bringsBackLabel')}</span>
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
              {t('resellerConsignment.settleAll')}
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
                method === m.id ? 'border-2 border-success bg-succes-bg text-succes-text font-extrabold' : 'border border-border-strong bg-bg-card text-[#5C5147] font-bold'
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleSubmit} disabled={submitting || paid <= 0} loading={submitting} className="min-h-12">
          {editing ? t('resellerConsignment.saveEditButton') : t('resellerConsignment.recordPaymentButton')}
        </Button>
      </div>
    </Modal>
  )
}
