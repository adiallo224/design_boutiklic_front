import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toErrorMessage } from '../../../lib/apiClient'
import { deliveryApi, type PickupPointRequest, type PickupPointResponse } from '../../../lib/deliveryApi'
import type { DepotResponse } from '../../../lib/depotsApi'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Modal from '../../components/Modal'

interface Props {
  open: boolean
  siteId: string
  /** Point à modifier ; absent = création. */
  point: PickupPointResponse | null
  depots: DepotResponse[]
  onClose: () => void
  onSaved: () => void
}

const toCoordinate = (text: string): number | undefined => (text.trim() === '' ? undefined : Number(text.replace(',', '.')))
const validLatitude = (n: number | undefined) => n === undefined || (Number.isFinite(n) && Math.abs(n) <= 90)
const validLongitude = (n: number | undefined) => n === undefined || (Number.isFinite(n) && Math.abs(n) <= 180)

/** Point de retrait : où le client vient chercher sa commande (une boutique, un dépôt). Le point GPS est facultatif mais jamais à moitié renseigné. */
export default function PickupPointModal({ open, siteId, point, depots, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [hours, setHours] = useState('')
  const [depotId, setDepotId] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(point?.name ?? '')
    setAddress(point?.addressText ?? '')
    setHours(point?.hoursText ?? '')
    setDepotId(point?.depotId ?? '')
    setLatitude(point?.latitude === null || point?.latitude === undefined ? '' : String(point.latitude))
    setLongitude(point?.longitude === null || point?.longitude === undefined ? '' : String(point.longitude))
    setActive(point?.active ?? true)
    setError(null)
  }, [open, point])

  const lat = toCoordinate(latitude)
  const lng = toCoordinate(longitude)
  const gpsIncomplete = (lat === undefined) !== (lng === undefined)
  const gpsInvalid = !validLatitude(lat) || !validLongitude(lng)
  const gpsError = gpsIncomplete ? t('onlineStore.delivery.gpsIncomplete') : gpsInvalid ? t('onlineStore.delivery.gpsInvalid') : undefined
  const canSave = name.trim() !== '' && address.trim() !== '' && !gpsIncomplete && !gpsInvalid && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    const payload: PickupPointRequest = {
      depotId: depotId || undefined,
      name: name.trim(),
      addressText: address.trim(),
      latitude: lat,
      longitude: lng,
      hoursText: hours.trim() || undefined,
      active,
    }
    try {
      if (point) await deliveryApi.updatePickupPoint(siteId, point.id, payload)
      else await deliveryApi.createPickupPoint(siteId, payload)
      onSaved()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const activeDepots = depots.filter((d) => d.active)

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={t(point ? 'onlineStore.delivery.pickupEditTitle' : 'onlineStore.delivery.pickupNewTitle')}
      subtitle={t('onlineStore.delivery.pickupSubtitle')}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('onlineStore.create.cancel')}</Button>
          <Button onClick={save} loading={saving} disabled={!canSave}>{t('onlineStore.delivery.save')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t('onlineStore.delivery.pickupName')} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={t('onlineStore.delivery.pickupNamePlaceholder')} autoFocus />
        <Input label={t('onlineStore.delivery.pickupAddress')} value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} />
        <Input label={t('onlineStore.delivery.pickupHours')} value={hours} maxLength={200} onChange={(e) => setHours(e.target.value)} placeholder={t('onlineStore.delivery.pickupHoursPlaceholder')} />

        {activeDepots.length > 1 && (
          <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
            {t('onlineStore.delivery.pickupDepot')}
            <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary">
              <option value="">{t('onlineStore.delivery.pickupNoDepot')}</option>
              {activeDepots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Input label={t('onlineStore.delivery.latitude')} value={latitude} inputMode="decimal" onChange={(e) => setLatitude(e.target.value)} error={gpsError} />
          <Input label={t('onlineStore.delivery.longitude')} value={longitude} inputMode="decimal" onChange={(e) => setLongitude(e.target.value)} />
        </div>
        <p className="text-xs font-medium text-text-dim break-words">{t('onlineStore.delivery.gpsHint')}</p>

        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-primary" />
          {t('onlineStore.delivery.active')}
        </label>

        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
