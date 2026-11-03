import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Clock, Minus } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, isSupportedLocale } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { resetEntitlementsCache } from '../../../hooks/useEntitlements'
import { toErrorMessage } from '../../../lib/apiClient'
import { comparePlans, displayedLimits, type PlanChange } from '../../../lib/planComparison'
import { subscriptionApi, type ChangeRequestResponse, type OverviewResponse, type PlanResponse } from '../../../lib/subscriptionApi'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { useTopBar } from '../../hooks/useTopBar'

/** Fonctionnalités présentées dans la comparaison, dans l'ordre. Une fonction que l'offre ne contient pas est marquée « non inclus ». */
const SHOWN_FEATURES = ['POS', 'INVENTORY_MANAGEMENT', 'ADVANCED_REPORTING', 'DESKTOP_AUTOUPDATE', 'MULTI_WAREHOUSE', 'ONLINE_STORE', 'MULTI_STOREFRONT']

/** « Mon offre » : l'offre actuelle, la comparaison des offres proposées et la demande de changement (le propriétaire demande, nous activons). Aucun paiement n'est pris ici. */
/** `embedded` : affiché comme onglet de Réglages (pas de bouton retour, pas de marge propre à la page). */
export default function DesktopMyPlan({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const isOwner = user?.role === 'OWNER'

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [plans, setPlans] = useState<PlanResponse[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<PlanResponse | null>(null)
  const [message, setMessage] = useState('')

  useTopBar({ title: t('mySubscription.title') }, [t])

  const load = useCallback(() => {
    setLoadError(null)
    return Promise.all([subscriptionApi.overview(), subscriptionApi.plans()])
      .then(([o, p]) => {
        setOverview(o)
        setPlans(p)
      })
      .catch((e) => setLoadError(toErrorMessage(e)))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const send = async () => {
    if (!target) return
    setBusy(true)
    setActionError(null)
    try {
      await subscriptionApi.requestChange(target.code, message)
      setTarget(null)
      setMessage('')
      setNotice(t('mySubscription.requestSent'))
      resetEntitlementsCache()
      await load()
    } catch (e) {
      setActionError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (request: ChangeRequestResponse) => {
    setBusy(true)
    setActionError(null)
    try {
      await subscriptionApi.cancelRequest(request.id)
      setNotice(t('mySubscription.requestCancelled'))
      await load()
    } catch (e) {
      setActionError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name ?? code ?? t('mySubscription.legacyPlan')
  const quotaText = (value: number | null) => (value === null ? t('mySubscription.unlimited') : new Intl.NumberFormat(locale).format(value))

  const pad = embedded ? '' : 'p-4 sm:p-8 '
  const back = embedded ? null : (
    <button type="button" onClick={() => navigate('/reglages')} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text self-start">
      <ArrowLeft size={16} />
      {t('mySubscription.back')}
    </button>
  )

  if (loadError) {
    return (
      <div className={`${pad}flex flex-col gap-4`}>
        {back}
        <div role="alert" className="text-[13px] font-semibold text-danger">{t('mySubscription.loadError')} {loadError}</div>
      </div>
    )
  }
  if (!overview) return <div className={`${pad}text-sm font-semibold text-text-dim`}>{t('common.loading')}</div>

  const current = { features: overview.entitlements.features, limits: overview.entitlements.limits }
  const change: PlanChange | null = target ? comparePlans(current, target) : null
  const currentName = overview.planName ?? (overview.planCode ? overview.planCode : t(tenant.subscription === 'PREMIUM' ? 'settings.subscriptionPremium' : 'settings.subscriptionFree'))

  return (
    <div className={`${pad}flex flex-col gap-6 max-w-[1100px]`}>
      {back}

      <section aria-labelledby="current-plan-title" className="rounded-2xl border border-border-strong bg-bg-card p-4 sm:p-5 flex flex-col gap-2">
        <h2 id="current-plan-title" className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('mySubscription.currentPlan')}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display text-xl sm:text-2xl break-words font-extrabold">{currentName}</span>
          {overview.planCode === null && <span className="text-xs font-semibold text-text-dim">{t('mySubscription.legacyHint')}</span>}
        </div>
        <p className="text-sm font-medium text-text-muted">
          {overview.periodEnd ? t('mySubscription.validUntil', { date: formatDateTime(overview.periodEnd, locale, { dateStyle: 'medium' }) }) : t('mySubscription.noExpiry')}
        </p>
      </section>

      {notice && <div role="status" className="rounded-xl bg-succes-bg text-succes-text text-sm font-bold px-4 py-3">{notice}</div>}
      {actionError && !target && <div role="alert" className="text-[13px] font-semibold text-danger">{actionError}</div>}

      {overview.pending && (
        <section aria-label={t('mySubscription.pendingTitle')} className="rounded-2xl border border-border-strong bg-bg-elevated p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 flex-none text-alerte-text" />
            <div className="flex flex-col gap-1">
              <span className="font-extrabold">{t('mySubscription.pendingTitle')}</span>
              <span className="text-sm font-medium text-text-muted">
                {t('mySubscription.pendingText', { plan: planName(overview.pending.toPlan), date: formatDateTime(overview.pending.createdAt, locale, { dateStyle: 'medium' }) })}
              </span>
            </div>
          </div>
          {isOwner && <Button variant="secondary" loading={busy} onClick={() => cancel(overview.pending!)}>{t('mySubscription.cancelRequest')}</Button>}
        </section>
      )}

      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <h2 id="plans-title" className="font-display text-base font-extrabold">{t('mySubscription.plansTitle')}</h2>
        {!isOwner && <p className="text-xs font-semibold text-text-dim">{t('mySubscription.ownerOnly')}</p>}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = plan.code === overview.planCode
            const isPending = overview.pending?.toPlan === plan.code
            return (
              <article key={plan.code} aria-label={plan.name} className={`rounded-2xl border-2 p-4 sm:p-5 min-w-0 flex flex-col gap-4 ${isCurrent ? 'border-terracotta bg-bg-elevated' : 'border-border bg-bg-card'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-extrabold">{plan.name}</h3>
                  {isCurrent && <span className="rounded-full bg-succes-bg text-succes-text px-2.5 py-1 text-xs font-extrabold">{t('mySubscription.current')}</span>}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {SHOWN_FEATURES.map((feature) => {
                    const included = plan.features.includes(feature)
                    return (
                      <li key={feature} className={`flex items-center gap-2 text-sm font-semibold ${included ? 'text-text' : 'text-text-dim'}`}>
                        {included ? <Check size={16} className="flex-none text-succes-text" aria-label={t('mySubscription.included')} /> : <Minus size={16} className="flex-none" aria-label={t('mySubscription.notIncluded')} />}
                        {t(`mySubscription.features.${feature}`)}
                      </li>
                    )
                  })}
                </ul>
                <dl className="flex flex-col gap-1 border-t border-border pt-3">
                  {displayedLimits(plan).map(({ quota, value }) => (
                    <div key={quota} className="flex justify-between gap-2 text-sm min-w-0">
                      <dt className="min-w-0 break-words font-medium text-text-muted">{t(`mySubscription.limits.${quota}`)}</dt>
                      <dd className="text-right flex-none font-extrabold">{quotaText(value)}</dd>
                    </div>
                  ))}
                </dl>
                {isOwner && !isCurrent && (
                  <Button className="w-full"
                    variant={isPending ? 'secondary' : 'accent'}
                    disabled={isPending}
                    onClick={() => {
                      setNotice(null)
                      setActionError(null)
                      setTarget(plan)
                    }}
                  >
                    {isPending ? t('mySubscription.requested') : t('mySubscription.requestPlan')}
                  </Button>
                )}
              </article>
            )
          })}
        </div>
        <p className="text-xs font-medium text-text-dim">{t('mySubscription.noPaymentNote')}</p>
      </section>

      {overview.recent.length > 0 && (
        <section aria-labelledby="history-title" className="flex flex-col gap-3">
          <h2 id="history-title" className="font-display text-base font-extrabold">{t('mySubscription.historyTitle')}</h2>
          <ul className="flex flex-col gap-2">
            {overview.recent.map((request) => (
              <li key={request.id} className="rounded-xl border border-border bg-bg-card px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-bold">{t('mySubscription.historyLine', { plan: planName(request.toPlan), date: formatDateTime(request.createdAt, locale, { dateStyle: 'medium' }) })}</span>
                  <span className="text-xs font-extrabold text-text-muted">{t(`mySubscription.status.${request.status}`)}</span>
                </div>
                {request.resolutionNote && <p className="text-sm font-medium text-text-muted">{request.resolutionNote}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        width={560}
        title={target ? t('mySubscription.confirmTitle', { plan: target.name }) : undefined}
        subtitle={t('mySubscription.confirmSubtitle')}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setTarget(null)}>{t('onlineStore.create.cancel')}</Button>
            <Button loading={busy} onClick={send}>{t('mySubscription.sendRequest')}</Button>
          </div>
        }
      >
        {change && target && (
          <div className="flex flex-col gap-4">
            {!change.hasChanges && <p className="text-sm font-medium text-text-muted">{t('mySubscription.noDifference')}</p>}
            {change.gained.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-succes-text uppercase tracking-wide">{t('mySubscription.youGain')}</span>
                <ul className="flex flex-col gap-1">
                  {change.gained.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm font-semibold"><ArrowUp size={14} className="text-succes-text" />{t(`mySubscription.features.${f}`)}</li>
                  ))}
                </ul>
              </div>
            )}
            {(change.lost.length > 0 || change.limits.some((l) => l.worse)) && (
              <div role="note" className="flex flex-col gap-1.5 rounded-xl bg-alerte-bg px-4 py-3">
                <span className="text-xs font-bold text-alerte-text uppercase tracking-wide">{t('mySubscription.youLose')}</span>
                <ul className="flex flex-col gap-1">
                  {change.lost.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm font-semibold"><ArrowDown size={14} className="text-alerte-text" />{t(`mySubscription.features.${f}`)}</li>
                  ))}
                  {change.limits.filter((l) => l.worse).map((l) => (
                    <li key={l.quota} className="flex items-center gap-2 text-sm font-semibold">
                      <ArrowDown size={14} className="text-alerte-text" />
                      {t('mySubscription.limitLowered', { limit: t(`mySubscription.limits.${l.quota}`), from: quotaText(l.from), to: quotaText(l.to) })}
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-medium text-text-muted">{t('mySubscription.downgradeNote')}</p>
              </div>
            )}
            {change.limits.some((l) => !l.worse) && (
              <ul className="flex flex-col gap-1">
                {change.limits.filter((l) => !l.worse).map((l) => (
                  <li key={l.quota} className="flex items-center gap-2 text-sm font-semibold">
                    <ArrowUp size={14} className="text-succes-text" />
                    {t('mySubscription.limitRaised', { limit: t(`mySubscription.limits.${l.quota}`), from: quotaText(l.from), to: quotaText(l.to) })}
                  </li>
                ))}
              </ul>
            )}
            <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
              {t('mySubscription.messageLabel')}
              <textarea
                value={message}
                maxLength={500}
                rows={3}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-xl border border-border-strong bg-bg px-3.5 py-2.5 font-medium normal-case tracking-normal text-text outline-none focus:border-primary"
              />
            </label>
            {actionError && <div role="alert" className="text-[13px] font-semibold text-danger">{actionError}</div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
