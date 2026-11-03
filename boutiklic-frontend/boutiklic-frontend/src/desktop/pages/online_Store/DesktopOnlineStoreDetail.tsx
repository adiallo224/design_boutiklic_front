import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, CircleAlert, ExternalLink } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, isSupportedLocale } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { ApiError, toErrorMessage } from '../../../lib/apiClient'
import { STOREFRONT_ERROR, storefrontsApi, type PublicationBlocker, type StorefrontLocale, type StorefrontResponse } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import Input from '../../components/Input'
import OnlineStoreStatusBadge from '../../components/OnlineStoreStatusBadge'
import { useTopBar } from '../../hooks/useTopBar'
import { primaryHostname } from '../../../lib/storefrontDomain'
import OnlineStoreAppearanceTab from './OnlineStoreAppearanceTab'
import OnlineStoreDeliveryTab from './OnlineStoreDeliveryTab'
import OnlineStoreProductsTab from './OnlineStoreProductsTab'

const BLOCKERS: PublicationBlocker[] = ['CONTACT_REQUIRED', 'PRODUCT_REQUIRED']

export type DetailTab = 'info' | 'appearance' | 'products' | 'delivery'
const TABS: DetailTab[] = ['info', 'appearance', 'products', 'delivery']
/** Onglet demandé dans l'adresse (?tab=products); tout le reste retombe sur « Informations ». */
export const parseTab = (value: string | null): DetailTab => (TABS as string[]).includes(value ?? '') ? (value as DetailTab) : 'info'
/** Où corriger chaque point bloquant de la liste de contrôle. */
const BLOCKER_TAB: Record<PublicationBlocker, DetailTab> = { CONTACT_REQUIRED: 'info', PRODUCT_REQUIRED: 'products' }

