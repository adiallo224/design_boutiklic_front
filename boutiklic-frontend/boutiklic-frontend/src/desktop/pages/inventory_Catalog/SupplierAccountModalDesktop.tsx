import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Phone, Truck } from 'lucide-react'
import { formatNumber, formatDate, type Locale } from '@boutiklic/shared'
import { suppliersApi, type SupplierResponse, type SupplierTransactionResponse } from '../../../lib/suppliersApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import SupplierPaymentModalDesktop from './SupplierPaymentModalDesktop'

type LedgerFilter = 'ALL' | 'ARRIVALS' | 'PAYMENTS'

function movementVisual(tx: SupplierTransactionResponse, t: (key: string, options?: Record<string, unknown>) => string) {
  const isPayment = tx.type === 'PAYMENT'
  if (isPayment) {
    return { Icon: Check, bg: '#E6F1EC', color: '#0E7A52', title: tx.note ? `${t('inventoryCatalog.payment')} · ${tx.note}` : t('inventoryCatalog.payment'), positive: true }
  }
  return { Icon: Truck, bg: '#F4E7D2', color: '#8A6A21', title: tx.note ? `${t('inventoryCatalog.arrival')} · ${tx.note}` : t('inventoryCatalog.arrival'), positive: false }
}

/** Compte fournisseur (carnet complet) — même contenu que l'ancien panneau maître-détail de
 *  DesktopSuppliers.tsx, replacé dans une modale par la refonte W19bis (étude
 *  study/web/fournisseur_web_page_redesign), symétrique de ClientLedger dans DesktopClients.tsx.
 *  Ouvert depuis /fournisseurs/:id (carte fournisseur, ligne du registre) plutôt que via un
 *  panneau latéral toujours visible — la nouvelle page est un tableau de bord plein écran, pas un
 *  maître-détail. */
