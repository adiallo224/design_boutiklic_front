import { useEffect, useState } from 'react'
import { Scan, Tag, ShoppingCart, Trash2, UserPlus, Search, Minus, Plus, X, CheckCircle2, ShoppingBasket, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Product, SaleLine } from '../../../types'
import type { CategoryResponse } from '../../../lib/categoriesApi'
import { descendantAndSelfIds, flattenCategoryTree } from '../../../lib/categoryTree'
import type { PromotionResponse } from '../../../lib/promotionsApi'
import type { PaymentMethod } from '../../../lib/salesApi'
import { resolvePrice } from '../../../lib/promotionPricing'
import { debtApi, type DebtorResponse } from '../../../lib/debtApi'
import { userApi, type CurrentUserResponse } from '../../../lib/userApi'
import { getRoleLabel } from '../store_Settings/TeamRolesDesktop'
import OfflineBanner from '../../../components/OfflineBanner'
import BarcodeScannerModal from '../../../components/BarcodeScannerModal'
import HorizontalScroller from '../../components/HorizontalScroller'
import { useTopBar } from '../../hooks/useTopBar'
import VenteRapideDesktop from './VenteRapideDesktop'
import { formatSellingPrice } from '@boutiklic/shared'

type Mode = 'catalog' | 'quick'

/** Numéro local (sans +224) attendu par le formulaire de dette de SaleValidationModalDesktop —
 *  DebtorResponse.customerPhone est stocké en E.164 côté API (cf. toE164Phone, authApi.ts). */
function toLocalPhone(e164: string): string {
  return e164.replace(/^\+224/, '')
}

function sessionLabelKey(hour: number): string {
  if (hour < 12) return 'registerSales.sessionMorning'
  if (hour < 18) return 'registerSales.sessionAfternoon'
  return 'registerSales.sessionEvening'
}

interface CaisseDesktopProps {
  /** Précision des prix de vente unitaires (0 à 2 décimales) — la devise garde la sienne pour les totaux. */
  sellingPriceDecimals?: number
  searchQuery: string
  setSearchQuery: (v: string) => void
  categories: CategoryResponse[]
  selectedCategory: string
  setSelectedCategory: (v: string) => void
  filteredProducts: Product[]
  /** Catalogue complet non filtré — sert uniquement aux articles fréquents de la Vente rapide (W33), qui ne doit pas dépendre de la recherche/catégorie du mode Catalogue. */
  allProducts: Product[]
  activePromotions: PromotionResponse[]
  onAddProduct: (product: Product) => void
  onRemoveProduct: (productId: string) => void
  onUpdateQuantity: (lineId: string, delta: number) => void
  lines: SaleLine[]
  totalAmount: number
  currency: string
  onClearCart: () => void
  /** Remplace l'ancien onValidate() générique : le panier attribue le client (carte "Client attribué
   *  à la vente") avant d'ouvrir SaleValidationModalDesktop, déjà pré-rempli pour la dette — le
   *  choix du moyen de paiement (Espèces/Orange M./Wave/Dette, défilement horizontal) vit dans la
   *  modale elle-même, pas ici (cf. étude study/web/caisse_web_page_redesign). Toujours ouverte sur
   *  CASH par défaut ; rien n'empêche l'utilisateur de changer de moyen dans la modale. */
  onQuickCheckout: (method: PaymentMethod, debtCustomer?: { name: string; phone: string }) => void
}

/** W3/W33 — grille produits + panier fixe (W3, par défaut), avec bascule vers la Vente rapide (W33,
 *  montant libre en grand + articles fréquents) — le panier/paiement à droite reste commun aux deux
 *  modes (règle de traduction n°7 : un seul état de vente). La recherche vit dans la TopBar
 *  (raccourci F2, cf. useDesktopShortcuts) plutôt que dans la grille, contrairement au mockup
 *  autonome qui duplique un second champ — un seul endroit pour chercher un article, comme partout
 *  ailleurs dans l'app bureau. "Montant libre" (mode Catalogue) utilise un champ texte (clavier
 *  physique) au lieu du pavé numérique tactile de CashierAdvanced — branché directement sur
 *  `amount`/`setAmount` de CashierFlow (même état, pas de logique dupliquée).
 *
 *  Refonte visuelle (étude study/web/caisse_web_page_redesign) : bandeau de session (opérateur réel
 *  via userApi.getMe(), pas de nom fabriqué), carte "client attribué à la vente" branchée sur
 *  debtApi.getDebtors() (ne préremplit que le nom/tél dette — l'API n'a aucune notion de client
 *  "attribué" hors dette), panier avec ajustement de quantité (+/-, réutilise updateQuantity déjà
 *  utilisé côté mobile), récapitulatif financier, et boutons de paiement rapide. Pas de ligne
 *  "imprimante thermique connectée" ni de faux numéro de série : aucune détection d'imprimante
 *  n'existe côté app. Historique et Journal de caisse ont quitté ce bandeau pour un sous-menu de
 *  la sidebar (navConfig.ts) — ils n'avaient pas d'autre point d'entrée bureau que ces deux
 *  boutons, qui n'existent plus dans le mockup cible. */
