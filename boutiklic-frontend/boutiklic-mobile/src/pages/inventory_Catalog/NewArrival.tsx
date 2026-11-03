import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { Check, ChevronLeft, Plus, Camera, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react-native'
import { mergePreselection, type LabelPreselection } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { suppliersApi, type SupplierResponse } from '../../lib/suppliersApi'
import { productsApi, type ProductResponse } from '../../lib/productsApi'
import { inventoryApi, type StockIntakeLine } from '../../lib/inventoryApi'
import { depotsApi, type DepotResponse } from '../../lib/depotsApi'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import { toE164Phone } from '../../lib/authApi'
import { PHONE_COUNTRIES, countryIdFromPhone, currencyDecimals, isSupportedLocale, DEFAULT_LOCALE, formatNumber, effectiveUnitCost, formatUnitCost, intakeCostIgnored, intakeLineTotal, intakeLineUnitCost, roundHalfUp, unitCostFromPack } from '@boutiklic/shared'
import SelectField from '../../components/SelectField'
import MoneyInput from '../../components/MoneyInput'
import PhoneNumberField from '../../components/PhoneNumberField'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'
import SupplierDetail from './SupplierDetail'

interface NewArrivalProps {
  onBack: () => void
  onCompleted: () => void
  /** Impression d'étiquettes des unités reçues (quantité = unités de chaque ligne) — absent pour un rôle qui ne peut pas imprimer. */
  onPrintLabels?: (items: LabelPreselection[]) => void
}

interface DraftLine extends StockIntakeLine {
  productName: string
}

export default function NewArrival({ onBack, onCompleted, onPrintLabels }: NewArrivalProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const priceDecimals = currencyDecimals(tenant.currency)
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [supplierId, setSupplierId] = useState('')
  // Affiché seulement si la boutique a plus d'un dépôt actif (phase 2b de l'étude
  // study/etude_multi_depots_transferts.md §2.2) — la quasi-totalité n'en ont qu'un.
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [depotId, setDepotId] = useState('')
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierCountryId, setNewSupplierCountryId] = useState('GN')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [viewingSupplier, setViewingSupplier] = useState(false)

  // Préselectionne l'indicatif de la boutique (dérivé de son téléphone déjà enregistré) dès qu'il
  // est connu, plutôt que de rester figé sur la Guinée — cf. countryIdFromPhone.
  useEffect(() => {
    if (tenant.phone) setNewSupplierCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  const [products, setProducts] = useState<ProductResponse[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  /** Arrivage enregistré : on propose d'imprimer les étiquettes avant de quitter. */
  const [recorded, setRecorded] = useState<{ items: LabelPreselection[]; units: number } | null>(null)
  const [showAddLine, setShowAddLine] = useState(false)
  const [lineProductId, setLineProductId] = useState('')
  // En mode lot, lineQty est le NOMBRE DE LOTS (et non d'unités) : les unités en stock = lots × unités par lot.
  const [lineQty, setLineQty] = useState('1')
  const [lineUnitPrice, setLineUnitPrice] = useState('')
  const [linePackMode, setLinePackMode] = useState(false)
  const [lineUnitsPerPack, setLineUnitsPerPack] = useState('')
  const [linePackPrice, setLinePackPrice] = useState('')

  // TVA payée au fournisseur sur cet arrivage (déductible) — saisie à part du coût d'achat, proposée seulement si la boutique applique la TVA.
  const [deductibleVat, setDeductibleVat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    Promise.all([suppliersApi.getAll(), productsApi.search(), depotsApi.getAll()])
      .then(([s, p, d]) => {
        setSuppliers(s)
        setProducts(p)
        const activeDepots = d.filter((depot) => depot.active)
        setDepots(activeDepots)
        setDepotId(activeDepots.find((depot) => depot.isDefault)?.id ?? activeDepots[0]?.id ?? '')
      })
      .catch((e) => setError(toErrorMessage(e)))
  }, [])

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0)
  const totalSpent = lines.reduce((s, l) => s + intakeLineTotal(l), 0)
  const selectedSupplier = suppliers.find((s) => s.id === supplierId)

  const handleCreateSupplier = async () => {
    if (newSupplierName.trim().length === 0) return
    setCreatingSupplier(true)
    setError(null)
    const supplierCountry = PHONE_COUNTRIES.find((c) => c.id === newSupplierCountryId)?.dialCode ?? '+224'
    const payload = {
      name: newSupplierName.trim(),
      phone: newSupplierPhone.trim() ? toE164Phone(newSupplierPhone.trim(), supplierCountry) : undefined,
      currency: tenant.currency,
    }
    try {
      const supplier = await suppliersApi.create(payload)
      setSuppliers((prev) => [...prev, supplier])
      setSupplierId(supplier.id)
      setShowNewSupplier(false)
      setNewSupplierName('')
      setNewSupplierPhone('')
    } catch (e) {
      // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
      // rejoué au retour du réseau (cf. lib/syncEngine.ts). Pas d'id serveur avant synchro : on ne
      // peut pas le sélectionner pour cet arrivage tout de suite, contrairement à un ajustement de
      // stock où le delta est déjà connu (cf. ProductDetail.applyDelta).
      if (e instanceof NetworkError) {
        await syncEngine.enqueue('CREATE_SUPPLIER', JSON.stringify(payload))
        setError(t('inventoryCatalog.supplierQueuedOffline'))
        setShowNewSupplier(false)
        setNewSupplierName('')
        setNewSupplierPhone('')
      } else {
        setError(toErrorMessage(e))
      }
    } finally {
      setCreatingSupplier(false)
    }
  }

  const openAddLine = () => {
    setLineProductId('')
    setLineQty('1')
    setLineUnitPrice('')
    setLinePackMode(false)
    setLineUnitsPerPack('')
    setLinePackPrice('')
    setShowAddLine(true)
  }

  const handleProductPicked = (productId: string) => {
    setLineProductId(productId)
    const product = products.find((p) => p.id === productId)
    if (!product) return
    if (product.packSize != null && product.packPurchasePrice != null) {
      // Un article acheté en lot est réceptionné en lot par défaut (1 lot), avec le lot connu de sa fiche.
      setLinePackMode(true)
      setLineQty('1')
      setLineUnitsPerPack(String(product.packSize))
      setLinePackPrice(String(product.packPurchasePrice))
    } else {
      setLinePackMode(false)
      setLineUnitPrice(String(product.purchasePrice))
    }
  }

  const linePackSizeNum = Number(lineUnitsPerPack) || 0
  const linePackPriceNum = Number(linePackPrice) || 0
  const lineQtyNum = Number(lineQty)
  const lineUnitCost = unitCostFromPack(linePackPriceNum, linePackSizeNum)
  const canAddLine = linePackMode
    ? !!lineProductId && lineQtyNum >= 1 && linePackSizeNum >= 1 && linePackPrice !== ''
    : !!lineProductId && lineQtyNum > 0 && lineUnitPrice !== ''

  /** En méthode manuelle, l'arrivage ne change jamais le coût de la fiche : prévient quand le coût de la ligne diffère de celui de la fiche. */
  const ignoredCost = (line: DraftLine) => {
    const product = products.find((p) => p.id === line.productId)
    if (!product) return null
    const sheet = effectiveUnitCost(product)
    const lineCost = intakeLineUnitCost(line)
    return intakeCostIgnored(tenant.costMethod, lineCost, sheet)
      ? { sheet: formatUnitCost(sheet, locale), line: formatUnitCost(lineCost, locale) }
      : null
  }

  const handleAddLine = () => {
    const product = products.find((p) => p.id === lineProductId)
    if (!product || !canAddLine) return
    if (linePackMode) {
      // Quantité (unités) et coût unitaire sont DÉRIVÉS du lot, comme côté serveur (qui ignore ce qu'on lui envoie ici).
      setLines((prev) => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: lineQtyNum * linePackSizeNum,
        unitPurchasePrice: roundHalfUp(lineUnitCost),
        packCount: lineQtyNum,
        unitsPerPack: linePackSizeNum,
        packPrice: linePackPriceNum,
      }])
    } else {
      const unitPrice = Number(lineUnitPrice)
      if (unitPrice < 0) return
      setLines((prev) => [...prev, { productId: product.id, productName: product.name, quantity: lineQtyNum, unitPurchasePrice: unitPrice }])
    }
    setShowAddLine(false)
  }

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const handleScanDetected = (code: string) => {
    setShowScanner(false)
    setError(null)
    // products contient déjà tout le catalogue (chargé au montage) — pas besoin d'un nouvel appel réseau.
    const match = products.find((p) => p.barcode === code)
    if (!match) {
      setError(t('inventoryCatalog.noArticleWithBarcode'))
      return
    }
    setLineQty('1')
    handleProductPicked(match.id)
    setShowAddLine(true)
  }

  const deductibleVatNum = tenant.taxEnabled ? parseFloat(deductibleVat) || 0 : 0
  const deductibleVatTooHigh = deductibleVatNum > totalSpent

  const handleSubmit = async () => {
    if (lines.length === 0 || deductibleVatTooHigh) return
    setSubmitting(true)
    setError(null)
    const payload = {
      supplierId: supplierId || undefined,
      currency: tenant.currency,
      lines: lines.map(({ productId, quantity, unitPurchasePrice, packCount, unitsPerPack, packPrice }) => ({ productId, quantity, unitPurchasePrice, packCount, unitsPerPack, packPrice })),
      depotId: depotId || undefined,
      deductibleVat: deductibleVatNum > 0 ? deductibleVatNum : undefined,
    }
    try {
      try {
        await inventoryApi.createIntake(payload)
      } catch (e) {
        // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
        // rejoué au retour du réseau (cf. lib/syncEngine.ts). Le stock affiché ne bougera qu'au
        // prochain instantané synchronisé (cf. lib/stockCache.ts) — limitation connue.
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('CREATE_STOCK_INTAKE', JSON.stringify({ ...payload, occurredAt: new Date().toISOString() }))
      }
      onCompleted()
      if (onPrintLabels) {
        setRecorded({
          items: mergePreselection(lines.map((l) => ({ productId: l.productId, copies: l.quantity }))),
          units: totalUnits,
        })
      } else {
        onBack()
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (viewingSupplier && supplierId) {
    return <SupplierDetail supplierId={supplierId} onBack={() => setViewingSupplier(false)} onNewOrder={() => setViewingSupplier(false)} />
  }

  if (recorded && onPrintLabels) {
    return (
      <View className="flex-1 bg-bg px-5 justify-center gap-5">
        <View className="gap-2">
          <Text className="text-[22px] font-extrabold tracking-tight">{t('labels.arrival.title')}</Text>
          <Text className="text-[15px] leading-relaxed text-text-muted">
            {t('labels.arrival.message', { count: recorded.items.length, units: recorded.units })}
          </Text>
        </View>
        <Pressable onPress={() => onPrintLabels(recorded.items)} className="h-[58px] rounded-2xl bg-primary flex-row items-center justify-center gap-2.5">
          <Printer size={19} color="#FFFDFA" />
          <Text className="text-papier text-base font-extrabold">{t('labels.arrival.print')}</Text>
        </Pressable>
        <Pressable onPress={onBack} className="h-[52px] rounded-2xl border border-border-strong bg-bg-card items-center justify-center">
          <Text className="font-bold">{t('labels.arrival.skip')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.newArrivalTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.newArrivalSubtitle')}</Text>
        </View>
      </View>

      <View className="px-5 pb-3.5">
        {showNewSupplier ? (
          <View className="p-4 rounded-2xl border border-border-strong bg-bg-card gap-2.5">
            <TextInput value={newSupplierName} onChangeText={setNewSupplierName} placeholder={t('inventoryCatalog.supplierNamePlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
            <PhoneNumberField
              countryId={newSupplierCountryId}
              setCountryId={setNewSupplierCountryId}
              phone={newSupplierPhone}
              setPhone={setNewSupplierPhone}
              label={t('inventoryCatalog.phoneOptionalUpperLabel')}
            />
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowNewSupplier(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleCreateSupplier} disabled={creatingSupplier || newSupplierName.trim().length === 0} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{creatingSupplier ? t('inventoryCatalog.creating') : t('inventoryCatalog.create')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SelectField
                value={supplierId}
                onChange={setSupplierId}
                options={[{ label: t('inventoryCatalog.noSupplier'), value: '' }, ...suppliers.map((s) => ({ label: s.name, value: s.id }))]}
                placeholder={t('inventoryCatalog.noSupplier')}
              />
            </View>
            {selectedSupplier && (
              <Pressable onPress={() => setViewingSupplier(true)} className="px-3 py-3 rounded-xl bg-bg-elevated">
                <Text className="text-xs font-bold text-encre">{t('inventoryCatalog.supplierSheetCta')}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setShowNewSupplier(true)} className="px-3 py-3 rounded-xl bg-bg-elevated">
              <Text className="text-xs font-bold text-primary">+ {t('inventoryCatalog.newSupplierCta')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {depots.length > 1 && (
        <View className="px-5 pb-3.5 gap-1.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.depotNameLabel')}</Text>
          <SelectField
            value={depotId}
            onChange={setDepotId}
            options={depots.map((d) => ({ label: d.isDefault ? `${d.name} (${t('settings.defaultDepotBadge')})` : d.name, value: d.id }))}
          />
        </View>
      )}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.receivedItemsHeader', { count: lines.length })}</Text>
        {lines.map((line, i) => (
          <View key={i} className="flex-row items-center gap-3 p-3 rounded-2xl bg-bg-card border border-border">
            <View className="w-[42px] h-[42px] rounded-xl bg-bg-elevated items-center justify-center">
              <Text className="text-lg">📦</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-bold">{line.productName}</Text>
              <Text className="amount text-[13px] font-semibold text-text-dim">
                {line.packCount != null && line.unitsPerPack != null && line.packPrice != null
                  ? `${t('inventoryCatalog.packLineSummary', { count: line.packCount, units: line.unitsPerPack })} · ${formatUnitCost(unitCostFromPack(line.packPrice, line.unitsPerPack), locale)}`
                  : `${line.quantity} × ${formatNumber(line.unitPurchasePrice, locale)}`}
              </Text>
              {ignoredCost(line) && (
                <Text className="text-[12px] font-semibold leading-snug text-[#8A6712]">{t('inventoryCatalog.intakeCostIgnored', ignoredCost(line)!)}</Text>
              )}
            </View>
            <Text className="amount text-base font-extrabold">{formatNumber(intakeLineTotal(line), locale)}</Text>
            <Pressable onPress={() => removeLine(i)} className="w-7 h-7 rounded-full bg-bg-elevated items-center justify-center">
              <X size={14} color="#A2A9B8" />
            </Pressable>
          </View>
        ))}

        {lines.length > 0 && (tenant.costMethod === 'LAST_PRICE' || tenant.costMethod === 'WEIGHTED_AVERAGE') && (
          <Text className="text-xs leading-relaxed text-text-muted">{t(`inventoryCatalog.intakeCostWillUpdate.${tenant.costMethod}`)}</Text>
        )}

        {showAddLine ? (
          <View className="p-4 rounded-2xl border border-border-strong bg-bg-card gap-2.5">
            <SelectField
              value={lineProductId}
              onChange={handleProductPicked}
              options={products.map((p) => ({ label: p.name, value: p.id }))}
              placeholder={t('inventoryCatalog.chooseArticlePlaceholder')}
            />
            <Pressable onPress={() => setLinePackMode((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: linePackMode }} className="flex-row items-center gap-2.5">
              <View className={`w-[22px] h-[22px] rounded-md border-2 items-center justify-center ${linePackMode ? 'bg-primary border-primary' : 'border-border-strong bg-bg'}`}>
                {linePackMode && <Check size={14} color="#FFFDFA" />}
              </View>
              <Text className="text-sm font-semibold">{t('inventoryCatalog.packToggleLabel')}</Text>
            </Pressable>
            <View className="flex-row gap-2.5">
              <TextInput keyboardType="number-pad" value={lineQty} onChangeText={setLineQty} placeholder={linePackMode ? t('inventoryCatalog.packCountPlaceholder') : t('inventoryCatalog.quantityPlaceholder')} className="amount flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold" />
              {linePackMode ? (
                <TextInput
                  keyboardType="number-pad"
                  value={lineUnitsPerPack}
                  onChangeText={(v: string) => setLineUnitsPerPack(v.replace(/[^0-9]/g, ''))}
                  placeholder={t('inventoryCatalog.packSizeLabel')}
                  className="amount flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold"
                />
              ) : (
                <MoneyInput
                  value={lineUnitPrice}
                  onValueChange={setLineUnitPrice}
                  decimals={priceDecimals}
                  placeholder={t('inventoryCatalog.unitPurchasePricePlaceholder')}
                  className="amount flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold"
                />
              )}
            </View>
            {linePackMode && (
              <>
                <MoneyInput
                  value={linePackPrice}
                  onValueChange={setLinePackPrice}
                  decimals={priceDecimals}
                  placeholder={t('inventoryCatalog.packPriceLabel')}
                  className="amount h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold"
                />
                {linePackSizeNum >= 1 && linePackPrice !== '' && (
                  <Text testID="arrival-pack-summary" className="text-xs font-semibold text-text-dim">
                    {t('inventoryCatalog.packLineSummary', { count: lineQtyNum || 0, units: linePackSizeNum })} = {(lineQtyNum || 0) * linePackSizeNum} · {t('inventoryCatalog.unitCostLabel')} {formatUnitCost(lineUnitCost, locale)} {tenant.currency}
                  </Text>
                )}
              </>
            )}
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowAddLine(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleAddLine} disabled={!canAddLine} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{t('inventoryCatalog.add')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row gap-2.5 mt-0.5 mb-1">
            <Pressable onPress={openAddLine} disabled={products.length === 0} className="flex-1 h-[54px] rounded-2xl border-2 border-dashed border-[#DDD2C3] items-center justify-center flex-row gap-2 disabled:opacity-50">
              <Plus size={19} color="#676E7E" />
              <Text className="text-sm font-bold text-text-muted">{t('inventoryCatalog.lineButtonLabel')}</Text>
            </Pressable>
            <Pressable onPress={() => setShowScanner(true)} className="flex-1 h-[54px] rounded-2xl bg-primary items-center justify-center flex-row gap-2">
              <Camera size={19} color="#FFFDFA" />
              <Text className="text-sm font-extrabold text-papier">{t('inventoryCatalog.scanButtonLabel')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {error && <Text className="px-5 pt-2 text-[13px] font-semibold text-danger">{error}</Text>}

      <View className="px-5 pt-3 pb-9 gap-2.5">
        <View className="flex-row items-center justify-between p-4 rounded-2xl bg-bg-elevated">
          <View className="gap-0.5">
            <Text className="text-sm font-bold text-[#5C5147]">{t('inventoryCatalog.totalSpentLabel')}</Text>
            <Text className="text-xs font-semibold text-text-dim">{t('inventoryCatalog.unitsAddedToStock', { count: totalUnits })}</Text>
          </View>
          <Text className="amount text-2xl font-extrabold tracking-tight">{formatNumber(totalSpent, locale)}</Text>
        </View>
        {tenant.taxEnabled && (
          <View className="gap-1.5 p-4 rounded-2xl bg-bg-elevated">
            <Text className="text-sm font-bold text-[#5C5147]">{t('inventoryCatalog.deductibleVatLabel')}</Text>
            <MoneyInput
              value={deductibleVat}
              onValueChange={setDeductibleVat}
              decimals={priceDecimals}
              placeholder="0"
              accessibilityLabel={t('inventoryCatalog.deductibleVatLabel')}
              className="amount h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold"
            />
            <Text className={`text-[11px] leading-snug ${deductibleVatTooHigh ? 'font-semibold text-danger' : 'text-text-muted'}`}>
              {deductibleVatTooHigh ? t('inventoryCatalog.deductibleVatTooHigh') : t('inventoryCatalog.deductibleVatHelp')}
            </Text>
          </View>
        )}
        <Pressable onPress={handleSubmit} disabled={submitting || lines.length === 0 || deductibleVatTooHigh} className="h-[62px] rounded-[18px] bg-success items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-lg font-extrabold">{submitting ? t('inventoryCatalog.saving') : t('inventoryCatalog.validateArrival')}</Text>
        </Pressable>
      </View>

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onDetected={handleScanDetected} />
    </View>
  )
}
