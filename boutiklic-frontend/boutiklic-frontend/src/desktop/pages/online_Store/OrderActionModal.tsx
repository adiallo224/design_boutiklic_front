import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACTIONS_WITH_REASON, completeWillCreateDebt } from '../../../lib/onlineOrderActions'
import type { OrderAction, OrderDetail } from '../../../lib/onlineOrdersApi'
import Button from '../../components/Button'
import Modal from '../../components/Modal'

const MAX_REASON = 300

interface Props {
  /** Action à confirmer; absente = fenêtre fermée. */
  action: OrderAction | null
  order: Pick<OrderDetail, 'paymentStatus' | 'orderNumber'>
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: (reason: string | undefined) => void
}

/** Confirmation d'une action qui engage le stock, l'argent ou le client (expédier, remettre, clôturer, annuler…), avec un motif facultatif quand il a un sens. */
export default function OrderActionModal({ action, order, busy, error, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  useEffect(() => setReason(''), [action])

  if (!action) return null
  const withReason = ACTIONS_WITH_REASON[action] !== undefined
  const debt = action === 'complete' && completeWillCreateDebt(order)

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      width={520}
      title={t(`onlineOrders.actions.${action}`)}
      subtitle={order.orderNumber}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('onlineOrders.modal.back')}
          </Button>
          <Button variant={action === 'cancel' || action === 'fail-delivery' ? 'danger' : 'primary'} loading={busy} onClick={() => onConfirm(reason.trim() || undefined)}>
            {t(`onlineOrders.actions.${action}`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-text-muted break-words">{t(`onlineOrders.confirmText.${action}`)}</p>
        {debt && (
          <div role="note" className="text-[13px] font-semibold text-alerte-text bg-alerte-bg rounded-xl px-4 py-3">
            {t('onlineOrders.confirmText.completeDebt')}
          </div>
        )}
        {withReason && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('onlineOrders.modal.reason')}</span>
            <textarea
              value={reason}
              maxLength={MAX_REASON}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('onlineOrders.modal.reasonPlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
            />
          </label>
        )}
        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
