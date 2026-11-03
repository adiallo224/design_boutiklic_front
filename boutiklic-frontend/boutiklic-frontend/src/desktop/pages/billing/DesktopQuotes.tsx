import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Plus, Trash2, Send, Check, X, Clock, Search, Copy, Printer, Download, Upload, LayoutTemplate, User, Building2, Wallet, Receipt } from 'lucide-react'
import { formatNumber, formatSellingPrice, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { billingApi, type QuoteResponse, type QuoteStatus } from '../../../lib/billingApi'
import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { taxApi, type TaxCategoryResponse } from '../../../lib/taxApi'
import { userApi } from '../../../lib/userApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { renderElementToPdfBlob } from '../../../lib/clientPdf'
import { networkMonitor } from '../../../lib/networkMonitor'
import { useTenant } from '../../../hooks/useTenant'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import MoneyInput from '../../components/MoneyInput'
import CustomerPicker from '../../components/CustomerPicker'
import type { CustomerResponse } from '../../../lib/customerApi'
import { useTopBar } from '../../hooks/useTopBar'
import QuoteSalePaymentModalDesktop from './QuoteSalePaymentModalDesktop'
import InvoiceModalDesktop from '../register_Sales/InvoiceModalDesktop'

const PAGE_SIZE = 10
type QuoteFilter = 'ALL' | 'DRAFT' | 'SENT' | 'VALIDATED' | 'REFUSED' | 'EXPIRED'

const STATUS_LABEL_KEY: Record<QuoteStatus, string> = {
  DRAFT: 'billing.statusDraft',
  SENT: 'billing.statusSent',
  ACCEPTED: 'billing.statusAccepted',
  REFUSED: 'billing.statusRefused',
  EXPIRED: 'billing.statusExpired',
  CONVERTED: 'billing.statusConverted',
}

const STATUS_BADGE_CLASS: Record<QuoteStatus, string> = {
  DRAFT: 'bg-bg-elevated text-text-muted',
  SENT: 'bg-info-bg text-primary',
  ACCEPTED: 'bg-succes-bg text-succes-text',
  REFUSED: 'bg-[#FBE9E4] text-terracotta',
  EXPIRED: 'bg-bg-elevated text-text-dim',
  CONVERTED: 'bg-succes-bg text-succes-text',
}

export default function DesktopQuotes() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant, formatCurrency } = useTenant()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QuoteFilter>('ALL')
  const [page, setPage] = useState(1)

  useTopBar({ title: t('billing.pageEyebrow') }, [t])

  const [quotes, setQuotes] = useState<QuoteResponse[]>([])
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [taxCategories, setTaxCategories] = useState<TaxCategoryResponse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [payingSale, setPayingSale] = useState<{ quoteId: string; saleId: string } | null>(null)
  const [invoicingSaleId, setInvoicingSaleId] = useState<string | null>(null)
  const [saleJustCompleted, setSaleJustCompleted] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(() => (location.state as { openCreate?: boolean } | null)?.openCreate ?? false)
  const [newBuyerType, setNewBuyerType] = useState<'PARTICULIER' | 'ENTREPRISE'>('PARTICULIER')
  const [newBuyerName, setNewBuyerName] = useState('')
  const [newBuyerPhone, setNewBuyerPhone] = useState('')
  const [newBuyerAddress, setNewBuyerAddress] = useState('')
  const [newBuyerTaxId, setNewBuyerTaxId] = useState('')
  const [newBuyerCustomerId, setNewBuyerCustomerId] = useState<string | null>(null)
  const [newPreparedBy, setNewPreparedBy] = useState('')
  const [newExpiresAt, setNewExpiresAt] = useState('')

  const [lineMode, setLineMode] = useState<'catalog' | 'free'>('catalog')
  const [lineProductId, setLineProductId] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')
  const [freeDescription, setFreeDescription] = useState('')
  const [freeUnitPrice, setFreeUnitPrice] = useState('')

  const [termsPreparedBy, setTermsPreparedBy] = useState('')
  const [termsPaymentMethod, setTermsPaymentMethod] = useState('')
  const [termsPaymentOther, setTermsPaymentOther] = useState('')
  const [termsDeliveryTerms, setTermsDeliveryTerms] = useState('')
  const [termsDeposit, setTermsDeposit] = useState('')
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const PAYMENT_METHOD_OPTIONS = ['CB', 'Chèque', 'Mandat', 'Virement', 'Espèces']

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([billingApi.list(), productsApi.search(), taxApi.getActiveCategories()])
      .then(([q, p, c]) => {
        setQuotes(q)
        setProducts(p)
        setTaxCategories(c)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    if (!creating) return
    userApi.getMe().then((me) => setNewPreparedBy((prev) => prev || me.displayName)).catch(() => {})
    setNewExpiresAt((prev) => prev || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  }, [creating])

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const taxCategoryMap = useMemo(() => new Map(taxCategories.map((c) => [c.id, c])), [taxCategories])
  const selectedQuote = useMemo(() => quotes.find((q) => q.id === selectedId) ?? null, [quotes, selectedId])

  // Recharge les conditions commerciales du devis sélectionné dans le formulaire d'édition.
  useEffect(() => {
    if (!selectedQuote) return
    setTermsPreparedBy(selectedQuote.preparedBy ?? '')
    const knownMethod = selectedQuote.paymentTerms && PAYMENT_METHOD_OPTIONS.includes(selectedQuote.paymentTerms)
    setTermsPaymentMethod(knownMethod ? selectedQuote.paymentTerms! : selectedQuote.paymentTerms ? 'Autre' : '')
    setTermsPaymentOther(knownMethod ? '' : selectedQuote.paymentTerms ?? '')
    setTermsDeliveryTerms(selectedQuote.deliveryTerms ?? '')
    setTermsDeposit(selectedQuote.depositAmount > 0 ? String(selectedQuote.depositAmount) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuote?.id])

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return quotes.filter((q) => {
      if (filter === 'DRAFT' && q.status !== 'DRAFT') return false
      if (filter === 'SENT' && q.status !== 'SENT') return false
      if (filter === 'VALIDATED' && q.status !== 'ACCEPTED' && q.status !== 'CONVERTED') return false
      if (filter === 'REFUSED' && q.status !== 'REFUSED') return false
      if (filter === 'EXPIRED' && q.status !== 'EXPIRED') return false
      if (!query) return true
      return q.buyerName.toLowerCase().includes(query) || formatNumber(q.totalTtc, locale).includes(query)
    })
  }, [quotes, search, filter, locale])

  useEffect(() => setPage(1), [search, filter])

  const pageCount = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE))
  const pageRows = filteredQuotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`
    let inProgress = 0
    let pendingSent = 0
    let createdThisWeek = 0
    let estimatedThisMonth = 0
    let resolvedCount = 0
    let positiveCount = 0
    let convertedCount = 0
    let convertedAmount = 0
    for (const q of quotes) {
      if (q.status === 'DRAFT' || q.status === 'SENT') inProgress += 1
      if (q.status === 'SENT') pendingSent += 1
      const created = new Date(q.createdAt)
      if (created >= weekAgo) createdThisWeek += 1
      if (`${created.getFullYear()}-${created.getMonth()}` === thisMonthKey) estimatedThisMonth += q.totalTtc
      if (q.status !== 'DRAFT') {
        resolvedCount += 1
        if (q.status === 'ACCEPTED' || q.status === 'CONVERTED') positiveCount += 1
      }
      if (q.status === 'CONVERTED') {
        convertedCount += 1
        convertedAmount += q.totalTtc
      }
    }
    const conversionRate = resolvedCount > 0 ? Math.round((positiveCount / resolvedCount) * 1000) / 10 : null
    return { inProgress, pendingSent, createdThisWeek, estimatedThisMonth, conversionRate, convertedCount, convertedAmount }
  }, [quotes])

  const refreshQuote = async (quoteId: string) => {
    const updated = await billingApi.getById(quoteId)
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? updated : q)))
  }

  const handleCreate = async () => {
    if (newBuyerName.trim().length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const quote = await billingApi.createQuote({
        currency: tenant.currency,
        buyerType: newBuyerType,
        buyerName: newBuyerName.trim(),
        buyerPhone: newBuyerPhone.trim() || undefined,
        buyerAddress: newBuyerAddress.trim() || undefined,
        buyerTaxId: newBuyerTaxId.trim() || undefined,
        customerId: newBuyerCustomerId ?? undefined,
        preparedBy: newPreparedBy.trim() || undefined,
        expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : undefined,
      })
      setQuotes((prev) => [quote, ...prev])
      setSelectedId(quote.id)
      setCreating(false)
      setNewBuyerType('PARTICULIER')
      setNewBuyerName('')
      setNewBuyerPhone('')
      setNewBuyerAddress('')
      setNewBuyerTaxId('')
      setNewBuyerCustomerId(null)
      setNewPreparedBy('')
      setNewExpiresAt('')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleAddLine = async () => {
    if (!selectedQuote || busy) return
    const quantity = Math.max(1, parseInt(lineQuantity, 10) || 1)

    let request: { productId?: string; productName: string; unitPrice: number; quantity: number; taxCategoryId?: string | null }
    if (lineMode === 'catalog') {
      const product = lineProductId ? productMap.get(lineProductId) : undefined
      if (!product) return
      request = { productId: product.id, productName: product.name, unitPrice: product.salePrice, quantity, taxCategoryId: product.taxCategoryId }
    } else {
      const unitPrice = parseFloat(freeUnitPrice)
      if (freeDescription.trim().length === 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return
      request = { productName: freeDescription.trim(), unitPrice, quantity, taxCategoryId: null }
    }

    setBusy(true)
    setError(null)
    try {
      await billingApi.addLine(selectedQuote.id, request)
      await refreshQuote(selectedQuote.id)
      setLineProductId('')
      setLineQuantity('1')
      setFreeDescription('')
      setFreeUnitPrice('')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateTerms = async () => {
    if (!selectedQuote || busy) return
    const deposit = termsDeposit.trim() ? parseFloat(termsDeposit) : 0
    if (!Number.isFinite(deposit) || deposit < 0) return
    const paymentTerms = termsPaymentMethod === 'Autre' ? termsPaymentOther.trim() : termsPaymentMethod
    setBusy(true)
    setError(null)
    try {
      const updated = await billingApi.updateTerms(selectedQuote.id, {
        preparedBy: termsPreparedBy.trim() || null,
        paymentTerms: paymentTerms || null,
        deliveryTerms: termsDeliveryTerms.trim() || null,
        depositAmount: deposit,
      })
      setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadPdf = async (quote: QuoteResponse) => {
    setDownloadingPdf(true)
    setError(null)
    const fileName = `${quote.quoteNumber}.pdf`
    try {
      const online = await networkMonitor.isOnline()
      if (online) {
        const blob = await billingApi.downloadPdf(quote.id)
        await downloadBlob(blob, fileName)
      } else {
        const blob = await renderElementToPdfBlob('quote-print-root')
        await downloadBlob(blob, fileName)
      }
    } catch (e) {
      try {
        const blob = await renderElementToPdfBlob('quote-print-root')
        await downloadBlob(blob, fileName)
      } catch {
        setError(toErrorMessage(e))
      }
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleRemoveLine = async (lineId: string) => {
    if (!selectedQuote || busy) return
    setBusy(true)
    setError(null)
    try {
      await billingApi.removeLine(selectedQuote.id, lineId)
      await refreshQuote(selectedQuote.id)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const runAction = async (action: (quoteId: string) => Promise<QuoteResponse>) => {
    if (!selectedQuote || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await action(selectedQuote.id)
      setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDuplicate = async (quote: QuoteResponse) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      let current = await billingApi.createQuote({
        currency: quote.currency,
        buyerType: quote.buyerType,
        buyerName: quote.buyerName,
        buyerPhone: quote.buyerPhone ?? undefined,
        buyerAddress: quote.buyerAddress ?? undefined,
        buyerTaxId: quote.buyerTaxId ?? undefined,
        customerId: quote.buyerCustomerId ?? undefined,
        preparedBy: quote.preparedBy ?? undefined,
      })
      if (quote.paymentTerms || quote.deliveryTerms) {
        current = await billingApi.updateTerms(current.id, {
          paymentTerms: quote.paymentTerms,
          deliveryTerms: quote.deliveryTerms,
        })
      }
      for (const line of quote.lines) {
        current = await billingApi.addLine(current.id, {
          productId: line.productId,
          productName: line.productName,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          taxCategoryId: line.taxCategoryId,
        })
      }
      setQuotes((prev) => [current, ...prev])
      setSelectedId(current.id)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const FILTERS: { id: QuoteFilter; label: string }[] = [
    { id: 'ALL', label: t('billing.filterAllQuotes') },
    { id: 'DRAFT', label: t('billing.filterDraftPlural') },
    { id: 'SENT', label: t('billing.filterSentPlural') },
    { id: 'VALIDATED', label: t('billing.filterValidated') },
    { id: 'REFUSED', label: t('billing.filterRefusedPlural') },
    { id: 'EXPIRED', label: t('billing.filterExpiredPlural') },
  ]

  const daysRemaining = selectedQuote?.expiresAt ? Math.ceil((new Date(selectedQuote.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
  const hasFreeTextLine = selectedQuote?.lines.some((l) => l.productId === null) ?? false

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <h1 className="font-display text-xl sm:text-3xl font-extrabold text-text">{t('billing.pageTitle')}</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">{t('billing.quotesPageSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            disabled
            title={t('desktopShell.topBar.notYetAvailable') ?? undefined}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-bg-card text-text text-xs sm:text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            <LayoutTemplate size={15} /> {t('billing.templatesCta')}
          </button>
          <button
            type="button"
            disabled
            title={t('desktopShell.topBar.notYetAvailable') ?? undefined}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-bg-card text-text text-xs sm:text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            <Upload size={15} /> {t('billing.exportCta')}
          </button>
          <Button variant="accent" onClick={() => setCreating(true)}>
            <span className="flex items-center gap-1.5"><Plus size={16} /> {t('billing.newQuoteCta')}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('billing.quotesInProgressLabel')}</span>
          <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl break-all font-extrabold text-text">{stats.inProgress}</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-alerte-bg text-alerte-text">{t('billing.quotesPendingSuffix', { count: stats.pendingSent })}</span>
          </div>
          {stats.createdThisWeek > 0 && <div className="text-[11px] text-text-dim mt-1">{t('billing.quotesCreatedThisWeek', { count: stats.createdThisWeek })}</div>}
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('billing.estimatedTotalLabel')}</span>
          <div className="mt-1.5 text-xl sm:text-2xl break-all font-extrabold text-text tracking-tight">{formatCurrency(stats.estimatedThisMonth)}</div>
          <div className="text-[11px] text-text-dim mt-1">{t('billing.estimatedTotalSubtitle')}</div>
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('billing.conversionRateLabel')}</span>
          <div className="mt-1.5 text-xl sm:text-2xl break-all font-extrabold text-text">{stats.conversionRate !== null ? `${stats.conversionRate}%` : '—'}</div>
        </div>
        <div className="min-w-0 bg-bg-card rounded-2xl p-4 border border-border shadow-sm">
          <span className="break-words text-xs font-semibold text-text-muted uppercase tracking-wider">{t('billing.convertedLabel')}</span>
          <div className="mt-1.5 text-xl sm:text-2xl break-all font-extrabold text-text">{stats.convertedCount}</div>
          {stats.convertedAmount > 0 && <div className="text-[11px] text-text-dim mt-1">{t('billing.convertedAmountSuffix', { amount: formatCurrency(stats.convertedAmount) })}</div>}
        </div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="flex-1 flex flex-col xl:flex-row gap-5 items-start">
        <div className="w-full xl:w-[400px] xl:shrink-0 bg-bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-border-hairline bg-bg-elevated/40 flex flex-col gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('billing.searchQuotePlaceholder') ?? ''}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-strong bg-bg text-sm font-semibold outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scroll-smooth pb-1 -mb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                    filter === f.id ? 'bg-primary text-papier' : 'bg-bg-card border border-border text-text-muted hover:bg-bg-elevated'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-hairline">
            {isLoading ? (
              <div className="p-4 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
            ) : quotes.length === 0 ? (
              <div className="p-4 text-sm font-semibold text-text-dim">{t('billing.emptyState')}</div>
            ) : filteredQuotes.length === 0 ? (
              <div className="p-4 text-sm font-semibold text-text-dim">{t('billing.noSearchResults')}</div>
            ) : (
              pageRows.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full text-left p-3.5 transition-colors ${
                    q.id === selectedId ? 'bg-info-bg border-l-4 border-primary' : 'border-l-4 border-transparent hover:bg-bg-elevated/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-text-dim">{q.quoteNumber}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${STATUS_BADGE_CLASS[q.status]}`}>
                          {t(STATUS_LABEL_KEY[q.status])}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-text break-words mt-1">{q.buyerName}</div>
                      <div className="text-xs text-text-dim">{q.lines.length} {t('billing.linesCount', { count: q.lines.length })}</div>
                    </div>
                    <span className="text-sm font-bold text-text amount flex-shrink-0">{formatCurrency(q.totalTtc)}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border-hairline text-[11px] text-text-dim">
                    {t('billing.createdOnLabel', { date: new Date(q.createdAt).toLocaleDateString(locale) })}
                  </div>
                </button>
              ))
            )}
          </div>

          {filteredQuotes.length > 0 && (
            <div className="p-3 border-t border-border-hairline">
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                rangeLabel={t('billing.quotesShowingRange', {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, filteredQuotes.length),
                  total: filteredQuotes.length,
                })}
              />
            </div>
          )}
        </div>

        <div className="flex-1 w-full min-w-0 bg-bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {!selectedQuote ? (
            <div className="p-5 sm:p-8 text-sm font-semibold text-text-dim text-center">
              {t('billing.selectQuotePrompt')}
            </div>
          ) : (
            <>
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  #quote-print-root, #quote-print-root * { visibility: visible; }
                  #quote-print-root { position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
                }
              `}</style>

              <div className="p-4 sm:p-5 border-b border-border-hairline bg-bg-elevated/30 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md bg-bg-elevated text-text-muted">{t('billing.quoteDocumentTitle')}</span>
                  <span className="font-mono text-xs font-bold text-text">{selectedQuote.quoteNumber}</span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${STATUS_BADGE_CLASS[selectedQuote.status]}`}>
                    {t(STATUS_LABEL_KEY[selectedQuote.status])}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedQuote)}
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

              <div className="p-3 sm:p-7 flex flex-col gap-5">
                <div id="quote-print-root" className="flex flex-col gap-5">
                  {selectedQuote.expiresAt && (
                    <div className="text-xs font-semibold text-alerte-text">
                      {selectedQuote.status === 'EXPIRED'
                        ? t('billing.expiredOnLabel', { date: new Date(selectedQuote.expiresAt).toLocaleDateString(locale) })
                        : `${t('billing.validUntilLabel', { date: new Date(selectedQuote.expiresAt).toLocaleDateString(locale) })}${daysRemaining !== null && daysRemaining >= 0 ? ` (${t('billing.daysRemainingSuffix', { count: daysRemaining })})` : ''}`}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="flex flex-col gap-0.5 bg-bg-elevated/40 p-3 rounded-xl border border-border-hairline">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-dim">{t('billing.preparedByLabel')}</span>
                      <span className="font-semibold text-text break-words">{selectedQuote.preparedBy || '—'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 bg-bg-elevated/40 p-3 rounded-xl border border-border-hairline">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-dim">{t('billing.paymentTermsLabel')}</span>
                      <span className="font-semibold text-text break-words">{selectedQuote.paymentTerms || '—'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 bg-bg-elevated/40 p-3 rounded-xl border border-border-hairline">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-dim">{t('billing.deliveryTermsLabel')}</span>
                      <span className="font-semibold text-text break-words">{selectedQuote.deliveryTerms || '—'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 bg-bg-elevated/40 p-3 rounded-xl border border-border-hairline">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-dim">{t('billing.validUntilShortLabel')}</span>
                      <span className="font-semibold text-text break-words">{selectedQuote.expiresAt ? new Date(selectedQuote.expiresAt).toLocaleDateString(locale) : '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-bg-elevated/40 p-4 rounded-xl border border-border-hairline">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim">{t('billing.issuerLabel')}</span>
                      {tenant.logoUrl && <img src={tenant.logoUrl} alt="" className="h-10 w-auto max-w-[140px] object-contain my-1" />}
                      <span className="text-sm font-bold text-text">{tenant.name}</span>
                      <span className="text-xs text-text-muted">{[tenant.neighborhood, tenant.city].filter(Boolean).join(', ')}</span>
                      {tenant.phone && <span className="text-xs text-text-muted">{t('billing.phoneLabel')} : {tenant.phone}</span>}
                      {tenant.email && <span className="text-xs text-text-muted">{tenant.email}</span>}
                      {tenant.taxId && <span className="text-xs text-text-muted">{t('settings.taxIdLabel')} : {tenant.taxId}</span>}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-dim">{t('billing.recipientLabel')}</span>
                      <span className="text-sm font-bold text-text">{selectedQuote.buyerName}</span>
                      <span className="text-xs text-text-muted">{selectedQuote.buyerPhone ?? t('billing.noPhone')}</span>
                      {selectedQuote.buyerAddress && <span className="text-xs text-text-muted">{selectedQuote.buyerAddress}</span>}
                      {selectedQuote.buyerType === 'ENTREPRISE' && selectedQuote.buyerTaxId && (
                        <span className="text-xs text-text-muted">{t('settings.taxIdLabel')} : {selectedQuote.buyerTaxId}</span>
                      )}
                      {selectedQuote.buyerTaxExempt && (
                        <span className="text-xs font-bold text-succes-text">{t('billing.taxExemptMention', { reason: selectedQuote.buyerTaxExemptionReason ?? '' })}</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                          <th className="px-3 py-2">{t('billing.productColumn')}</th>
                          <th className="px-3 py-2 text-right">{t('billing.quantityColumn')}</th>
                          <th className="px-3 py-2 text-right">{t('billing.unitPriceColumn')}</th>
                          <th className="px-3 py-2 text-right">{t('billing.taxColumn')}</th>
                          <th className="px-3 py-2 text-right">{t('billing.totalColumn')}</th>
                          {selectedQuote.status === 'DRAFT' && <th className="px-3 py-2 print:hidden" />}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedQuote.lines.map((l) => (
                          <tr key={l.id} className="border-t border-border-hairline">
                            <td className="px-3 py-2 font-bold">
                              {l.productName}
                              {l.productId === null && (
                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-bg-elevated text-text-dim">
                                  {t('billing.freeLineBadge')}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right amount">{l.quantity}</td>
                            <td className="px-3 py-2 text-right amount">{formatSellingPrice(l.unitPrice, locale, tenant.sellingPriceDecimals)}</td>
                            <td className="px-3 py-2 text-right amount">
                              {l.taxRateApplied != null ? `${l.taxRateApplied}%` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right amount font-extrabold">{formatNumber(l.lineTotalTtc, locale)}</td>
                            {selectedQuote.status === 'DRAFT' && (
                              <td className="px-3 py-2 text-right print:hidden">
                                <button type="button" onClick={() => handleRemoveLine(l.id)} className="text-danger">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {selectedQuote.lines.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 text-center text-text-dim text-sm">{t('billing.noLinesYet')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-1 items-end pt-2 border-t border-border">
                    <div className="flex justify-between gap-3 w-full max-w-64 text-sm text-text-dim">
                      <span>{t('billing.totalHtLabel')}</span>
                      <span className="amount">{formatNumber(selectedQuote.totalHt, locale)}</span>
                    </div>
                    <div className="flex justify-between gap-3 w-full max-w-64 text-sm text-text-dim">
                      <span>{t('billing.totalTaxLabel')}</span>
                      <span className="amount">{formatNumber(selectedQuote.totalTax, locale)}</span>
                    </div>
                    <div className="flex justify-between gap-3 w-full max-w-64 text-base font-extrabold text-text">
                      <span>{t('billing.totalTtcLabel')}</span>
                      <span className="amount">{formatNumber(selectedQuote.totalTtc, locale)}</span>
                    </div>
                    {selectedQuote.depositAmount > 0 && (
                      <>
                        <div className="flex justify-between gap-3 w-full max-w-64 text-sm text-alerte-text">
                          <span>{t('billing.depositLabel')}</span>
                          <span className="amount">- {formatNumber(selectedQuote.depositAmount, locale)}</span>
                        </div>
                        <div className="flex justify-between gap-3 w-full max-w-64 text-base font-extrabold text-primary pt-1 border-t border-border">
                          <span>{t('billing.netToPayLabel')}</span>
                          <span className="amount">{formatNumber(selectedQuote.netToPay, locale)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1.5 pt-6 mt-auto text-center border-t border-border-hairline">
                    <p className="text-xs italic text-text-dim">
                      {t('billing.freeQuoteFooterNote', {
                        date: selectedQuote.expiresAt ? new Date(selectedQuote.expiresAt).toLocaleDateString(locale) : '—',
                        phone: tenant.phone || '—',
                      })}
                    </p>
                    <p className="text-base sm:text-lg font-extrabold text-text break-words">{t('billing.thankYouNote')}</p>
                  </div>
                </div>

                {selectedQuote.status === 'DRAFT' && (
                  <div className="flex flex-col gap-2.5 print:hidden">
                    <div className="p-1 rounded-xl bg-bg-elevated flex flex-wrap items-center gap-1 w-fit max-w-full">
                      <button
                        type="button"
                        onClick={() => setLineMode('catalog')}
                        className={`px-3 h-8 rounded-lg text-xs transition-all ${lineMode === 'catalog' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
                      >
                        {t('billing.catalogLineTab')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLineMode('free')}
                        className={`px-3 h-8 rounded-lg text-xs transition-all ${lineMode === 'free' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
                      >
                        {t('billing.freeLineTab')}
                      </button>
                    </div>

                    <div className="flex items-end gap-2 flex-wrap">
                      {lineMode === 'catalog' ? (
                        <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
                          <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('billing.productColumn')}</span>
                          <select
                            value={lineProductId}
                            onChange={(e) => setLineProductId(e.target.value)}
                            className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
                          >
                            <option value="">{t('billing.selectProductPlaceholder')}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {formatSellingPrice(p.salePrice, locale, tenant.sellingPriceDecimals)} {p.taxCategoryId ? `(${taxCategoryMap.get(p.taxCategoryId)?.name ?? ''})` : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <>
                          <Input
                            value={freeDescription}
                            onChange={(e) => setFreeDescription(e.target.value)}
                            placeholder={t('billing.freeLineDescriptionPlaceholder')}
                            label={t('billing.freeLineDescriptionPlaceholder')}
                            className="flex-1 min-w-[220px]"
                          />
                          <MoneyInput
                            value={freeUnitPrice}
                            onValueChange={setFreeUnitPrice}
                            decimals={tenant.sellingPriceDecimals}
                            className="w-full min-[420px]:w-32"
                            label={t('billing.unitPriceColumn')}
                          />
                        </>
                      )}
                      <Input
                        type="number"
                        min={1}
                        value={lineQuantity}
                        onChange={(e) => setLineQuantity(e.target.value)}
                        className="w-full min-[420px]:w-24"
                        label={t('billing.quantityColumn')}
                      />
                      <Button
                        variant="secondary"
                        onClick={handleAddLine}
                        disabled={busy || (lineMode === 'catalog' ? !lineProductId : freeDescription.trim().length === 0 || !freeUnitPrice)}
                      >
                        <span className="flex items-center gap-1.5"><Plus size={14} /> {t('billing.addLineCta')}</span>
                      </Button>
                    </div>
                  </div>
                )}

                {(selectedQuote.status === 'DRAFT' || selectedQuote.status === 'SENT') && (
                  <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border-hairline bg-bg-elevated/30 print:hidden">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-text-muted">{t('billing.commercialTermsTitle')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Input value={termsPreparedBy} onChange={(e) => setTermsPreparedBy(e.target.value)} label={t('billing.preparedByLabel')} />
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('billing.paymentTermsLabel')}</span>
                        <select
                          value={termsPaymentMethod}
                          onChange={(e) => setTermsPaymentMethod(e.target.value)}
                          className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
                        >
                          <option value="">—</option>
                          {PAYMENT_METHOD_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="Autre">{t('billing.paymentTermsOther')}</option>
                        </select>
                      </label>
                      {termsPaymentMethod === 'Autre' && (
                        <Input value={termsPaymentOther} onChange={(e) => setTermsPaymentOther(e.target.value)} label={t('billing.paymentTermsOther')} />
                      )}
                      <Input value={termsDeliveryTerms} onChange={(e) => setTermsDeliveryTerms(e.target.value)} label={t('billing.deliveryTermsLabel')} />
                      <Input type="number" min={0} value={termsDeposit} onChange={(e) => setTermsDeposit(e.target.value)} label={t('billing.depositLabel')} />
                    </div>
                    <Button variant="secondary" onClick={handleUpdateTerms} disabled={busy} className="self-stretch sm:self-end">
                      {t('billing.saveCommercialTermsCta')}
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 flex-wrap print:hidden">
                  <button type="button" onClick={() => handleDuplicate(selectedQuote)} disabled={busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-bg-card text-text text-xs font-bold hover:bg-bg-elevated transition-colors disabled:opacity-50">
                    <Copy size={14} /> {t('billing.duplicateCta')}
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(selectedQuote.status === 'DRAFT') && (
                      <Button variant="secondary" disabled={selectedQuote.lines.length === 0 || busy} onClick={() => runAction((id) => billingApi.send(id))}>
                        <span className="flex items-center gap-1.5"><Send size={14} /> {t('billing.sendCta')}</span>
                      </Button>
                    )}
                    {(selectedQuote.status === 'DRAFT' || selectedQuote.status === 'SENT') && (
                      <>
                        <Button variant="secondary" disabled={busy} onClick={() => runAction((id) => billingApi.expire(id))}>
                          <span className="flex items-center gap-1.5"><Clock size={14} /> {t('billing.expireCta')}</span>
                        </Button>
                        <Button variant="danger" disabled={busy} onClick={() => runAction((id) => billingApi.refuse(id))}>
                          <span className="flex items-center gap-1.5"><X size={14} /> {t('billing.refuseCta')}</span>
                        </Button>
                        <Button
                          disabled={selectedQuote.lines.length === 0 || hasFreeTextLine || busy}
                          onClick={() => runAction((id) => billingApi.accept(id))}
                          title={hasFreeTextLine ? (t('billing.acceptDisabledFreeTextTooltip') ?? undefined) : undefined}
                        >
                          <span className="flex items-center gap-1.5"><Check size={14} /> {t('billing.acceptCta')}</span>
                        </Button>
                      </>
                    )}
                    {selectedQuote.convertedSaleId && (
                      selectedQuote.status === 'CONVERTED' || saleJustCompleted.has(selectedQuote.id) ? (
                        <Button onClick={() => setInvoicingSaleId(selectedQuote.convertedSaleId)}>
                          <span className="flex items-center gap-1.5"><Receipt size={14} /> {t('billing.invoiceCta')}</span>
                        </Button>
                      ) : (
                        <Button onClick={() => setPayingSale({ quoteId: selectedQuote.id, saleId: selectedQuote.convertedSaleId! })}>
                          <span className="flex items-center gap-1.5"><Wallet size={14} /> {t('billing.collectPaymentCta')}</span>
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} width={480} title={t('billing.newQuoteModalTitle')}>
        <div className="flex flex-col gap-3">
          <div className="p-1 rounded-xl bg-bg-elevated flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setNewBuyerType('PARTICULIER')}
              className={`flex-1 min-w-[130px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${newBuyerType === 'PARTICULIER' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
            >
              <User size={16} /> {t('billing.buyerTypeParticulier')}
            </button>
            <button
              type="button"
              onClick={() => setNewBuyerType('ENTREPRISE')}
              className={`flex-1 min-w-[130px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${newBuyerType === 'ENTREPRISE' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
            >
              <Building2 size={16} /> {t('billing.buyerTypeEntreprise')}
            </button>
          </div>
          <CustomerPicker
            selectedName={newBuyerCustomerId ? newBuyerName : null}
            onSelect={(c: CustomerResponse) => {
              setNewBuyerCustomerId(c.id)
              setNewBuyerType(c.type)
              setNewBuyerName(c.name)
              setNewBuyerPhone(c.phone ?? '')
              setNewBuyerAddress(c.address ?? '')
              setNewBuyerTaxId(c.taxId ?? '')
            }}
            onClear={() => setNewBuyerCustomerId(null)}
          />
          <Input value={newBuyerName} onChange={(e) => { setNewBuyerName(e.target.value); setNewBuyerCustomerId(null) }} placeholder={t('billing.buyerNamePlaceholder')} autoFocus />
          <Input value={newBuyerPhone} onChange={(e) => setNewBuyerPhone(e.target.value)} placeholder={t('billing.buyerPhonePlaceholder')} />
          <Input value={newBuyerAddress} onChange={(e) => setNewBuyerAddress(e.target.value)} placeholder={t('billing.buyerAddressPlaceholder')} />
          {newBuyerType === 'ENTREPRISE' && (
            <Input value={newBuyerTaxId} onChange={(e) => setNewBuyerTaxId(e.target.value)} placeholder={t('billing.buyerTaxIdPlaceholder')} />
          )}
          <Input value={newPreparedBy} onChange={(e) => setNewPreparedBy(e.target.value)} label={t('billing.preparedByLabel')} />
          <Input type="date" value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} label={t('billing.validUntilShortLabel')} />
          <Button onClick={handleCreate} disabled={newBuyerName.trim().length === 0 || busy} loading={busy} className="min-h-11">
            {t('billing.create')}
          </Button>
        </div>
      </Modal>

      <QuoteSalePaymentModalDesktop
        open={!!payingSale}
        saleId={payingSale?.saleId ?? null}
        onClose={() => setPayingSale(null)}
        onCompleted={() => {
          if (payingSale) {
            setSaleJustCompleted((prev) => new Set(prev).add(payingSale.quoteId))
            setInvoicingSaleId(payingSale.saleId)
          }
          setPayingSale(null)
          load()
        }}
      />
      <InvoiceModalDesktop open={!!invoicingSaleId} saleId={invoicingSaleId} onClose={() => setInvoicingSaleId(null)} />
    </div>
  )
}
