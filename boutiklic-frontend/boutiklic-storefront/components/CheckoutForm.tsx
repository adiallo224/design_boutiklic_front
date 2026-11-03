'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@boutiklic/shared'
import { callApi } from '../lib/browserApi'
import { forgetKey, keyFor, requestSignature, type KeyStore } from '../lib/idempotency'
import { translate, type MessageKey } from '../lib/i18n'
import { money } from '../lib/money'
import type { DeliveryMethod, DeliveryOptions, PlaceOrderRequest, PlaceOrderResponse, QuoteResponse } from '../lib/types'
import { useCart } from './CartProvider'

const OTHER_AREA = '__other__'
const PHONE = /^\+[1-9]\d{7,14}$/

/** La clé d'idempotence survit à un rechargement de la page (coupure pendant l'envoi), mais pas à la fermeture de l'onglet. */
const sessionKeys: KeyStore = {
  get: (name) => {
    try { return window.sessionStorage.getItem(name) } catch { return null }
  },
  set: (name, value) => {
    try { window.sessionStorage.setItem(name, value) } catch { /* stockage indisponible: la clé vit alors le temps de la page */ }
  },
  remove: (name) => {
    try { window.sessionStorage.removeItem(name) } catch { /* idem */ }
  },
}

interface Props {
  locale: Locale
  delivery: DeliveryOptions
  /** Clé publique du captcha (Turnstile). Absente = captcha non utilisé par cette vitrine. */
  captchaSiteKey: string | null
}

declare global {
  interface Window {
    turnstile?: { render(el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }): string; reset(id?: string): void }
  }
}

