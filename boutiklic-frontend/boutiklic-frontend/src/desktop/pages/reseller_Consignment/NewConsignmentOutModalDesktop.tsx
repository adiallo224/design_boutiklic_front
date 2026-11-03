import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { resellerApi, type ResellerResponse } from '../../../lib/resellerApi'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { toE164Phone } from '../../../lib/authApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface NewConsignmentOutModalDesktopProps {
  open: boolean
  /** Revendeur déjà connu quand ouvert depuis sa fiche (W5 → bouton "Sortie"). */
  presetResellerPhone?: string
  onClose: () => void
  onCompleted: () => void
}

interface DraftLine {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

/** W13 — modale 880px : revendeur + échéance en en-tête, tableau des articles avec stepper et
 *  "votre prix uniquement" (aucun prix catalogue ré-affiché, cf. resellerConsignment.priceNotice),
 *  total à récupérer en pied. Même appels resellerApi que NewConsignmentOut.tsx (mobile). */
export default function NewConsignmentOutModalDesktop({ open, presetResellerPhone, onClose, onCompleted }: NewConsignmentOutModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [resellers, setResellers] = useState<ResellerResponse[]>([])
  const [resellerPhone, setResellerPhone] = useState('')
  const [showNewReseller, setShowNewReseller] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creatingReseller, setCreatingReseller] = useState(false)

