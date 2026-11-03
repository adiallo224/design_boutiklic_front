import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { salesApi } from '../../lib/salesApi'
import { toErrorMessage } from '../../lib/apiClient'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'

interface CashCountModalDesktopProps {
  open: boolean
  currency: string
  onClose: () => void
  onRecorded: () => void
}

/** Version bureau de CashCountModal.tsx (mobile) — même appel API (salesApi.recordCashCount),
 *  juste portée sur la primitive Modal (le positionnement mobile `inset-x-5 top-1/3` deviendrait
 *  une bande quasi pleine largeur sur un écran bureau). */
export default function CashCountModalDesktop({ open, currency, onClose, onRecorded }: CashCountModalDesktopProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setNote('')
      setError(null)
    }
  }, [open])

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0

  const handleSubmit = async () => {
    if (parsedAmount <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await salesApi.recordCashCount({ countedAmount: parsedAmount, currency, note: note.trim() || undefined })
      onRecorded()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={420}
      title={t('components.cashCount.title')}
      subtitle={t('components.cashCount.subtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('components.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={parsedAmount <= 0 || submitting} loading={submitting}>
            {t('components.cashCount.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          placeholder={t('components.cashCount.amountPlaceholder')}
          inputMode="decimal"
          autoFocus
          className="amount"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('components.cashCount.notePlaceholder')} />
        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