export function CheckoutForm({ locale, delivery, captchaSiteKey }: Props) {
  const t = (key: MessageKey) => translate(locale, key)
  const router = useRouter()
  const { cart, ready, clear } = useCart()

  const areas = useMemo(() => [...new Set(delivery.zones.flatMap((z) => z.areas))].sort((a, b) => a.localeCompare(b, locale)), [delivery.zones, locale])
  const canDeliver = delivery.zones.length > 0
  const canPickUp = delivery.pickupPoints.length > 0

  const [method, setMethod] = useState<DeliveryMethod>(canDeliver ? 'DELIVERY' : 'PICKUP')
  const [areaChoice, setAreaChoice] = useState('')
  const [otherArea, setOtherArea] = useState('')
  const [pickupPointId, setPickupPointId] = useState(delivery.pickupPoints.length === 1 ? delivery.pickupPoints[0].id : '')
  const [address, setAddress] = useState('')
  const [landmark, setLandmark] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaBox = useRef<HTMLDivElement>(null)
  const captchaWidget = useRef<string | null>(null)

  const area = areaChoice === OTHER_AREA ? otherArea.trim() : areaChoice
  const currency = quote?.currency ?? cart[0]?.currency ?? ''

  // Devis du serveur à chaque changement (panier, mode, lieu). Le navigateur n'envoie que quoi/combien/comment/où: jamais un prix.
  useEffect(() => {
    if (!ready || cart.length === 0) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setQuoting(true)
      try {
        const result = await callApi<QuoteResponse>('POST', 'public/checkout/quote', {
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          deliveryMethod: method,
          area: method === 'DELIVERY' ? area : undefined,
          pickupPointId: method === 'PICKUP' && pickupPointId ? pickupPointId : undefined,
        }, {}, controller.signal)
        if (result.ok) setQuote(result.data)
      } catch {
        // requête annulée par un changement plus récent
      } finally {
        if (!controller.signal.aborted) setQuoting(false)
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [ready, cart, method, area, pickupPointId])

  // Captcha (seulement si la vitrine en a un): script chargé à la demande.
  useEffect(() => {
    if (!captchaSiteKey || !captchaBox.current) return
    const render = () => {
      if (window.turnstile && captchaBox.current && !captchaWidget.current) {
        captchaWidget.current = window.turnstile.render(captchaBox.current, { sitekey: captchaSiteKey, callback: setCaptchaToken, 'expired-callback': () => setCaptchaToken(null) })
      }
    }
    if (window.turnstile) return render()
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = render
    document.head.appendChild(script)
  }, [captchaSiteKey])

  if (!ready) return <p className="muted">{t('loading')}</p>
  if (cart.length === 0) {
    return (
      <>
        <h1>{t('checkout')}</h1>
        <p className="muted">{t('emptyCart')}</p>
        <Link className="btn inline" href="/">{t('continueShopping')}</Link>
      </>
    )
  }

  const phoneDigits = phone.replace(/[\s.\-()]/g, '')
  const phoneOk = PHONE.test(phoneDigits)
  const placeOk = method === 'PICKUP' ? pickupPointId !== '' : area !== '' || address.trim() !== ''
  const canSubmit = !!quote && quote.canOrder && !quoting && !submitting && name.trim() !== '' && phoneOk && placeOk && (!captchaSiteKey || captchaToken !== null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!quote || !canSubmit) return
    setMessage(null)
    setSubmitting(true)
    try {
      await place(quote)
    } catch {
      setMessage({ kind: 'error', text: t('genericError') })
    } finally {
      setSubmitting(false)
    }
  }

  async function place(quote: QuoteResponse) {
    const body: PlaceOrderRequest = {
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      deliveryMethod: method,
      area: method === 'DELIVERY' ? area || undefined : undefined,
      pickupPointId: method === 'PICKUP' ? pickupPointId : undefined,
      addressText: method === 'DELIVERY' ? address.trim() || undefined : undefined,
      landmark: method === 'DELIVERY' ? landmark.trim() || undefined : undefined,
      buyerName: name.trim(),
      buyerPhone: phoneDigits,
      buyerEmail: email.trim() || undefined,
      buyerNote: note.trim() || undefined,
      paymentMethod: method === 'DELIVERY' ? 'COD' : 'PICKUP_PAYMENT',
      expectedTotal: quote.total,
      captchaToken: captchaToken ?? undefined,
    }
    // Même demande = même clé (un nouvel essai après une coupure retrouve la commande déjà créée); demande modifiée = clé neuve.
    const key = keyFor(requestSignature({ ...body, area: body.area }), sessionKeys)
    const result = await callApi<PlaceOrderResponse>('POST', 'public/checkout/orders', body, { 'Idempotency-Key': key })

    if (result.ok && result.data) {
      forgetKey(sessionKeys)
      clear()
      router.push(`/order/${encodeURIComponent(result.data.orderNumber)}?t=${encodeURIComponent(result.data.trackingToken)}`)
      return
    }
    if (captchaWidget.current) {
      window.turnstile?.reset(captchaWidget.current)
      setCaptchaToken(null)
    }
    if (result.networkError) return setMessage({ kind: 'error', text: t('networkError') })
    const code = result.problem?.errorCode
    if (result.status === 409 && code === 'PRICE_CHANGED') {
      const newTotal = result.problem?.newTotal
      return setMessage({ kind: 'warn', text: `${t('priceChanged')}${newTotal !== undefined ? ` ${t('newTotal')} : ${money(newTotal, result.problem?.currency ?? currency, locale)}` : ''}` })
    }
    if (result.status === 409) return setMessage({ kind: 'warn', text: t('stockShortage') })
    if (result.status === 429) return setMessage({ kind: 'error', text: t('tooManyRequests') })
    if (result.status === 403) return setMessage({ kind: 'error', text: t('refused') })
    if (result.status === 422 && code === 'ORDER_013') return setMessage({ kind: 'error', text: t('codCap') })
    if (result.status === 422 && result.problem?.detail) return setMessage({ kind: 'error', text: result.problem.detail })
    return setMessage({ kind: 'error', text: t('genericError') })
  }

  const fee = quote?.delivery
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h1>{t('checkout')}</h1>

      <fieldset>
        <legend>{t('delivery')}</legend>
        {canDeliver ? (
          <label className="radio-row"><input type="radio" name="method" checked={method === 'DELIVERY'} onChange={() => setMethod('DELIVERY')} /> {t('delivery')}</label>
        ) : null}
        {canPickUp ? (
          <label className="radio-row"><input type="radio" name="method" checked={method === 'PICKUP'} onChange={() => setMethod('PICKUP')} /> {t('pickup')}</label>
        ) : null}
        {!canDeliver && !canPickUp ? <p className="notice error">{t('genericError')}</p> : null}

        {method === 'DELIVERY' ? (
          <>
            <label>
              {t('deliveryArea')}
              <select value={areaChoice} onChange={(e) => setAreaChoice(e.target.value)}>
                <option value="">{t('chooseArea')}</option>
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value={OTHER_AREA}>{t('otherArea')}</option>
              </select>
            </label>
            {areaChoice === OTHER_AREA ? <label>{t('deliveryArea')}<input type="text" value={otherArea} onChange={(e) => setOtherArea(e.target.value)} maxLength={200} /></label> : null}
            <label>{t('addressLabel')}<small>{t('addressHelp')}</small><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} autoComplete="street-address" /></label>
            <label>{t('landmark')}<input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={200} /></label>
          </>
        ) : (
          <label>
            {t('pickupPoint')}
            <select value={pickupPointId} onChange={(e) => setPickupPointId(e.target.value)}>
              <option value="">{t('choosePickup')}</option>
              {delivery.pickupPoints.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.addressText}</option>)}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('yourName')}</legend>
        <label>{t('yourName')}<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} autoComplete="name" required /></label>
        <label>{t('yourPhone')}<small>{t('phoneHelp')}</small><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" inputMode="tel" required aria-invalid={phone !== '' && !phoneOk} /></label>
        <label>{t('yourEmail')}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" /></label>
        <label>{t('note')}<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
      </fieldset>

      <section aria-live="polite" className="totals">
        {quote ? (
          <>
            {quote.lines.map((l) => (
              <div className="row" key={l.productId}><span>{l.quantity} × {l.name}</span><span>{money(l.lineTotal, quote.currency ?? currency, locale)}</span></div>
            ))}
            <div className="row"><span>{t('subtotal')}</span><span>{money(quote.subtotal, quote.currency ?? currency, locale)}</span></div>
            {fee ? (
              <div className="row">
                <span>{t('deliveryFee')}{fee.zoneName ? ` (${fee.zoneName})` : ''}</span>
                <span>{fee.method === 'PICKUP' ? '—' : fee.status === 'FREE' ? t('free') : fee.status === 'TO_CONFIRM' ? t('toConfirm') : money(fee.fee ?? 0, quote.currency ?? currency, locale)}</span>
              </div>
            ) : null}
            <div className="row grand"><span>{quote.totalIsFinal ? t('total') : t('totalWithoutFees')}</span><span>{money(quote.total, quote.currency ?? currency, locale)}</span></div>
            {fee?.status === 'TO_CONFIRM' && fee.method === 'DELIVERY' ? <p className="muted">{t('toConfirmHelp')}</p> : null}
            {fee?.etaText ? <p className="muted">{fee.etaText}</p> : null}
            {quote.unavailableProductIds.length > 0 ? <p className="notice">{t('unavailable')}</p> : null}
            {quote.issues.includes('MINIMUM_ORDER_NOT_REACHED') ? <p className="notice">{t('minOrderNotMet')} {fee?.minOrder ? `(${t('minOrder')} : ${money(fee.minOrder, quote.currency ?? currency, locale)})` : ''}</p> : null}
            {quote.issues.includes('PICKUP_POINT_UNKNOWN') ? <p className="notice">{t('noPickupPoint')}</p> : null}
          </>
        ) : (
          <p className="muted">{t('loading')}</p>
        )}
        <p className="muted">{method === 'DELIVERY' ? t('cod') : t('pickupPayment')}</p>
      </section>

      {captchaSiteKey ? <div ref={captchaBox} /> : null}
      {message ? <p role="alert" className={`notice ${message.kind === 'error' ? 'error' : ''}`}>{message.text}</p> : null}
      <button type="submit" className="btn" disabled={!canSubmit}>{submitting ? t('placing') : t('placeOrder')}</button>
    </form>
  )
}
