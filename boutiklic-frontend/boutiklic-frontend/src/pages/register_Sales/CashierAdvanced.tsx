import { useState } from 'react'
import { Search, Scan, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatSellingPrice } from '@boutiklic/shared'
import type { Product, SaleLine } from '../../types'
import type { CategoryResponse } from '../../lib/categoriesApi'
import { flattenCategoryTree } from '../../lib/categoryTree'
import type { PromotionResponse } from '../../lib/promotionsApi'
import { resolvePrice } from '../../lib/promotionPricing'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'

interface CashierAdvancedProps {
  /** Précision des prix de vente unitaires (0 à 2 décimales). */
  sellingPriceDecimals?: number
  searchQuery: string
  setSearchQuery: (v: string) => void
  categories: CategoryResponse[]
  selectedCategory: string
  setSelectedCategory: (v: string) => void
  filteredProducts: Product[]
  activePromotions: PromotionResponse[]
  onAddProduct: (product: Product) => void
  onRemoveProduct: (productId: string) => void
  lines: SaleLine[]
  totalAmount: number
  currency: string
  onClearCart: () => void
  onValidate: () => void
}

export default function CashierAdvanced({
  sellingPriceDecimals = 0,
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  activePromotions,
  onAddProduct,
  onRemoveProduct,
  lines,
  totalAmount,
  currency,
  onClearCart,
  onValidate,
}: CashierAdvancedProps) {
  const { t } = useTranslation()
  const [showScanner, setShowScanner] = useState(false)
  const pills = [
    { id: 'FAVORIS', label: t('registerSales.favorites') },
    { id: '', label: t('registerSales.allCategories') },
    ...flattenCategoryTree(categories).map((c) => ({ id: c.id, label: c.depth > 1 ? `↳ ${c.name}` : c.name })),
  ]

  return (
    <>
      <div className="flex-none px-5 pb-3.5 flex gap-2.5">
        <div className="flex-1 h-14 rounded-2xl bg-bg-card border border-border-strong flex items-center gap-2.5 px-4">
          <Search size={19} className="text-text-dim" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('registerSales.searchPlaceholder')}
            className="flex-1 bg-transparent outline-none text-base placeholder:text-text-dim"
          />
        </div>
        <button onClick={() => setShowScanner(true)} className="w-14 h-14 rounded-2xl bg-terracotta flex items-center justify-center">
          <Scan size={24} className="text-papier" />
        </button>
      </div>
      <div className="flex-none px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {pills.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-4 py-2.5 rounded-xl text-sm whitespace-nowrap ${selectedCategory === c.id ? 'bg-primary text-papier font-bold' : 'bg-bg-card border border-border-strong text-[#5C5147] font-semibold'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex-1 px-5 flex flex-col gap-1.5">
        {filteredProducts.length === 0 ? (
          <div className="text-[13px] font-semibold text-text-dim text-center py-6">{t('registerSales.noProductMatch')}</div>
        ) : (
          filteredProducts.map((p) => {
            const qtyInCart = lines.find((l) => l.productId === p.id)?.quantity ?? 0
            const resolved = resolvePrice(p, activePromotions)
            const onPromo = resolved.catalogPrice !== null
            return (
              <div
                key={p.id}
                onClick={() => { if (p.quantity > 0) onAddProduct(p) }}
                className={`flex items-center gap-3 p-2.5 rounded-2xl bg-bg-card border text-left ${onPromo ? 'border-terracotta' : 'border-border'} ${p.quantity === 0 ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
              >
                <div className="w-[46px] h-[46px] rounded-[13px] bg-bg-elevated flex items-center justify-center text-2xl flex-none overflow-hidden">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : '📦'}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-base font-bold truncate">{p.name}</div>
                    {onPromo && <Tag size={13} className="text-terracotta flex-none" />}
                  </div>
                  <div className={`text-[13px] font-semibold ${p.quantity <= p.alertThreshold ? 'text-terracotta' : 'text-text-dim'}`}>
                    {p.quantity === 0 ? t('registerSales.outOfStock') : t('registerSales.stockCount', { count: p.quantity })} {p.quantity > 0 && p.quantity <= p.alertThreshold ? `· ${t('registerSales.lowStockSoon')}` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-none">
                  {onPromo ? (
                    <div className="flex items-baseline gap-1.5">
                      <div className="amount text-xs font-semibold text-text-dim line-through">{formatSellingPrice(resolved.catalogPrice!, 'fr', sellingPriceDecimals)}</div>
                      <div className="amount text-base font-extrabold text-terracotta">{formatSellingPrice(resolved.unitPrice, 'fr', sellingPriceDecimals)}</div>
                    </div>
                  ) : (
                    <div className="amount text-base font-extrabold">{formatSellingPrice(p.salePrice, 'fr', sellingPriceDecimals)}</div>
                  )}
                  {qtyInCart > 0 ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onRemoveProduct(p.id)}
                        className="w-[34px] h-[34px] rounded-[11px] bg-bg-elevated border border-border-strong flex items-center justify-center text-lg font-bold leading-none"
                      >
                        −
                      </button>
                      <div className="w-5 text-center text-sm font-extrabold tabular-nums text-success">{qtyInCart}</div>
                      <button
                        onClick={() => onAddProduct(p)}
                        disabled={p.quantity === 0}
                        className="w-[34px] h-[34px] rounded-[11px] bg-primary flex items-center justify-center text-papier text-lg font-bold leading-none disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <div className="w-[34px] h-[34px] rounded-[11px] bg-primary flex items-center justify-center text-papier text-lg font-bold">+</div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      {lines.length > 0 && (
        <div className="flex-none mx-4 mt-3 p-4 rounded-[20px] bg-primary flex flex-col gap-2.5 shadow-[0_-6px_24px_rgba(17,20,24,.12)]">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-xs font-bold text-papier/60 tracking-widest whitespace-nowrap">
              {t('registerSales.cartLabel', { count: lines.length })}
            </div>
            <div className="amount text-[26px] font-extrabold text-papier whitespace-nowrap">{totalAmount.toLocaleString('fr-FR')} {currency}</div>
          </div>
          <div className="flex gap-2.5">
            <button onClick={onClearCart} className="flex-1 h-[52px] rounded-2xl bg-papier/15 text-papier text-base font-bold">
              {t('registerSales.clearCart')}
            </button>
            <button onClick={onValidate} className="flex-[2] h-[52px] rounded-2xl bg-warning text-encre text-[17px] font-extrabold">
              {t('registerSales.checkout')}
            </button>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={(code) => { setSearchQuery(code); setShowScanner(false) }}
      />
    </>
  )
}
