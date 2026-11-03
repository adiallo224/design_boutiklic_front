import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ArrowRight, Building2, Check, ChevronLeft, Package, Plus, Sparkles, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatDate, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { stockTransfersApi, type StockTransferResponse, type TransferDestinationResponse } from '../../lib/stockTransfersApi'
import { depotsApi, type DepotResponse } from '../../lib/depotsApi'
import { productsApi, type ProductResponse } from '../../lib/productsApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useAuth } from '../../hooks/useAuth'
import { useTenant } from '../../hooks/useTenant'
import SelectField from '../../components/SelectField'

interface StockTransfersProps {
  onBack: () => void
}

interface DraftLine {
  productId: string
  productName: string
  quantity: number
}

type Scope = 'intra' | 'inter'

const statusColors: Record<StockTransferResponse['status'], { bg: string; text: string }> = {
  IN_TRANSIT: { bg: 'bg-alerte-bg', text: 'text-alerte-text' },
  RECEIVED: { bg: 'bg-succes-bg', text: 'text-succes-text' },
  CANCELLED: { bg: 'bg-bg-elevated', text: 'text-text-dim' },
}

/** Étude study/etude_multi_depots_transferts.md — transfert de stock entre deux dépôts (phase 3,
 *  même boutique) ou entre deux boutiques du même propriétaire (phase 4, réservé à OWNER côté
 *  serveur). Écran auto-suffisant (charge ses propres données), comme Depots.tsx. Un transfert
 *  décrémente la source à l'envoi et n'incrémente la destination qu'à la confirmation de réception
 *  — jamais automatique, cf. étude §2.4. */