export default function CaisseDesktop({
  sellingPriceDecimals = 0,
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  allProducts,
  activePromotions,
  onAddProduct,
  onRemoveProduct,
  onUpdateQuantity,
  lines,
  totalAmount,
  currency,
  onClearCart,
  onQuickCheckout,
}: CaisseDesktopProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('catalog')
  const [showScanner, setShowScanner] = useState(false)
  const [me, setMe] = useState<CurrentUserResponse | null>(null)
  const [debtors, setDebtors] = useState<DebtorResponse[]>([])
  const [assignedDebtor, setAssignedDebtor] = useState<DebtorResponse | null>(null)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  // Seules les catégories (ou sous-catégories) qui contiennent des produits, directement ou via un descendant, sont proposées.
  const productCategoryIds = new Set(allProducts.map((p) => p.categoryId).filter((id): id is string => !!id))
  const hasProducts = (categoryId: string) => [...descendantAndSelfIds(categoryId, categories)].some((id) => productCategoryIds.has(id))
  const pills = [
    { id: '', label: t('registerSales.allCategories') },
    { id: 'FAVORIS', label: t('registerSales.favorites') },
    ...flattenCategoryTree(categories).filter((c) => hasProducts(c.id)).map((c) => ({ id: c.id, label: c.depth > 1 ? `↳ ${c.name}` : c.name })),
  ]
  const frequentProducts = allProducts.filter((p) => p.isFavorite)

  useTopBar(
    { searchValue: searchQuery, onSearchChange: setSearchQuery, searchPlaceholder: t('registerSales.searchPlaceholder') },
    [t, searchQuery],
  )

  useEffect(() => {
    userApi.getMe().then(setMe).catch(() => undefined)
    debtApi.getDebtors('urgency').then(setDebtors).catch(() => undefined)
  }, [])

  // "Entrée" encaisse au clavier physique tant que le panier n'est pas vide et qu'aucun champ
  // texte n'a le focus (montant libre, recherche client...) — même esprit que F2 (recherche
  // produit) dans useDesktopShortcuts.ts, scopé à cet écran plutôt que global. Ouvre toujours la
  // modale sur CASH — le choix du moyen de paiement se fait désormais dans la modale elle-même.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || lines.length === 0) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      onQuickCheckout('CASH', assignedDebtor ? { name: assignedDebtor.customerName, phone: toLocalPhone(assignedDebtor.customerPhone) } : undefined)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lines.length, assignedDebtor, onQuickCheckout])

  const handleCheckout = () => {
    onQuickCheckout('CASH', assignedDebtor ? { name: assignedDebtor.customerName, phone: toLocalPhone(assignedDebtor.customerPhone) } : undefined)
  }

  const clientQuery = clientSearch.trim().toLowerCase()
  const matchingDebtors = debtors.filter(
    (d) => !clientQuery || d.customerName.toLowerCase().includes(clientQuery) || d.customerPhone.includes(clientQuery),
  )

  return (
    <div className="h-full flex min-h-0 max-lg:flex-col max-lg:overflow-y-auto">
      <div className="flex-1 min-w-0 flex flex-col min-h-0 max-lg:flex-none">
        <OfflineBanner />
        <div className="flex-none px-4 2xl:px-6 pt-4 flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1 p-1 rounded-xl bg-bg-elevated">
            {(['catalog', 'quick'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-9 px-3.5 rounded-lg text-sm font-bold ${mode === m ? 'bg-bg-card shadow-sm' : 'text-text-muted'}`}
              >
                {m === 'catalog' ? t('registerSales.catalogMode') : t('registerSales.quickSaleMode')}
              </button>
            ))}
          </div>
        </div>

        {mode === 'quick' ? (
          <VenteRapideDesktop
            frequentProducts={frequentProducts}
            onAddProduct={onAddProduct}
            sellingPriceDecimals={sellingPriceDecimals}
          />
        ) : (
          <>
            <div className="flex-none mx-4 2xl:mx-6 mt-3 p-3.5 rounded-xl bg-bg-card border border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-[200px]">
                <span className="w-9 h-9 rounded-lg bg-info-bg text-info-text flex items-center justify-center flex-none">
                  <Zap size={17} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-text break-words">
                    {t('registerSales.sessionActiveLabel')} · {t(sessionLabelKey(new Date().getHours()))}
                  </div>
                  {me && (
                    <div className="text-xs font-semibold text-text-dim break-words">
                      {me.displayName} ({getRoleLabel(me.role, t).label})
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-succes-bg flex-none">
                <span className="w-2 h-2 rounded-full bg-succes-text" />
                <span className="text-[11px] font-extrabold uppercase text-succes-text">{t('registerSales.scannerAvailable')}</span>
              </div>
            </div>

            <div className="flex-none px-4 2xl:px-6 pt-3 pb-3 flex items-center gap-2">
              <HorizontalScroller className="flex-1 min-w-0">
                {pills.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap flex-none ${
                      selectedCategory === c.id ? 'bg-primary text-papier font-bold' : 'bg-bg-card border border-border-strong text-[#5C5147] font-semibold'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </HorizontalScroller>
              <button type="button" onClick={() => setShowScanner(true)} title={t('registerSales.scan')} aria-label={t('registerSales.scan')} className="h-10 px-3.5 rounded-lg bg-terracotta text-papier flex items-center gap-2 text-sm font-bold flex-none">
                <Scan size={16} />
                <span className="hidden 2xl:inline">{t('registerSales.scan')}</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 2xl:px-6 pb-4 2xl:pb-6">
              {filteredProducts.length === 0 ? (
                <div className="text-[13px] font-semibold text-text-dim text-center py-10">{t('registerSales.noProductMatch')}</div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
                  {filteredProducts.map((p) => {
                    const qtyInCart = lines.find((l) => l.productId === p.id)?.quantity ?? 0
                    const resolved = resolvePrice(p, activePromotions)
                    const onPromo = resolved.catalogPrice !== null
                    const lowStock = p.quantity > 0 && p.quantity <= p.alertThreshold
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (p.quantity > 0) onAddProduct(p)
                        }}
                        className={`flex flex-col gap-2 rounded-xl bg-bg-card border text-left overflow-hidden ${onPromo ? 'border-terracotta' : 'border-border'} ${
                          p.quantity === 0 ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary hover:shadow-md transition-shadow'
                        }`}
                      >
                        <div className="relative w-full h-28 bg-bg-elevated flex items-center justify-center text-2xl overflow-hidden">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : '📦'}
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/80 text-papier text-[10px] font-extrabold uppercase truncate max-w-[80%]">
                            {p.category}
                          </span>
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.quantity === 0 || lowStock ? 'bg-[#FBE9E4] text-terracotta' : 'bg-bg-card/90 text-text'
                            }`}
                          >
                            {p.quantity === 0 ? t('registerSales.outOfStock') : t('registerSales.stockCount', { count: p.quantity })}
                          </span>
                        </div>
                        <div className="px-3 flex flex-col gap-1">
                          {p.barcode && <span className="text-[10px] font-extrabold uppercase text-text-dim truncate">{p.barcode}</span>}
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-bold truncate flex-1">{p.name}</div>
                            {onPromo && <Tag size={12} className="text-terracotta flex-none" />}
                          </div>
                        </div>
                        <div className="px-3 pb-3 flex items-center justify-between">
                          {onPromo ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="amount text-[11px] font-semibold text-text-dim line-through">{formatSellingPrice(resolved.catalogPrice!, 'fr', sellingPriceDecimals)}</span>
                              <span className="amount text-sm font-extrabold text-terracotta">{formatSellingPrice(resolved.unitPrice, 'fr', sellingPriceDecimals)}</span>
                            </div>
                          ) : (
                            <span className="amount text-sm font-extrabold">{formatSellingPrice(p.salePrice, 'fr', sellingPriceDecimals)}</span>
                          )}
                          {qtyInCart > 0 ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => onRemoveProduct(p.id)}
                                className="w-6 h-6 rounded-md bg-bg-elevated border border-border-strong flex items-center justify-center text-sm font-bold leading-none"
                              >
                                −
                              </button>
                              <span className="w-4 text-center text-xs font-extrabold text-success">{qtyInCart}</span>
                              <button
                                type="button"
                                onClick={() => onAddProduct(p)}
                                disabled={p.quantity === 0}
                                className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-papier text-sm font-bold leading-none disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-papier text-sm font-bold">+</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex-none mx-4 2xl:mx-6 mb-4 2xl:mb-6 p-3 rounded-xl bg-bg-card border border-border flex flex-wrap max-lg:hidden items-center gap-2.5">
              <span className="text-[11px] font-extrabold uppercase text-text-dim">{t('registerSales.cashierShortcutsLabel')}</span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-bg-elevated text-text"><span className="text-primary">F2</span> {t('registerSales.shortcutSearchLabel')}</span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-bg-elevated text-text"><span className="text-primary">↵</span> {t('registerSales.checkout')}</span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-bg-elevated text-text"><span className="text-primary">Esc</span> {t('registerSales.cancel')}</span>
            </div>
          </>
        )}
        {/* Barre de validation mobile : valable dans les deux modes (catalogue et vente rapide). */}
        {lines.length > 0 && (
          <div className="hidden max-lg:flex sticky bottom-0 z-10 flex-none items-center justify-between gap-3 px-4 py-2.5 bg-bg-card border-t border-border shadow-[0_-6px_18px_rgba(17,20,24,.10)]">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase text-text-dim">{t('registerSales.itemCount', { count: lines.length })}</div>
              <div className="amount text-lg font-extrabold text-primary truncate">{totalAmount.toLocaleString('fr-FR')} {currency}</div>
            </div>
            <button type="button" onClick={handleCheckout} className="h-11 px-5 rounded-xl bg-[#0E7A52] text-papier text-sm font-extrabold uppercase flex-none">
              {t('registerSales.checkout')}
            </button>
          </div>
        )}
      </div>

      <div className="w-[clamp(320px,30vw,420px)] max-lg:w-full max-lg:flex-none max-lg:border-l-0 max-lg:border-t shrink-0 border-l border-border bg-bg-card flex flex-col min-h-0">
        <div className="px-4 2xl:px-5 pt-4 2xl:pt-5 pb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ShoppingCart size={19} className="text-primary" />
            <span className="text-[15px] font-extrabold text-text">{t('registerSales.cartTitle')}</span>
            <span className="px-2 py-0.5 rounded-full bg-info-bg text-info-text text-xs font-bold">{t('registerSales.itemCount', { count: lines.length })}</span>
          </div>
          <button type="button" onClick={onClearCart} disabled={lines.length === 0} className="flex items-center gap-1 text-terracotta text-xs font-bold disabled:opacity-40">
            <Trash2 size={13} /> {t('registerSales.clearCart')}
          </button>
        </div>

        <div className="mx-4 2xl:mx-5 mb-3 relative">
          <div className="p-3 rounded-xl bg-bg flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase text-text-dim">{t('registerSales.assignedClientLabel')}</span>
              <button type="button" onClick={() => setShowClientPicker((s) => !s)} className="text-[11px] font-bold text-primary hover:underline">
                {t('registerSales.changeLink')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-bg-elevated text-text flex items-center justify-center text-xs font-bold flex-none">
                  {assignedDebtor ? assignedDebtor.customerName.slice(0, 2).toUpperCase() : '—'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-text truncate leading-tight">{assignedDebtor?.customerName ?? t('registerSales.walkInCustomer')}</div>
                  {assignedDebtor ? (
                    assignedDebtor.totalRemaining > 0 ? (
                      <div className="text-xs font-bold text-terracotta truncate">{t('registerSales.existingDebtLabel', { amount: `${assignedDebtor.totalRemaining.toLocaleString('fr-FR')} ${currency}` })}</div>
                    ) : (
                      <div className="text-xs font-bold text-succes-text truncate">{t('registerSales.upToDateLabel')}</div>
                    )
                  ) : (
                    <div className="text-xs font-semibold text-text-dim truncate">{t('registerSales.walkInCustomerHint')}</div>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setShowClientPicker((s) => !s)} className="text-text-dim hover:text-primary flex-none">
                <UserPlus size={17} />
              </button>
            </div>
          </div>

          {showClientPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowClientPicker(false)} />
              <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-xl bg-bg-card border border-border-strong shadow-lg p-2.5 flex flex-col gap-2 max-h-[320px]">
                <div className="relative flex-none">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
                  <input
                    autoFocus
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder={t('registerSales.searchCustomerPlaceholder')}
                    className="w-full h-9 pl-8 pr-2.5 rounded-lg border border-border-strong bg-bg text-sm font-semibold outline-none focus:border-primary"
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignedDebtor(null)
                      setShowClientPicker(false)
                      setClientSearch('')
                    }}
                    className="p-2.5 rounded-lg bg-bg hover:bg-bg-elevated text-left flex items-center justify-between"
                  >
                    <span className="text-sm font-bold text-text">{t('registerSales.walkInCustomer')}</span>
                    <span className="text-xs font-semibold text-text-dim">{t('registerSales.walkInCustomerHint')}</span>
                  </button>
                  {matchingDebtors.map((d) => (
                    <button
                      key={d.customerPhone}
                      type="button"
                      onClick={() => {
                        setAssignedDebtor(d)
                        setShowClientPicker(false)
                        setClientSearch('')
                      }}
                      className="p-2.5 rounded-lg bg-bg hover:bg-bg-elevated text-left flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-text truncate">{d.customerName}</div>
                        <div className="text-xs font-semibold text-text-dim truncate">{d.customerPhone}</div>
                      </div>
                      <span className={`text-xs font-bold flex-none ${d.totalRemaining > 0 ? 'text-terracotta' : 'text-succes-text'}`}>
                        {d.totalRemaining > 0 ? d.totalRemaining.toLocaleString('fr-FR') : t('registerSales.upToDateLabel')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 max-lg:max-h-80 overflow-y-auto px-4 2xl:px-5 flex flex-col gap-1.5">
          {lines.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-text-dim/70 text-center py-10">
              <ShoppingBasket size={32} />
              <span className="text-sm font-extrabold text-text-dim">{t('registerSales.emptyCartTitle')}</span>
              <span className="text-xs font-semibold text-text-dim">{t('registerSales.emptyCartHint')}</span>
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.id} className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 p-2.5 rounded-xl bg-bg hover:bg-bg-elevated transition-colors">
                <div className="flex-1 basis-[120px] min-w-0">
                  <div className="text-sm font-bold break-words">{line.productName}</div>
                  <div className="amount text-xs text-text-dim">{formatSellingPrice(line.unitPrice, 'fr', sellingPriceDecimals)} × {line.quantity}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-bg-card rounded-lg p-0.5 shadow-sm">
                    <button type="button" onClick={() => onUpdateQuantity(line.id, -1)} className="w-6 h-6 rounded flex items-center justify-center text-text-dim hover:bg-bg-elevated">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center amount text-xs font-bold">{line.quantity}</span>
                    <button type="button" onClick={() => onUpdateQuantity(line.id, 1)} className="w-6 h-6 rounded flex items-center justify-center text-text-dim hover:bg-bg-elevated">
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="amount text-sm font-extrabold min-w-[62px] text-right">{line.lineTotal.toLocaleString('fr-FR')}</span>
                  <button type="button" onClick={() => onUpdateQuantity(line.id, -line.quantity)} className="text-text-dim hover:text-danger">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex-none p-4 2xl:p-5 flex flex-col gap-3 [@media(max-height:820px)]:p-3 [@media(max-height:820px)]:gap-2 border-t border-border">
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-bg">
            <div className="flex items-center justify-between text-[13px] font-semibold text-text-muted">
              <span>{t('registerSales.subtotalArticlesLabel')}</span>
              <span className="amount font-bold text-text">{totalAmount.toLocaleString('fr-FR')} {currency}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] font-semibold text-text-muted">
              <span>{t('registerSales.commercialDiscountLabel')}</span>
              <span className="amount font-bold text-text-dim">0 {currency}</span>
            </div>
          </div>

          <div className="rounded-xl bg-bg-elevated p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-extrabold uppercase text-text-dim">{t('registerSales.netToPayLabel')}</div>
              <div className="text-xs font-bold text-succes-text">{t('registerSales.currencyLabel', { currency })}</div>
            </div>
            <div className="text-right">
              <div className="font-display amount text-2xl sm:text-3xl font-extrabold text-primary leading-none break-all">{totalAmount.toLocaleString('fr-FR')}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={lines.length === 0}
            className="w-full min-h-14 py-2 gap-2 [@media(max-height:820px)]:min-h-12 rounded-xl bg-[#0E7A52] hover:bg-[#0B6443] active:scale-[0.99] text-papier flex items-center justify-between px-4 shadow-[0_10px_22px_-10px_rgba(14,122,82,0.5)] transition-all disabled:opacity-40"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={22} />
              <span className="text-base font-extrabold uppercase tracking-wide">{t('registerSales.checkout')}</span>
            </span>
            <span className="amount text-base sm:text-xl font-extrabold break-all text-right">{totalAmount.toLocaleString('fr-FR')} {currency}</span>
          </button>
        </div>
      </div>

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onDetected={(code) => { setSearchQuery(code); setShowScanner(false) }} />
    </div>
  )
}
