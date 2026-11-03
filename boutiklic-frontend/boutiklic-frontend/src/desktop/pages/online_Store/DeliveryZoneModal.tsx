import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toErrorMessage } from '../../../lib/apiClient'
import { deliveryApi, type DeliveryZoneRequest, type DeliveryZoneResponse, type FeeType } from '../../../lib/deliveryApi'
import { areasProblem, areasToText, parseAreas } from '../../../lib/deliveryAreas'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'

const FEE_TYPES: FeeType[] = ['FLAT', 'FREE_ABOVE', 'TO_CONFIRM']

interface Props {
  open: boolean
  siteId: string
  /** Zone à modifier ; absente = création. */
  zone: DeliveryZoneResponse | null
  /** Décimales autorisées pour les montants (celles des prix de vente de la boutique). */
  decimals: number
  currency: string
  onClose: () => void
  onSaved: () => void
}

const toText = (value: number | null) => (value === null || value === undefined ? '' : String(value))
const toNumber = (text: string): number | undefined => (text.trim() === '' ? undefined : Number(text))

/** Zone de livraison : lieux couverts, frais (fixes, gratuits au-delà d'un seuil, ou à confirmer), commande minimum, délai. Le serveur revalide tout. */
export default function DeliveryZoneModal({ open, siteId, zone, decimals, currency, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [areasText, setAreasText] = useState('')
  const [feeType, setFeeType] = useState<FeeType>('FLAT')
  const [fee, setFee] = useState('')
  const [freeAbove, setFreeAbove] = useState('')
  const [minOrder, setMinOrder] = useState('')
  const [etaText, setEtaText] = useState('')
  const [active, setActive] = useState(true)
  const [position, setPosition] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(zone?.name ?? '')
    setAreasText(zone ? areasToText(zone.areas) : '')
    setFeeType(zone?.feeType ?? 'FLAT')
    setFee(toText(zone?.fee ?? null))
    setFreeAbove(toText(zone?.freeAbove ?? null))
    setMinOrder(toText(zone?.minOrder ?? null))
    setEtaText(zone?.etaText ?? '')
    setActive(zone?.active ?? true)
    setPosition(String(zone?.position ?? 0))
    setError(null)
  }, [open, zone])

  const areas = parseAreas(areasText)
  const areaIssue = areasProblem(areas)
  const needsFee = feeType !== 'TO_CONFIRM'
  const needsThreshold = feeType === 'FREE_ABOVE'
  const feeOk = !needsFee || fee.trim() !== ''
  const thresholdOk = !needsThreshold || Number(freeAbove) > 0
  const canSave = name.trim() !== '' && areas.length > 0 && !areaIssue && feeOk && thresholdOk && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    // Seuls les montants qui ont un sens pour le type choisi sont envoyés (le serveur refuse une combinaison incohérente).
    const payload: DeliveryZoneRequest = {
      name: name.trim(),
      areas,
      feeType,
      fee: needsFee ? toNumber(fee) : undefined,
      freeAbove: needsThreshold ? toNumber(freeAbove) : undefined,
      minOrder: toNumber(minOrder),
      etaText: etaText.trim() || undefined,
      active,
      position: Math.max(0, Number.parseInt(position, 10) || 0),
    }
    try {
      if (zone) await deliveryApi.updateZone(siteId, zone.id, payload)
      else await deliveryApi.createZone(siteId, payload)
      onSaved()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={t(zone ? 'onlineStore.delivery.zoneEditTitle' : 'onlineStore.delivery.zoneNewTitle')}
      subtitle={t('onlineStore.delivery.zoneSubtitle')}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('onlineStore.create.cancel')}</Button>
          <Button onClick={save} loading={saving} disabled={!canSave}>{t('onlineStore.delivery.save')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t('onlineStore.delivery.zoneName')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={t('onlineStore.delivery.zoneNamePlaceholder')} autoFocus />

        <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
          {t('onlineStore.delivery.areas')}
          <textarea
            value={areasText}
            onChange={(e) => setAreasText(e.target.value)}
            rows={4}
            className={`w-full rounded-xl border bg-bg px-3.5 py-2.5 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary ${areaIssue ? 'border-danger' : 'border-border-strong'}`}
            placeholder={t('onlineStore.delivery.areasPlaceholder')}
          />
          <span className={`text-xs font-medium normal-case tracking-normal ${areaIssue ? 'text-danger' : 'text-text-dim'}`}>
            {areaIssue ? t(`onlineStore.delivery.areasProblems.${areaIssue}`) : t('onlineStore.delivery.areasHint', { count: areas.length })}
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">{t('onlineStore.delivery.feeType')}</legend>
          {FEE_TYPES.map((type) => (
            <label key={type} className="flex items-start gap-2.5 text-sm font-semibold">
              <input type="radio" name="feeType" checked={feeType === type} onChange={() => setFeeType(type)} className="mt-1 accent-primary" />
              <span className="flex flex-col min-w-0 break-words">
                {t(`onlineStore.delivery.feeTypes.${type}`)}
                <span className="text-xs font-medium text-text-dim">{t(`onlineStore.delivery.feeTypeHints.${type}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {needsFee && <MoneyInput label={`${t('onlineStore.delivery.fee')} (${currency})`} value={fee} onValueChange={setFee} decimals={decimals} />}
        {needsThreshold && (
          <MoneyInput label={`${t('onlineStore.delivery.freeAbove')} (${currency})`} value={freeAbove} onValueChange={setFreeAbove} decimals={decimals} error={freeAbove !== '' && !thresholdOk ? t('onlineStore.delivery.freeAboveInvalid') : undefined} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoneyInput label={`${t('onlineStore.delivery.minOrder')} (${currency})`} value={minOrder} onValueChange={setMinOrder} decimals={decimals} />
          <Input label={t('onlineStore.delivery.eta')} value={etaText} maxLength={200} onChange={(e) => setEtaText(e.target.value)} placeholder={t('onlineStore.delivery.etaPlaceholder')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:items-end">
          <Input label={t('onlineStore.delivery.position')} value={position} inputMode="numeric" onChange={(e) => setPosition(e.target.value.replace(/\D/g, ''))} />
          <label className="flex items-center gap-2.5 text-sm font-semibold min-h-11">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-primary" />
            {t('onlineStore.delivery.active')}
          </label>
        </div>
        <p className="text-xs font-medium text-text-dim">{t('onlineStore.delivery.positionHint')}</p>

        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
