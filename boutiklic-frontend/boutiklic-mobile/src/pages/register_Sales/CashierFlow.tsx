import { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { History, FileText, Receipt as ReceiptIcon } from 'lucide-react-native'
import NetInfo from '@react-native-community/netinfo'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../../components/OfflineBanner'
import { useTenant } from '../../hooks/useTenant'
import { loadCatalogWithStock } from '../../lib/productCatalog'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { descendantAndSelfIds } from '../../lib/categoryTree'
import { salesApi, type PaymentSplit } from '../../lib/salesApi'
import { discountsApi, ManagerApprovalPendingError } from '../../lib/discountsApi'
import { promotionsApi, type PromotionResponse } from '../../lib/promotionsApi'
import { resolvePrice } from '../../lib/promotionPricing'
import { currencyDecimals, unitPriceLineTotal } from '@boutiklic/shared'
import { enqueueSale } from '../../lib/outbox'
import { ApiError, toErrorMessage } from '../../lib/apiClient'
import type { Product, SaleLine } from '../../types'
import CashierAdvanced from './CashierAdvanced'
import SaleValidation, { type DiscountInput } from './SaleValidation'
import Receipt from './Receipt'
import SalesHistory from './SalesHistory'
import ManagerApprovalModal from '../../components/ManagerApprovalModal'
import QuotesList from '../billing/QuotesList'
import InvoicesList from '../billing/InvoicesList'

interface PendingFinalize {
  saleId: string
  payments: PaymentSplit[]
  debtCustomerName?: string
  debtCustomerPhone?: string
  discount?: DiscountInput
}

export default function CashierFlow() {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  // Total d'une ligne : prix unitaire (jusqu'à 2 décimales) x quantité, arrondi UNE fois à la précision de la devise — exactement
  // comme le serveur ; le total du panier est la somme de ces lignes arrondies (étude prix décimaux, phase 5bis).
  const lineTotalFor = (unitPrice: number, quantity: number) => unitPriceLineTotal(unitPrice, quantity, currencyDecimals(tenant.currency))
  const [lines, setLines] = useState<SaleLine[]>([])
  const [showValidation, setShowValidation] = useState(false)
  const [showTicket, setShowTicket] = useState(false)
  const [ticketInfo, setTicketInfo] = useState<{ payments: PaymentSplit[]; pending: boolean; discount?: DiscountInput } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('FAVORIS')
  const [showHistory, setShowHistory] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)
  const [showInvoices, setShowInvoices] = useState(false)

  const [pendingFinalize, setPendingFinalize] = useState<PendingFinalize | null>(null)
  const [managerApprovalOpen, setManagerApprovalOpen] = useState(false)
  const [managerApprovalLoading, setManagerApprovalLoading] = useState(false)
  const [managerApprovalError, setManagerApprovalError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [activePromotions, setActivePromotions] = useState<PromotionResponse[]>([])

  useEffect(() => {
    loadCatalogWithStock().then((r) => setProducts(r.products)).catch((e) => console.error('[DEBUG catalog]', e))
    categoriesApi.getAll().then(setCategories).catch((e) => console.error('[DEBUG categories]', e))
    promotionsApi.getAll(true).then(setActivePromotions).catch((e) => console.error('[DEBUG promotions]', e))
  }, [])

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
    setLines(
      lines.flatMap((l) => {
        if (l.id !== lineId) return [l]
        const newQty = l.quantity + delta
        if (newQty <= 0) return []
        return [{ ...l, quantity: newQty, lineTotal: lineTotalFor(l.unitPrice, newQty) }]
      }),
    )
  }

  const clearCart = () => setLines([])

  const filteredProducts = products.filter((p) => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCategory =
      selectedCategory === 'FAVORIS'
        ? p.isFavorite
        : selectedCategory === ''
          ? true
          : !!p.categoryId && descendantAndSelfIds(selectedCategory, categories).has(p.categoryId)
    return matchSearch && matchCategory
  })

  const finish = (payments: PaymentSplit[], pending: boolean, discount?: DiscountInput) => {
    setTicketInfo({ payments, pending, discount })
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
    finish(p.payments, false, p.discount)
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
   *  déjà persistée) — SaleValidation masque le bouton "Rabais" quand hors ligne. */
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
    }))

    const netState = await NetInfo.fetch()
    if (!netState.isConnected) {
      await enqueueSale({ lines: queueLines, currency, payments, debtCustomerName, debtCustomerPhone })
      finish(payments, true, discount)
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
      await enqueueSale({ lines: queueLines, currency, payments, debtCustomerName, debtCustomerPhone })
      finish(payments, true, discount)
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

  if (showTicket) {
    return (
      <Receipt
        total={totalAmount}
        lines={lines}
        payments={ticketInfo?.payments ?? [{ method: 'CASH', amount: totalAmount }]}
        pending={ticketInfo?.pending ?? false}
        discount={ticketInfo?.discount}
        onClose={() => {
          setShowTicket(false)
          setLines([])
        }}
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

  if (showQuotes) {
    return <QuotesList onBack={() => setShowQuotes(false)} />
  }

  if (showInvoices) {
    return <InvoicesList onBack={() => setShowInvoices(false)} />
  }

  return (
    <View className="flex-1 bg-bg">
      <OfflineBanner />

      <View className="px-5 pt-2.5 pb-3.5 flex-row items-center justify-between">
        <Text className="text-[21px] font-extrabold tracking-tight">{t('registerSales.title')}</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={() => setShowQuotes(true)} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <FileText size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={() => setShowInvoices(true)} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <ReceiptIcon size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={() => setShowHistory(true)} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <History size={20} color="#111418" />
          </Pressable>
        </View>
      </View>

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
    </View>
  )
}
