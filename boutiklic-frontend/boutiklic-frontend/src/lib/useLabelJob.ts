import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  buildLabelsDocument,
  clampCopies,
  generateInternalCodes,
  getActiveProfile,
  isSupportedLocale,
  labelsPerPage,
  layoutForPreset,
  promotedProductIds,
  type LabelPreselection,
  type PrintProfile,
} from '@boutiklic/shared'
import type { Product } from '../types'
import { NetworkError, toErrorMessage } from './apiClient'
import { formatOptions } from './labelFormats'
import { toLabelModel } from './labelPrint'
import { printHtmlDocument } from './printHtml'
import { printSettingsActions, usePrintSettings } from './printSettingsStore'
import { printLabelsDirect, rawPrintErrorMessage, willPrintDirectly } from './rawPrint'
import { productsApi } from './productsApi'
import { promotionsApi, type PromotionResponse } from './promotionsApi'

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface UseLabelJobOptions {
  /** Catalogue déjà chargé par l'écran hôte (il peut arriver après le premier rendu). */
  products: Product[]
  /** Articles cochés à l'ouverture ; appliqués UNE fois, dès que le catalogue est disponible. */
  preselection: LabelPreselection[]
  shopName: string
  /** Un code interne vient d'être attribué : l'écran hôte met son catalogue à jour. */
  onBarcodeAssigned: (productId: string, barcode: string) => void
}

/**
 * État et logique d'un travail d'impression d'étiquettes côté web (écran bureau ET écran étroit) : sélection et
 * exemplaires, recherche, profil d'impression et format de planche, document (`buildLabelsDocument`), points à
 * vérifier, génération de codes internes, impression via le dialogue du navigateur. Les écrans ne gardent que le
 * rendu. Le mobile a sa propre version (React Native, impression `expo-print`) — cf. Labels.tsx.
 */
