import { useEffect, useState } from 'react'
import { ChevronLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { salesApi, type SaleResponse, type RefundMethod } from '../../lib/salesApi'
import { toE164Phone } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useTenant } from '../../hooks/useTenant'

interface SaleReturnProps {
  saleId: string
  time: string
  onBack: () => void
}

export default function SaleReturn({ saleId, time, onBack }: SaleReturnProps) {
  const { t } = useTranslation()
  const REASONS = [t('registerSales.returnReasonDamaged'), t('registerSales.returnReasonCashierError'), t('registerSales.returnReasonCustomerChangedMind')] as const
  /** Remise en stock par défaut selon le motif — modifiable ensuite par ligne (bouton "Remettre en stock").
   *  Comparaison par index (REASONS[0]) plutôt que par chaîne en dur, pour rester correct une fois "Produit abîmé" traduit. */
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
    salesApi.getById(saleId)
      .then((s) => {
        setSale(s)
        setSelected(Object.fromEntries(s.lines.map((l) => [l.id, false])))
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [saleId])

  const toggleLine = (lineId: string) => {
    const nowSelected = !selected[lineId]
    setSelected((s) => ({ ...s, [lineId]: nowSelected }))
    if (nowSelected && restockByLine[lineId] === undefined) {
      setRestockByLine((r) => ({ ...r, [lineId]: defaultRestock(reason) }))
    }
  }

  const toggleRestock = (lineId: string) => {
    setRestockByLine((r) => ({ ...r, [lineId]: !r[lineId] }))
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
      await salesApi.processReturn(saleId, {
        reason,
        refundMethod: method,
        lines,
        customerName: isCredit ? customerName.trim() : undefined,
        customerPhone: isCredit ? toE164Phone(customerPhone.trim()) : undefined,
      })
      onBack()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col bg-bg">
      <div className="flex-none flex items-center gap-3.5 px-5 pt-4 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('registerSales.returnTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('registerSales.returnTicketToday', { id: saleId.slice(-4), time })}</div>
        </div>
      </div>

      <div className="flex-1 px-5 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {isLoading ? (
          <div className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.ticketItems')}</div>
            {(sale?.lines ?? []).map((line) => {
              const checked = !!selected[line.id]
              const restock = restockByLine[line.id] ?? defaultRestock(reason)
              return (
                <div
                  key={line.id}
                  className={`flex flex-col gap-2.5 p-3.5 rounded-2xl bg-bg-card ${checked ? 'border-2 border-terracotta' : 'border border-border'}`}
                >
                  <button onClick={() => toggleLine(line.id)} className="flex items-center gap-3.5 text-left">
                    <div className={`w-6 h-6 rounded-lg flex-none flex items-center justify-center ${checked ? 'bg-terracotta' : 'border-2 border-[#DDD2C3]'}`}>
                      {checked && <Check size={14} strokeWidth={3.4} className="text-papier" />}
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-bg-elevated flex items-center justify-center text-xl flex-none">📦</div>
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <div className="text-[15px] font-bold truncate">{line.productName}</div>
                      <div className="text-[13px] text-text-dim">{t('registerSales.soldCount', { count: line.quantity })}</div>
                    </div>
                    <div className={`amount text-base font-extrabold ${checked ? '' : 'text-[#BDB1A3]'}`}>{line.lineTotal.toLocaleString('fr-FR')}</div>
                  </button>
                  {checked && (
                    <button
                      onClick={() => toggleRestock(line.id)}
                      className="flex items-center justify-between pl-[58px] pr-1"
                    >
                      <div className="text-[13px] font-semibold text-text-dim">{t('registerSales.restockToggle')}</div>
                      <div className={`w-[42px] h-[25px] rounded-full p-[3px] flex ${restock ? 'bg-success justify-end' : 'bg-bg-elevated justify-start'}`}>
                        <div className="w-[19px] h-[19px] rounded-full bg-papier" />
                      </div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.returnReasonTitle')}</div>
          <div className="flex gap-2 flex-wrap">
            {REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`px-4 py-2.5 rounded-xl text-sm ${reason === r ? 'bg-primary text-papier font-bold' : 'bg-bg-card border border-border-strong text-[#5C5147] font-semibold'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.refundMethodTitle')}</div>
          <div className="flex gap-2.5">
            {[
              { id: 'CASH' as const, label: t('registerSales.methodCash') },
              { id: 'CREDIT' as const, label: t('registerSales.methodCredit') },
              { id: 'DEBT' as const, label: t('registerSales.methodDebtRefund') },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`flex-1 h-14 rounded-2xl text-[15px] ${
                  method === m.id ? 'border-2 border-terracotta bg-[#F7E9E5] text-[#8F3B23] font-extrabold' : 'border border-border-strong bg-bg-card text-[#5C5147] font-bold'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {debtUnavailable && (
            <div className="text-[13px] font-semibold text-danger">{t('registerSales.debtUnavailableNotice')}</div>
          )}
        </div>

        {isCredit && (
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.clientForCreditTitle')}</div>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('registerSales.customerNamePlaceholder')}
              className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold outline-none focus:border-primary"
            />
            <div className="h-[52px] rounded-2xl flex items-center px-4 gap-2.5 border border-border-strong bg-bg-card">
              <div className="amount text-base font-bold text-text-muted">+224</div>
              <div className="w-px h-5 bg-border-strong" />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="620 12 34 56"
                inputMode="numeric"
                className="amount flex-1 font-bold outline-none bg-transparent"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-[18px] rounded-2xl bg-[#F4E3DE] mb-2">
          <div className="text-[15px] font-bold text-[#7A3A26]">{t('registerSales.amountToRefund')}</div>
          <div className="amount text-2xl font-extrabold text-[#8F3B23]">{total.toLocaleString('fr-FR')} {tenant.currency}</div>
        </div>
      </div>

      <div className="flex-none px-5 pt-3 pb-9 flex flex-col gap-2.5">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-[62px] rounded-[18px] bg-terracotta text-papier text-lg font-extrabold disabled:opacity-40"
        >
          {submitting ? t('registerSales.recording') : anySelected ? t('registerSales.validateReturn', { amount: total.toLocaleString('fr-FR') }) : t('registerSales.selectAnItem')}
        </button>
      </div>
    </div>
  )
}
