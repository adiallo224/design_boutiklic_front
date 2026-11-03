import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MessageCircle, Phone, ShieldBan } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, formatMoney, isSupportedLocale } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { ApiError, toErrorMessage } from '../../../lib/apiClient'
import { ACTIONS_NEEDING_CONFIRMATION, availableActions, fulfillmentTone, nextStep, orderTone, paymentTone, riskLevel, whatsappDigits } from '../../../lib/onlineOrderActions'
import { ORDER_ERROR, onlineOrdersApi, type OrderAction, type OrderDetail } from '../../../lib/onlineOrdersApi'
import Button from '../../components/Button'
import OrderBadge from '../../components/OrderBadge'
import { useTopBar } from '../../hooks/useTopBar'
import OrderActionModal from './OrderActionModal'

const MANAGE_ROLES = ['OWNER', 'SELLER']

/** Commande en ligne — détail et traitement. Chaque bouton correspond à UNE transition du serveur, qui reste seul juge (un 409 rafraîchit l'écran au lieu d'échouer en silence). */
export default function DesktopOnlineOrderDetail() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const { user } = useAuth()
  const canManage = MANAGE_ROLES.includes(user?.role ?? '')

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<OrderAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useTopBar({ title: order ? order.orderNumber : t('onlineOrders.title') }, [t, order?.orderNumber])

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    onlineOrdersApi
      .get(id)
      .then(setOrder)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(load, [load])

  const money = (amount: number) => formatMoney(amount, order?.currency ?? tenant.currency, locale, tenant.sellingPriceDecimals)

  const run = async (action: OrderAction, reason?: string) => {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      setOrder(await onlineOrdersApi.act(id, action, reason))
      setPending(null)
    } catch (e) {
      // Une transition devenue impossible (autre appareil, expiration…): on recharge l'état réel et on le dit.
      if (e instanceof ApiError && e.errorCode === ORDER_ERROR.transition) {
        setPending(null)
        setNotice(t('onlineOrders.stale'))
        load()
      } else {
        setActionError(toErrorMessage(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const start = (action: OrderAction) => {
    setActionError(null)
    if (ACTIONS_NEEDING_CONFIRMATION.includes(action) || action === 'mark-paid') setPending(action)
    else void run(action)
  }

  const blockBuyer = async () => {
    if (!order || !window.confirm(t('onlineOrders.blockConfirm', { phone: order.buyerPhone }))) return
    setBusy(true)
    setActionError(null)
    try {
      await onlineOrdersApi.blockBuyer(order.id)
      setNotice(t('onlineOrders.blocked'))
    } catch (e) {
      setActionError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading && !order) return <div className="p-4 sm:p-8 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
  if (!order) return <div className="p-4 sm:p-8 text-[13px] font-semibold text-danger" role="alert">{error ?? t('onlineOrders.loadError')}</div>

  const actions = canManage ? availableActions(order) : []
  const main = nextStep(actions)
  const others = actions.filter((a) => a !== main)
  const whatsapp = whatsappDigits(order.buyerPhone)
  const risk = riskLevel(order.riskScore)
  const section = 'rounded-2xl border border-border bg-bg-card p-4 sm:p-5 min-w-0 flex flex-col gap-3'
  const heading = 'font-display text-base font-extrabold'
  const label = 'text-xs font-bold text-text-muted uppercase tracking-wide'

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6 max-w-[1100px]">
      <button type="button" onClick={() => navigate('/commandes-en-ligne')} className="flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text self-start">
        <ArrowLeft size={16} /> {t('onlineOrders.back')}
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2 min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-extrabold break-all">{order.orderNumber}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <OrderBadge tone={orderTone(order.status)} label={t(`onlineOrders.status.${order.status}`)} />
            <OrderBadge tone={paymentTone(order.paymentStatus)} label={t(`onlineOrders.payment.${order.paymentStatus}`)} />
            <OrderBadge tone={fulfillmentTone(order.fulfillmentStatus)} label={t(`onlineOrders.fulfillment.${order.fulfillmentStatus}`)} />
            <span className="text-xs font-semibold text-text-muted">{formatDateTime(order.placedAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {others.map((a) => (
              <Button key={a} variant={a === 'cancel' || a === 'fail-delivery' ? 'danger' : 'secondary'} disabled={busy} onClick={() => start(a)}>
                {t(`onlineOrders.actions.${a}`)}
              </Button>
            ))}
            {main && (
              <Button variant="accent" loading={busy && pending === null} disabled={busy} onClick={() => start(main)}>
                {t(`onlineOrders.actions.${main}`)}
              </Button>
            )}
          </div>
        )}
      </div>

      {notice && <div role="status" className="text-[13px] font-semibold text-succes-text bg-succes-bg rounded-xl px-4 py-3">{notice}</div>}
      {actionError && pending === null && <div role="alert" className="text-[13px] font-semibold text-danger">{actionError}</div>}
      {order.stockStatus === 'CONFLICT' && (
        <div role="alert" className="text-[13px] font-semibold text-alerte-text bg-alerte-bg rounded-xl px-4 py-3">{t('onlineOrders.stockConflict')}</div>
      )}
      {order.cancelReason && order.status !== 'COMPLETED' && (
        <div className="text-[13px] font-semibold text-text-muted">{t('onlineOrders.cancelReason', { reason: order.cancelReason })}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className={section} aria-labelledby="buyer-title">
          <h2 id="buyer-title" className={heading}>{t('onlineOrders.buyer.title')}</h2>
          <div className="font-extrabold break-words">{order.buyerName}</div>
          <div className="flex items-center gap-3 flex-wrap text-sm font-semibold">
            <a href={`tel:${order.buyerPhone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Phone size={14} />{order.buyerPhone}</a>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <MessageCircle size={14} />{t('onlineOrders.buyer.whatsapp')}
              </a>
            )}
          </div>
          {order.buyerEmail && <div className="text-sm font-semibold text-text-muted break-all">{order.buyerEmail}</div>}
          {order.buyerNote && (
            <div><div className={label}>{t('onlineOrders.buyer.note')}</div><p className="text-sm font-semibold whitespace-pre-line">{order.buyerNote}</p></div>
          )}
          {canManage && (
            <Button variant="ghost" className="flex items-center gap-2 self-start" disabled={busy} onClick={blockBuyer}>
              <ShieldBan size={16} />{t('onlineOrders.buyer.block')}
            </Button>
          )}
        </section>

        <section className={section} aria-labelledby="delivery-title">
          <h2 id="delivery-title" className={heading}>{t(`onlineOrders.method.${order.deliveryMethod}`)}</h2>
          {order.deliveryMethod === 'DELIVERY' ? (
            <>
              {order.deliveryArea && <div className="font-extrabold">{order.deliveryArea}</div>}
              {order.deliveryAddressText && <p className="text-sm font-semibold whitespace-pre-line">{order.deliveryAddressText}</p>}
              {order.deliveryLandmark && <p className="text-sm font-semibold text-text-muted">{t('onlineOrders.delivery.landmark', { landmark: order.deliveryLandmark })}</p>}
              {order.deliveryFee === null && <div role="note" className="text-[13px] font-semibold text-alerte-text bg-alerte-bg rounded-xl px-3 py-2">{t('onlineOrders.delivery.feeToConfirm')}</div>}
            </>
          ) : (
            <p className="text-sm font-semibold text-text-muted">{t('onlineOrders.delivery.pickupHint')}</p>
          )}
          {order.paymentMethod && <div className="text-sm font-semibold text-text-muted">{t('onlineOrders.paymentMethod', { method: t(`onlineOrders.methods.${order.paymentMethod}`, { defaultValue: order.paymentMethod }) })}</div>}
          {risk !== 'none' && (
            <div role="note" className={`text-[13px] font-semibold rounded-xl px-3 py-2 ${risk === 'high' ? 'bg-alerte-bg text-danger' : 'bg-alerte-bg text-alerte-text'}`}>
              {t(`onlineOrders.risk.${risk}`, { score: order.riskScore })}
              {order.riskFlags.length > 0 && <ul className="mt-1 list-disc pl-5">{order.riskFlags.map((f) => <li key={f}>{t(`onlineOrders.risk.flags.${f}`)}</li>)}</ul>}
            </div>
          )}
        </section>
      </div>

      <section className={section} aria-labelledby="lines-title">
        <h2 id="lines-title" className={heading}>{t('onlineOrders.lines.title')}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {order.lines.map((line) => (
            <li key={line.productId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <div className="flex-1 basis-[160px] min-w-0">
                <div className="font-bold break-words">{line.productName}</div>
                <div className="text-xs font-semibold text-text-muted tabular-nums">{line.quantity} × {money(line.unitPrice)}</div>
              </div>
              <div className="font-extrabold tabular-nums ml-auto">{money(line.lineTotal)}</div>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1.5 text-sm font-semibold border-t border-border pt-3 tabular-nums">
          <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('onlineOrders.lines.subtotal')}</dt><dd>{money(order.subtotal)}</dd></div>
          {order.taxTotal > 0 && <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('onlineOrders.lines.tax')}</dt><dd>{money(order.taxTotal)}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('onlineOrders.lines.delivery')}</dt><dd>{order.deliveryFee === null ? t('onlineOrders.lines.toConfirm') : money(order.deliveryFee)}</dd></div>
          <div className="flex justify-between gap-3 font-extrabold text-base"><dt>{order.totalIsFinal ? t('onlineOrders.lines.total') : t('onlineOrders.lines.totalProvisional')}</dt><dd>{money(order.total)}</dd></div>
        </dl>
        {order.saleId && <div className="text-xs font-semibold text-text-muted">{t('onlineOrders.saleCreated')}</div>}
      </section>

      <section className={section} aria-labelledby="history-title">
        <h2 id="history-title" className={heading}>{t('onlineOrders.history.title')}</h2>
        <ol className="flex flex-col gap-2">
          {[...order.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`} className="text-sm font-semibold">
              <span className="text-text-muted tabular-nums">{formatDateTime(h.at, locale, { dateStyle: 'short', timeStyle: 'short' })}</span>{' '}
              {t(`onlineOrders.history.dimension.${h.dimension}`)} → <span className="font-extrabold">{t(`onlineOrders.${DIM_KEY[h.dimension]}.${h.to}`, { defaultValue: h.to })}</span>
              {h.reason && <span className="text-text-muted"> — {h.reason}</span>}
            </li>
          ))}
        </ol>
      </section>

      <OrderActionModal
        action={pending}
        order={order}
        busy={busy}
        error={actionError}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && run(pending, reason)}
      />
    </div>
  )
}

/** Où chercher le libellé de l'état d'arrivée selon la dimension de l'historique. */
const DIM_KEY = { ORDER: 'status', PAYMENT: 'payment', FULFILLMENT: 'fulfillment', STOCK: 'stock' } as const
