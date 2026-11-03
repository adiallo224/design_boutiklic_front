import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../../components/OfflineBanner'
import { useTenant } from '../../hooks/useTenant'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { loadCatalogWithStock } from '../../lib/productCatalog'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { descendantAndSelfIds } from '../../lib/categoryTree'
import { salesApi, type PaymentMethod, type PaymentSplit } from '../../lib/salesApi'
import { discountsApi, ManagerApprovalPendingError } from '../../lib/discountsApi'
import { promotionsApi, type PromotionResponse } from '../../lib/promotionsApi'
import { resolvePrice } from '../../lib/promotionPricing'
import { currencyDecimals, summarizeSaleTax, unitPriceLineTotal } from '@boutiklic/shared'
import { getCachedTaxContext, refreshTaxContext } from '../../lib/taxContextCache'
import { enqueueSale } from '../../lib/outbox'
import { ApiError, toErrorMessage } from '../../lib/apiClient'
import type { Product, SaleLine } from '../../types'
import CashierAdvanced from './CashierAdvanced'
import SaleValidation, { type DiscountInput } from './SaleValidation'
import Receipt from './Receipt'
import SalesHistory from './SalesHistory'
import ManagerApprovalModal from '../../components/ManagerApprovalModal'
import CaisseDesktop from '../../desktop/pages/register_Sales/CaisseDesktop'
import SaleValidationModalDesktop from '../../desktop/pages/register_Sales/SaleValidationModalDesktop'
import ReceiptModalDesktop from '../../desktop/pages/register_Sales/ReceiptModalDesktop'
import ManagerApprovalModalDesktop from '../../desktop/components/ManagerApprovalModalDesktop'

interface PendingFinalize {
  saleId: string
  payments: PaymentSplit[]
  debtCustomerName?: string
  debtCustomerPhone?: string
  discount?: DiscountInput
}

/** Récap HT/TVA/TTC du ticket (doc TVA §3.3) — en ligne, c'est le snapshot par ligne figé par le backend (jamais recalculé ici).
 *  Hors ligne, c'est une ESTIMATION calculée sur l'appareil avec les derniers taux connus (@boutiklic/shared, tax) : le serveur
 *  refige la TVA à la synchronisation. Absent (null) tant qu'aucune ligne de la vente n'a de TVA applicable. */
export interface TaxSummary {
  totalHt: number
  totalTax: number
  totalTtc: number
}