  const [products, setProducts] = useState<ProductResponse[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [lineProductId, setLineProductId] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [lineUnitPrice, setLineUnitPrice] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setResellerPhone(presetResellerPhone ?? '')
    setLines([])
    setError(null)
    setShowNewReseller(false)
    Promise.all([resellerApi.getResellers('late'), productsApi.search()])
      .then(([r, p]) => {
        setResellers(r)
        setProducts(p)
      })
      .catch((e) => setError(toErrorMessage(e)))
  }, [open, presetResellerPhone])

  const selectedReseller = resellers.find((r) => r.phone === resellerPhone)
  const totalToRecover = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  const handleCreateReseller = async () => {
    if (newName.trim().length === 0 || newPhone.trim().length < 8) return
    setCreatingReseller(true)
    setError(null)
    try {
      const phone = toE164Phone(newPhone.trim())
      await resellerApi.create({ name: newName.trim(), phone })
      const refreshed = await resellerApi.getResellers('late')
      setResellers(refreshed)
      setResellerPhone(phone)
      setShowNewReseller(false)
      setNewName('')
      setNewPhone('')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCreatingReseller(false)
    }
  }

  const handleProductPicked = (productId: string) => {
    setLineProductId(productId)
    const product = products.find((p) => p.id === productId)
    if (product) setLineUnitPrice(String(product.salePrice))
  }

  const handleAddLine = () => {
    const product = products.find((p) => p.id === lineProductId)
    const qty = Number(lineQty)
    const unitPrice = Number(lineUnitPrice)
    if (!product || qty <= 0 || unitPrice <= 0) return
    setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantity: qty, unitPrice }])
    setLineProductId('')
    setLineQty('1')
    setLineUnitPrice('')
  }

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    if (!resellerPhone || lines.length === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await resellerApi.recordConsignmentOut(resellerPhone, {
        currency: tenant.currency,
        lines: lines.map(({ productId, productName, unitPrice, quantity }) => ({ productId, productName, unitPrice, quantity })),
      })
      onCompleted()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={880} title={t('resellerConsignment.newConsignmentButton')}>
      <div className="flex flex-col gap-4">
        {!presetResellerPhone && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('resellerConsignment.resellerSectionTitle')}</span>
            {showNewReseller ? (
              <div className="p-4 rounded-xl border border-border-strong bg-bg-card flex flex-col gap-2.5">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('resellerConsignment.resellerNamePlaceholder')} />
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))} placeholder="620 12 34 56" inputMode="numeric" className="amount" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="flex-1 min-w-[120px]" onClick={() => setShowNewReseller(false)}>{t('resellerConsignment.cancel')}</Button>
                  <Button className="flex-1 min-w-[120px]" onClick={handleCreateReseller} disabled={creatingReseller || newName.trim().length === 0 || newPhone.trim().length < 8} loading={creatingReseller}>
                    {t('resellerConsignment.create')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={resellerPhone}
                  onChange={(e) => setResellerPhone(e.target.value)}
                  className="flex-1 min-w-[180px] h-11 rounded-xl border-2 border-encre bg-bg-card px-3.5 font-bold outline-none"
                >
                  <option value="">{t('resellerConsignment.chooseReseller')}</option>
                  {resellers.map((r) => (
                    <option key={r.resellerId} value={r.phone}>{r.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowNewReseller(true)} className="px-3.5 min-h-11 py-1 rounded-xl bg-bg-elevated text-xs font-bold text-primary text-left">
                  {t('resellerConsignment.newResellerButton')}
                </button>
              </div>
            )}
            {selectedReseller && selectedReseller.totalRemaining > 0 && (
              <div className="text-[12.5px] font-semibold text-terracotta break-words">
                {t('resellerConsignment.alreadyOutside', { amount: formatNumber(selectedReseller.totalRemaining, locale), currency: tenant.currency })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('resellerConsignment.merchandiseOutTitle', { count: lines.length })}</span>
          {lines.length > 0 && (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                    <th className="px-3 py-2">{t('inventoryCatalog.productNameLabel')}</th>
                    <th className="px-3 py-2 text-right">{t('resellerConsignment.quantityPlaceholder')}</th>
                    <th className="px-3 py-2 text-right">{t('resellerConsignment.myUnitPricePlaceholder')}</th>
                    <th className="px-3 py-2 text-right">{t('resellerConsignment.totalToRecover')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t border-border-hairline">
                      <td className="px-3 py-2 font-bold break-words">{line.productName}</td>
                      <td className="px-3 py-2 text-right amount">{line.quantity}</td>
                      <td className="px-3 py-2 text-right amount">{formatNumber(line.unitPrice, locale)}</td>
                      <td className="px-3 py-2 text-right amount font-extrabold">{formatNumber(line.quantity * line.unitPrice, locale)}</td>
                      <td className="px-1 text-center">
                        <button type="button" onClick={() => removeLine(i)} className="w-6 h-6 rounded-full bg-bg-elevated inline-flex items-center justify-center">
                          <X size={12} className="text-text-dim" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-[1fr_120px_140px_auto] gap-2.5 items-end">
            <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1 min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('resellerConsignment.chooseItem')}</span>
              <select
                value={lineProductId}
                onChange={(e) => handleProductPicked(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="">{t('resellerConsignment.chooseItem')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} inputMode="numeric" className="amount" placeholder={t('resellerConsignment.quantityPlaceholder')} />
            <Input value={lineUnitPrice} onChange={(e) => setLineUnitPrice(e.target.value)} inputMode="numeric" className="amount" placeholder={t('resellerConsignment.myUnitPricePlaceholder')} />
            <Button variant="secondary" className="col-span-2 md:col-span-1" onClick={handleAddLine} disabled={!lineProductId || Number(lineQty) <= 0 || Number(lineUnitPrice) <= 0}>
              <Plus size={15} />
            </Button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-info-bg border border-info-border text-xs sm:text-[13px] leading-relaxed text-[#33465E] break-words">
          <Trans t={t} i18nKey="resellerConsignment.priceNotice" components={{ strong: <strong /> }} />
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-4 rounded-xl bg-bg-elevated">
          <span className="text-sm font-bold text-[#5C5147]">{t('resellerConsignment.totalToRecover')}</span>
          <span className="amount text-xl sm:text-2xl break-all font-extrabold">{formatNumber(totalToRecover, locale)}</span>
        </div>

        <Button onClick={handleSubmit} disabled={submitting || !resellerPhone || lines.length === 0} loading={submitting} className="min-h-12">
          {t('resellerConsignment.validateConsignmentOut')}
        </Button>
      </div>
    </Modal>
  )
}
