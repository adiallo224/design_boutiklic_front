import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Globe, Plus } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, isSupportedLocale } from '@boutiklic/shared'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { useTenant } from '../../../hooks/useTenant'
import { toErrorMessage } from '../../../lib/apiClient'
import { primaryHostname } from '../../../lib/storefrontDomain'
import { storefrontsApi, type StorefrontResponse } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import OnlineStoreStatusBadge from '../../components/OnlineStoreStatusBadge'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import { useTopBar } from '../../hooks/useTopBar'
import CreateOnlineStoreModal from './CreateOnlineStoreModal'

/** Boutique en ligne — liste des sites et création d'un nouveau (module storefront). Réservé au propriétaire (STOREFRONT_MANAGE) et aux offres qui incluent la vente en ligne. */
export default function DesktopOnlineStores() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const entitlements = useEntitlements()
  const { tenant } = useTenant()

  useTopBar({ title: t('onlineStore.title') }, [t])

  const [sites, setSites] = useState<StorefrontResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const included = entitlements.has('ONLINE_STORE')

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    storefrontsApi
      .list()
      .then(setSites)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (entitlements.loaded && included) load()
    else if (entitlements.loaded) setIsLoading(false)
  }, [entitlements.loaded, included, load])

  const activeSites = sites.filter((s) => s.status !== 'ARCHIVED')
  const siteLimit = entitlements.limit('MAX_STOREFRONTS')
  // Une boutique sans l'option « plusieurs sites » n'en a qu'un ; avec elle, la limite chiffrée de l'offre (absente = illimité).
  const reachedLimit = activeSites.length >= 1 && !entitlements.has('MULTI_STOREFRONT') ? 'multi' : siteLimit !== null && activeSites.length >= siteLimit ? 'limit' : null

  const columns: TableColumn<StorefrontResponse>[] = [
    { key: 'name', label: t('onlineStore.columns.name'), render: (s) => <span className="font-extrabold">{s.name}</span> },
    {
      key: 'address',
      label: t('onlineStore.columns.address'),
      render: (s) => {
        const host = primaryHostname(s)
        return host ? (
          <a
            href={`https://${host}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            {host}
            <ExternalLink size={13} />
          </a>
        ) : (
          '—'
        )
      },
    },
    { key: 'status', label: t('onlineStore.columns.status'), render: (s) => <OnlineStoreStatusBadge status={s.status} /> },
    {
      key: 'published',
      label: t('onlineStore.columns.published'),
      render: (s) => (s.publishedAt ? formatDateTime(s.publishedAt, locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—'),
    },
  ]

  if (entitlements.loaded && !included) {
    return (
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-6 sm:p-10 flex flex-col items-center gap-3 text-center">
          <Globe size={32} className="text-text-dim" />
          <div className="font-display text-lg font-extrabold">{t('onlineStore.notIncludedTitle')}</div>
          <div className="text-sm font-semibold text-text-muted max-w-[480px]">{t('onlineStore.notIncludedText')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm font-semibold text-text-muted max-w-[640px] min-w-0 flex-1 basis-[240px]">{t('onlineStore.subtitle')}</p>
        <Button onClick={() => setCreateOpen(true)} variant="accent" className="flex items-center gap-2" disabled={reachedLimit !== null}>
          <Plus size={16} />
          {t('onlineStore.newSite')}
        </Button>
      </div>

      {reachedLimit && (
        <div role="note" className="text-[13px] font-semibold text-alerte-text bg-alerte-bg rounded-xl px-4 py-3">
          {reachedLimit === 'multi' ? t('onlineStore.multiNotIncluded') : t('onlineStore.limitReached', { limit: siteLimit })}
        </div>
      )}

      {error && <div className="text-[13px] font-semibold text-danger">{t('onlineStore.loadError')} {error}</div>}

      {isLoading || !entitlements.loaded ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-6 sm:p-10 flex flex-col items-center gap-3 text-center">
          <Globe size={32} className="text-text-dim" />
          <div className="font-display text-lg font-extrabold">{t('onlineStore.empty')}</div>
          <div className="text-sm font-semibold text-text-muted">{t('onlineStore.emptyHint')}</div>
        </div>
      ) : (
        <Table columns={columns} rows={sites} getRowKey={(s) => s.id} onRowClick={(s) => navigate(`/boutique-en-ligne/${s.id}`)} />
      )}

      <CreateOnlineStoreModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultPhone={tenant.phone}
        onCreated={(site) => {
          setCreateOpen(false)
          navigate(`/boutique-en-ligne/${site.id}`)
        }}
      />
    </div>
  )
}
