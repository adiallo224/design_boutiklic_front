import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { DEFAULT_LOCALE, formatMoney, isSupportedLocale } from '@boutiklic/shared'
import { toErrorMessage } from '../../../lib/apiClient'
import { MAX_PICKUP_POINTS, MAX_ZONES, deliveryApi, type DeliveryZoneResponse, type PickupPointResponse } from '../../../lib/deliveryApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import Button from '../../components/Button'
import DeliveryZoneModal from './DeliveryZoneModal'
import PickupPointModal from './PickupPointModal'

interface Props {
  siteId: string
  currency: string
  decimals: number
}

/** Pastille « actif / inactif » commune aux zones et aux points de retrait. */
function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${active ? 'bg-succes-bg text-succes-text' : 'bg-bg-elevated text-text-muted'}`}>
      {t(active ? 'onlineStore.delivery.activeLabel' : 'onlineStore.delivery.inactiveLabel')}
    </span>
  )
}

/** Onglet « Livraison » d'un site : zones (lieux, frais, minimum, délai) et points de retrait. Ce que voit le client au moment de commander. */
export default function OnlineStoreDeliveryTab({ siteId, currency, decimals }: Props) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [zones, setZones] = useState<DeliveryZoneResponse[]>([])
  const [points, setPoints] = useState<PickupPointResponse[]>([])
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoneModal, setZoneModal] = useState<{ open: boolean; zone: DeliveryZoneResponse | null }>({ open: false, zone: null })
  const [pointModal, setPointModal] = useState<{ open: boolean; point: PickupPointResponse | null }>({ open: false, point: null })

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([deliveryApi.listZones(siteId), deliveryApi.listPickupPoints(siteId), depotsApi.getAll().catch(() => [] as DepotResponse[])])
      .then(([z, p, d]) => {
        setZones(z)
        setPoints(p)
        setDepots(d)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [siteId])

  useEffect(load, [load])

  const money = (n: number) => formatMoney(n, currency, locale, decimals)

  const feeSummary = (z: DeliveryZoneResponse) => {
    if (z.feeType === 'TO_CONFIRM') return t('onlineStore.delivery.feeTypes.TO_CONFIRM')
    if (z.feeType === 'FREE_ABOVE') return t('onlineStore.delivery.feeFreeAbove', { fee: money(z.fee ?? 0), threshold: money(z.freeAbove ?? 0) })
    return (z.fee ?? 0) === 0 ? t('onlineStore.delivery.free') : money(z.fee ?? 0)
  }

  const areasSummary = (areas: string[]) => (areas.length <= 3 ? areas.join(', ') : `${areas.slice(0, 3).join(', ')} +${areas.length - 3}`)

  const remove = async (kind: 'zone' | 'point', id: string) => {
    if (!window.confirm(t(kind === 'zone' ? 'onlineStore.delivery.deleteZoneConfirm' : 'onlineStore.delivery.deletePickupConfirm'))) return
    setError(null)
    try {
      if (kind === 'zone') await deliveryApi.deleteZone(siteId, id)
      else await deliveryApi.deletePickupPoint(siteId, id)
      load()
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  if (isLoading) return <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>

  return (
    <div className="flex flex-col gap-8">
      {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}

      <section aria-labelledby="zones-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="zones-title" className="font-display text-base font-extrabold">{t('onlineStore.delivery.zonesTitle')}</h2>
            <p className="text-xs font-medium text-text-dim max-w-[560px]">{t('onlineStore.delivery.zonesHint')}</p>
          </div>
          <Button variant="accent" className="flex items-center gap-2" disabled={zones.length >= MAX_ZONES} onClick={() => setZoneModal({ open: true, zone: null })}>
            <Plus size={16} />
            {t('onlineStore.delivery.addZone')}
          </Button>
        </div>
        {zones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-5 sm:p-8 flex flex-col items-center gap-2 text-center">
            <Truck size={28} className="text-text-dim" />
            <div className="font-bold">{t('onlineStore.delivery.noZones')}</div>
            <div className="text-sm font-medium text-text-muted max-w-[460px]">{t('onlineStore.delivery.noZonesHint')}</div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {zones.map((z) => (
              <li key={z.id} className="rounded-xl border border-border-strong bg-bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5">
                    <span className="font-extrabold break-words">{z.name}</span>
                    <ActiveBadge active={z.active} />
                  </div>
                  <span className="text-xs font-medium text-text-muted break-words">{areasSummary(z.areas)}</span>
                  <span className="text-xs font-semibold text-text-dim">
                    {feeSummary(z)}
                    {z.minOrder ? ` · ${t('onlineStore.delivery.minOrderShort', { amount: money(z.minOrder) })}` : ''}
                    {z.etaText ? ` · ${z.etaText}` : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="!px-3" aria-label={`${t('onlineStore.delivery.edit')} ${z.name}`} onClick={() => setZoneModal({ open: true, zone: z })}><Pencil size={16} /></Button>
                  <Button variant="ghost" className="!px-3 text-danger" aria-label={`${t('onlineStore.delivery.delete')} ${z.name}`} onClick={() => remove('zone', z.id)}><Trash2 size={16} /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pickup-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="pickup-title" className="font-display text-base font-extrabold">{t('onlineStore.delivery.pickupTitle')}</h2>
            <p className="text-xs font-medium text-text-dim max-w-[560px]">{t('onlineStore.delivery.pickupHint')}</p>
          </div>
          <Button variant="accent" className="flex items-center gap-2" disabled={points.length >= MAX_PICKUP_POINTS} onClick={() => setPointModal({ open: true, point: null })}>
            <Plus size={16} />
            {t('onlineStore.delivery.addPickup')}
          </Button>
        </div>
        {points.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-bg-card p-5 sm:p-8 flex flex-col items-center gap-2 text-center">
            <MapPin size={28} className="text-text-dim" />
            <div className="font-bold">{t('onlineStore.delivery.noPickup')}</div>
            <div className="text-sm font-medium text-text-muted max-w-[460px]">{t('onlineStore.delivery.noPickupHint')}</div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {points.map((p) => (
              <li key={p.id} className="rounded-xl border border-border-strong bg-bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5">
                    <span className="font-extrabold break-words">{p.name}</span>
                    <ActiveBadge active={p.active} />
                  </div>
                  <span className="text-xs font-medium text-text-muted break-words">{p.addressText}</span>
                  {p.hoursText && <span className="text-xs font-semibold text-text-dim">{p.hoursText}</span>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="!px-3" aria-label={`${t('onlineStore.delivery.edit')} ${p.name}`} onClick={() => setPointModal({ open: true, point: p })}><Pencil size={16} /></Button>
                  <Button variant="ghost" className="!px-3 text-danger" aria-label={`${t('onlineStore.delivery.delete')} ${p.name}`} onClick={() => remove('point', p.id)}><Trash2 size={16} /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeliveryZoneModal
        open={zoneModal.open}
        siteId={siteId}
        zone={zoneModal.zone}
        decimals={decimals}
        currency={currency}
        onClose={() => setZoneModal({ open: false, zone: null })}
        onSaved={() => {
          setZoneModal({ open: false, zone: null })
          load()
        }}
      />
      <PickupPointModal
        open={pointModal.open}
        siteId={siteId}
        point={pointModal.point}
        depots={depots}
        onClose={() => setPointModal({ open: false, point: null })}
        onSaved={() => {
          setPointModal({ open: false, point: null })
          load()
        }}
      />
    </div>
  )
}
