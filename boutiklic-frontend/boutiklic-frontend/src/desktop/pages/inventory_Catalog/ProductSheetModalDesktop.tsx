import { useEffect, useState } from 'react'
import { Camera, Minus, Plus, Printer, Scan, Sparkles, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_LOCALE, currencyDecimals, formatUnitCost, isSupportedLocale, roundHalfUp, unitCostFromPack } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { buildLabelsPath } from '../../../lib/labelPrint'
import { productsApi } from '../../../lib/productsApi'
import { categoriesApi, type CategoryResponse } from '../../../lib/categoriesApi'
import { flattenCategoryTree } from '../../../lib/categoryTree'
import { taxApi, type TaxCategoryResponse } from '../../../lib/taxApi'
import { formatTaxRate, inheritedTax } from '../../../lib/taxInheritance'
import { inventoryApi } from '../../../lib/inventoryApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { toErrorMessage, NetworkError } from '../../../lib/apiClient'
import { syncEngine } from '../../../lib/syncEngine'
import type { Product } from '../../../types'
import BarcodeScannerModal from '../../../components/BarcodeScannerModal'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'
import MoneyInput from '../../components/MoneyInput'
import ImageGalleryEditor from '../../components/ImageGalleryEditor'

interface ProductSheetModalDesktopProps {
  open: boolean
  /** null = création (W16 depuis "+ Ajouter"), sinon édition (W16 depuis une ligne du tableau). */
  product: Product | null
  /** Catégorie pré-sélectionnée en création (W37, "+ Ajouter" depuis une catégorie) — même idiome que StockFlow.tsx (mobile). */
  initialCategoryId?: string
  onClose: () => void
  /** En création réussie, transmet l'id + la quantité initiale déjà connus côté client (cf. handleSave)
   *  pour contourner le délai de l'event inventory. Absent en édition (le stock existant n'est pas
   *  touché par ce formulaire — les ajustements passent par applyDelta, déjà synchrones). */
  onSaved: (justCreated?: { productId: string; quantity: number }) => void
  onDeleted: () => void
}

/** W16 — modale 820px. Consolide ProductForm.tsx (création, mobile) et ProductDetail.tsx (fiche +
 *  ajustements, mobile) en un seul écran bureau create/edit, avec la marge recalculée en direct
 *  (en vert) pendant la saisie — le spec le demande, et productsApi.update existe déjà côté API
 *  même si aucun écran mobile ne l'appelle aujourd'hui (le mobile ne permet que la création).
 *  Pas d'interrupteur "disponible en sortie revendeur" : ce champ n'existe pas dans ProductResponse,
 *  on ne fabrique pas de contrôle qui n'enregistrerait rien. */
