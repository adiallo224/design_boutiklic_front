import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { suppliersApi, type SupplierResponse } from '../../../lib/suppliersApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { syncEngine } from '../../../lib/syncEngine'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface SupplierPaymentModalDesktopProps {
  supplier: SupplierResponse | null
  onClose: () => void
  onDone: () => void
  /** Mode correction d'un paiement déjà enregistré : préremplit montant / note et appelle PUT. */
  editing?: { transactionId: string; amount: number; note: string | null }
}

/** Règlement d'un fournisseur (bouton "Régler" du registre, W19 refonte). PaySupplierRequest ne
 *  porte qu'un montant + une note libre (pas de mode de paiement, contrairement à
 *  DebtPaymentModalDesktop côté clients) — aucun sélecteur Cash/Mobile Money ici, ce champ
 *  n'existe pas côté API fournisseurs. */
export default function SupplierPaymentModalDesktop({ supplier, onClose, onDone, editing }: SupplierPaymentModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (supplier) {
      setAmount(editing ? String(editing.amount) : String(supplier.balanceDue))
      setNote(editing?.note ?? '')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier, editing?.transactionId])

  if (!supplier) return null

  const paid = parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0
  // En correction, le solde actuel inclut déjà l'ancien paiement : on le rajoute avant de retrancher le nouveau.
  const maxAmount = supplier.balanceDue + (editing?.amount ?? 0)
  const remaining = Math.max(0, maxAmount - paid)

  const handleSubmit = async () => {
    if (paid <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    const payload = { amount: paid, currency: supplier.currency, note: note.trim() || undefined }
    try {
      if (editing) {
        await suppliersApi.updatePayment(supplier.id, editing.transactionId, payload)
        onDone()
        return
      }
      try {
        await suppliersApi.pay(supplier.id, payload)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('PAY_SUPPLIER', JSON.stringify({ supplierId: supplier.id, ...payload }))
      }
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={!!supplier} onClose={onClose} width={640} title={editing ? t('inventoryCatalog.editSupplierPaymentTitle', { name: supplier.name }) : t('inventoryCatalog.paySupplierModalTitle', { name: supplier.name })}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <div className="min-w-0 p-4 rounded-xl bg-bg-elevated flex flex-col gap-1">
            <span className="break-words text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.supplierBalanceDueLabel')}</span>
            <span className="amount text-lg sm:text-xl break-all font-extrabold">{formatNumber(maxAmount, locale)}</span>
          </div>
          <div className="min-w-0 p-4 rounded-xl bg-info-bg flex flex-col gap-1">
            <span className="text-xs font-extrabold tracking-widest text-primary">{t('resellerConsignment.afterPaymentLabel')}</span>
            <span className="amount text-lg sm:text-xl break-all font-extrabold text-primary">{formatNumber(remaining, locale)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.settlePromptLabel')}</span>
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="amount text-xl sm:text-2xl h-14" autoFocus />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAmount(String(maxAmount))}
              className={`px-3.5 min-h-10 py-1 rounded-lg text-sm font-bold ${paid === maxAmount ? 'bg-primary text-papier' : 'bg-bg-elevated text-text-muted'}`}
            >
              {t('resellerConsignment.settleAll')}
            </button>
          </div>
        </div>

        <Input
          label={t('inventoryCatalog.noteOptionalPlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('inventoryCatalog.noteOptionalPlaceholder')}
        />

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleSubmit} disabled={submitting || paid <= 0 || paid > maxAmount} loading={submitting} className="min-h-12">
          {editing ? t('inventoryCatalog.saveEditButton') : t('inventoryCatalog.confirmPayment')} · {formatNumber(paid, locale)} {tenant.currency}
        </Button>
      </div>
    </Modal>
  )
}
