'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { formatDateTime, type Locale } from '@boutiklic/shared'
import { callApi } from '../lib/browserApi'
import { statusLabel, translate, type MessageKey } from '../lib/i18n'
import { money } from '../lib/money'
import type { TrackedOrder } from '../lib/types'

const REFRESH_MS = 30_000

export function TrackingView({ locale, orderNumber, token }: { locale: Locale; orderNumber: string; token: string }) {
  const t = (key: MessageKey) => translate(locale, key)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notFound' | 'error'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await callApi<TrackedOrder>('GET', `public/orders/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`)
    if (result.ok && result.data) {
      setOrder(result.data)
      setState('ok')
    } else if (result.status === 404) {
      setState('notFound')
    } else if (!result.networkError) {
      setState((s) => (s === 'ok' ? s : 'error'))
    }
  }, [orderNumber, token])

  useEffect(() => {
    void load()
    // Actualisation périodique tant que la commande est ouverte et l'onglet visible (économise le réseau mobile).
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  async function cancel() {
    if (!window.confirm(t('cancelConfirm'))) return
    setBusy(true)
    setNotice(null)
    const result = await callApi<TrackedOrder>('POST', `public/orders/${encodeURIComponent(orderNumber)}/cancel?t=${encodeURIComponent(token)}`)
    setBusy(false)
    if (result.ok && result.data) setOrder(result.data)
    else if (result.status === 409) {
      setNotice(t('cancelTooLate'))
      void load()
    } else setNotice(t('genericError'))
  }

  if (state === 'loading') return <p className="muted">{t('loading')}</p>
  if (state === 'notFound') {
    return (
      <div className="center">
        <h1>{t('notFoundOrder')}</h1>
        <Link href="/">{t('continueShopping')}</Link>
      </div>
    )
  }
  if (state === 'error' || !order) {
    return (
      <div className="center">
        <p>{t('genericError')}</p>
        <button type="button" className="btn inline" onClick={() => void load()}>{t('refresh')}</button>
      </div>
    )
  }

  return (
    <>
      <h1>{t('orderNumber')} <span className="nowrap">{order.orderNumber}</span></h1>
      <p>
        <span className="status-pill">{statusLabel(locale, 'orderStatus', order.status)}</span>
        <span className="status-pill">{statusLabel(locale, 'fulfillment', order.fulfillmentStatus)}</span>
        <span className="status-pill">{statusLabel(locale, 'payment', order.paymentStatus)}</span>
      </p>
      <p className="notice ok">{t('keepLink')}</p>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {order.lines.map((l, i) => (
          <li key={i} className="cart-line">
            {l.imageUrl ? <img className="thumb" src={l.imageUrl} alt="" loading="lazy" decoding="async" /> : <div className="thumb-empty" aria-hidden="true">📦</div>}
            <div>
              <strong>{l.name}</strong>
              <div className="muted">{l.quantity} × {money(l.unitPrice, order.currency, locale)}</div>
              <div>{money(l.lineTotal, order.currency, locale)}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="totals">
        <div className="row"><span>{t('subtotal')}</span><span>{money(order.subtotal, order.currency, locale)}</span></div>
        <div className="row"><span>{t('deliveryFee')}</span><span>{order.deliveryMethod === 'PICKUP' ? '—' : order.deliveryFee === null ? t('toConfirm') : order.deliveryFee === 0 ? t('free') : money(order.deliveryFee, order.currency, locale)}</span></div>
        <div className="row grand"><span>{order.totalIsFinal ? t('total') : t('totalWithoutFees')}</span><span>{money(order.total, order.currency, locale)}</span></div>
        {!order.totalIsFinal ? <p className="muted">{t('toConfirmHelp')}</p> : null}
      </div>

      <h2>{t('history')}</h2>
      <ul className="timeline">
        {order.timeline.map((e, i) => (
          <li key={i}>
            <span>{statusLabel(locale, e.dimension === 'ORDER' ? 'orderStatus' : e.dimension === 'PAYMENT' ? 'payment' : 'fulfillment', e.status)}</span>
            <span className="muted">{formatDateTime(e.at, locale)}</span>
          </li>
        ))}
      </ul>

      {notice ? <p role="alert" className="notice">{notice}</p> : null}
      {order.canCancel ? <button type="button" className="btn danger" disabled={busy} onClick={cancel}>{t('cancelOrder')}</button> : null}
      <p><Link href="/">{t('continueShopping')}</Link></p>
    </>
  )
}
