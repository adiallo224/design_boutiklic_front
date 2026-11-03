import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, Printer, Search, Send, Upload } from 'lucide-react'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { billingApi, type InvoiceResponse } from '../../../lib/billingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { renderElementToPdfBlob } from '../../../lib/clientPdf'
import { networkMonitor } from '../../../lib/networkMonitor'
import { useTenant } from '../../../hooks/useTenant'
import Pagination from '../../components/Pagination'
import InvoiceDocumentView from './InvoiceDocumentView'
import { useTopBar } from '../../hooks/useTopBar'

const PAGE_SIZE = 10

/** Historique des factures (Phase 5, doc TVA §5) — gap constaté : `billingApi.listInvoices`/
 *  `getInvoiceById` existaient déjà côté API mais aucun écran ne les exploitait ; une facture
 *  générée n'était visible qu'une fois, dans la modale de génération (InvoiceModalDesktop), puis
 *  disparaissait. La maquette de référence (study/web/facture) affiche aussi des statuts
 *  Payée/En attente/Brouillon, des méthodes de paiement et des échéances : rien de tout ça n'existe
 *  côté API — une facture (InvoiceResponse) est un document immuable une fois émise (doc §5, jamais
 *  de statut de paiement, jamais de brouillon — un "brouillon" est un Devis, pas une Facture). Non
 *  repris, même logique que les écarts déjà documentés pour l'onglet Équipe. Les 3 cartes de stats
 *  restent réelles, calculées depuis les factures déjà chargées (total du mois, delta vs mois
 *  dernier, total historique). Le partage WhatsApp est réel (lien wa.me avec message prérempli), pas
 *  un faux bouton. "Nouvelle facture" ne collecte pas d'acheteur/lignes ici : une facture ne peut
 *  être générée que depuis une vente complétée (GenerateInvoiceRequest exige un saleId), donc le
 *  bouton renvoie vers /devis pour démarrer le circuit Devis → Vente → Facture (cf. DesktopQuotes.tsx,
 *  boutons "Encaisser"/"Facturer" sur un devis accepté). */