export default function ProductSheetModalDesktop({ open, product, initialCategoryId, onClose, onSaved, onDeleted }: ProductSheetModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant, formatCurrency } = useTenant()
  // Décimales des champs : le prix de VENTE suit le réglage de la boutique (0 à 2, même en GNF/FCFA) ; le prix d'achat et le prix du
  // lot sont des montants payés, ils suivent la précision de la devise.
  const priceDecimals = currencyDecimals(tenant.currency)
  const sellingDecimals = tenant.sellingPriceDecimals
  const navigate = useNavigate()
  const { user } = useAuth()
  const canPrintLabels = user?.role === 'OWNER' || user?.role === 'SELLER'
  const isEdit = !!product

  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [taxCategoryId, setTaxCategoryId] = useState('')
  const [taxCategories, setTaxCategories] = useState<TaxCategoryResponse[]>([])
  const [purchasePrice, setPurchasePrice] = useState('')
  // Achat par lot (étude prix décimaux, phase 2) : le prix d'achat unitaire est alors dérivé du lot, jamais saisi.
  const [packMode, setPackMode] = useState(false)
  const [packSize, setPackSize] = useState('')
  const [packPrice, setPackPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [initialStock, setInitialStock] = useState('0')
  const [alertThreshold, setAlertThreshold] = useState('5')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [savingImages, setSavingImages] = useState(false)
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState(0)
  const [adjusting, setAdjusting] = useState(false)
  // Sélecteur affiché seulement si la boutique a plus d'un dépôt actif (phase 2b de l'étude
  // study/etude_multi_depots_transferts.md §2.2) — la quasi-totalité n'en ont qu'un.
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [depotId, setDepotId] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Cascade article > catégorie > boutique : ce que l'article hérite tant qu'il n'a pas de TVA propre (libellé de l'option vide).
  const inherited = inheritedTax(categoryId || null, categories, taxCategories, tenant.defaultTaxCategoryId, tenant.taxEnabled)
  const inheritedTaxLabel = inherited.taxCategory
    ? t(inherited.source === 'category' ? 'inventoryCatalog.taxInheritedFromCategory' : 'inventoryCatalog.taxInheritedFromShop', { rate: formatTaxRate(inherited.taxCategory.ratePercent) })
    : t('inventoryCatalog.taxNone')

  useEffect(() => {
    if (!open) return
    categoriesApi.getAll().then(setCategories).catch(() => undefined)
    taxApi.getActiveCategories().then(setTaxCategories).catch(() => undefined)
    depotsApi.getAll().then((d) => {
      const activeDepots = d.filter((depot) => depot.active)
      setDepots(activeDepots)
      setDepotId(activeDepots.find((depot) => depot.isDefault)?.id ?? activeDepots[0]?.id ?? '')
    }).catch(() => undefined)
    setError(null)
    setConfirmDelete(false)
    if (product) {
      setName(product.name)
      setBarcode(product.barcode ?? '')
      setCategoryId(product.categoryId ?? '')
      setTaxCategoryId(product.taxCategoryId ?? '')
      setPurchasePrice(String(product.purchasePrice))
      setPackMode(product.packSize != null)
      setPackSize(product.packSize != null ? String(product.packSize) : '')
      setPackPrice(product.packPurchasePrice != null ? String(product.packPurchasePrice) : '')
      setSalePrice(String(product.salePrice))
      setImageUrls(product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : []))
      setQuantity(product.quantity)
      setAlertThreshold(String(product.alertThreshold))
      setIsFavorite(product.isFavorite)
    } else {
      setName('')
      setBarcode('')
      setCategoryId(initialCategoryId ?? '')
      setTaxCategoryId('')
      setPurchasePrice('')
      setPackMode(false)
      setPackSize('')
      setPackPrice('')
      setSalePrice('')
      setImageUrls([])
      setQuantity(0)
      setInitialStock('0')
      setAlertThreshold('5')
      setIsFavorite(false)
    }
  }, [open, product])

  const packSizeNum = Number(packSize) || 0
  const packPriceNum = Number(packPrice) || 0
  /** Coût unitaire EXACT : issu du lot (1 000 / 3 = 333,333333) ou du prix d'achat saisi. La marge affichée part de
   *  lui, pas de sa version arrondie — sinon 3 boîtes vendues 400 afficheraient 201 de bénéfice au lieu de 200. */
  const unitCost = packMode ? unitCostFromPack(packPriceNum, packSizeNum) : (Number(purchasePrice) || 0)
  /** Prix d'achat envoyé : arrondi à la devise quand il est dérivé du lot (le serveur le redérive de toute façon). */
  const purchase = packMode ? roundHalfUp(unitCost) : (Number(purchasePrice) || 0)
  const sale = Number(salePrice) || 0
  const margin = sale > 0 ? sale - unitCost : 0
  const marginPct = sale > 0 ? ((margin / sale) * 100).toFixed(1) : null
  const packValid = !packMode || (packSizeNum >= 1 && packPrice !== '')
  const canSubmit = name.trim().length > 0 && sale > 0 && purchase >= 0 && packValid && !saving
  /** Toute mise à jour remplace le conditionnement côté serveur : on le renvoie TOUJOURS (absent = l'article repasse à
   *  l'unité). Sans ça, enregistrer une photo ou un prix effacerait silencieusement le lot. */
  const packFields = packMode ? { packSize: packSizeNum, packPurchasePrice: packPriceNum } : {}
  const canGenerateBarcode = isEdit && canPrintLabels && barcode.trim() === ''

  /** Fiche existante : chaque ajout/suppression d'image s'enregistre tout de suite, comme le favori
   *  ou le stock juste en dessous (cf. plan images multiples §5, décision "enregistrement immédiat").
   *  En création, l'article n'existe pas encore : la galerie reste en état local jusqu'à handleSave. */
  const handleImagesChange = async (next: string[]) => {
    setImageUrls(next)
    if (!isEdit || !product) return
    setSavingImages(true)
    setError(null)
    const payload = {
      productId: product.id,
      name: name.trim(),
      barcode: barcode.trim() || undefined,
      categoryId: categoryId || undefined,
      purchasePrice: purchase,
      salePrice: sale,
      currency: tenant.currency,
      imageUrls: next,
      taxCategoryId: taxCategoryId || undefined,
      ...packFields,
    }
    try {
      try {
        await productsApi.update(product.id, payload)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('UPDATE_PRODUCT', JSON.stringify(payload))
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSavingImages(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    // Création seulement : la ligne de stock initiale est posée par le module inventory de façon
    // asynchrone (event Spring Modulith @ApplicationModuleListener, après commit — cf. product_catalog
    // ProductCreatedEvent / inventory ProductCreatedInventoryListener), donc un rechargement immédiat
    // du catalogue peut arriver avant que la ligne existe et afficher 0. On retransmet l'id + la
    // quantité déjà connus côté client pour que l'appelant corrige l'affichage sans attendre l'event.
    let justCreated: { productId: string; quantity: number } | undefined
    try {
      // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
      // rejoué au retour du réseau (cf. lib/syncEngine.ts). N'apparaît/ne se répercute dans le
      // catalogue local qu'une fois réellement synchronisé — limitation connue, pas d'écriture
      // optimiste ici.
      if (isEdit && product) {
        const payload = {
          productId: product.id,
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: categoryId || undefined,
          purchasePrice: purchase,
          salePrice: sale,
          currency: tenant.currency,
          imageUrls,
          taxCategoryId: taxCategoryId || undefined,
          ...packFields,
        }
        try {
          await productsApi.update(product.id, payload)
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e
          await syncEngine.enqueue('UPDATE_PRODUCT', JSON.stringify(payload))
        }
      } else {
        const payload = {
          name: name.trim(),
          barcode: barcode.trim() || undefined,
          categoryId: categoryId || undefined,
          purchasePrice: purchase,
          salePrice: sale,
          currency: tenant.currency,
          imageUrls,
          initialQuantity: Number(initialStock) || 0,
          alertThreshold: Number(alertThreshold) || 0,
          taxCategoryId: taxCategoryId || undefined,
          ...packFields,
        }
        try {
          const created = await productsApi.create(payload)
          justCreated = { productId: created.id, quantity: payload.initialQuantity }
        } catch (e) {
          if (!(e instanceof NetworkError)) throw e
          await syncEngine.enqueue('CREATE_PRODUCT', JSON.stringify(payload))
        }
      }
      onSaved(justCreated)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const applyDelta = async (delta: number) => {
    if (!product || adjusting || quantity + delta < 0) return
    setAdjusting(true)
    setError(null)
    try {
      try {
        const stockLine = await inventoryApi.adjust(product.id, delta, t('inventoryCatalog.manualAdjustmentReason'), depotId || undefined)
        setQuantity(stockLine.quantity)
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('ADJUST_STOCK', JSON.stringify({ productId: product.id, delta, reason: t('inventoryCatalog.manualAdjustmentReason'), depotId: depotId || undefined, occurredAt: new Date().toISOString() }))
        setQuantity(quantity + delta)
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAdjusting(false)
    }
  }

  const saveThreshold = async () => {
    if (!product) return
    const next = Number(alertThreshold)
    if (!Number.isInteger(next) || next < 0) return
    try {
      await inventoryApi.changeThreshold(product.id, next, depotId || undefined)
    } catch (e) {
      if (e instanceof NetworkError) {
        await syncEngine.enqueue('CHANGE_ALERT_THRESHOLD', JSON.stringify({ productId: product.id, alertThreshold: next, depotId: depotId || undefined }))
      } else {
        setError(toErrorMessage(e))
      }
    }
  }

  const toggleFavorite = async () => {
    if (!product || togglingFavorite) return
    setTogglingFavorite(true)
    try {
      const next = !isFavorite
      await productsApi.setFavorite(product.id, next)
      setIsFavorite(next)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setTogglingFavorite(false)
    }
  }

  const handleDelete = async () => {
    if (!product) return
    setDeleting(true)
    setError(null)
    try {
      await productsApi.deactivate(product.id)
      onDeleted()
    } catch (e) {
      setError(toErrorMessage(e))
      setDeleting(false)
    }
  }

  const [generatingBarcode, setGeneratingBarcode] = useState(false)
  /** Code interne pour un article sans code-barres (cf. étude étiquettes §3.2) : posé côté serveur tout de
   *  suite (pas besoin d'« Enregistrer »), puis reflété dans le champ. Requiert le réseau. */
  const generateBarcode = async () => {
    if (!product) return
    setError(null)
    setGeneratingBarcode(true)
    try {
      const updated = await productsApi.assignInternalBarcode(product.id)
      setBarcode(updated.barcode ?? '')
    } catch (e) {
      setError(e instanceof NetworkError ? t('labels.codes.needsConnection') : t('labels.codes.generateError', { error: toErrorMessage(e) }))
    } finally {
      setGeneratingBarcode(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={1080} title={isEdit ? t('inventoryCatalog.productSheetTitle') : t('inventoryCatalog.addProductTitle')}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-5 lg:gap-7">
          {/* Colonne gauche — vitrine visuelle : grande image + galerie de vignettes. */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className="rounded-2xl bg-bg-card border border-border p-3.5">
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-bg-elevated flex items-center justify-center">
                {imageUrls[0] ? (
                  <img src={imageUrls[0]} alt={name} className="w-full h-full object-contain p-2" />
                ) : (
                  <Camera size={40} className="text-text-dim" />
                )}
                {isEdit && (
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    disabled={togglingFavorite}
                    title={t('registerSales.favorites') ?? undefined}
                    className="absolute top-2 right-2 w-9 h-9 rounded-full border border-border-strong bg-bg/90 shadow-sm flex items-center justify-center disabled:opacity-50"
                  >
                    <Star size={16} className={isFavorite ? 'fill-warning text-warning' : 'text-text-dim'} />
                  </button>
                )}
              </div>
            </div>

            <ImageGalleryEditor imageUrls={imageUrls} onChange={handleImagesChange} disabled={savingImages} />

            {isEdit && (
              <div className="p-3.5 rounded-xl bg-bg-card border border-border flex flex-col gap-2.5">
                <div className="text-xs font-semibold text-text-dim">{t('inventoryCatalog.stockManagementLabel')}</div>
                {depots.length > 1 && (
                  <select
                    value={depotId}
                    onChange={(e) => setDepotId(e.target.value)}
                    className="h-9 w-full min-w-0 rounded-lg border border-border-strong bg-bg px-2.5 text-xs font-bold outline-none"
                  >
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}{d.isDefault ? ` (${t('settings.defaultDepotBadge')})` : ''}</option>
                    ))}
                  </select>
                )}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => applyDelta(-1)} disabled={adjusting || quantity === 0} className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center disabled:opacity-40">
                    <Minus size={14} />
                  </button>
                  <span className="amount text-lg font-extrabold">{quantity}</span>
                  <button type="button" onClick={() => applyDelta(1)} disabled={adjusting} className="w-8 h-8 rounded-lg bg-primary text-papier flex items-center justify-center disabled:opacity-40">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite — formulaire. */}
          <div className="flex flex-col gap-3.5 min-w-0">
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3.5">
              <Input label={t('inventoryCatalog.productNameLabel')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('inventoryCatalog.productNamePlaceholder')} />
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.categoryLabel')}</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                >
                  <option value="">{t('inventoryCatalog.noCategory')}</option>
                  {flattenCategoryTree(categories).map((c) => (
                    <option key={c.id} value={c.id}>{'— '.repeat(c.depth - 1)}{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {taxCategories.length > 0 && (
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.taxCategoryLabel')}</span>
                <select
                  value={taxCategoryId}
                  onChange={(e) => setTaxCategoryId(e.target.value)}
                  className="h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                >
                  <option value="">{inheritedTaxLabel}</option>
                  {taxCategories.map((c) => (
                    <option key={c.id} value={c.id}>{t('inventoryCatalog.taxRateOption', { name: c.name, rate: formatTaxRate(c.ratePercent) })}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.barcodeOptionalLabel')}</span>
              <div className="relative">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={t('inventoryCatalog.enterManuallyPlaceholder')}
                  className={canGenerateBarcode ? 'pr-20' : 'pr-11'}
                />
                <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
                  {canGenerateBarcode && (
                    <button
                      type="button"
                      onClick={generateBarcode}
                      disabled={generatingBarcode}
                      title={generatingBarcode ? t('labels.codes.generating') : t('labels.codes.generate')}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-bg-elevated disabled:opacity-50"
                    >
                      <Sparkles size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    title={t('components.barcodeScanner.title') ?? undefined}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg-elevated"
                  >
                    <Scan size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3.5">
              {packMode ? (
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.unitCostLabel')}</span>
                  <div className="min-h-11 py-1 rounded-xl border border-border bg-bg-elevated px-3.5 flex items-center amount font-bold break-all" data-testid="pack-unit-cost">
                    {packValid && packPrice !== '' ? `${formatUnitCost(unitCost, locale)} ${tenant.currency}` : '—'}
                  </div>
                </div>
              ) : (
                <MoneyInput
                  label={t('inventoryCatalog.purchasePriceUpperLabel')}
                  value={purchasePrice}
                  onValueChange={setPurchasePrice}
                  decimals={priceDecimals}
                  placeholder="0"
                />
              )}
              <MoneyInput
                label={t('inventoryCatalog.salePriceUpperLabel')}
                value={salePrice}
                onValueChange={setSalePrice}
                decimals={sellingDecimals}
                placeholder="0"
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={packMode}
                onChange={(e) => setPackMode(e.target.checked)}
                className="w-[18px] h-[18px] mt-0.5 flex-none rounded accent-primary"
              />
              {t('inventoryCatalog.packToggleLabel')}
            </label>

            {packMode && (
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3.5">
                <Input
                  label={t('inventoryCatalog.packSizeLabel')}
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  className="amount"
                  placeholder="3"
                />
                <MoneyInput
                  label={t('inventoryCatalog.packPriceLabel')}
                  value={packPrice}
                  onValueChange={setPackPrice}
                  decimals={priceDecimals}
                  placeholder="0"
                />
              </div>
            )}

            {marginPct !== null && (
              <div className="p-3.5 rounded-xl bg-succes-bg border border-[#CBE1D7] flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-succes-text text-sm font-bold">{t('inventoryCatalog.estimatedProfitLabel')}</span>
                <span className="amount text-succes-text font-extrabold">{formatCurrency(margin)} · {marginPct}%</span>
              </div>
            )}

            {isEdit ? (
              <div className="flex flex-wrap items-end gap-2.5">
                <Input
                  label={t('inventoryCatalog.alertThresholdUpperLabel')}
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  className="flex-1 min-w-[140px]"
                />
                <Button variant="secondary" onClick={saveThreshold} className="mb-0">
                  {t('inventoryCatalog.okBadge')}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.initialStockLabel')}</span>
                  <div className="flex items-center h-11 rounded-xl border border-border-strong bg-bg p-1">
                    <button
                      type="button"
                      onClick={() => setInitialStock(String(Math.max(0, (Number(initialStock) || 0) - 1)))}
                      className="w-8 h-8 shrink-0 rounded-lg bg-bg-card border border-border flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value.replace(/[^0-9]/g, ''))}
                      inputMode="numeric"
                      className="w-full text-center border-0 bg-transparent font-bold outline-none amount"
                    />
                    <button
                      type="button"
                      onClick={() => setInitialStock(String((Number(initialStock) || 0) + 1))}
                      className="w-8 h-8 shrink-0 rounded-lg bg-primary text-papier flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <Input label={t('inventoryCatalog.alertThresholdUpperLabel')} value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" />
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        {/* Barre d'actions — supprimer / étiquette à gauche, enregistrer à droite (isEdit only pour les deux premiers). */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {isEdit && (
              confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="danger" onClick={handleDelete} loading={deleting}>
                    {t('inventoryCatalog.confirm')}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    {t('inventoryCatalog.cancel')}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="min-h-10 py-1 px-3.5 rounded-xl border border-border-strong text-danger text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  {t('inventoryCatalog.deleteArticle')}
                </button>
              )
            )}

            {isEdit && canPrintLabels && product && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate(buildLabelsPath([{ productId: product.id, copies: 1 }]))
                }}
                className="min-h-10 py-1 px-3.5 rounded-xl border border-border-strong bg-bg-card text-text-muted text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer size={14} />
                {t('labels.entry.fromProduct')}
              </button>
            )}
          </div>

          <Button onClick={handleSave} disabled={!canSubmit} loading={saving} className="w-full sm:w-auto">
            {t('inventoryCatalog.saveProduct')}
          </Button>
        </div>
      </div>

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onDetected={(code) => { setBarcode(code); setShowScanner(false) }} />
    </Modal>
  )
}
