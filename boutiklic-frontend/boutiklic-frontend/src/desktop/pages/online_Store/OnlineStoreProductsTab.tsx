import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeOff, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { DEFAULT_LOCALE, formatMoney, isSupportedLocale } from '@boutiklic/shared'
import { toErrorMessage } from '../../../lib/apiClient'
import { storefrontsApi, type StorefrontProductResponse } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import AddProductsModal from './AddProductsModal'
import EditPublishedProductModal from './EditPublishedProductModal'

interface Props {
  siteId: string
  decimals: number
  /** Appelé après tout changement d'articles publiés: la liste de contrôle de publication du site (au moins un article actif) doit être relue. */
  onChanged: () => void
}

/** Onglet « Articles » d'un site : ce que la vitrine expose, à quel prix. Le catalogue (stock, caisse) n'est jamais modifié ici, hormis la description qui est propre à l'article. */
export default function OnlineStoreProductsTab({ siteId, decimals, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [rows, setRows] = useState<StorefrontProductResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<StorefrontProductResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    storefrontsApi
      .listProducts(siteId)
      .then(setRows)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [siteId])

  useEffect(load, [load])

  const changed = () => {
    load()
    onChanged()
  }

  const money = (amount: number, currency: string) => formatMoney(amount, currency, locale, decimals)

  const remove = async (row: StorefrontProductResponse) => {
    if (!window.confirm(t('onlineStore.products.removeConfirm', { name: row.name }))) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await storefrontsApi.unpublishProducts(siteId, [row.productId])
      changed()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const publishAll = async () => {
    if (!window.confirm(t('onlineStore.products.publishAllConfirm'))) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await storefrontsApi.publishAllProducts(siteId)
      setNotice(t('onlineStore.products.publishedCount', { count: result.created }))
      changed()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const visible = rows.filter((r) => r.active).length

  if (isLoading) return <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-base font-extrabold">{t('onlineStore.products.title')}</h2>
          <p className="text-xs font-medium text-text-dim max-w-[560px]">{t('onlineStore.products.hint')}</p>
          {rows.length > 0 && <p className="text-xs font-bold text-text-muted mt-1">{t('onlineStore.products.counts', { visible, total: rows.length })}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled={busy} onClick={publishAll}>{t('onlineStore.products.publishAll')}</Button>
          <Button variant="accent" className="flex items-center gap-2" disabled={busy} onClick={() => setAddOpen(true)}>
            <Plus size={16} />
            {t('onlineStore.products.add')}
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      {notice && <div role="status" className="text-[13px] font-bold text-succes-text">{notice}</div>}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-10 flex flex-col items-center gap-3 text-center">
          <Package size={32} className="text-text-dim" />
          <div className="font-display text-lg font-extrabold">{t('onlineStore.products.empty')}</div>
          <div className="text-sm font-semibold text-text-muted max-w-[480px]">{t('onlineStore.products.emptyHint')}</div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border-strong bg-bg-card">
          {rows.map((row) => (
            <li key={row.productId} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${row.active ? '' : 'opacity-70'}`}>
              {row.imageUrl ? <img src={row.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-none" /> : <span className="w-11 h-11 rounded-lg bg-bg-elevated flex-none" aria-hidden="true" />}
              <div className="flex-1 basis-[140px] min-w-0 flex flex-col gap-0.5">
                <span className="font-extrabold break-words">{row.name}</span>
                {!row.active && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-alerte-text">
                    <EyeOff size={13} />
                    {t('onlineStore.products.inactive')}
                  </span>
                )}
              </div>
              <div className="text-right flex flex-col gap-0.5 flex-none">
                <span className="font-extrabold tabular-nums">{money(row.effectivePrice, row.currency)}</span>
                {row.onlinePrice !== null ? (
                  <span className="text-xs font-semibold text-text-dim">{t('onlineStore.products.catalogPrice', { price: money(row.catalogPrice, row.currency) })}</span>
                ) : (
                  <span className="text-xs font-semibold text-text-dim">{t('onlineStore.products.sameAsCatalog')}</span>
                )}
                {row.compareAtPrice !== null && <span className="text-xs font-semibold text-text-dim line-through tabular-nums">{money(row.compareAtPrice, row.currency)}</span>}
              </div>
              <div className="flex gap-1 flex-none">
                <Button variant="ghost" className="!px-3" aria-label={`${t('onlineStore.delivery.edit')} ${row.name}`} onClick={() => setEditing(row)}><Pencil size={16} /></Button>
                <Button variant="ghost" className="!px-3 text-danger" aria-label={`${t('onlineStore.products.remove')} ${row.name}`} disabled={busy} onClick={() => remove(row)}><Trash2 size={16} /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddProductsModal
        open={addOpen}
        siteId={siteId}
        publishedIds={new Set(rows.map((r) => r.productId))}
        decimals={decimals}
        onClose={() => setAddOpen(false)}
        onPublished={(count) => {
          setAddOpen(false)
          setNotice(t('onlineStore.products.publishedCount', { count }))
          changed()
        }}
      />
      <EditPublishedProductModal
        open={editing !== null}
        siteId={siteId}
        product={editing}
        decimals={decimals}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          changed()
        }}
      />
    </div>
  )
}
