import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, Plus, X, Info } from 'lucide-react-native'
import { Trans, useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { resellerApi, type ResellerResponse } from '../../lib/resellerApi'
import { productsApi, type ProductResponse } from '../../lib/productsApi'
import { toE164Phone } from '../../lib/authApi'
import { PHONE_COUNTRIES, countryIdFromPhone, formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { toErrorMessage } from '../../lib/apiClient'
import SelectField from '../../components/SelectField'
import PhoneNumberField from '../../components/PhoneNumberField'

interface NewConsignmentOutProps {
  /** Numéro déjà connu quand on arrive depuis la fiche revendeur (bouton "Sortie", écran C10). */
  presetResellerPhone?: string
  onBack: () => void
  onCompleted: () => void
}

interface DraftLine {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

export default function NewConsignmentOut({ presetResellerPhone, onBack, onCompleted }: NewConsignmentOutProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [resellers, setResellers] = useState<ResellerResponse[]>([])
  const [resellerPhone, setResellerPhone] = useState(presetResellerPhone ?? '')
  const [showNewReseller, setShowNewReseller] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCountryId, setNewCountryId] = useState('GN')
  const [newPhone, setNewPhone] = useState('')
  const [creatingReseller, setCreatingReseller] = useState(false)

  // Préselectionne l'indicatif de la boutique (dérivé de son téléphone déjà enregistré) dès qu'il
  // est connu, plutôt que de rester figé sur la Guinée — cf. countryIdFromPhone.
  useEffect(() => {
    if (tenant.phone) setNewCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  const [products, setProducts] = useState<ProductResponse[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [showAddLine, setShowAddLine] = useState(false)
  const [lineProductId, setLineProductId] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [lineUnitPrice, setLineUnitPrice] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([resellerApi.getResellers('late'), productsApi.search()])
      .then(([r, p]) => {
        setResellers(r)
        setProducts(p)
      })
      .catch((e) => setError(toErrorMessage(e)))
  }, [])

  const selectedReseller = resellers.find((r) => r.phone === resellerPhone)
  const totalToRecover = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  const handleCreateReseller = async () => {
    if (newName.trim().length === 0 || newPhone.trim().length < 8) return
    setCreatingReseller(true)
    setError(null)
    try {
      const dialCode = PHONE_COUNTRIES.find((c) => c.id === newCountryId)?.dialCode ?? '+224'
      const phone = toE164Phone(newPhone.trim(), dialCode)
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

  const openAddLine = () => {
    setLineProductId('')
    setLineQty('1')
    setLineUnitPrice('')
    setShowAddLine(true)
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
    setShowAddLine(false)
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
      onBack()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('resellerConsignment.newConsignmentButton')}</Text>
      </View>

      <View className="px-5 pb-3.5 gap-2">
        <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('resellerConsignment.resellerSectionTitle')}</Text>
        {showNewReseller ? (
          <View className="p-4 rounded-2xl border border-border-strong bg-bg-card gap-2.5">
            <TextInput value={newName} onChangeText={setNewName} placeholder={t('resellerConsignment.resellerNamePlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
            <PhoneNumberField countryId={newCountryId} setCountryId={setNewCountryId} phone={newPhone} setPhone={setNewPhone} label={t('resellerConsignment.resellerPhoneNumberLabel')} />
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowNewReseller(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                <Text className="text-text-muted font-bold">{t('resellerConsignment.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleCreateReseller} disabled={creatingReseller || newName.trim().length === 0 || newPhone.trim().length < 8} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{creatingReseller ? t('resellerConsignment.creating') : t('resellerConsignment.create')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SelectField
                value={resellerPhone}
                onChange={setResellerPhone}
                options={resellers.map((r) => ({ label: r.name, value: r.phone }))}
                placeholder={t('resellerConsignment.chooseReseller')}
                className="border-2 border-encre"
              />
            </View>
            <Pressable onPress={() => setShowNewReseller(true)} className="px-3.5 h-[54px] rounded-xl bg-bg-elevated items-center justify-center">
              <Text className="text-xs font-bold text-primary">{t('resellerConsignment.newResellerButton')}</Text>
            </Pressable>
          </View>
        )}
        {selectedReseller && selectedReseller.totalRemaining > 0 && (
          <Text className="text-[12.5px] font-semibold text-[#D84E2A] px-1">
            {t('resellerConsignment.alreadyOutside', { amount: formatNumber(selectedReseller.totalRemaining, locale), currency: tenant.currency })}
          </Text>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-extrabold tracking-widest text-text-dim">
          {t('resellerConsignment.merchandiseOutTitle', { count: lines.length })}
        </Text>
        {lines.map((line, i) => (
          <View key={i} className="flex-row items-center gap-3 p-3 rounded-2xl bg-bg-card border border-border">
            <View className="w-[42px] h-[42px] rounded-xl bg-bg-elevated items-center justify-center">
              <Text className="text-lg">📦</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-bold">{line.productName}</Text>
              <Text className="amount text-[13px] font-semibold text-text-dim">
                {line.quantity} × {formatNumber(line.unitPrice, locale)}
              </Text>
            </View>
            <Text className="amount text-base font-extrabold">{formatNumber(line.quantity * line.unitPrice, locale)}</Text>
            <Pressable onPress={() => removeLine(i)} className="w-7 h-7 rounded-full bg-bg-elevated items-center justify-center">
              <X size={14} color="#A2A9B8" />
            </Pressable>
          </View>
        ))}

        {showAddLine ? (
          <View className="p-4 rounded-2xl border border-border-strong bg-bg-card gap-2.5">
            <SelectField value={lineProductId} onChange={handleProductPicked} options={products.map((p) => ({ label: p.name, value: p.id }))} placeholder={t('resellerConsignment.chooseItem')} />
            <View className="flex-row gap-2.5">
              <TextInput keyboardType="number-pad" value={lineQty} onChangeText={setLineQty} placeholder={t('resellerConsignment.quantityPlaceholder')} className="amount flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold" />
              <TextInput
                keyboardType="number-pad"
                value={lineUnitPrice}
                onChangeText={setLineUnitPrice}
                placeholder={t('resellerConsignment.myUnitPricePlaceholder')}
                className="amount flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold"
              />
            </View>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowAddLine(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                <Text className="text-text-muted font-bold">{t('resellerConsignment.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleAddLine} disabled={!lineProductId || Number(lineQty) <= 0 || Number(lineUnitPrice) <= 0} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{t('resellerConsignment.addLineButton')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={openAddLine} disabled={products.length === 0} className="h-[54px] rounded-2xl border-2 border-dashed border-[#DDD2C3] items-center justify-center flex-row gap-2 disabled:opacity-50">
            <Plus size={19} color="#676E7E" />
            <Text className="text-sm font-bold text-text-muted">{t('resellerConsignment.addItemButton')}</Text>
          </Pressable>
        )}

        <View className="p-[13px] rounded-2xl bg-[#EAF0F7] border border-[#D3DFEC] flex-row gap-2.5 mt-0.5">
          <Info size={18} color="#0E2038" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] leading-[19px] text-[#33465E]">
            <Trans t={t} i18nKey="resellerConsignment.priceNotice" components={{ strong: <Text className="font-bold" /> }} />
          </Text>
        </View>
      </ScrollView>

      {error && <Text className="px-5 pt-2 text-[13px] font-semibold text-danger">{error}</Text>}

      <View className="px-5 pt-3 pb-9 gap-2.5">
        <View className="flex-row items-center justify-between p-4 rounded-2xl bg-bg-elevated">
          <Text className="text-sm font-bold text-[#5C5147]">{t('resellerConsignment.totalToRecover')}</Text>
          <Text className="amount text-2xl font-extrabold tracking-tight">{formatNumber(totalToRecover, locale)}</Text>
        </View>
        <Pressable onPress={handleSubmit} disabled={submitting || !resellerPhone || lines.length === 0} className="h-[62px] rounded-[18px] bg-terracotta items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-lg font-extrabold">{submitting ? t('resellerConsignment.recording') : t('resellerConsignment.validateConsignmentOut')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
