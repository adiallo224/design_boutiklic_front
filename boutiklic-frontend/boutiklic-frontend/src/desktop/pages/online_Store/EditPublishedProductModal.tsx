import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, formatMoney, isSupportedLocale } from '@boutiklic/shared'
import { toErrorMessage } from '../../../lib/apiClient'
import { productsApi } from '../../../lib/productsApi'
import { storefrontsApi, type StorefrontProductResponse } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import MoneyInput from '../../components/MoneyInput'

export const MAX_DESCRIPTION_LENGTH = 2000

interface Props {
  open: boolean
  siteId: string
  product: StorefrontProductResponse | null
  decimals: number
  onClose: () => void
  onSaved: () => void
}

const toText = (value: number | null) => (value === null || value === undefined ? '' : String(value))

/**
 * Réglages d'UN article sur UN site : prix en ligne (sinon celui du catalogue), ancien prix barré (indicatif), ordre d'affichage, et description (propre à l'article, donc commune à
 * tous les sites). Le prix de la caisse n'est jamais modifié ici. Le serveur revalide les prix avec la précision de la boutique.
 */
export default function EditPublishedProductModal({ open, siteId, product, decimals, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [onlinePrice, setOnlinePrice] = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [position, setPosition] = useState('0')
  const [description, setDescription] = useState('')
  const [initialDescription, setInitialDescription] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !product) return
    setOnlinePrice(toText(product.onlinePrice))
    setComparePrice(toText(product.compareAtPrice))
    setPosition(String(product.position))
    setError(null)
    setDescription('')
    setInitialDescription(null)
    let active = true
    // La description vit sur la fiche article (pas dans la liste des articles publiés): on la lit à l'ouverture.
    productsApi
      .getById(product.productId)
      .then((p) => {
        if (!active) return
        setDescription(p.description ?? '')
        setInitialDescription(p.description ?? '')
      })
      .catch(() => active && setInitialDescription(null))
    return () => {
      active = false
    }
  }, [open, product])

  if (!product) return null

  const effective = onlinePrice.trim() === '' ? product.catalogPrice : Number(onlinePrice)
  const compare = comparePrice.trim() === '' ? null : Number(comparePrice)
  const compareInvalid = compare !== null && !(compare > effective)
  const descriptionTooLong = description.length > MAX_DESCRIPTION_LENGTH
  const descriptionLoaded = initialDescription !== null
  const descriptionChanged = descriptionLoaded && description.trim() !== (initialDescription ?? '').trim()
  const canSave = !compareInvalid && !descriptionTooLong && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      // Les prix d'abord: s'ils sont refusés, la description n'est pas touchée non plus.
      await storefrontsApi.publishProducts(siteId, [
        {
          productId: product.productId,
          onlinePrice: onlinePrice.trim() === '' ? null : Number(onlinePrice),
          compareAtPrice: compare,
          position: Math.max(0, Number.parseInt(position, 10) || 0),
        },
      ])
      if (descriptionChanged) await productsApi.changeDescription(product.productId, description.trim() === '' ? null : description.trim())
      onSaved()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={600}
      title={product.name}
      subtitle={t('onlineStore.products.editSubtitle', { price: formatMoney(product.catalogPrice, product.currency, locale, decimals) })}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('onlineStore.create.cancel')}</Button>
          <Button onClick={save} loading={saving} disabled={!canSave}>{t('onlineStore.delivery.save')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoneyInput label={`${t('onlineStore.products.onlinePrice')} (${product.currency})`} value={onlinePrice} onValueChange={setOnlinePrice} decimals={decimals} placeholder={String(product.catalogPrice)} />
          <MoneyInput
            label={`${t('onlineStore.products.comparePrice')} (${product.currency})`}
            value={comparePrice}
            onValueChange={setComparePrice}
            decimals={decimals}
            error={compareInvalid ? t('onlineStore.products.comparePriceInvalid') : undefined}
          />
        </div>
        <p className="text-xs font-medium text-text-dim">{t('onlineStore.products.priceHint')}</p>

        <Input label={t('onlineStore.products.position')} value={position} inputMode="numeric" onChange={(e) => setPosition(e.target.value.replace(/\D/g, ''))} />

        <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
          {t('onlineStore.products.description')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            disabled={!descriptionLoaded}
            className={`w-full rounded-xl border bg-bg px-3.5 py-2.5 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary disabled:opacity-60 ${descriptionTooLong ? 'border-danger' : 'border-border-strong'}`}
            placeholder={t('onlineStore.products.descriptionPlaceholder')}
          />
          <span className={`text-xs font-medium normal-case tracking-normal ${descriptionTooLong ? 'text-danger' : 'text-text-dim'}`}>
            {description.length} / {MAX_DESCRIPTION_LENGTH} — {t('onlineStore.products.descriptionHint')}
          </span>
        </label>

        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
