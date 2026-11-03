import { View, Text, Pressable } from 'react-native'
import * as Print from 'expo-print'
import { Printer } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { formatDate } from '../../lib/dateFormat'
import type { InvoiceResponse } from '../../lib/billingApi'

interface InvoiceDocumentViewProps {
  invoice: InvoiceResponse
  hidePrintButton?: boolean
}

/** Document facture, mirror mobile de desktop/pages/billing/InvoiceDocumentView.tsx — mêmes
 *  mentions légales (Code Général des Impôts Guinée, Art.383.VI), même absence de dépendance PDF :
 *  `expo-print` (déjà utilisé pour le ticket de caisse, cf. Receipt.tsx) ouvre la boîte d'impression
 *  OS, qui permet "Enregistrer en PDF" — équivalent exact de window.print() côté desktop. */
export default function InvoiceDocumentView({ invoice, hidePrintButton }: InvoiceDocumentViewProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  const handlePrint = () => {
    const rows = invoice.lines
      .map(
        (l) => `
          <tr>
            <td style="padding:6px 8px;">${l.productName}</td>
            <td style="padding:6px 8px;text-align:right;">${l.quantity}</td>
            <td style="padding:6px 8px;text-align:right;">${formatNumber(l.quantity > 0 ? l.lineTotalHt / l.quantity : 0, locale)}</td>
            <td style="padding:6px 8px;text-align:right;">${l.taxRateApplied != null ? `${l.taxRateApplied}%` : '—'}</td>
            <td style="padding:6px 8px;text-align:right;">${formatNumber(l.taxAmount, locale)}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:bold;">${formatNumber(l.lineTotalTtc, locale)}</td>
          </tr>`,
      )
      .join('')

    const html = `
      <html><body style="font-family:sans-serif;padding:24px;color:#1A1A1A;">
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;">${invoice.sellerName}</h2>
            ${invoice.sellerAddress ? `<div>${invoice.sellerAddress}</div>` : ''}
            ${invoice.sellerPhone ? `<div>${t('billing.phoneLabel')} : ${invoice.sellerPhone}</div>` : ''}
            ${invoice.sellerTaxId ? `<div>${t('billing.taxIdLabel')} : ${invoice.sellerTaxId}</div>` : ''}
            ${invoice.sellerVatRegistrationKey ? `<div>${t('billing.vatRegistrationKeyLabel')} : ${invoice.sellerVatRegistrationKey}</div>` : ''}
            ${invoice.sellerRccm ? `<div>${t('billing.rccmLabel')} : ${invoice.sellerRccm}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="color:#D84E2A;font-weight:bold;text-transform:uppercase;font-size:11px;">${t('billing.invoiceDocumentTitle')}</div>
            <div style="font-size:20px;font-weight:bold;">${invoice.number}</div>
            <div>${formatDate(invoice.issuedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <div style="text-transform:uppercase;font-size:11px;color:#676E7E;">${t('billing.billedToLabel')}</div>
          <div style="font-weight:bold;">${invoice.buyerName}</div>
          ${invoice.buyerPhone ? `<div>${invoice.buyerPhone}</div>` : ''}
          ${invoice.buyerAddress ? `<div>${invoice.buyerAddress}</div>` : ''}
          ${invoice.buyerType === 'ENTREPRISE' && invoice.buyerTaxId ? `<div>${t('billing.taxIdLabel')} : ${invoice.buyerTaxId}</div>` : ''}
          ${invoice.buyerTaxExempt ? `<div style="font-weight:bold;">${t('billing.taxExemptMention', { reason: invoice.buyerTaxExemptionReason ?? '' })}</div>` : ''}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid #1A1A1A;text-align:left;text-transform:uppercase;font-size:11px;">
              <th style="padding:6px 8px;">${t('billing.productColumn')}</th>
              <th style="padding:6px 8px;text-align:right;">${t('billing.quantityColumn')}</th>
              <th style="padding:6px 8px;text-align:right;">${t('billing.unitPriceHtColumn')}</th>
              <th style="padding:6px 8px;text-align:right;">${t('billing.taxColumn')}</th>
              <th style="padding:6px 8px;text-align:right;">${t('billing.taxAmountColumn')}</th>
              <th style="padding:6px 8px;text-align:right;">${t('billing.totalColumn')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="display:flex;flex-direction:column;align-items:flex-end;margin-top:12px;gap:2px;">
          <div>${t('billing.totalHtLabel')} : ${formatNumber(invoice.totalHt, locale)} ${invoice.currency}</div>
          <div>${t('billing.totalTaxLabel')} : ${formatNumber(invoice.totalTax, locale)} ${invoice.currency}</div>
          <div style="font-weight:bold;font-size:16px;border-top:1px solid #1A1A1A;padding-top:4px;">${t('billing.totalTtcLabel')} : ${formatNumber(invoice.totalTtc, locale)} ${invoice.currency}</div>
        </div>
      </body></html>
    `
    Print.printAsync({ html }).catch(() => undefined)
  }

  return (
    <View className="gap-3">
      {!hidePrintButton && (
        <Pressable onPress={handlePrint} className="self-end flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border-strong bg-bg-card">
          <Printer size={14} color="#E69D3B" />
          <Text className="text-sm font-bold">{t('registerSales.print')}</Text>
        </Pressable>
      )}

      <View className="bg-white rounded-2xl border border-border p-4 gap-3.5">
        <View className="flex-row items-start justify-between gap-3 pb-3 border-b border-border-hairline">
          <View className="flex-1 gap-0.5">
            <Text className="font-display text-base font-extrabold text-[#1A1A1A]">{invoice.sellerName}</Text>
            {invoice.sellerAddress && <Text className="text-xs text-[#6B6B6B]">{invoice.sellerAddress}</Text>}
            {invoice.sellerPhone && <Text className="text-xs text-[#6B6B6B]">{t('billing.phoneLabel')} : {invoice.sellerPhone}</Text>}
            {invoice.sellerTaxId && <Text className="text-xs text-[#6B6B6B]">{t('billing.taxIdLabel')} : {invoice.sellerTaxId}</Text>}
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-terracotta">{t('billing.invoiceDocumentTitle')}</Text>
            <Text className="amount text-lg font-extrabold text-[#1A1A1A]">{invoice.number}</Text>
            <Text className="text-xs text-[#6B6B6B]">{formatDate(invoice.issuedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        <View className="gap-0.5">
          <Text className="text-[10px] font-extrabold uppercase tracking-wide text-[#6B6B6B]">{t('billing.billedToLabel')}</Text>
          <Text className="font-bold text-[#1A1A1A]">{invoice.buyerName}</Text>
          {invoice.buyerPhone && <Text className="text-xs text-[#6B6B6B]">{invoice.buyerPhone}</Text>}
          {invoice.buyerAddress && <Text className="text-xs text-[#6B6B6B]">{invoice.buyerAddress}</Text>}
          {invoice.buyerTaxExempt && (
            <Text className="text-xs font-bold text-[#1A1A1A]">{t('billing.taxExemptMention', { reason: invoice.buyerTaxExemptionReason ?? '' })}</Text>
          )}
        </View>

        <View className="gap-2">
          {invoice.lines.map((l) => (
            <View key={l.id} className="flex-row justify-between items-center">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-[#1A1A1A]" numberOfLines={1}>
                  {l.productName}
                </Text>
                <Text className="text-[11px] text-[#6B6B6B]">
                  {l.quantity} × {formatNumber(l.quantity > 0 ? l.lineTotalHt / l.quantity : 0, locale)} · {l.taxRateApplied != null ? `${l.taxRateApplied}%` : '—'}
                </Text>
              </View>
              <Text className="amount text-sm font-bold text-[#1A1A1A]">{formatNumber(l.lineTotalTtc, locale)}</Text>
            </View>
          ))}
        </View>

        <View className="gap-1 items-end pt-2 border-t border-border-hairline">
          <View className="flex-row justify-between w-full">
            <Text className="text-xs text-[#6B6B6B]">{t('billing.totalHtLabel')}</Text>
            <Text className="amount text-xs text-[#1A1A1A]">{formatNumber(invoice.totalHt, locale)} {invoice.currency}</Text>
          </View>
          <View className="flex-row justify-between w-full">
            <Text className="text-xs text-[#6B6B6B]">{t('billing.totalTaxLabel')}</Text>
            <Text className="amount text-xs text-[#1A1A1A]">{formatNumber(invoice.totalTax, locale)} {invoice.currency}</Text>
          </View>
          <View className="flex-row justify-between w-full pt-1 border-t border-[#1A1A1A]">
            <Text className="text-sm font-extrabold text-[#1A1A1A]">{t('billing.totalTtcLabel')}</Text>
            <Text className="amount text-sm font-extrabold text-[#1A1A1A]">{formatNumber(invoice.totalTtc, locale)} {invoice.currency}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
