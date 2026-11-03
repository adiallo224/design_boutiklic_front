import { useTranslation } from 'react-i18next'
import type { StorefrontStatus } from '../../lib/storefrontsApi'

const STATUS_CLASSES: Record<StorefrontStatus, string> = {
  DRAFT: 'bg-alerte-bg text-alerte-text',
  PUBLISHED: 'bg-succes-bg text-succes-text',
  SUSPENDED: 'bg-alerte-bg text-danger',
  ARCHIVED: 'bg-bg-elevated text-text-muted',
}

/** Pastille d'état d'un site e-commerce (liste et détail). */
export default function OnlineStoreStatusBadge({ status }: { status: StorefrontStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS_CLASSES[status]}`}>
      {t(`onlineStore.status.${status}`)}
    </span>
  )
}
