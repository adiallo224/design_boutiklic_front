import type { QueuedOperation } from '@boutiklic/shared'

/** Traduit une opération en attente (n'importe quel type, cf. lib/syncEngine.ts) en un libellé
 *  lisible — le payload est opaque pour le moteur générique, seuls les écrans qui l'affichent ont
 *  besoin de savoir le décoder (cf. SyncPending.tsx, DesktopSettings.tsx). Un type inconnu (futur
 *  type d'opération pas encore géré ici) retombe sur un libellé générique plutôt que de planter. */
export function describeOperation(
  op: QueuedOperation,
  t: (key: string, options?: Record<string, unknown>) => string,
  formatCurrency: (n: number) => string,
): { icon: string; title: string; subtitle: string } {
  try {
    const payload = JSON.parse(op.payload) as Record<string, unknown>
    switch (op.type) {
      case 'COMPLETE_SALE': {
        const lines = Array.isArray(payload.lines) ? payload.lines.length : 0
        const payments = Array.isArray(payload.payments) ? (payload.payments as { amount?: unknown }[]) : []
        const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        return { icon: '🧾', title: t('settings.saleLinesCount', { count: lines }), subtitle: formatCurrency(total) }
      }
      case 'CREATE_PRODUCT':
      case 'UPDATE_PRODUCT':
        return { icon: '📦', title: (payload.name as string) || t('settings.operationTypeProduct'), subtitle: t('settings.operationTypeProduct') }
      case 'CREATE_DEBT':
        return { icon: '🤝', title: (payload.customerName as string) || t('settings.operationTypeDebt'), subtitle: t('settings.operationTypeDebt') }
      case 'PAY_DEBT':
        return { icon: '💳', title: t('settings.operationTypeDebtPayment'), subtitle: formatCurrency(Number(payload.amount) || 0) }
      case 'ADJUST_STOCK':
      case 'CHANGE_ALERT_THRESHOLD':
        return { icon: '📊', title: t('settings.operationTypeStock'), subtitle: '' }
      case 'CREATE_STOCK_INTAKE':
        return { icon: '🚚', title: t('settings.operationTypeIntake'), subtitle: '' }
      case 'CREATE_SUPPLIER':
      case 'PAY_SUPPLIER':
        return { icon: '🏭', title: (payload.name as string) || t('settings.operationTypeSupplier'), subtitle: '' }
      default:
        return { icon: '⏳', title: t('settings.operationTypeGeneric'), subtitle: '' }
    }
  } catch {
    return { icon: '⏳', title: t('settings.operationTypeGeneric'), subtitle: '' }
  }
}
