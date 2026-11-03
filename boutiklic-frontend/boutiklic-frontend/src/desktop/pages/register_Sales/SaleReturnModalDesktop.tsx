import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { salesApi, type SaleResponse, type RefundMethod } from '../../../lib/salesApi'
import { toE164Phone } from '../../../lib/authApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { useTenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface SaleReturnModalDesktopProps {
  open: boolean
  saleId: string | null
  onClose: () => void
  onDone: () => void
}

/** W35 — modale 860px. Même contrat que SaleReturn.tsx (mobile) : une ligne se retourne en
 *  entier (bascule + remise en stock optionnelle), pas de quantité partielle — ReturnLineRequest
 *  n'a pas de champ quantité côté API (cf. salesApi.ts), donc pas de stepper ici malgré le
 *  "stepper" du spec visuel : on ne fabrique pas un contrôle qui n'enregistrerait rien. */
export default function SaleReturnModalDesktop({ open, saleId, onClose, onDone }: SaleReturnModalDesktopProps) {
  const { t } = useTranslation()
  const REASONS = [t('registerSales.returnReasonDamaged'), t('registerSales.returnReasonCashierError'), t('registerSales.returnReasonCustomerChangedMind')] as const
  const defaultRestock = (reason: string): boolean => reason !== REASONS[0]
  const { tenant } = useTenant()

  const [sale, setSale] = useState<SaleResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [restockByLine, setRestockByLine] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState<string>(REASONS[0])
  const [method, setMethod] = useState<RefundMethod>('CASH')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !saleId) return
    setIsLoading(true)
    setError(null)
    setSelected({})
    setRestockByLine({})
    setReason(REASONS[0])
    setMethod('CASH')
    setCustomerName('')
    setCustomerPhone('')
    salesApi.getById(saleId)
      .then((s) => {
        setSale(s)
        setSelected(Object.fromEntries(s.lines.map((l) => [l.id, false])))
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saleId])

  const toggleLine = (lineId: string) => {
    const nowSelected = !selected[lineId]
    setSelected((s) => ({ ...s, [lineId]: nowSelected }))
    if (nowSelected && restockByLine[lineId] === undefined) {
      setRestockByLine((r) => ({ ...r, [lineId]: defaultRestock(reason) }))
    }
  }

  const total = (sale?.lines ?? []).filter((l) => selected[l.id]).reduce((sum, l) => sum + l.lineTotal, 0)
  const anySelected = Object.values(selected).some(Boolean)
  const isCredit = method === 'CREDIT'
  const isDebtMethod = method === 'DEBT'
  const debtUnavailable = isDebtMethod && sale?.debtId == null
  const creditInvalid = isCredit && (customerName.trim().length === 0 || customerPhone.trim().length < 8)
  const canSubmit = anySelected && !creditInvalid && !debtUnavailable && !submitting

  const handleSubmit = async () => {
    if (!sale || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const lines = sale.lines
        .filter((l) => selected[l.id])
        .map((l) => ({ saleLineId: l.id, restock: restockByLine[l.id] ?? defaultRestock(reason) }))
      await salesApi.processReturn(sale.id, {
        reason,
        refundMethod: method,
        lines,
        customerName: isCredit ? customerName.trim() : undefined,
        customerPhone: isCredit ? toE164Phone(customerPhone.trim()) : undefined,
      })
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={860} title={t('registerSales.returnTitle')}>
      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim py-6">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-5 md:gap-6">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.ticketItems')}</div>
              {(sale?.lines ?? []).map((line) => {
                const checked = !!selected[line.id]
                const restock = restockByLine[line.id] ?? defaultRestock(reason)
                return (
                  <div key={line.id} className={`flex flex-col gap-2 p-3 rounded-xl bg-bg-card ${checked ? 'border-2 border-terracotta' : 'border border-border'}`}>
                    <button type="button" onClick={() => toggleLine(line.id)} className="flex items-center gap-3 text-left">
                      <div className={`w-5 h-5 rounded-md flex-none flex items-center justify-center ${checked ? 'bg-terracotta' : 'border-2 border-border-strong'}`}>
                        {checked && <Check size={12} strokeWidth={3.4} className="text-papier" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold break-words">{line.productName}</div>
                        <div className="text-xs text-text-dim">{t('registerSales.soldCount', { count: line.quantity })}</div>
                      </div>
                      <div className={`amount text-sm font-extrabold flex-none ${checked ? '' : 'text-text-dim'}`}>{line.lineTotal.toLocaleString('fr-FR')}</div>
                    </button>
                    {checked && (
                      <button
                        type="button"
                        onClick={() => setRestockByLine((r) => ({ ...r, [line.id]: !restock }))}
                        className="flex items-center justify-between gap-3 pl-8 text-left"
                      >
                        <span className="text-xs font-semibold text-text-dim">{t('registerSales.restockToggle')}</span>
                        <span className={`w-9 h-5 rounded-full p-0.5 flex ${restock ? 'bg-success justify-end' : 'bg-bg-elevated justify-start'}`}>
                          <span className="w-4 h-4 rounded-full bg-papier" />
                        </span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.returnReasonTitle')}</div>
              <div className="flex gap-2 flex-wrap">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`px-3.5 py-2 rounded-lg text-sm ${reason === r ? 'bg-primary text-papier font-bold' : 'bg-bg-card border border-border-strong text-text-muted font-semibold'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 min-w-0">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.refundMethodTitle')}</div>
              <div className="flex flex-col gap-2">
                {([
                  { id: 'CASH' as const, label: t('registerSales.methodCash') },
                  { id: 'CREDIT' as const, label: t('registerSales.methodCredit') },
                  { id: 'DEBT' as const, label: t('registerSales.methodDebtRefund') },
                ]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`min-h-11 py-1 px-2 rounded-xl text-sm ${method === m.id ? 'border-2 border-terracotta bg-[#F7E9E5] text-[#8F3B23] font-extrabold' : 'border border-border-strong bg-bg-card text-text-muted font-bold'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {debtUnavailable && <div className="text-xs font-semibold text-danger">{t('registerSales.debtUnavailableNotice')}</div>}
            </div>

            {isCredit && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.clientForCreditTitle')}</div>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('registerSales.customerNamePlaceholder')} />
                <div className="min-h-11 rounded-xl flex items-center px-3.5 gap-2.5 border border-border-strong bg-bg">
                  <span className="amount text-sm font-bold text-text-muted">+224</span>
                  <div className="w-px h-5 bg-border-strong" />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="620 12 34 56"
                    inputMode="numeric"
                    className="amount flex-1 min-w-0 font-bold outline-none bg-transparent"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3.5 rounded-xl bg-[#F4E3DE]">
              <div className="text-sm font-bold text-[#7A3A26]">{t('registerSales.amountToRefund')}</div>
              <div className="amount text-lg sm:text-xl break-all font-extrabold text-[#8F3B23]">{total.toLocaleString('fr-FR')} {tenant.currency}</div>
            </div>

            {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
            <Button variant="danger" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} className="bg-terracotta hover:bg-terracotta min-h-12">
              {anySelected ? t('registerSales.validateReturn', { amount: total.toLocaleString('fr-FR') }) : t('registerSales.selectAnItem')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