export default function StockTransfers({ onBack }: StockTransfersProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { user } = useAuth()
  const { tenant } = useTenant()
  const isOwner = user?.role === 'OWNER'

  const [transfers, setTransfers] = useState<StockTransferResponse[]>([])
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [destinations, setDestinations] = useState<TransferDestinationResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [scope, setScope] = useState<Scope>('intra')
  const [sourceDepotId, setSourceDepotId] = useState('')
  const [destinationDepotId, setDestinationDepotId] = useState('')
  const [destinationTenantId, setDestinationTenantId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [showAddLine, setShowAddLine] = useState(false)
  const [lineProductId, setLineProductId] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [tr, d, p, dest] = await Promise.all([
        stockTransfersApi.getAll(),
        depotsApi.getAll(),
        productsApi.search(),
        isOwner ? stockTransfersApi.getDestinations() : Promise.resolve([]),
      ])
      setTransfers(tr)
      setDepots(d.filter((depot) => depot.active))
      setProducts(p)
      setDestinations(dest)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [isOwner])

  useEffect(() => {
    load()
  }, [load])

  const depotName = (id: string) => depots.find((d) => d.id === id)?.name
  const boutiqueName = (tenantId: string) => destinations.find((d) => d.tenantId === tenantId)?.name
  const sideLabel = (sideTenantId: string, sideDepotId: string) =>
    sideTenantId === tenant.id ? depotName(sideDepotId) ?? '—' : boutiqueName(sideTenantId) ?? '—'

  const canCreateIntra = depots.length > 1
  const canCreateInter = isOwner && destinations.length > 0
  const canCreate = tenant.multiDepotEnabled && (canCreateIntra || canCreateInter)

  const openCreate = () => {
    const defaultSource = depots.find((d) => d.isDefault)?.id ?? depots[0]?.id ?? ''
    setScope(canCreateIntra ? 'intra' : 'inter')
    setSourceDepotId(defaultSource)
    setDestinationDepotId(depots.find((d) => d.id !== defaultSource)?.id ?? '')
    setDestinationTenantId(destinations[0]?.tenantId ?? '')
    setLines([])
    setError(null)
    setCreating(true)
  }

  const handleAddLine = () => {
    const product = products.find((p) => p.id === lineProductId)
    const qty = Number(lineQty)
    if (!product || qty <= 0) return
    setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantity: qty }])
    setShowAddLine(false)
    setLineProductId('')
    setLineQty('1')
  }

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const canSend =
    lines.length > 0 && !!sourceDepotId && (scope === 'intra' ? !!destinationDepotId : !!destinationTenantId) && !submitting

  const handleSend = async () => {
    if (!canSend) return
    setSubmitting(true)
    setError(null)
    try {
      if (scope === 'intra') {
        await stockTransfersApi.send({
          sourceDepotId,
          destinationDepotId,
          lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
        })
      } else {
        await stockTransfersApi.sendInterBoutique({
          sourceDepotId,
          destinationTenantId,
          lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
        })
      }
      setCreating(false)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceive = async (transferId: string) => {
    setActingId(transferId)
    setError(null)
    try {
      await stockTransfersApi.receive(transferId)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setActingId(null)
    }
  }

  const handleCancel = async (transferId: string) => {
    setActingId(transferId)
    setError(null)
    try {
      await stockTransfersApi.cancel(transferId)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setActingId(null)
    }
  }

  if (creating) {
    const destinationDepotOptions = depots.filter((d) => d.id !== sourceDepotId)
    return (
      <View className="flex-1 bg-bg">
        <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
          <Pressable onPress={() => setCreating(false)} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.newStockTransferCta')}</Text>
        </View>

        <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 12, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          {canCreateIntra && canCreateInter && (
            <View className="flex-row gap-1.5 p-1 rounded-xl bg-bg-elevated self-start">
              <Pressable onPress={() => setScope('intra')} className={`px-3.5 py-1.5 rounded-lg ${scope === 'intra' ? 'bg-bg-card' : ''}`}>
                <Text className={`text-xs font-bold ${scope === 'intra' ? 'text-text' : 'text-text-muted'}`}>{t('inventoryCatalog.transferScopeIntra')}</Text>
              </Pressable>
              <Pressable onPress={() => setScope('inter')} className={`px-3.5 py-1.5 rounded-lg ${scope === 'inter' ? 'bg-bg-card' : ''}`}>
                <Text className={`text-xs font-bold ${scope === 'inter' ? 'text-text' : 'text-text-muted'}`}>{t('inventoryCatalog.transferScopeInter')}</Text>
              </Pressable>
            </View>
          )}

          <View className="gap-1.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.sourceDepotLabel')}</Text>
            <SelectField
              value={sourceDepotId}
              onChange={(v) => {
                setSourceDepotId(v)
                if (v === destinationDepotId) setDestinationDepotId('')
              }}
              options={depots.map((d) => ({ label: d.name, value: d.id }))}
            />
          </View>
          {scope === 'intra' ? (
            <View className="gap-1.5">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.destinationDepotLabel')}</Text>
              <SelectField
                value={destinationDepotId}
                onChange={setDestinationDepotId}
                options={destinationDepotOptions.map((d) => ({ label: d.name, value: d.id }))}
                placeholder={t('inventoryCatalog.chooseArticlePlaceholder')}
              />
            </View>
          ) : (
            <View className="gap-1.5">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.destinationBoutiqueLabel')}</Text>
              <SelectField
                value={destinationTenantId}
                onChange={setDestinationTenantId}
                options={destinations.map((d) => ({ label: `${d.name} — ${d.city}`, value: d.tenantId }))}
              />
              <Text className="text-[12px] text-text-dim">{t('inventoryCatalog.interBoutiqueDepotHint')}</Text>
            </View>
          )}

          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.receivedItemsHeader', { count: lines.length })}</Text>
          {lines.map((line, i) => (
            <View key={i} className="flex-row items-center gap-3 p-3 rounded-2xl bg-bg-card border border-border">
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold">{line.productName}</Text>
                <Text className="amount text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.unitsCount', { count: line.quantity })}</Text>
              </View>
              <Pressable onPress={() => removeLine(i)} className="w-7 h-7 rounded-full bg-bg-elevated items-center justify-center">
                <X size={14} color="#A2A9B8" />
              </Pressable>
            </View>
          ))}

          {showAddLine ? (
            <View className="p-4 rounded-2xl border border-border-strong bg-bg-card gap-2.5">
              <SelectField
                value={lineProductId}
                onChange={setLineProductId}
                options={products.map((p) => ({ label: p.name, value: p.id }))}
                placeholder={t('inventoryCatalog.chooseArticlePlaceholder')}
              />
              <View className="flex-row items-center gap-2.5">
                <Pressable onPress={() => setLineQty(String(Math.max(1, Number(lineQty) - 1)))} className="w-10 h-10 rounded-xl bg-bg-elevated items-center justify-center">
                  <Text className="text-lg font-extrabold">−</Text>
                </Pressable>
                <Text className="amount text-lg font-extrabold flex-1 text-center">{lineQty}</Text>
                <Pressable onPress={() => setLineQty(String(Number(lineQty) + 1))} className="w-10 h-10 rounded-xl bg-bg-elevated items-center justify-center">
                  <Text className="text-lg font-extrabold">+</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setShowAddLine(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                  <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
                </Pressable>
                <Pressable onPress={handleAddLine} disabled={!lineProductId} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                  <Text className="text-papier font-extrabold">{t('inventoryCatalog.add')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowAddLine(true)} className="h-[54px] rounded-2xl border-2 border-dashed border-[#DDD2C3] items-center justify-center flex-row gap-2">
              <Plus size={19} color="#676E7E" />
              <Text className="text-sm font-bold text-text-muted">{t('inventoryCatalog.lineButtonLabel')}</Text>
            </Pressable>
          )}

          {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        </ScrollView>

        <View className="px-5 pt-3 pb-9">
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            className="h-[58px] rounded-2xl bg-success items-center justify-center disabled:opacity-50"
          >
            <Text className="text-papier text-base font-extrabold">{t('inventoryCatalog.sendStockTransferCta')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4">
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.stockTransfersTitle')}</Text>
        </View>
        {tenant.multiDepotEnabled && (
          <Pressable onPress={openCreate} disabled={!canCreate} className="w-10 h-10 rounded-xl bg-primary items-center justify-center disabled:opacity-40">
            <Plus size={18} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {!tenant.multiDepotEnabled && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 flex-row items-start gap-3">
            <Sparkles size={18} color="#B45F2E" />
            <View className="flex-1">
              <Text className="text-sm font-extrabold">{t('settings.multiDepotUpsellTitle')}</Text>
              <Text className="text-[13px] font-semibold text-text-dim mt-0.5">{t('settings.multiDepotUpsellMessage')}</Text>
            </View>
          </View>
        )}
        {tenant.multiDepotEnabled && !canCreate && (
          <View className="p-3 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] font-semibold text-[#33465E]">{t('inventoryCatalog.stockTransfersNeedsSecondDepot')}</Text>
          </View>
        )}
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : transfers.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.stockTransfersEmptyState')}</Text>
        ) : (
          transfers.map((tr) => {
            const colors = statusColors[tr.status]
            const isCrossBoutique = tr.sourceTenantId !== tr.destinationTenantId
            return (
              <View key={tr.id} className="p-3.5 rounded-2xl bg-bg-card border border-border gap-2.5">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-9 h-9 rounded-xl bg-bg-elevated items-center justify-center">
                    {isCrossBoutique ? <Building2 size={16} color="#676E7E" /> : <Package size={16} color="#676E7E" />}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-sm font-bold" numberOfLines={1}>{sideLabel(tr.sourceTenantId, tr.sourceDepotId)}</Text>
                      <ArrowRight size={12} color="#A2A9B8" />
                      <Text className="text-sm font-bold" numberOfLines={1}>{sideLabel(tr.destinationTenantId, tr.destinationDepotId)}</Text>
                    </View>
                    <Text className="text-xs text-text-dim font-semibold mt-0.5">
                      {t('inventoryCatalog.unitsCount', { count: tr.totalUnits })} · {formatDate(tr.createdAt, locale, { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${colors.bg}`}>
                    <Text className={`text-[10px] font-extrabold uppercase ${colors.text}`}>{t(`inventoryCatalog.stockTransferStatus.${tr.status}`)}</Text>
                  </View>
                </View>
                {tr.status === 'IN_TRANSIT' && (
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => handleCancel(tr.id)} disabled={actingId === tr.id} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center disabled:opacity-50">
                      <Text className="text-danger font-bold text-sm">{t('inventoryCatalog.cancelTransferCta')}</Text>
                    </Pressable>
                    <Pressable onPress={() => handleReceive(tr.id)} disabled={actingId === tr.id} className="flex-1 py-2.5 rounded-xl bg-primary items-center flex-row justify-center gap-1.5 disabled:opacity-50">
                      <Check size={14} color="#FFFDFA" />
                      <Text className="text-papier font-extrabold text-sm">{t('inventoryCatalog.receiveTransferCta')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