export default function SupplierAccountModalDesktop({ supplierId, locale, reloadToken, onClose, onPay, onChanged }: {
  supplierId: string | null
  locale: Locale
  /** Incrémenté par l'écran parent après un règlement réussi ailleurs (modale de paiement) pour
   *  rafraîchir ce carnet sans le fermer. */
  reloadToken: number
  onClose: () => void
  onPay: (supplier: SupplierResponse) => void
  /** Appelé après la correction d'un paiement, pour que l'écran parent recharge son registre. */
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const { formatCurrency } = useTenant()
  const [supplier, setSupplier] = useState<SupplierResponse | null>(null)
  const [transactions, setTransactions] = useState<SupplierTransactionResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('ALL')
  // Paiement en cours de correction (seuls les paiements sont modifiables : un arrivage est lié à son bon de stock).
  const [editingTx, setEditingTx] = useState<SupplierTransactionResponse | null>(null)

  const load = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const [s, tx] = await Promise.all([suppliersApi.getById(id), suppliersApi.getTransactions(id)])
      setSupplier(s)
      setTransactions(tx)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (supplierId) load(supplierId)
    setLedgerFilter('ALL')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, reloadToken])

  const rows = useMemo(() => {
    if (!supplier) return []
    let running = supplier.balanceDue
    return transactions.map((tx) => {
      const isPayment = tx.type === 'PAYMENT'
      const balance = running
      running = isPayment ? running + tx.amount : running - tx.amount
      return { tx, isPayment, balance }
    })
  }, [supplier, transactions])

  const visibleRows = rows.filter(({ isPayment }) => (ledgerFilter === 'ARRIVALS' ? !isPayment : ledgerFilter === 'PAYMENTS' ? isPayment : true))
  const totalReceived = rows.filter((r) => !r.isPayment).reduce((s, r) => s + r.tx.amount, 0)
  const totalSettled = rows.filter((r) => r.isPayment).reduce((s, r) => s + r.tx.amount, 0)
  const lastMovement = transactions[0]?.createdAt

  return (
    <Modal open={!!supplierId} onClose={onClose} width={880} title={supplier?.name ?? t('inventoryCatalog.suppliersTitle')}>
      {isLoading && !supplier ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : !supplier ? (
        <div className="text-sm font-semibold text-danger">{error ?? t('inventoryCatalog.supplierNotFound')}</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 -mt-1">
            <div className="amount text-sm text-text-muted flex-1 min-w-[140px] break-words">{[supplier.location, supplier.phone].filter(Boolean).join(' · ') || t('inventoryCatalog.noContactInfo')}</div>
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="min-h-9 px-3 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold flex-none">
                <Phone size={14} className="text-succes-text" />
                {t('inventoryCatalog.call')}
              </a>
            )}
            <button
              type="button"
              onClick={() => onPay(supplier)}
              disabled={supplier.balanceDue <= 0}
              className="min-h-9 px-4 rounded-xl bg-or hover:brightness-95 text-encre text-sm font-bold disabled:opacity-40 flex-none"
            >
              {t('inventoryCatalog.pay')}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-[1.3] basis-full sm:basis-[220px] min-w-0 p-4 rounded-2xl bg-alerte-bg border border-[#EED9AE] flex flex-col gap-1">
              <span className="break-words text-[11px] font-extrabold tracking-widest text-alerte-text">{t('inventoryCatalog.whatYouOweLabel')}</span>
              <span className="font-display amount text-2xl sm:text-[26px] break-all font-extrabold text-[#6B5410] leading-none">{formatCurrency(supplier.balanceDue)}</span>
            </div>
            <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-1">
              <span className="break-words text-[11px] font-extrabold tracking-wider text-text-dim">{t('inventoryCatalog.totalReceivedLabel')}</span>
              <span className="amount text-lg sm:text-xl break-all font-extrabold">{formatNumber(totalReceived, locale)}</span>
            </div>
            <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-1">
              <span className="break-words text-[11px] font-extrabold tracking-wider text-text-dim">{t('inventoryCatalog.totalSettledLabel')}</span>
              <span className="amount text-lg sm:text-xl break-all font-extrabold text-succes-text">{formatNumber(totalSettled, locale)}</span>
            </div>
            <div className="flex-1 basis-[130px] min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-1">
              <span className="break-words text-[11px] font-extrabold tracking-wider text-text-dim">{t('inventoryCatalog.lastActivityStatLabel')}</span>
              <span className="text-lg sm:text-xl font-extrabold">{lastMovement ? formatDate(new Date(lastMovement), locale, { day: 'numeric', month: 'short' }) : '—'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg-card flex flex-col overflow-hidden">
            <div className="flex-none flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-border bg-bg">
              <span className="text-[15px] font-extrabold">{t('inventoryCatalog.recentExchangesLabel')}</span>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['ALL', t('inventoryCatalog.ledgerFilterAll')],
                  ['ARRIVALS', t('inventoryCatalog.ledgerFilterArrivals')],
                  ['PAYMENTS', t('inventoryCatalog.ledgerFilterPayments')],
                ] as [LedgerFilter, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLedgerFilter(id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ledgerFilter === id ? 'bg-encre text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-none grid grid-cols-[0.9fr_1.8fr_1fr_1fr] sm:grid-cols-[1fr_2.3fr_1.1fr_1.1fr] gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 border-b border-border">
              <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim">{t('inventoryCatalog.dateColumn')}</span>
              <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim">{t('inventoryCatalog.movementColumn')}</span>
              <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim text-right">{t('inventoryCatalog.amountColumn')}</span>
              <span className="text-[10.5px] font-extrabold tracking-wider text-text-dim text-right">{t('inventoryCatalog.balanceColumn')}</span>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {error && <div className="p-4 text-[13px] font-semibold text-danger">{error}</div>}
              {visibleRows.length === 0 ? (
                <div className="p-6 text-sm font-semibold text-text-dim text-center">{t('inventoryCatalog.noExchangesYet')}</div>
              ) : (
                visibleRows.map(({ tx, balance }, i) => {
                  const { Icon, bg, color, title, positive } = movementVisual(tx, t)
                  return (
                    <div
                      key={tx.id}
                      role={tx.type === 'PAYMENT' ? 'button' : undefined}
                      tabIndex={tx.type === 'PAYMENT' ? 0 : undefined}
                      aria-label={tx.type === 'PAYMENT' ? t('inventoryCatalog.editRowAria') : undefined}
                      onClick={tx.type === 'PAYMENT' ? () => setEditingTx(tx) : undefined}
                      onKeyDown={tx.type === 'PAYMENT' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingTx(tx) } } : undefined}
                      className={`grid grid-cols-[0.9fr_1.8fr_1fr_1fr] sm:grid-cols-[1fr_2.3fr_1.1fr_1.1fr] gap-2 sm:gap-4 px-3 sm:px-5 py-3 items-center ${i > 0 ? 'border-t border-border-hairline' : ''} ${tx.type === 'PAYMENT' ? 'cursor-pointer hover:bg-bg-elevated' : ''}`}
                    >
                      <span className="text-xs sm:text-[13px] font-bold text-text-muted">{formatDate(new Date(tx.createdAt), locale, { day: 'numeric', month: 'short' })}</span>
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-none" style={{ background: bg }}>
                          <Icon size={15} style={{ color }} strokeWidth={2.4} />
                        </span>
                        <span className="text-xs sm:text-[13.5px] font-extrabold break-words min-w-0">{title}</span>
                        {tx.type === 'PAYMENT' && (
                          <span className="ml-auto flex-none w-8 h-8 rounded-lg flex items-center justify-center text-text-muted">
                            <Pencil size={14} />
                          </span>
                        )}
                      </span>
                      <span className={`amount text-xs sm:text-[13.5px] break-all font-extrabold text-right ${positive ? 'text-succes-text' : ''}`}>{positive ? '−' : '+'}{formatNumber(tx.amount, locale)}</span>
                      <span className="amount text-xs sm:text-[13.5px] break-all font-extrabold text-right">{formatNumber(Math.max(0, balance), locale)}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <SupplierPaymentModalDesktop
        supplier={editingTx ? supplier : null}
        editing={editingTx ? { transactionId: editingTx.id, amount: editingTx.amount, note: editingTx.note } : undefined}
        onClose={() => setEditingTx(null)}
        onDone={() => {
          setEditingTx(null)
          if (supplierId) load(supplierId)
          onChanged()
        }}
      />
    </Modal>
  )
}
