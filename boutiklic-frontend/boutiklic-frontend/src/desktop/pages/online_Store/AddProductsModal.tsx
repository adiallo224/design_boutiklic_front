import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, formatMoney, isSupportedLocale } from '@boutiklic/shared'
import { toErrorMessage } from '../../../lib/apiClient'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { storefrontsApi } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import Modal from '../../components/Modal'

const SEARCH_DELAY_MS = 300
/** Plafond du serveur par appel de publication. */
export const MAX_PUBLISH_PER_CALL = 500

interface Props {
  open: boolean
  siteId: string
  /** Articles déjà publiés sur ce site (ils ne sont pas proposés une seconde fois). */
  publishedIds: Set<string>
  decimals: number
  onClose: () => void
  onPublished: (count: number) => void
}

/** Choix d'articles du catalogue à publier sur le site. Seuls les articles actifs sont proposés; le prix en ligne se règle ensuite article par article (par défaut: prix du catalogue). */
export default function AddProductsModal({ open, siteId, publishedIds, decimals, onClose, onPublished }: Props) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductResponse[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestSearch = useRef(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(new Set())
    setError(null)
  }, [open])

  // Recherche après une courte pause; une réponse tardive d'une recherche périmée est ignorée.
  useEffect(() => {
    if (!open) return
    const ticket = ++latestSearch.current
    setIsLoading(true)
    const timer = window.setTimeout(() => {
      productsApi
        .search({ query: query.trim() || undefined })
        .then((list) => ticket === latestSearch.current && setResults(list))
        .catch((e) => ticket === latestSearch.current && setError(toErrorMessage(e)))
        .finally(() => ticket === latestSearch.current && setIsLoading(false))
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [open, query])

  const candidates = useMemo(() => results.filter((p) => p.active && !publishedIds.has(p.id)), [results, publishedIds])
  const allShownSelected = candidates.length > 0 && candidates.every((p) => selected.has(p.id))

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current)
      for (const p of candidates) {
        if (allShownSelected) next.delete(p.id)
        else next.add(p.id)
      }
      return next
    })

  const publish = async () => {
    if (selected.size === 0 || saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await storefrontsApi.publishProducts(siteId, [...selected].map((productId) => ({ productId })))
      onPublished(result.created)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const tooMany = selected.size > MAX_PUBLISH_PER_CALL

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={680}
      title={t('onlineStore.products.addTitle')}
      subtitle={t('onlineStore.products.addSubtitle')}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-sm font-bold text-text-muted">{t('onlineStore.products.selectedCount', { count: selected.size })}</span>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onClose}>{t('onlineStore.create.cancel')}</Button>
            <Button onClick={publish} loading={saving} disabled={selected.size === 0 || tooMany}>{t('onlineStore.products.publishSelected')}</Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('onlineStore.products.searchPlaceholder')}
          aria-label={t('onlineStore.products.searchPlaceholder')}
          className="h-11 w-full rounded-xl border border-border-strong bg-bg px-3.5 font-semibold outline-none focus:border-primary"
        />
        {tooMany && <div role="alert" className="text-[13px] font-semibold text-danger">{t('onlineStore.products.tooMany', { max: MAX_PUBLISH_PER_CALL })}</div>}
        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}

        {candidates.length > 0 && (
          <label className="flex items-center gap-2.5 text-sm font-bold text-text-muted">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="w-4 h-4 flex-none accent-primary" />
            {t('onlineStore.products.selectAllShown', { count: candidates.length })}
          </label>
        )}

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border max-h-[380px] overflow-y-auto">
          {isLoading && candidates.length === 0 ? (
            <li className="px-4 py-6 text-sm font-semibold text-text-dim text-center">{t('common.loading')}</li>
          ) : candidates.length === 0 ? (
            <li className="px-4 py-6 text-sm font-semibold text-text-dim text-center">{t('onlineStore.products.nothingToAdd')}</li>
          ) : (
            candidates.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-bg-elevated">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 flex-none accent-primary" />
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-none" /> : <span className="w-9 h-9 rounded-lg bg-bg-elevated flex-none" aria-hidden="true" />}
                  <span className="flex-1 min-w-0 font-semibold break-words">{p.name}</span>
                  <span className="text-xs sm:text-sm font-bold tabular-nums text-text-muted flex-none">{formatMoney(p.salePrice, p.currency, locale, decimals)}</span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  )
}
