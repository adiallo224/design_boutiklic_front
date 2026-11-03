import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { debtApi } from '../../../lib/debtApi'
import { toE164Phone } from '../../../lib/authApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { syncEngine } from '../../../lib/syncEngine'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface NewDebtModalDesktopProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

/** Écran connectif du carnet client (pas de numéro W dédié) — reprend NewDebt.tsx (mobile) en
 *  modale, même appel debtApi.createDebt. */
export default function NewDebtModalDesktop({ open, onClose, onCreated }: NewDebtModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setCustomerName('')
      setCustomerPhone('')
      setAmount('')
      setDueDate('')
      setError(null)
    }
  }, [open])

  const parsedAmount = parseInt(amount.replace(',', ''), 10) || 0
  const invalid = customerName.trim().length === 0 || customerPhone.trim().length < 8 || parsedAmount <= 0

  const handleSubmit = async () => {
    if (invalid || submitting) return
    setSubmitting(true)
    setError(null)
    const payload = {
      customerName: customerName.trim(),
      customerPhone: toE164Phone(customerPhone.trim()),
      amount: parsedAmount,
      currency: tenant.currency,
      dueDate: dueDate || undefined,
    }
    try {
      try {
        await debtApi.createDebt(payload)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('CREATE_DEBT', JSON.stringify(payload))
      }
      onCreated()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={480} title={t('debtBook.newDebtTitle')}>
      <div className="flex flex-col gap-3.5">
        <Input label={t('debtBook.clientLabel')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('debtBook.customerNamePlaceholder')} />
        <Input
          label={t('debtBook.customerPhonePlaceholder')}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          className="amount"
        />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('debtBook.debtAmountLabel')}</span>
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ''))} inputMode="decimal" className="amount text-lg" placeholder="0" />
          {parsedAmount > 0 && <span className="amount text-sm text-text-muted">{formatNumber(parsedAmount, locale)} {tenant.currency}</span>}
        </div>
        <Input label={t('debtBook.dueDateLabel')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleSubmit} disabled={submitting || invalid} loading={submitting} className="h-12">
          {t('debtBook.createDebt')}
        </Button>
      </div>
    </Modal>
  )
}
