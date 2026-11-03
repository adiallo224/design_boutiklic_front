import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import type { Product } from '../../types'
import type { LabelPreselection } from '@boutiklic/shared'
import { loadCatalogWithStock } from '../../lib/productCatalog'
import { toErrorMessage } from '../../lib/apiClient'
import type { CategoryResponse } from '../../lib/categoriesApi'
import type { ResellerResponse } from '../../lib/resellerApi'
import ProductList from './ProductList'
import ProductDetail from './ProductDetail'
import ProductForm from './ProductForm'
import Categories from './Categories'
import CategoryDetail from './CategoryDetail'
import UnclassifiedProducts from './UnclassifiedProducts'
import NewArrival from './NewArrival'
import ArrivalsList from './ArrivalsList'
import StockTransfers from './StockTransfers'
import InventoryExports from './InventoryExports'
import StockCounts from './StockCounts'
import Promotions from './Promotions'
import StockAlerts from './StockAlerts'
import Labels from './Labels'
import SuppliersList from './SuppliersList'
import FirstDay from './FirstDay'
import ResellerList from '../reseller_Consignment/ResellerList'
import ResellerDetail from '../reseller_Consignment/ResellerDetail'
import NewConsignmentOut from '../reseller_Consignment/NewConsignmentOut'

export default function StockFlow() {
  const { tenant, formatCurrency, formatUnitPrice } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  /** Impression d'étiquettes : propriétaire et vendeurs, comme la modification d'article. */
  const canPrintLabels = user?.role === 'OWNER' || user?.role === 'SELLER'
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormCategoryId, setAddFormCategoryId] = useState<string | undefined>(undefined)
  const [showCategories, setShowCategories] = useState(false)
  const [showUnclassified, setShowUnclassified] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryResponse | null>(null)
  const [showNewArrival, setShowNewArrival] = useState(false)
  const [showArrivalsList, setShowArrivalsList] = useState(false)
  const [showStockTransfers, setShowStockTransfers] = useState(false)
  const [showInventoryExports, setShowInventoryExports] = useState(false)
  const [showStockCounts, setShowStockCounts] = useState(false)
  const [showPromotions, setShowPromotions] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  /** null = écran fermé ; sinon articles cochés à l'ouverture (vide = aucun). */
  const [labelsPreselection, setLabelsPreselection] = useState<LabelPreselection[] | null>(null)
  const [showSuppliers, setShowSuppliers] = useState(false)
  const [showResellers, setShowResellers] = useState(false)
  const [selectedReseller, setSelectedReseller] = useState<ResellerResponse | null>(null)
  const [showNewConsignment, setShowNewConsignment] = useState(false)
  const [firstDayDismissed, setFirstDayDismissed] = useState<boolean | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stockAsOf, setStockAsOf] = useState<string | null>(null)

  useEffect(() => {
    AsyncStorage.getItem('boutiklic_first_day_done').then((v) => setFirstDayDismissed(v === 'true'))
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await loadCatalogWithStock()
      setProducts(result.products)
      setCategories(result.categories)
      setStockAsOf(result.stockAsOf)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dismissFirstDay = () => {
    AsyncStorage.setItem('boutiklic_first_day_done', 'true')
    setFirstDayDismissed(true)
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null

  const handleQuantityChanged = (productId: string, quantity: number) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, quantity } : p)))
  }

  const handleFavoriteChanged = (productId: string, isFavorite: boolean) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isFavorite } : p)))
  }

  const handleThresholdChanged = (productId: string, alertThreshold: number) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, alertThreshold } : p)))
  }

  const handleBarcodeAssigned = (productId: string, barcode: string) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, barcode } : p)))
  }

  const handleImagesChanged = (productId: string, imageUrls: string[]) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, imageUrls, imageUrl: imageUrls[0] } : p)))
  }

  const closeAddForm = () => {
    setShowAddForm(false)
    setAddFormCategoryId(undefined)
  }

  if (labelsPreselection) {
    return <Labels onBack={() => setLabelsPreselection(null)} products={products} preselection={labelsPreselection} onBarcodeAssigned={handleBarcodeAssigned} />
  }
  if (showAddForm) {
    return (
      <ProductForm
        initialCategoryId={addFormCategoryId}
        onBack={closeAddForm}
        onCreated={() => {
          closeAddForm()
          load()
        }}
      />
    )
  }
  if (selectedProduct) {
    return (
      <ProductDetail
        product={selectedProduct}
        onBack={() => setSelectedProductId(null)}
        formatCurrency={formatCurrency}
        formatUnitPrice={formatUnitPrice}
        onQuantityChanged={handleQuantityChanged}
        onFavoriteChanged={handleFavoriteChanged}
        onThresholdChanged={handleThresholdChanged}
        onImagesChanged={handleImagesChanged}
        onPrintLabel={canPrintLabels ? () => setLabelsPreselection([{ productId: selectedProduct.id, copies: 1 }]) : undefined}
        onDeleted={() => {
          setSelectedProductId(null)
          load()
        }}
      />
    )
  }
  // La fiche est toujours relue dans la liste fraîche : un renommage/changement de couleur s'y reflète, une suppression la fait disparaître.
  const currentCategory = selectedCategory ? (categories.find((c) => c.id === selectedCategory.id) ?? null) : null
  if (currentCategory) {
    return (
      <CategoryDetail
        category={currentCategory}
        categories={categories}
        products={products}
        isOwner={isOwner}
        onBack={() => setSelectedCategory(null)}
        onAdd={() => {
          setAddFormCategoryId(currentCategory.id)
          setShowAddForm(true)
        }}
        onProductDeleted={load}
        onCategoriesChanged={load}
        onDeleted={() => setSelectedCategory(null)}
      />
    )
  }
  if (showUnclassified) {
    return <UnclassifiedProducts categories={categories} products={products} isOwner={isOwner} onBack={() => setShowUnclassified(false)} onChanged={load} />
  }
  if (showCategories) {
    return (
      <Categories
        onBack={() => setShowCategories(false)}
        categories={categories}
        products={products}
        isOwner={isOwner}
        onCategoriesChanged={load}
        onSelectCategory={setSelectedCategory}
        onOpenUnclassified={() => setShowUnclassified(true)}
      />
    )
  }
  if (showNewArrival) {
    return (
      <NewArrival
        onBack={() => setShowNewArrival(false)}
        onCompleted={load}
        onPrintLabels={
          canPrintLabels
            ? (items) => {
                setShowNewArrival(false)
                setLabelsPreselection(items)
              }
            : undefined
        }
      />
    )
  }
  if (showArrivalsList) return <ArrivalsList onBack={() => setShowArrivalsList(false)} />
  if (showStockTransfers) return <StockTransfers onBack={() => setShowStockTransfers(false)} />
  if (showInventoryExports) return <InventoryExports onBack={() => setShowInventoryExports(false)} />
  if (showStockCounts) return <StockCounts onBack={() => setShowStockCounts(false)} />
  if (showSuppliers) return <SuppliersList onBack={() => setShowSuppliers(false)} />
  if (showPromotions) {
    return (
      <Promotions
        onBack={() => setShowPromotions(false)}
        products={products}
        isOwner={isOwner}
        canPrintLabels={canPrintLabels}
        onPrintLabels={(items) => {
          setShowPromotions(false)
          setLabelsPreselection(items)
        }}
      />
    )
  }
  if (showAlerts) {
    return (
      <StockAlerts
        onBack={() => setShowAlerts(false)}
        onOrder={() => {
          setShowAlerts(false)
          setShowNewArrival(true)
        }}
        products={products}
      />
    )
  }
  if (selectedReseller) return <ResellerDetail resellerPhone={selectedReseller.phone} onBack={() => setSelectedReseller(null)} />
  if (showNewConsignment) return <NewConsignmentOut onBack={() => setShowNewConsignment(false)} onCompleted={() => setShowNewConsignment(false)} />
  if (showResellers) {
    return (
      <ResellerList
        onBack={() => setShowResellers(false)}
        onSelectReseller={setSelectedReseller}
        onNewConsignment={() => setShowNewConsignment(true)}
      />
    )
  }
  if (firstDayDismissed === false) {
    return (
      <FirstDay
        isOwner={isOwner}
        onAddFirstProduct={() => {
          dismissFirstDay()
          setShowAddForm(true)
        }}
        onImport={dismissFirstDay}
      />
    )
  }
  if (firstDayDismissed === null) return null

  return (
    <ProductList
      sellingPriceDecimals={tenant.sellingPriceDecimals}
      products={products}
      isLoading={isLoading}
      error={error}
      stockAsOf={stockAsOf}
      isOwner={isOwner}
      onSelectProduct={(p) => setSelectedProductId(p.id)}
      onAdd={() => setShowAddForm(true)}
      onOpenCategories={() => setShowCategories(true)}
      onOpenNewArrival={() => setShowNewArrival(true)}
      onOpenArrivalsList={() => setShowArrivalsList(true)}
      onOpenStockTransfers={() => setShowStockTransfers(true)}
      onOpenInventoryExports={() => setShowInventoryExports(true)}
      onOpenStockCounts={() => setShowStockCounts(true)}
      onOpenPromotions={() => setShowPromotions(true)}
      onOpenResellers={() => setShowResellers(true)}
      onOpenAlerts={() => setShowAlerts(true)}
      onOpenSuppliers={() => setShowSuppliers(true)}
      canPrintLabels={canPrintLabels}
      onOpenLabels={() => setLabelsPreselection([])}
      onPrintLabels={setLabelsPreselection}
    />
  )
}
