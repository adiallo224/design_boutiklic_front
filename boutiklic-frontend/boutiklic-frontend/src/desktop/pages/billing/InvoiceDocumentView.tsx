import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Printer } from 'lucide-react'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { billingApi, type InvoiceResponse } from '../../../lib/billingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { renderElementToPdfBlob } from '../../../lib/clientPdf'
import { networkMonitor } from '../../../lib/networkMonitor'
import { useTenant } from '../../../hooks/useTenant'
import Button from '../../components/Button'

interface InvoiceDocumentViewProps {
  invoice: InvoiceResponse
  /** Masque les boutons "Imprimer"/"Télécharger le PDF" internes (ex: DesktopInvoices.tsx, qui a
   *  déjà ses propres boutons dans son propre header). */
  hidePrintButton?: boolean
}

/** Document facture conforme, imprimable — le "PDF" de la Phase 5 (doc TVA §5).
 *
 *  Mentions couvertes, vérifiées dans le Code Général des Impôts de la République de Guinée
 *  (loi L/2021/032/AN, https://mbudget.gov.gn/wp-content/uploads/Code-General-des-Impots.pdf) :
 *   - Art.383.VI.2° : nom, adresse, téléphone du vendeur (bloc "seller", snapshot figé)
 *   - Art.383.VI.3° : nom, adresse, téléphone de l'acquéreur (bloc "buyer", snapshot figé)
 *   - Art.383.VI.4° : NIF + clef d'immatriculation à la TVA du vendeur
 *   - Art.383.VI.8° : numéro unique séquentiel et continu (`invoice.number`, module billing)
 *   - Art.383.VI.9° : date de la facture (`invoice.issuedAt`)
 *   - Art.383.VI.11° : par ligne — désignation, quantité, prix unitaire HORS TAXES (calculé ici à
 *     l'affichage : `lineTotalHt / quantity` — le domaine stocke `unitPrice` en TTC par convention
 *     métier, doc §2 décision 2, jamais recalculé côté serveur) et taux de TVA applicable
 *   - Art.383.VI.13°/14°/15° : montant total TVA, total HT, total TTC
 *  Régimes spéciaux (autoliquidation, représentant fiscal, option débits, marge — Art.383.VI.5°/6°/
 *  7°/16°/17°) : hors périmètre, non pertinents pour un commerce de détail standard.
 *  PDF : backend (OpenPDF, texte vectoriel) quand en ligne ; repli 100% local (capture du DOM
 *  #invoice-print-root via html2canvas/jsPDF, cf. lib/clientPdf.ts) sinon — même bouton, jamais
 *  d'échec silencieux faute de réseau. Impression navigateur (`window.print()`, mise en page
 *  `@media print` isolée via #invoice-print-root) reste disponible en complément, déjà utilisable
 *  hors ligne nativement (aucun appel réseau). */