export function useLabelJob({ products, preselection, shopName, onBarcodeAssigned }: UseLabelJobOptions) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  // --- promotions (optionnelles : hors ligne → étiquettes au prix catalogue) ---
  const [promotions, setPromotions] = useState<PromotionResponse[]>([])
  useEffect(() => {
    let cancelled = false
    promotionsApi.getAll(true).then((list) => !cancelled && setPromotions(list)).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name, locale)), [products, locale])

  // --- sélection (id → exemplaires) ---
  const [selection, setSelection] = useState<Map<string, number>>(new Map())
  const [search, setSearch] = useState('')
  const preselectedRef = useRef(false)

  useEffect(() => {
    if (preselectedRef.current || products.length === 0) return
    preselectedRef.current = true
    if (preselection.length === 0) return
    const known = new Set(products.map((p) => p.id))
    setSelection(new Map(preselection.filter((w) => known.has(w.productId)).map((w) => [w.productId, w.copies])))
  }, [products, preselection])

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    if (!q) return sortedProducts
    return sortedProducts.filter((p) => normalize(`${p.name} ${p.barcode ?? ''} ${p.category}`).includes(q))
  }, [sortedProducts, search])

  const toggle = (id: string) =>
    setSelection((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, 1)
      return next
    })
  const setCopies = (id: string, copies: number) => setSelection((prev) => new Map(prev).set(id, clampCopies(copies)))
  const selectAllFiltered = () =>
    setSelection((prev) => {
      const next = new Map(prev)
      for (const p of filtered) if (!next.has(p.id)) next.set(p.id, 1)
      return next
    })
  const clearSelection = () => setSelection(new Map())

  /** Articles visés par une promotion EN COURS (même règle que la caisse) — pour imprimer les étiquettes promo d'un coup. */
  const promotedIds = useMemo(() => promotedProductIds(promotions, sortedProducts), [promotions, sortedProducts])
  const selectPromoted = () =>
    setSelection((prev) => {
      const next = new Map(prev)
      for (const id of promotedIds) if (!next.has(id)) next.set(id, 1)
      return next
    })

  // --- profil d'impression et format ---
  const settings = usePrintSettings()
  const baseProfile = getActiveProfile(settings)
  const [presetOverride, setPresetOverride] = useState<string | null>(null)
  useEffect(() => setPresetOverride(null), [baseProfile.id])

  const profile: PrintProfile = useMemo(() => {
    if (!presetOverride || presetOverride === baseProfile.presetId) return baseProfile
    const layout = layoutForPreset(presetOverride)
    return layout ? { ...baseProfile, presetId: presetOverride, layout } : baseProfile
  }, [baseProfile, presetOverride])

  const formats = formatOptions(t, baseProfile.kind, baseProfile.presetId === 'custom')
  const perPage = labelsPerPage(profile.layout)
  const isSheet = profile.kind === 'SHEET_A4'

  const [startIndex, setStartIndex] = useState('1')
  const startOffset = isSheet ? Math.min(perPage, Math.max(1, Math.floor(Number(startIndex)) || 1)) - 1 : 0
  const { content } = settings

  // --- document ---
  const selectedProducts = useMemo(() => sortedProducts.filter((p) => selection.has(p.id)), [sortedProducts, selection])
  const productNames = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products])

  const built = useMemo(() => {
    if (selectedProducts.length === 0) return { doc: null, models: [], options: null, tooMany: false }
    const models = selectedProducts.map((p) => toLabelModel(p, selection.get(p.id) ?? 1, content.showPromoPrice ? promotions : null))
    const options = {
      showBarcode: content.showBarcode,
      showShopName: content.showShopName,
      shopName,
      showCategory: content.showCategory,
      showCutMarks: content.showCutMarks,
      startIndex: startOffset,
      locale,
      title: t('labels.documentTitle') ?? undefined,
    }
    try {
      return { doc: buildLabelsDocument(models, profile, options), models, options, tooMany: false }
    } catch (e) {
      if (e instanceof RangeError) return { doc: null, models, options, tooMany: true }
      throw e
    }
  }, [selectedProducts, selection, content, promotions, profile, shopName, startOffset, locale, t])
  const doc = built.doc

  // --- codes-barres internes (cf. étude §3.2) ---
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [codeMessage, setCodeMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  /** Attribue un code interne aux articles donnés (serveur, idempotent). S'arrête à la première coupure réseau :
   *  le numéro vient du compteur du serveur, il n'existe pas de génération hors ligne. */
  const generateCodes = async (ids: string[]) => {
    if (ids.length === 0) return
    setCodeMessage(null)
    setGeneratingIds((prev) => new Set([...prev, ...ids]))
    const { generated, failure } = await generateInternalCodes({
      ids,
      assign: (id) => productsApi.assignInternalBarcode(id),
      onAssigned: (id, updated) => {
        if (updated.barcode) onBarcodeAssigned(id, updated.barcode)
      },
      onSettled: (id) =>
        setGeneratingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        }),
    })
    if (failure) {
      setCodeMessage({ kind: 'error', text: failure instanceof NetworkError ? t('labels.codes.needsConnection') : t('labels.codes.generateError', { error: toErrorMessage(failure) }) })
    } else if (generated > 0) {
      setCodeMessage({ kind: 'success', text: t('labels.codes.generated', { count: generated }) })
    }
  }
  const missingCodeIds = selectedProducts.filter((p) => !p.barcode).map((p) => p.id)

  // --- impression ---
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  /** Vrai quand « Imprimer » enverra les commandes directement à l'imprimante (profil thermique + app bureau). */
  const direct = willPrintDirectly(profile)
  /** Après un échec d'envoi direct : proposer le dialogue système (pilote installé) au lieu de laisser l'utilisateur bloqué. */
  const [canFallback, setCanFallback] = useState(false)
  /** Nombre d'étiquettes envoyées en direct (pas de dialogue système : sans ce retour, rien ne dit que ça a marché). */
  const [sentCount, setSentCount] = useState<number | null>(null)

  const runPrint = async (viaDialog: boolean) => {
    if (!doc || !built.options) return
    setPrintError(null)
    setCanFallback(false)
    setSentCount(null)
    setPrinting(true)
    const useDirect = direct && !viaDialog
    try {
      if (useDirect) setSentCount((await printLabelsDirect(built.models, profile, built.options)).labelCount)
      else await printHtmlDocument(doc.html)
    } catch (e) {
      if (useDirect) {
        setPrintError(t('labels.print.directError', { error: rawPrintErrorMessage(e) }))
        setCanFallback(true)
      } else {
        setPrintError(t('labels.print.error', { error: toErrorMessage(e) }))
      }
    } finally {
      setPrinting(false)
    }
  }
  const print = () => runPrint(false)
  const printViaDialog = () => runPrint(true)

  return {
    // liste
    filtered,
    search,
    setSearch,
    selection,
    toggle,
    setCopies,
    selectAllFiltered,
    clearSelection,
    promotedIds,
    selectPromoted,
    // imprimante / format / contenu
    settings,
    baseProfile,
    profile,
    presetOverride,
    setPresetOverride,
    formats,
    perPage,
    isSheet,
    startIndex,
    setStartIndex,
    content,
    setActiveProfile: printSettingsActions.setActive,
    updateContent: printSettingsActions.updateContent,
    // document et points à vérifier
    doc,
    tooMany: built.tooMany,
    productNames,
    // codes internes
    generatingIds,
    codeMessage,
    generateCodes,
    missingCodeIds,
    // impression
    printing,
    printError,
    print,
    direct,
    sentCount,
    canFallback,
    printViaDialog,
  }
}