export default function DesktopInvoices() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { formatCurrency } = useTenant()

  const [invoices, setInvoices] = useState<InvoiceResponse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useTopBar({ title: t('billing.invoicesPageEyebrow') }, [t])

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    billingApi
      .listInvoices()
      .then((list) => {
        const sorted = [...list].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))
        setInvoices(sorted)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(
      (inv) =>
        inv.number.toLowerCase().includes(q) ||
        inv.buyerName.toLowerCase().includes(q) ||
        formatNumber(inv.totalTtc, locale).includes(q),
    )
  }, [invoices, query, locale])

  useEffect(() => setPage(1), [query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selectedInvoice = useMemo(() => invoices.find((inv) => inv.id === selectedId) ?? null, [invoices, selectedId])

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthKey = `${prev.getFullYear()}-${prev.getMonth()}`
    let thisMonthTotal = 0
    let thisMonthCount = 0
    let lastMonthTotal = 0
    let allTimeTotal = 0
    for (const inv of invoices) {
      allTimeTotal += inv.totalTtc
      const d = new Date(inv.issuedAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (key === thisMonthKey) {
        thisMonthTotal += inv.totalTtc
        thisMonthCount += 1
      } else if (key === lastMonthKey) {
        lastMonthTotal += inv.totalTtc
      }
    }
    const percentChange = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null
    return { thisMonthTotal, thisMonthCount, allTimeTotal, percentChange }
  }, [invoices])

  const handleDownloadPdf = async (invoice: InvoiceResponse) => {
    setDownloadingPdf(true)
    setError(null)
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
        setError(toErrorMessage(e))
      }
    } finally {
      setDownloadingPdf(false)
    }
  }

  const whatsappUrl = useMemo(() => {
    if (!selectedInvoice?.buyerPhone) return null
    const phone = selectedInvoice.buyerPhone.replace(/\D/g, '')
    if (!phone) return null
    const message = t('billing.shareWhatsappMessage', {
      name: selectedInvoice.buyerName,
      number: selectedInvoice.number,
      amount: formatCurrency(selectedInvoice.totalTtc),
    })
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }, [selectedInvoice, t, formatCurrency])

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <h1 className="font-display text-xl sm:text-3xl font-extrabold text-text">{t('billing.invoicesPageTitle')}</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">{t('billing.invoicesPageSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            disabled
            title={t('desktopShell.topBar.notYetAvailable') ?? undefined}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-bg-card text-text text-xs sm:text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            <Upload size={15} /> {t('billing.exportCta')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/devis', { state: { openCreate: true } })}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-terracotta text-white text-xs sm:text-sm font-bold"
          >
            <Plus size={16} /> {t('billing.newInvoiceCta')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="text-xs font-medium text-text-muted">{t('billing.totalBilledThisMonthLabel')}</span>
          <div className="flex flex-wrap items-baseline justify-between mt-1.5 gap-x-2 gap-y-1">
            <span className="text-lg sm:text-2xl font-extrabold break-all text-text tracking-tight">{formatCurrency(stats.thisMonthTotal)}</span>
            {stats.percentChange !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${stats.percentChange >= 0 ? 'text-succes-text bg-succes-bg' : 'text-danger bg-danger/10'}`}>
                {t('billing.vsLastMonthChange', { percent: stats.percentChange >= 0 ? `+${stats.percentChange}` : stats.percentChange })}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="text-xs font-medium text-text-muted">{t('billing.invoiceCountThisMonthLabel')}</span>
          <div className="mt-1.5 text-lg sm:text-2xl font-extrabold break-all text-text tracking-tight">{stats.thisMonthCount}</div>
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="text-xs font-medium text-text-muted">{t('billing.totalBilledAllTimeLabel')}</span>
          <div className="mt-1.5 text-lg sm:text-2xl font-extrabold break-all text-text tracking-tight">{formatCurrency(stats.allTimeTotal)}</div>
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="flex-1 flex flex-col xl:flex-row gap-5 items-start">
        <div className="w-full xl:w-[400px] xl:shrink-0 bg-bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-border-hairline bg-bg-elevated/40">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('billing.searchInvoicePlaceholder') ?? ''}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-strong bg-bg text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-hairline">
            {isLoading ? (
              <div className="p-4 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm font-semibold text-text-dim">{t('billing.emptyInvoicesState')}</div>
            ) : (
              pageRows.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedId(inv.id)}
                  className={`w-full text-left p-3.5 transition-colors ${
                    inv.id === selectedId ? 'bg-info-bg border-l-4 border-primary' : 'border-l-4 border-transparent hover:bg-bg-elevated/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-primary amount">{inv.number}</span>
                      <div className="text-sm font-semibold text-text break-words mt-0.5">{inv.buyerName}</div>
                    </div>
                    <span className="text-sm font-bold text-text amount flex-shrink-0">{formatCurrency(inv.totalTtc)}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border-hairline text-[11px] text-text-dim">
                    {new Date(inv.issuedAt).toLocaleDateString(locale)}
                  </div>
                </button>
              ))
            )}
          </div>

          {filtered.length > 0 && (
            <div className="p-3 border-t border-border-hairline">
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                rangeLabel={t('billing.invoicesShowingRange', {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, filtered.length),
                  total: filtered.length,
                })}
              />
            </div>
          )}
        </div>

        <div className="flex-1 w-full min-w-0 bg-bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {!selectedInvoice ? (
            <div className="p-5 sm:p-8 text-sm font-semibold text-text-dim text-center">
              {t('billing.selectInvoicePrompt')}
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-5 border-b border-border-hairline bg-bg-elevated/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('billing.invoicePreviewLabel')}</span>
                  <span className="text-border-strong">|</span>
                  <span className="text-sm font-bold text-text amount">{selectedInvoice.number}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedInvoice)}
                    disabled={downloadingPdf}
                    className="p-2 text-text-muted bg-bg-card border border-border rounded-xl hover:border-border-strong hover:text-text transition-colors disabled:opacity-50"
                    title={t('billing.downloadPdfCta') ?? undefined}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-2 text-text-muted bg-bg-card border border-border rounded-xl hover:border-border-strong hover:text-text transition-colors"
                    title={t('billing.printCta') ?? undefined}
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-7">
                <InvoiceDocumentView invoice={selectedInvoice} hidePrintButton />

                <div className="mt-6 pt-4 border-t border-border-hairline flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-text-muted">{t('billing.shareWithCustomerLabel')}</span>
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-succes-bg text-succes-text border border-success/20 rounded-lg text-xs font-semibold hover:bg-success/20 transition-colors"
                    >
                      <Send size={13} />
                      {t('billing.shareWhatsappCta')}
                    </a>
                  ) : (
                    <span className="text-xs text-text-dim italic">{t('billing.noBuyerPhoneHint')}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