export default function InvoiceDocumentView({ invoice, hidePrintButton }: InvoiceDocumentViewProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  // Logo/email résolus en direct depuis le profil boutique courant — pas figés sur la facture,
  // contrairement au reste du vendeur (nom/adresse/téléphone/NIF/RCCM), même décision que le PDF
  // serveur (cf. InvoicePdfService).
  const { tenant } = useTenant()
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    setDownloadError(null)
    const fileName = `${invoice.number}.pdf`
    try {
      const online = await networkMonitor.isOnline()
      if (online) {
        const blob = await billingApi.downloadInvoicePdf(invoice.id)
        await downloadBlob(blob, fileName)
      } else {
        const blob = await renderElementToPdfBlob('invoice-print-root')
        await downloadBlob(blob, fileName)
      }
    } catch (e) {
      try {
        const blob = await renderElementToPdfBlob('invoice-print-root')
        await downloadBlob(blob, fileName)
      } catch {
        setDownloadError(toErrorMessage(e))
      }
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print-root, #invoice-print-root * { visibility: visible; }
          #invoice-print-root { position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
        }
      `}</style>

      {!hidePrintButton && (
        <div className="flex flex-col items-end gap-1.5 print:hidden">
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleDownloadPdf} disabled={downloadingPdf} loading={downloadingPdf}>
              <span className="flex items-center gap-1.5"><Download size={14} /> {t('billing.downloadPdfCta')}</span>
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <span className="flex items-center gap-1.5"><Printer size={14} /> {t('billing.printCta')}</span>
            </Button>
          </div>
          {downloadError && <span className="text-[13px] font-semibold text-danger">{downloadError}</span>}
        </div>
      )}

      <div id="invoice-print-root" className="bg-white text-[#1A1A1A] rounded-xl border border-border p-4 sm:p-6 flex flex-col gap-5 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-4 border-b border-border-hairline">
          <div className="flex flex-col gap-0.5 min-w-0">
            {tenant.logoUrl && <img src={tenant.logoUrl} alt="" className="h-10 w-auto max-w-[140px] object-contain mb-1" />}
            <span className="font-display text-lg font-extrabold">{invoice.sellerName}</span>
            {invoice.sellerAddress && <span className="text-xs text-text-dim">{invoice.sellerAddress}</span>}
            {invoice.sellerPhone && <span className="text-xs text-text-dim">{t('billing.phoneLabel')} : {invoice.sellerPhone}</span>}
            {tenant.email && <span className="text-xs text-text-dim">{tenant.email}</span>}
            {invoice.sellerTaxId && <span className="text-xs text-text-dim">{t('settings.taxIdLabel')} : {invoice.sellerTaxId}</span>}
            {invoice.sellerVatRegistrationKey && (
              <span className="text-xs text-text-dim">{t('settings.vatRegistrationKeyLabel')} : {invoice.sellerVatRegistrationKey}</span>
            )}
            {invoice.sellerRccm && <span className="text-xs text-text-dim">{t('settings.rccmLabel')} : {invoice.sellerRccm}</span>}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-terracotta">{t('billing.invoiceDocumentTitle')}</span>
            <span className="font-display text-xl font-extrabold amount">{invoice.number}</span>
            <span className="text-xs text-text-dim">{new Date(invoice.issuedAt).toLocaleDateString(locale)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-muted">{t('billing.billedToLabel')}</span>
          <span className="font-bold">{invoice.buyerName}</span>
          {invoice.buyerPhone && <span className="text-xs text-text-dim">{invoice.buyerPhone}</span>}
          {invoice.buyerAddress && <span className="text-xs text-text-dim">{invoice.buyerAddress}</span>}
          {invoice.buyerType === 'ENTREPRISE' && invoice.buyerTaxId && (
            <span className="text-xs text-text-dim">{t('settings.taxIdLabel')} : {invoice.buyerTaxId}</span>
          )}
          {invoice.buyerTaxExempt && (
            <span className="text-xs font-bold">{t('billing.taxExemptMention', { reason: invoice.buyerTaxExemptionReason ?? '' })}</span>
          )}
        </div>

        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-[#1A1A1A] text-left text-xs font-extrabold uppercase tracking-wide">
              <th className="py-2 pr-2">{t('billing.productColumn')}</th>
              <th className="py-2 px-2 text-right">{t('billing.quantityColumn')}</th>
              <th className="py-2 px-2 text-right">{t('billing.unitPriceHtColumn')}</th>
              <th className="py-2 px-2 text-right">{t('billing.taxColumn')}</th>
              <th className="py-2 px-2 text-right">{t('billing.taxAmountColumn')}</th>
              <th className="py-2 pl-2 text-right">{t('billing.totalColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-border-hairline">
                <td className="py-2 pr-2 font-semibold">{l.productName}</td>
                <td className="py-2 px-2 text-right amount">{l.quantity}</td>
                <td className="py-2 px-2 text-right amount">{formatNumber(l.quantity > 0 ? l.lineTotalHt / l.quantity : 0, locale)}</td>
                <td className="py-2 px-2 text-right amount">{l.taxRateApplied != null ? `${l.taxRateApplied}%` : '—'}</td>
                <td className="py-2 px-2 text-right amount">{formatNumber(l.taxAmount, locale)}</td>
                <td className="py-2 pl-2 text-right amount font-bold">{formatNumber(l.lineTotalTtc, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>

        <div className="flex flex-col gap-1 items-end pt-1">
          <div className="flex justify-between gap-3 w-full max-w-64 text-text-dim">
            <span>{t('billing.totalHtLabel')}</span>
            <span className="amount">{formatNumber(invoice.totalHt, locale)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between gap-3 w-full max-w-64 text-text-dim">
            <span>{t('billing.totalTaxLabel')}</span>
            <span className="amount">{formatNumber(invoice.totalTax, locale)} {invoice.currency}</span>
          </div>
          <div className="flex justify-between gap-3 w-full max-w-64 text-base font-extrabold border-t border-[#1A1A1A] pt-1">
            <span>{t('billing.totalTtcLabel')}</span>
            <span className="amount">{formatNumber(invoice.totalTtc, locale)} {invoice.currency}</span>
          </div>
          {invoice.depositAmount > 0 && (
            <>
              <div className="flex justify-between gap-3 w-full max-w-64 text-alerte-text">
                <span>{t('billing.depositLabel')}</span>
                <span className="amount">- {formatNumber(invoice.depositAmount, locale)} {invoice.currency}</span>
              </div>
              <div className="flex justify-between gap-3 w-full max-w-64 text-base font-extrabold text-primary pt-1 border-t border-[#1A1A1A]">
                <span>{t('billing.netToPayLabel')}</span>
                <span className="amount">{formatNumber(invoice.netToPay, locale)} {invoice.currency}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
