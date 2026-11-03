import { useTranslation } from 'react-i18next'
import type { StockCountStatus } from '@boutiklic/shared'

const STATUS_CLASSES: Record<StockCountStatus, string> = {
  COUNTING: 'bg-info-bg text-primary',
  PENDING_REVIEW: 'bg-alerte-bg text-alerte-text',
  VALIDATED: 'bg-succes-bg text-succes-text',
  CANCELLED: 'bg-bg-elevated text-text-muted',
}

/** Pastille de statut d'un inventaire physique (liste et détail). */
export default function StockCountStatusBadge({ status }: { status: StockCountStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS_CLASSES[status]}`}>
      {t(`stockCounts.status.${status}`)}
    </span>
  )
}
