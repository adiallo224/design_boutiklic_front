import { syncEngine } from './syncEngine'
import type { PaymentSplit } from './salesApi'

export { getSyncLog, type SyncLogEntry } from './salesSyncLog'

/**
 * File d'attente hors-ligne pour les ventes (écran B1-B5, "Encaissez... même sans réseau").
 *
 * Enveloppe fine autour du SyncEngine partagé (cf. lib/syncEngine.ts) : la vente hors ligne est
 * poussée en UNE opération atomique (type COMPLETE_SALE, cf. CompleteSaleSyncOperationHandlerAdapter
 * côté serveur) plutôt que rejouée en trois appels REST successifs (create → addLine×N → complete)
 * comme le fait le flux en ligne (CashierFlow.tsx). Ce choix diverge de l'ancienne logique de reprise
 * remoteSaleId/linesSubmitted : elle protégeait contre la duplication d'une vente si le réseau
 * coupait entre deux des trois appels. Ici il n'y a qu'UN SEUL appel HTTP (POST /sync/push), déjà
 * protégé par IdempotencyFilter (X-Idempotency-Key = operationId, cf. shared) — un rejeu après
 * coupure retourne la réponse déjà enregistrée sans jamais dupliquer la vente ni laisser de
 * brouillon partiel côté serveur.
 *
 * La file elle-même (lecture, retry, discard, bannière "en attente") n'est plus spécifique aux
 * ventes — cf. hooks/useOutbox.ts et pages/store_Settings/SyncPending.tsx, qui lisent directement
 * syncEngine et couvrent toutes les opérations en attente (catalogue, dettes, stock, fournisseurs).
 */

export interface QueuedSaleLine {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  barcode?: string
  promotionId?: string
  catalogPrice?: number
}

export async function enqueueSale(input: {
  lines: QueuedSaleLine[]
  currency: string
  payments: PaymentSplit[]
  debtCustomerName?: string
  debtCustomerPhone?: string
}): Promise<void> {
  // `soldAt` : le moment de la vente sur l'appareil. Le serveur résout le taux de TVA à CETTE date, pas à celle de la synchronisation
  // (une vente faite hors ligne mardi et synchronisée jeudi garde le taux de mardi).
  await syncEngine.enqueue('COMPLETE_SALE', JSON.stringify({ ...input, soldAt: new Date().toISOString() }))
}