export default function CashierFlow() {
  const { t } = useTranslation()
  const { tenant, isLoading: tenantLoading, error: tenantError } = useTenant()
  // Total d'une ligne : prix unitaire (jusqu'à 2 décimales) x quantité, arrondi UNE fois à la précision de la devise — exactement
  // comme le serveur ; le total du panier est la somme de ces lignes arrondies (étude prix décimaux, phase 5bis).
  const lineTotalFor = (unitPrice: number, quantity: number) => unitPriceLineTotal(unitPrice, quantity, currencyDecimals(tenant.currency))
  const isDesktop = useIsDesktop()
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true)
  const [lines, setLines] = useState<SaleLine[]>([])
  const [showValidation, setShowValidation] = useState(false)
  const [showTicket, setShowTicket] = useState(false)
  const [ticketInfo, setTicketInfo] = useState<{ payments: PaymentSplit[]; pending: boolean; discount?: DiscountInput } | null>(null)
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('FAVORIS')
  const [showHistory, setShowHistory] = useState(false)
  /** Présélection depuis les boutons rapides du panier bureau (Espèces/Orange M./Wave, "Mettre sur
   *  dette") — juste une valeur de départ pour la modale de validation, qui reste modifiable. */
  const [quickCheckout, setQuickCheckout] = useState<{ method: PaymentMethod; debtCustomer?: { name: string; phone: string } }>({ method: 'CASH' })

  const [pendingFinalize, setPendingFinalize] = useState<PendingFinalize | null>(null)
  const [managerApprovalOpen, setManagerApprovalOpen] = useState(false)
  const [managerApprovalLoading, setManagerApprovalLoading] = useState(false)
  const [managerApprovalError, setManagerApprovalError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [activePromotions, setActivePromotions] = useState<PromotionResponse[]>([])

  useEffect(() => {
    loadCatalogWithStock().then((r) => setProducts(r.products)).catch(() => undefined)
    categoriesApi.getAll().then(setCategories).catch(() => undefined)
    promotionsApi.getAll(true).then(setActivePromotions).catch(() => undefined)
  }, [])

  // Instantané des taux pour le calcul de TVA hors ligne : seulement une fois la boutique ET les catégories réellement chargées,
  // pour ne jamais écraser un bon instantané par un état vide (boutique pas encore lue, ou lecture échouée).
  useEffect(() => {
    if (!tenant.id || tenantLoading || tenantError || categories.length === 0) return
    refreshTaxContext(tenant, categories)
  }, [tenant, tenantLoading, tenantError, categories])

  /** TVA estimée d'une vente mise en file (hors ligne) : cascade article > catégorie > boutique sur les derniers taux connus. */
  const estimateTaxSummary = (): TaxSummary | null => {
    const context = getCachedTaxContext(tenant.id)
    if (!context) return null
    const categoryIdByProduct = new Map(products.map((p) => [p.id, p.categoryId]))
    const summary = summarizeSaleTax(
      lines.map((l) => ({ lineTotal: l.lineTotal, taxCategoryId: l.taxCategoryId, categoryId: categoryIdByProduct.get(l.productId) })),
      context,
      tenant.currency,
    )
    return summary && { totalHt: summary.totalHt, totalTax: summary.totalTax, totalTtc: summary.totalTtc }
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0)

  const addProduct = (product: Product) => {
    if (product.quantity === 0) return
    const existing = lines.find((l) => l.productId === product.id)
    if (existing) {
      setLines(lines.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + 1, lineTotal: lineTotalFor(l.unitPrice, l.quantity + 1) } : l)))
    } else {
      // Prix résolu une seule fois, à l'ajout — pas re-résolu si la promo change pendant que le panier se construit.
      const { unitPrice, catalogPrice, promotionId } = resolvePrice(product, activePromotions, tenant.sellingPriceDecimals)
      setLines([
        ...lines,
        {
          id: Date.now().toString(),
          productId: product.id,
          productName: product.name,
          unitPrice,
          quantity: 1,
          lineTotal: lineTotalFor(unitPrice, 1),
          barcode: product.barcode,
          promotionId: promotionId ?? undefined,
          catalogPrice: catalogPrice ?? undefined,
          taxCategoryId: product.taxCategoryId,
        },
      ])
    }
  }

  const removeProduct = (productId: string) => {
    setLines(
      lines.flatMap((l) => {
        if (l.productId !== productId) return [l]
        if (l.quantity <= 1) return []
        return [{ ...l, quantity: l.quantity - 1, lineTotal: lineTotalFor(l.unitPrice, l.quantity - 1) }]
      }),
    )
  }

  const updateQuantity = (lineId: string, delta: number) => {
    setLines(lines.flatMap((l) => {
      if (l.id !== lineId) return [l]
      const newQty = l.quantity + delta
      if (newQty <= 0) return []
      return [{ ...l, quantity: newQty, lineTotal: lineTotalFor(l.unitPrice, newQty) }]
    }))
  }

  const clearCart = () => setLines([])

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase()
    // Le code-barres scanné (B2) doit retrouver l'article même si son nom ne contient pas la saisie.
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)
    const matchCategory =
      selectedCategory === 'FAVORIS'
        ? p.isFavorite
        : selectedCategory === ''
          ? true
          : !!p.categoryId && descendantAndSelfIds(selectedCategory, categories).has(p.categoryId)
    return matchSearch && matchCategory
  })

  const finish = (payments: PaymentSplit[], pending: boolean, discount?: DiscountInput, summary?: TaxSummary | null) => {
    setTicketInfo({ payments, pending, discount })
    setTaxSummary(summary ?? null)
    setShowValidation(false)
    setShowTicket(true)
  }

  /** Accorde le rabais (si présent) puis finalise une vente déjà créée (DRAFT) — séparé de
   *  handleComplete pour pouvoir être rejoué après le relais gérant sans recréer la vente. */
  const finalizeSale = async (p: PendingFinalize, managerPassword?: string) => {
    const currency = tenant.currency
    if (p.discount) {
      await discountsApi.grant(p.saleId, {
        type: p.discount.type,
        value: p.discount.value,
        reason: p.discount.reason,
        reasonNote: p.discount.reasonNote,
        managerPassword,
      })
    }
    await salesApi.complete(p.saleId, {
      payments: p.payments,
      currency,
      debtCustomerName: p.debtCustomerName,
      debtCustomerPhone: p.debtCustomerPhone,
    })

    // Récap HT/TVA/TTC (doc TVA §3.3) : jamais recalculé côté frontend, on relit la vente complétée
    // pour prendre le snapshot figé par ligne côté backend. Absent si aucune ligne n'a de TVA (tenant
    // non activé, ou aucune catégorie applicable) — pas d'appel superflu ni de bloc de ticket vide.
    let summary: TaxSummary | null = null
    try {
      const completed = await salesApi.getById(p.saleId)
      const taxedLines = completed.lines.filter((l) => l.taxRateApplied !== null)
      if (taxedLines.length > 0) {
        summary = completed.lines.reduce(
          (acc, l) => ({
            totalHt: acc.totalHt + (l.lineTotalHt ?? l.lineTotal),
            totalTax: acc.totalTax + (l.taxAmount ?? 0),
            totalTtc: acc.totalTtc + l.lineTotal,
          }),
          { totalHt: 0, totalTax: 0, totalTtc: 0 },
        )
      }
    } catch {
      // Le ticket reste affichable sans le récap TVA si cette relecture échoue — la vente est déjà actée.
    }

    finish(p.payments, false, p.discount, summary)
  }

  /** Le panier reste local pendant la vente (pas de PATCH/DELETE de ligne côté backend) — on ne
   *  crée la vente et ses lignes qu'à la confirmation, cf. SaleController.
   *  Hors ligne (ou coupure réseau en cours de route) : la vente est mise en file (lib/outbox)
   *  plutôt que perdue — reprise automatique au retour du réseau. Une vraie erreur métier
   *  (ApiError, ex: requête rejetée) remonte telle quelle à SaleValidation.
   *  Un rabais qui dépasse le seuil autorisé (SALE_002) ouvre la modale de relais gérant au lieu
   *  d'échouer — ManagerApprovalPendingError signale à SaleValidation de juste réarmer son bouton,
   *  la modale (rendue par ce composant) prend le relais visuellement.
   *  Un rabais ne peut pas encore être mis en file hors ligne (discountsApi requiert une vente
   *  déjà persistée) — SaleValidation masque le bouton "Rabais" quand !navigator.onLine. */
  const handleComplete = async (
    payments: PaymentSplit[],
    debtCustomerName?: string,
    debtCustomerPhone?: string,
    discount?: DiscountInput,
  ) => {
    const currency = tenant.currency
    const queueLines = lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      barcode: l.barcode,
      promotionId: l.promotionId,
      catalogPrice: l.catalogPrice,
      taxCategoryId: l.taxCategoryId,
    }))

    if (!navigator.onLine) {
      enqueueSale({ lines: queueLines, currency, payments, debtCustomerName, debtCustomerPhone })
      finish(payments, true, discount, estimateTaxSummary())
      return
    }

    try {
      const sale = await salesApi.createSale(currency)
      for (const line of lines) {
        await salesApi.addLine(sale.id, {
          productId: line.productId,
          productName: line.productName,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          currency,
          barcode: line.barcode,
          promotionId: line.promotionId,
          catalogPrice: line.catalogPrice,
          taxCategoryId: line.taxCategoryId,
        })
      }
      const pending: PendingFinalize = { saleId: sale.id, payments, debtCustomerName, debtCustomerPhone, discount }
      try {
        await finalizeSale(pending)
      } catch (e) {
        if (e instanceof ApiError && e.errorCode === 'SALE_002') {
          setPendingFinalize(pending)
          setManagerApprovalError(null)
          setManagerApprovalOpen(true)
          throw new ManagerApprovalPendingError()
        }
        throw e
      }
    } catch (e) {
      if (e instanceof ApiError || e instanceof ManagerApprovalPendingError) throw e
      enqueueSale({ lines: queueLines, currency, payments, debtCustomerName, debtCustomerPhone })
      finish(payments, true, discount, estimateTaxSummary())
    }
  }

  const handleManagerApprovalSubmit = async (password: string) => {
    if (!pendingFinalize) return
    setManagerApprovalLoading(true)
    setManagerApprovalError(null)
    try {
      await finalizeSale(pendingFinalize, password)
      setManagerApprovalOpen(false)
      setPendingFinalize(null)
    } catch (e) {
      setManagerApprovalError(
        e instanceof ApiError && e.errorCode === 'SALE_003' ? t('registerSales.managerPasswordIncorrect') : toErrorMessage(e),
      )
    } finally {
      setManagerApprovalLoading(false)
    }
  }

  const handleManagerApprovalCancel = () => {
    setManagerApprovalOpen(false)
    setPendingFinalize(null)
  }

  if (isDesktop) {
    return (
      <>
        <CaisseDesktop
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          filteredProducts={filteredProducts}
          allProducts={products}
          activePromotions={activePromotions}
          onAddProduct={addProduct}
          onRemoveProduct={removeProduct}
          onUpdateQuantity={updateQuantity}
          lines={lines}
          totalAmount={totalAmount}
          currency={tenant.currency}
          sellingPriceDecimals={tenant.sellingPriceDecimals}
          onClearCart={clearCart}
          onQuickCheckout={(method, debtCustomer) => {
            setQuickCheckout({ method, debtCustomer })
            setShowValidation(true)
          }}
        />
        <SaleValidationModalDesktop
          open={showValidation}
          total={totalAmount}
          lines={lines}
          initialMethod={quickCheckout.method}
          initialDebtCustomer={quickCheckout.debtCustomer}
          onClose={() => setShowValidation(false)}
          onComplete={handleComplete}
          onCompleted={(printReceipt) => {
            setAutoPrintReceipt(printReceipt)
            setShowValidation(false)
            setQuickCheckout({ method: 'CASH' })
          }}
        />
        <ManagerApprovalModalDesktop
          open={managerApprovalOpen}
          loading={managerApprovalLoading}
          error={managerApprovalError}
          onSubmit={handleManagerApprovalSubmit}
          onCancel={handleManagerApprovalCancel}
        />
        <ReceiptModalDesktop
          open={showTicket}
          total={totalAmount}
          lines={lines}
          payments={ticketInfo?.payments ?? [{ method: 'CASH', amount: totalAmount }]}
          pending={ticketInfo?.pending ?? false}
          discount={ticketInfo?.discount}
          taxSummary={taxSummary}
          autoPrint={autoPrintReceipt}
          onClose={() => {
            setShowTicket(false)
            setLines([])
          }}
        />
      </>
    )
  }

  if (showTicket) {
    return (
      <Receipt
        total={totalAmount}
        lines={lines}
        payments={ticketInfo?.payments ?? [{ method: 'CASH', amount: totalAmount }]}
        pending={ticketInfo?.pending ?? false}
        discount={ticketInfo?.discount}
        taxSummary={taxSummary}
        onClose={() => { setShowTicket(false); setLines([]) }}
      />
    )
  }

  if (showValidation) {
    return (
      <>
        <SaleValidation
          total={totalAmount}
          lines={lines}
          onBack={() => setShowValidation(false)}
          onUpdateQuantity={updateQuantity}
          onComplete={handleComplete}
        />
        <ManagerApprovalModal
          open={managerApprovalOpen}
          loading={managerApprovalLoading}
          error={managerApprovalError}
          onSubmit={handleManagerApprovalSubmit}
          onCancel={handleManagerApprovalCancel}
        />
      </>
    )
  }

  if (showHistory) {
    return <SalesHistory onBack={() => setShowHistory(false)} />
  }

  return (
    <div className="flex flex-col bg-bg">
      <OfflineBanner />

      <div className="flex-none px-5 pt-2.5 pb-3.5 flex items-center justify-between">
        <div className="text-[21px] font-extrabold tracking-tight">{t('registerSales.title')}</div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(true)} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card flex items-center justify-center">
            <span className="sr-only">{t('registerSales.history')}</span>
            <History size={20} />
          </button>
        </div>
      </div>

      <CashierAdvanced
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        filteredProducts={filteredProducts}
        activePromotions={activePromotions}
        onAddProduct={addProduct}
        onRemoveProduct={removeProduct}
        lines={lines}
        totalAmount={totalAmount}
        currency={tenant.currency}
        sellingPriceDecimals={tenant.sellingPriceDecimals}
        onClearCart={clearCart}
        onValidate={() => setShowValidation(true)}
      />
    </div>
  )
}
