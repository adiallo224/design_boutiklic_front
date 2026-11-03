import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, User } from 'lucide-react'
import { billingApi, type BillingPartyType, type InvoiceResponse } from '../../../lib/billingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import InvoiceDocumentView from '../billing/InvoiceDocumentView'
import CustomerPicker from '../../components/CustomerPicker'
import type { CustomerResponse } from '../../../lib/customerApi'

interface InvoiceModalDesktopProps {
  open: boolean
  saleId: string | null
  onClose: () => void
}

/** Bouton "Facturer" (doc TVA §3.4) — génère une facture à la demande depuis une vente complétée.
 *  Le vendeur (boutique) est résolu automatiquement côté backend depuis le profil tenant courant.
 *  Le client (buyer) peut être choisi dans l'annuaire (CustomerPicker, préremplit les champs et
 *  transmet buyerCustomerId) ou saisi librement. */
export default function InvoiceModalDesktop({ open, saleId, onClose }: InvoiceModalDesktopProps) {
  const { t } = useTranslation()

  const [buyerType, setBuyerType] = useState<BillingPartyType>('PARTICULIER')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerTaxId, setBuyerTaxId] = useState('')
  const [buyerCustomerId, setBuyerCustomerId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null)

  useEffect(() => {
    if (!open) return
    setBuyerType('PARTICULIER')
    setBuyerName('')
    setBuyerPhone('')
    setBuyerAddress('')
    setBuyerTaxId('')
    setBuyerCustomerId(null)
    setError(null)
    setInvoice(null)
  }, [open, saleId])

  const canSubmit = !!saleId && buyerName.trim().length > 0 && !submitting

  const handleGenerate = () => {
    if (!saleId || !buyerName.trim()) return
    setSubmitting(true)
    setError(null)
    billingApi
      .generateInvoice({
        saleId,
        buyerType,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        buyerAddress: buyerAddress.trim() || undefined,
        buyerTaxId: buyerTaxId.trim() || undefined,
        buyerCustomerId: buyerCustomerId ?? undefined,
      })
      .then(setInvoice)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setSubmitting(false))
  }

  return (
    <Modal open={open} onClose={onClose} width={invoice ? 640 : 460} title={t('billing.generateInvoiceTitle')}>
      <div className="flex flex-col gap-4">
        {invoice ? (
          <div className="flex flex-col gap-3">
            <InvoiceDocumentView invoice={invoice} />
            <Button onClick={onClose} className="min-h-11 print:hidden">
              {t('billing.closeCta')}
            </Button>
          </div>
        ) : (
          <>
            <div className="p-1 rounded-xl bg-bg-elevated flex flex-wrap items-center gap-1">
              {(['PARTICULIER', 'ENTREPRISE'] as BillingPartyType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBuyerType(type)}
                  className={`flex-1 min-w-[130px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${
                    buyerType === type ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'
                  }`}
                >
                  {type === 'PARTICULIER' ? <User size={16} /> : <Building2 size={16} />}
                  {type === 'PARTICULIER' ? t('billing.buyerTypeParticulier') : t('billing.buyerTypeEntreprise')}
                </button>
              ))}
            </div>

            <CustomerPicker
              selectedName={buyerCustomerId ? buyerName : null}
              onSelect={(c: CustomerResponse) => {
                setBuyerCustomerId(c.id)
                setBuyerType(c.type)
                setBuyerName(c.name)
                setBuyerPhone(c.phone ?? '')
                setBuyerAddress(c.address ?? '')
                setBuyerTaxId(c.taxId ?? '')
              }}
              onClear={() => setBuyerCustomerId(null)}
            />
            <Input
              label={t('billing.buyerNameLabel')}
              value={buyerName}
              onChange={(e) => { setBuyerName(e.target.value); setBuyerCustomerId(null) }}
              placeholder={t('billing.buyerNamePlaceholder') ?? ''}
              autoFocus
            />
            <Input
              label={t('billing.buyerPhoneLabel')}
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder={t('billing.buyerPhonePlaceholder') ?? ''}
            />
            <Input
              label={t('billing.buyerAddressLabel')}
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder={t('billing.buyerAddressPlaceholder') ?? ''}
            />
            {buyerType === 'ENTREPRISE' && (
              <Input
                label={t('billing.buyerTaxIdLabel')}
                value={buyerTaxId}
                onChange={(e) => setBuyerTaxId(e.target.value)}
                placeholder={t('billing.buyerTaxIdPlaceholder') ?? ''}
              />
            )}

            {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

            <Button onClick={handleGenerate} disabled={!canSubmit} className="min-h-11">
              {submitting ? t('common.loading') : t('billing.generateInvoiceAction')}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
