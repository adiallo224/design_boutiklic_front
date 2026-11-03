import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { debtApi } from '../../../lib/debtApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface EditManualDebtModalDesktopProps {
  open: boolean
  debtId: string
  customerName: string
  initialAmount: number
  initialDueDate: string | null
  onClose: () => void
  onDone: () => void
}

/** Correction du montant / de l'échéance d'une dette ouverte manuellement (NewDebtModalDesktop) —
 *  les dettes issues d'une vente ne passent jamais par ici (le montant reste celui de la vente). */
export default function EditManualDebtModalDesktop({ open, debtId, customerName, initialAmount, initialDueDate, onClose, onDone }: EditManualDebtModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(String(initialAmount))
      setDueDate(initialDueDate ?? '')
      setError(null)
    }
  }, [open, debtId, initialAmount, initialDueDate])

  const parsedAmount = parseInt(amount.replace(',', ''), 10) || 0

  const handleSubmit = async () => {
    if (parsedAmount <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await debtApi.updateManualDebt(debtId, { amount: parsedAmount, currency: tenant.currency, dueDate: dueDate || null })
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={480} title={t('debtBook.editDebtTitle')} subtitle={customerName}>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('debtBook.debtAmountLabel')}</span>
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ''))} inputMode="decimal" className="amount text-lg" placeholder="0" autoFocus />
          {parsedAmount > 0 && <span className="amount text-sm text-text-muted">{formatNumber(parsedAmount, locale)} {tenant.currency}</span>}
        </div>
        <Input label={t('debtBook.dueDateLabel')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleSubmit} disabled={submitting || parsedAmount <= 0} loading={submitting} className="h-12">
          {t('debtBook.saveEditButton')}
        </Button>
      </div>
    </Modal>
  )
}
