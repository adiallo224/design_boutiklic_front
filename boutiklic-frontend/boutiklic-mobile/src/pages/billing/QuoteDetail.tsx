import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, Alert } from 'react-native'
import { ChevronLeft, Trash2, Send, Check, X, Clock, Plus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, formatSellingPrice, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { billingApi, type QuoteResponse, type QuoteStatus } from '../../lib/billingApi'
import { productsApi, type ProductResponse } from '../../lib/productsApi'
import { taxApi, type TaxCategoryResponse } from '../../lib/taxApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useTenant } from '../../hooks/useTenant'
import SelectField from '../../components/SelectField'

interface QuoteDetailProps {
  quoteId: string
  onBack: () => void
  onChanged: (updated: QuoteResponse) => void
}

const STATUS_LABEL_KEY: Record<QuoteStatus, string> = {
  DRAFT: 'billing.statusDraft',
  SENT: 'billing.statusSent',
  ACCEPTED: 'billing.statusAccepted',
  REFUSED: 'billing.statusRefused',
  EXPIRED: 'billing.statusExpired',
  CONVERTED: 'billing.statusConverted',
}

/** Détail d'un devis — mirror mobile de la partie droite de desktop/pages/billing/DesktopQuotes.tsx,
 *  en écran séparé (navigation mobile) plutôt qu'en panneau maître-détail. */
export default function QuoteDetail({ quoteId, onBack, onChanged }: QuoteDetailProps) {
  const { tenant } = useTenant()
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [taxCategories, setTaxCategories] = useState<TaxCategoryResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [lineProductId, setLineProductId] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([billingApi.getById(quoteId), productsApi.search(), taxApi.getActiveCategories()])
      .then(([q, p, c]) => {
        setQuote(q)
        setProducts(p)
        setTaxCategories(c)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId])

  const taxCategoryMap = new Map(taxCategories.map((c) => [c.id, c]))
  const productMap = new Map(products.map((p) => [p.id, p]))

  const refresh = async () => {
    const updated = await billingApi.getById(quoteId)
    setQuote(updated)
    onChanged(updated)
  }

  const handleAddLine = async () => {
    if (!quote || !lineProductId || busy) return
    const product = productMap.get(lineProductId)
    if (!product) return
    const quantity = Math.max(1, parseInt(lineQuantity, 10) || 1)
    setBusy(true)
    setError(null)
    try {
      await billingApi.addLine(quote.id, {
        productId: product.id,
        productName: product.name,
        unitPrice: product.salePrice,
        quantity,
        taxCategoryId: product.taxCategoryId,
      })
      await refresh()
      setLineProductId('')
      setLineQuantity('1')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveLine = (lineId: string) => {
    if (!quote || busy) return
    Alert.alert(t('inventoryCatalog.deleteAriaLabel'), undefined, [
      { text: t('inventoryCatalog.cancel'), style: 'cancel' },
      {
        text: t('inventoryCatalog.deleteAriaLabel'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          setError(null)
          try {
            await billingApi.removeLine(quote.id, lineId)
            await refresh()
          } catch (e) {
            setError(toErrorMessage(e))
          } finally {
            setBusy(false)
          }
        },
      },
    ])
  }

  const runAction = async (action: (id: string) => Promise<QuoteResponse>) => {
    if (!quote || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await action(quote.id)
      setQuote(updated)
      onChanged(updated)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !quote) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center mb-4">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }

  const isDraft = quote.status === 'DRAFT'
  const canTransition = quote.status === 'DRAFT' || quote.status === 'SENT'

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-[17px] font-extrabold tracking-tight" numberOfLines={1}>
            {quote.buyerName}
          </Text>
          <Text className="text-[13px] text-text-dim">{quote.buyerPhone ?? t('billing.noPhone')}</Text>
          {quote.buyerTaxExempt && (
            <Text className="text-[12px] font-extrabold text-succes-text">{t('billing.taxExemptMention', { reason: quote.buyerTaxExemptionReason ?? '' })}</Text>
          )}
        </View>
        <View className="px-2.5 py-1 rounded-full bg-bg-elevated">
          <Text className="text-[11px] font-extrabold">{t(STATUS_LABEL_KEY[quote.status])}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        {quote.lines.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-4">{t('billing.noLinesYet')}</Text>
        ) : (
          quote.lines.map((l) => (
            <View key={l.id} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border">
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold" numberOfLines={1}>
                  {l.productName}
                </Text>
                <Text className="text-[13px] text-text-dim">
                  {t('billing.quantityColumn')} {l.quantity} · {formatSellingPrice(l.unitPrice, locale, tenant.sellingPriceDecimals)} · {l.taxRateApplied != null ? `${l.taxRateApplied}%` : '—'}
                </Text>
              </View>
              <Text className="amount text-[15px] font-extrabold">{formatNumber(l.lineTotalTtc, locale)}</Text>
              {isDraft && (
                <Pressable onPress={() => handleRemoveLine(l.id)} className="w-8 h-8 rounded-lg border border-[#F0C9C2] items-center justify-center">
                  <Trash2 size={14} color="#C6362F" />
                </Pressable>
              )}
            </View>
          ))
        )}

        {isDraft && (
          <View className="p-3.5 rounded-2xl bg-bg-card border border-border gap-2.5">
            <SelectField
              value={lineProductId}
              onChange={setLineProductId}
              placeholder={t('billing.selectProductPlaceholder')}
              options={products.map((p) => ({
                label: `${p.name} — ${formatSellingPrice(p.salePrice, locale, tenant.sellingPriceDecimals)}${p.taxCategoryId ? ` (${taxCategoryMap.get(p.taxCategoryId)?.name ?? ''})` : ''}`,
                value: p.id,
              }))}
            />
            <View className="flex-row gap-2.5">
              <TextInput
                value={lineQuantity}
                onChangeText={setLineQuantity}
                keyboardType="number-pad"
                placeholder={t('billing.quantityColumn')}
                className="w-24 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-bold text-center"
              />
              <Pressable onPress={handleAddLine} disabled={!lineProductId || busy} className="flex-1 h-[48px] rounded-xl bg-primary items-center justify-center flex-row gap-1.5 disabled:opacity-50">
                <Plus size={16} color="#FFFDFA" />
                <Text className="text-papier font-extrabold">{t('billing.addLineCta')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="p-3.5 rounded-2xl bg-bg-card border border-border gap-1.5">
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-text-dim">{t('billing.totalHtLabel')}</Text>
            <Text className="amount text-[13px] font-bold">{formatNumber(quote.totalHt, locale)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-text-dim">{t('billing.totalTaxLabel')}</Text>
            <Text className="amount text-[13px] font-bold">{formatNumber(quote.totalTax, locale)}</Text>
          </View>
          <View className="flex-row justify-between pt-1.5 border-t border-border-hairline">
            <Text className="text-base font-extrabold">{t('billing.totalTtcLabel')}</Text>
            <Text className="amount text-base font-extrabold">{formatNumber(quote.totalTtc, locale)}</Text>
          </View>
        </View>

        {quote.convertedSaleId && <Text className="text-[13px] font-semibold text-text-dim text-center">{t('billing.linkedSaleLabel')}</Text>}
      </ScrollView>

      {(isDraft || canTransition) && (
        <View className="px-5 pt-3 pb-9 gap-2.5">
          {isDraft && (
            <Pressable
              onPress={() => runAction((id) => billingApi.send(id))}
              disabled={quote.lines.length === 0 || busy}
              className="h-[52px] rounded-2xl bg-primary items-center justify-center flex-row gap-2 disabled:opacity-50"
            >
              <Send size={17} color="#FFFDFA" />
              <Text className="text-papier font-extrabold">{t('billing.sendCta')}</Text>
            </Pressable>
          )}
          {canTransition && (
            <View className="flex-row gap-2.5">
              <Pressable onPress={() => runAction((id) => billingApi.expire(id))} disabled={busy} className="flex-1 h-[48px] rounded-xl border border-border-strong items-center justify-center flex-row gap-1.5 disabled:opacity-50">
                <Clock size={15} color="#111418" />
                <Text className="text-sm font-bold">{t('billing.expireCta')}</Text>
              </Pressable>
              <Pressable onPress={() => runAction((id) => billingApi.refuse(id))} disabled={busy} className="flex-1 h-[48px] rounded-xl border border-[#F0C9C2] items-center justify-center flex-row gap-1.5 disabled:opacity-50">
                <X size={15} color="#C6362F" />
                <Text className="text-sm font-bold text-danger">{t('billing.refuseCta')}</Text>
              </Pressable>
              <Pressable
                onPress={() => runAction((id) => billingApi.accept(id))}
                disabled={quote.lines.length === 0 || busy}
                className="flex-1 h-[48px] rounded-xl bg-success items-center justify-center flex-row gap-1.5 disabled:opacity-50"
              >
                <Check size={15} color="#FFFDFA" />
                <Text className="text-sm font-extrabold text-papier">{t('billing.acceptCta')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