/** Détail d'un site : adresse, état, liste de contrôle de publication et informations modifiables. L'adresse ne change jamais (un lien partagé ne doit pas casser). */
export default function DesktopOnlineStoreDetail() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { tenant } = useTenant()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  const goToTab = (next: DetailTab) => setSearchParams(next === 'info' ? {} : { tab: next }, { replace: true })

  const [site, setSite] = useState<StorefrontResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [siteLocale, setSiteLocale] = useState<StorefrontLocale>('fr')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')

  useTopBar({ title: site?.name ?? t('onlineStore.title') }, [t, site?.name])

  const fill = useCallback((s: StorefrontResponse) => {
    setSite(s)
    setName(s.name)
    setSiteLocale(s.locale)
    setPhone(s.contactPhone ?? '')
    setWhatsapp(s.contactWhatsapp ?? '')
    setEmail(s.contactEmail ?? '')
  }, [])

  useEffect(() => {
    setIsLoading(true)
    setLoadError(null)
    storefrontsApi
      .get(id)
      .then(fill)
      .catch((e) => setLoadError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [id, fill])

  /** Relit le site pour rafraîchir la liste de contrôle (ex. après avoir publié un article) SANS toucher au formulaire en cours de saisie. */
  const refreshSite = useCallback(() => {
    storefrontsApi.get(id).then(setSite).catch(() => undefined)
  }, [id])

  /** Exécute une action serveur ; en cas d'erreur, un message clair (offre sans vente en ligne = 402) et l'état de l'écran reste celui du serveur. */
  const run = async (action: () => Promise<StorefrontResponse | void>, after?: () => void) => {
    setBusy(true)
    setActionError(null)
    setSaved(false)
    try {
      const result = await action()
      if (result) fill(result)
      after?.()
    } catch (e) {
      setActionError(e instanceof ApiError && e.errorCode === STOREFRONT_ERROR.notIncluded ? t('onlineStore.errors.notIncluded') : toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <button type="button" onClick={() => navigate('/boutique-en-ligne')} className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text self-start">
      <ArrowLeft size={16} />
      {t('onlineStore.detail.back')}
    </button>
  )

  if (isLoading) return <div className="p-4 sm:p-8 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
  if (loadError || !site) {
    return (
      <div className="p-4 sm:p-8 flex flex-col gap-4">
        {back}
        <div role="alert" className="text-[13px] font-semibold text-danger">{t('onlineStore.loadError')} {loadError}</div>
      </div>
    )
  }

  const host = primaryHostname(site)
  const isArchived = site.status === 'ARCHIVED'
  const isSuspended = site.status === 'SUSPENDED'
  const isPublished = site.status === 'PUBLISHED'
  const blockers = site.publicationBlockers
  const dirty =
    name.trim() !== site.name || siteLocale !== site.locale || phone.trim() !== (site.contactPhone ?? '') || whatsapp.trim() !== (site.contactWhatsapp ?? '') || email.trim() !== (site.contactEmail ?? '')

  const save = () =>
    run(
      () =>
        storefrontsApi.update(site.id, {
          name: name.trim(),
          locale: siteLocale,
          contactPhone: phone.trim() || undefined,
          contactWhatsapp: whatsapp.trim() || undefined,
          contactEmail: email.trim() || undefined,
        }),
      () => setSaved(true),
    )

  const archive = () => {
    if (!window.confirm(t('onlineStore.detail.archiveConfirm'))) return
    return run(
      async () => {
        await storefrontsApi.archive(site.id)
      },
      () => navigate('/boutique-en-ligne'),
    )
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6 max-w-[880px]">
      {back}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-xl sm:text-2xl font-extrabold break-words">{site.name}</h1>
            <OnlineStoreStatusBadge status={site.status} />
          </div>
          {host && (
            <a href={`https://${host}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
              {host}
              <ExternalLink size={14} />
            </a>
          )}
          {site.publishedAt && <span className="text-xs font-semibold text-text-dim">{t('onlineStore.detail.publishedOn', { date: formatDateTime(site.publishedAt, locale, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>}
        </div>

        {!isArchived && !isSuspended && (
          <div className="flex flex-wrap gap-3">
            {isPublished ? (
              <Button variant="secondary" loading={busy} onClick={() => run(() => storefrontsApi.unpublish(site.id))}>{t('onlineStore.detail.unpublish')}</Button>
            ) : (
              <Button variant="accent" loading={busy} disabled={blockers.length > 0} onClick={() => run(() => storefrontsApi.publish(site.id))} title={blockers.length > 0 ? t('onlineStore.detail.publishBlocked') : undefined}>
                {t('onlineStore.detail.publish')}
              </Button>
            )}
          </div>
        )}
      </div>

      {isSuspended && <div role="note" className="text-[13px] font-semibold text-danger bg-alerte-bg rounded-xl px-4 py-3">{t('onlineStore.detail.suspendedNotice')}</div>}
      {actionError && <div role="alert" className="text-[13px] font-semibold text-danger">{actionError}</div>}

      {!isPublished && !isArchived && !isSuspended && (
        <section aria-labelledby="checklist-title" className="rounded-2xl border border-border-strong bg-bg-card p-5 flex flex-col gap-3">
          <h2 id="checklist-title" className="font-display text-base font-extrabold">{t('onlineStore.detail.checklist')}</h2>
          <ul className="flex flex-col gap-2">
            {BLOCKERS.map((b) => {
              const missing = blockers.includes(b)
              return (
                <li key={b} className={`flex items-start gap-2.5 text-sm font-semibold ${missing ? 'text-text' : 'text-succes-text'}`}>
                  {missing ? <CircleAlert size={18} className="text-alerte-text flex-none mt-0.5" /> : <Check size={18} className="flex-none mt-0.5" />}
                  <span className="flex-1">{t(missing ? `onlineStore.detail.blockers.${b}` : `onlineStore.detail.done.${b}`)}</span>
                  {missing && tab !== BLOCKER_TAB[b] && (
                    <button type="button" onClick={() => goToTab(BLOCKER_TAB[b])} className="text-xs font-extrabold text-primary hover:underline ">
                      {t(`onlineStore.detail.fix.${BLOCKER_TAB[b]}`)}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {blockers.length === 0 && <p className="text-xs font-semibold text-succes-text">{t('onlineStore.detail.ready')}</p>}
        </section>
      )}

      {!isArchived && (
        <div role="tablist" aria-label={t('onlineStore.detail.tabs.label')} className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((id2) => (
            <button
              key={id2}
              type="button"
              role="tab"
              id={`tab-${id2}`}
              aria-selected={tab === id2}
              aria-controls={`panel-${id2}`}
              onClick={() => goToTab(id2)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-extrabold -mb-px border-b-2 whitespace-nowrap flex-none ${tab === id2 ? 'border-terracotta text-text' : 'border-transparent text-text-muted hover:text-text'}`}
            >
              {t(`onlineStore.detail.tabs.${id2}`)}
            </button>
          ))}
        </div>
      )}

      {(tab === 'info' || isArchived) && (
      <div role="tabpanel" id="panel-info" aria-labelledby="tab-info" className="flex flex-col gap-6">
      <section aria-labelledby="info-title" className="rounded-2xl border border-border-strong bg-bg-card p-5 flex flex-col gap-4">
        <h2 id="info-title" className="font-display text-base font-extrabold">{t('onlineStore.detail.info')}</h2>
        <Input label={t('onlineStore.create.name')} value={name} maxLength={120} disabled={isArchived} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('onlineStore.create.slug')}</span>
          <span className="h-11 px-3.5 rounded-xl border border-border bg-bg-elevated font-semibold flex items-center text-text-muted">{site.slug}</span>
          <span className="text-xs font-medium text-text-dim">{t('onlineStore.detail.slugFixed')}</span>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
          {t('onlineStore.create.locale')}
          <select
            value={siteLocale}
            disabled={isArchived}
            onChange={(e) => setSiteLocale(e.target.value as StorefrontLocale)}
            className="h-11 rounded-xl border border-border-strong bg-bg px-3 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label={t('onlineStore.create.phone')} value={phone} maxLength={30} inputMode="tel" disabled={isArchived} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t('onlineStore.create.whatsapp')} value={whatsapp} maxLength={30} inputMode="tel" disabled={isArchived} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        <Input label={t('onlineStore.create.email')} type="email" value={email} maxLength={255} disabled={isArchived} onChange={(e) => setEmail(e.target.value)} />
        {!isArchived && (
          <div className="flex items-center gap-3">
            <Button onClick={save} loading={busy} disabled={!dirty || name.trim() === ''}>{t('onlineStore.detail.save')}</Button>
            {saved && !dirty && <span role="status" className="text-sm font-bold text-succes-text">{t('onlineStore.detail.saved')}</span>}
          </div>
        )}
      </section>

      {!isArchived && (
        <section className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-bold">{t('onlineStore.detail.archive')}</span>
            <span className="text-xs font-medium text-text-dim max-w-[520px]">{t('onlineStore.detail.archiveHint')}</span>
          </div>
          <Button variant="danger" loading={busy} onClick={archive}>{t('onlineStore.detail.archive')}</Button>
        </section>
      )}
      </div>
      )}

      {tab === 'appearance' && !isArchived && (
        <div role="tabpanel" id="panel-appearance" aria-labelledby="tab-appearance">
          <OnlineStoreAppearanceTab siteId={site.id} siteName={site.name} disabled={isSuspended} />
        </div>
      )}
      {tab === 'products' && !isArchived && (
        <div role="tabpanel" id="panel-products" aria-labelledby="tab-products">
          <OnlineStoreProductsTab siteId={site.id} decimals={tenant.sellingPriceDecimals} onChanged={refreshSite} />
        </div>
      )}
      {tab === 'delivery' && !isArchived && (
        <div role="tabpanel" id="panel-delivery" aria-labelledby="tab-delivery">
          <OnlineStoreDeliveryTab siteId={site.id} currency={tenant.currency} decimals={tenant.sellingPriceDecimals} />
        </div>
      )}
    </div>
  )
}
