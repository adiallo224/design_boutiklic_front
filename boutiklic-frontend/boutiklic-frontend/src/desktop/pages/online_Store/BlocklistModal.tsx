import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { DEFAULT_LOCALE, formatDateTime, isSupportedLocale } from '@boutiklic/shared'
import { toErrorMessage } from '../../../lib/apiClient'
import { onlineOrdersApi, type BlocklistEntry } from '../../../lib/onlineOrdersApi'
import Modal from '../../components/Modal'

interface Props {
  open: boolean
  onClose: () => void
}

/** Acheteurs refusés (téléphones et connexions bloqués): consulter la liste et lever un blocage posé par erreur. */
export default function BlocklistModal({ open, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [entries, setEntries] = useState<BlocklistEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    onlineOrdersApi
      .blocklist()
      .then(setEntries)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const unblock = async (entry: BlocklistEntry) => {
    if (!window.confirm(t('onlineOrders.blocklist.unblockConfirm', { value: entry.value }))) return
    setRemoving(entry.id)
    setError(null)
    try {
      await onlineOrdersApi.unblock(entry.id)
      setEntries((current) => current.filter((e) => e.id !== entry.id))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={680} title={t('onlineOrders.blocklist.title')} subtitle={t('onlineOrders.blocklist.subtitle')}>
      {error && <div role="alert" className="text-[13px] font-semibold text-danger mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm font-semibold text-text-muted">{t('onlineOrders.blocklist.empty')}</div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-3 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="font-extrabold break-all">
                  {entry.kind === 'PHONE' ? entry.value : t('onlineOrders.blocklist.connection')}
                </div>
                <div className="text-xs font-semibold text-text-muted break-words">
                  {t(`onlineOrders.blocklist.kind.${entry.kind}`)} · {formatDateTime(entry.createdAt, locale, { dateStyle: 'medium' })}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </div>
              </div>
              <button
                type="button"
                aria-label={t('onlineOrders.blocklist.unblock')}
                title={t('onlineOrders.blocklist.unblock')}
                disabled={removing === entry.id}
                onClick={() => unblock(entry)}
                className="rounded-full p-2 flex-none hover:bg-bg-elevated text-text-muted disabled:opacity-40"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
