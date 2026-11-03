import { useTranslation } from 'react-i18next'
import { formatSellingPrice } from '@boutiklic/shared'
import type { Product } from '../../../types'

interface VenteRapideDesktopProps {
  /** Précision des prix de vente unitaires (0 à 2 décimales). */
  sellingPriceDecimals?: number
  frequentProducts: Product[]
  onAddProduct: (product: Product) => void
}

/** W33 — vente rapide : articles fréquents en pastilles ; le panneau de droite (panier +
 *  paiement) reste celui de CaisseDesktop, partagé entre les deux modes (règle de traduction n°7 :
 *  un seul état de vente, pas deux écrans qui divergent). */
export default function VenteRapideDesktop({ frequentProducts, onAddProduct, sellingPriceDecimals = 0 }: VenteRapideDesktopProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 2xl:px-6 pb-4 2xl:pb-6 flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.frequentProductsLabel')}</div>
        {frequentProducts.length === 0 ? (
          <div className="text-sm font-semibold text-text-dim">{t('registerSales.noProductMatch')}</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {frequentProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => p.quantity > 0 && onAddProduct(p)}
                disabled={p.quantity === 0}
                className="flex items-center gap-2 px-3.5 min-h-11 py-1 max-w-full rounded-full text-left border border-border-strong bg-bg-card text-sm font-bold disabled:opacity-40 hover:border-primary"
              >
                <span className="break-words min-w-0">{p.name}</span>
                <span className="amount text-xs text-text-dim flex-none">{formatSellingPrice(p.salePrice, 'fr', sellingPriceDecimals)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
