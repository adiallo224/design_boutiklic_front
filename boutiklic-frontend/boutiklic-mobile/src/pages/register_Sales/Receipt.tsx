import { View, Text, Pressable, ScrollView, Share } from 'react-native'
import { Check } from 'lucide-react-native'
import * as Print from 'expo-print'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import { formatDateTime } from '../../lib/dateFormat'
import type { SaleLine } from '../../types'
import type { DiscountInput } from './SaleValidation'
import type { DiscountReason } from '../../lib/discountsApi'
import type { PaymentSplit } from '../../lib/salesApi'

interface ReceiptProps {
  /** Sous-total brut (somme des lignes, avant rabais). */
  total: number
  lines: SaleLine[]
  /** Une entrée par moyen de paiement utilisé (écran B3, paiement fractionné). */
  payments: PaymentSplit[]
  /** true si la vente a été mise en file (lib/outbox) faute de réseau — pas encore de numéro de
   *  ticket serveur, elle sera envoyée dès la reconnexion. */
  pending: boolean
  discount?: DiscountInput
  onClose: () => void
}

export default function Receipt({ total, lines, payments, pending, discount, onClose }: ReceiptProps) {
  const { t } = useTranslation()
  const REASON_LABELS: Record<DiscountReason, string> = {
    LOYAL_CUSTOMER: t('registerSales.discountReasonLoyalCustomer'),
    PRODUCT_DEFECT: t('registerSales.discountReasonProductDefect'),
    NEGOTIATION: t('registerSales.discountReasonNegotiation'),
    PRICING_ERROR: t('registerSales.discountReasonPricingError'),
    OTHER: t('registerSales.discountReasonOther'),
  }
  const METHOD_LABELS: Record<string, string> = {
    CASH: t('registerSales.methodCash'),
    MOBILE_MONEY_ORANGE: t('registerSales.methodOrangeMoney'),
    MOBILE_MONEY_WAVE: t('registerSales.methodWave'),
    DEBT: t('registerSales.methodDebt'),
  }
  const { tenant, formatCurrency } = useTenant()
  const ticketId = Date.now().toString().slice(-4)
  const now = formatDateTime(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const netTotal = total - (discount?.amount ?? 0)
  const isSingleCash = payments.length === 1 && payments[0].method === 'CASH'
  const change = isSingleCash && payments[0].amount > netTotal ? payments[0].amount - netTotal : 0
  const ticketLabel = pending ? t('registerSales.pendingSyncLabel') : t('registerSales.ticketNumber', { id: ticketId })

  const ticketText = [
    tenant.name.toUpperCase(),
    [tenant.city, tenant.phone].filter(Boolean).join(' · '),
    `${now} · ${ticketLabel}`,
    '',
    ...lines.map((line) => `${line.productName} ×${line.quantity} — ${line.lineTotal.toLocaleString('fr-FR')},00`),
    '',
    discount ? `${t('registerSales.subtotal')} : ${total.toLocaleString('fr-FR')},00` : null,
    discount ? `${t('registerSales.discountLabel', { reason: REASON_LABELS[discount.reason] })} : −${discount.amount.toLocaleString('fr-FR')},00` : null,
    `${t('registerSales.total')} : ${formatCurrency(netTotal)}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')

  const handleShare = () => {
    Share.share({ message: ticketText }).catch(() => undefined)
  }

  const handlePrint = () => {
    const html = `
      <html><body style="font-family:sans-serif;padding:24px;">
        <h2>${tenant.name.toUpperCase()}</h2>
        <p>${[tenant.city, tenant.phone].filter(Boolean).join(' · ')}</p>
        <p>${now} · ${ticketLabel}</p>
        <hr/>
        <ul>${lines.map((line) => `<li>${line.productName} ×${line.quantity} — ${line.lineTotal.toLocaleString('fr-FR')},00</li>`).join('')}</ul>
        <hr/>
        <h3>${t('registerSales.total')} : ${formatCurrency(netTotal)}</h3>
      </body></html>
    `
    Print.printAsync({ html }).catch(() => undefined)
  }

  return (
    <View className="flex-1 bg-success relative overflow-hidden">
      <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />

      <View className="items-center gap-3 pt-5 pb-5">
        <View className="w-[66px] h-[66px] rounded-full bg-papier/20 items-center justify-center">
          <View className="w-12 h-12 rounded-full bg-papier items-center justify-center">
            <Check size={26} strokeWidth={3} color="#0E7A52" />
          </View>
        </View>
        <Text className="font-display text-2xl font-extrabold text-papier">{pending ? t('registerSales.saleSavedOffline') : t('registerSales.saleSaved')}</Text>
      </View>

      {pending && (
        <View className="mx-5 mb-3 p-3.5 rounded-2xl bg-papier/15 border border-papier/30">
          <Text className="text-[13px] font-semibold text-papier text-center">
            {t('registerSales.offlinePendingNotice')}
          </Text>
        </View>
      )}

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="bg-bg-card rounded-t-[20px] p-5 pb-4 gap-4">
          <View className="items-center gap-0.5 pb-3.5 border-b border-dashed border-[#DDD2C3]">
            <Text className="font-display text-lg font-extrabold tracking-tight">{tenant.name.toUpperCase()}</Text>
            <Text className="text-xs font-semibold text-text-dim">{[tenant.city, tenant.phone].filter(Boolean).join(' · ')}</Text>
            <Text className="amount text-xs font-semibold text-text-dim">
              {now} · {ticketLabel}
            </Text>
          </View>
          <View className="gap-2">
            {lines.map((line) => (
              <View key={line.id} className="flex-row justify-between">
                <Text className="text-[15px] font-semibold">
                  {line.productName} ×{line.quantity}
                </Text>
                <Text className="amount text-[15px] font-bold">{line.lineTotal.toLocaleString('fr-FR')},00</Text>
              </View>
            ))}
          </View>
          <View className="border-t border-dashed border-[#DDD2C3] pt-3.5 gap-1.5">
            {discount && (
              <>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-semibold text-[#5C5147]">{t('registerSales.subtotal')}</Text>
                  <Text className="amount text-sm font-bold text-[#5C5147]">{total.toLocaleString('fr-FR')},00</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm font-semibold text-terracotta">{t('registerSales.discountLabel', { reason: REASON_LABELS[discount.reason] })}</Text>
                  <Text className="amount text-sm font-bold text-terracotta">−{discount.amount.toLocaleString('fr-FR')},00</Text>
                </View>
              </>
            )}
            <View className="flex-row justify-between items-baseline">
              <Text className="text-[15px] font-extrabold">{t('registerSales.total')}</Text>
              <Text className="amount text-2xl font-extrabold">{formatCurrency(netTotal)}</Text>
            </View>
            {payments.map((p) => (
              <View key={p.method} className="flex-row justify-between">
                <Text className="text-sm font-semibold text-[#5C5147]">{METHOD_LABELS[p.method] ?? p.method}</Text>
                <Text className="amount text-sm font-bold text-[#5C5147]">{p.amount.toLocaleString('fr-FR')},00</Text>
              </View>
            ))}
            {change > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold text-success">{t('registerSales.changeDue')}</Text>
                <Text className="amount text-sm font-extrabold text-success">{change.toLocaleString('fr-FR')},00</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-3.5 pt-3 border-t border-dashed border-[#DDD2C3]">
            <View className="w-16 h-16 bg-encre rounded-lg p-1.5">
              <View className="flex-1 rounded-sm bg-papier" />
            </View>
            <Text className="flex-1 text-[13px] leading-relaxed text-[#5C5147]">{t('registerSales.qrHint')}</Text>
          </View>
        </View>
      </ScrollView>

      <View className="px-5 pt-4 pb-9 gap-2.5">
        <View className="flex-row gap-2.5">
          <Pressable onPress={handleShare} className="flex-1 h-[58px] rounded-2xl bg-papier items-center justify-center">
            <Text className="text-succes-text text-base font-extrabold">{t('registerSales.share')}</Text>
          </Pressable>
          <Pressable onPress={handlePrint} className="flex-1 h-[58px] rounded-2xl bg-papier/15 border border-papier/35 items-center justify-center">
            <Text className="text-papier text-base font-bold">{t('registerSales.print')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onClose} className="h-[60px] rounded-2xl bg-warning items-center justify-center">
          <Text className="text-encre text-lg font-extrabold">{t('registerSales.newSale')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
