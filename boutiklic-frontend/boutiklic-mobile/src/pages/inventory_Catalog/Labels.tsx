import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, Switch } from 'react-native'
import { AlertTriangle, Check, ChevronLeft, Minus, Plus, Printer, Search, Settings2 } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  MAX_COPIES_PER_PRODUCT,
  MAX_LABELS_PER_JOB,
  buildLabelsDocument,
  clampCopies,
  formatOptions,
  generateInternalCodes,
  getActiveProfile,
  isSupportedLocale,
  labelsPerPage,
  layoutForPreset,
  promotedProductIds,
  toLabelModel,
  type LabelPreselection,
  type PersistedContentOptions,
  type PrintProfile,
} from '@boutiklic/shared'
import OfflineBanner from '../../components/OfflineBanner'
import SelectField from '../../components/SelectField'
import { useAuth } from '../../hooks/useAuth'
import { useTenant } from '../../hooks/useTenant'
import { NetworkError, toErrorMessage } from '../../lib/apiClient'
import { printLabelsDocument } from '../../lib/printLabels'
import { printSettingsActions, usePrintSettings } from '../../lib/printSettingsStore'
import { resolvePrice } from '../../lib/promotionPricing'
import { promotionsApi, type PromotionResponse } from '../../lib/promotionsApi'
import { productsApi } from '../../lib/productsApi'
import type { Product } from '../../types'
import PrintSettings from '../store_Settings/PrintSettings'

interface LabelsProps {
  onBack: () => void
  products: Product[]
  /** Articles déjà cochés à l'ouverture (bouton « Étiquette » de la fiche article). */
  preselection?: LabelPreselection[]
  /** Un code interne vient d'être attribué : le catalogue du parent doit le refléter. */
  onBarcodeAssigned: (productId: string, barcode: string) => void
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const CONTENT_TOGGLES: { key: keyof PersistedContentOptions; labelKey: string }[] = [
  { key: 'showBarcode', labelKey: 'labels.setup.showBarcode' },
  { key: 'showShopName', labelKey: 'labels.setup.showShopName' },
  { key: 'showCategory', labelKey: 'labels.setup.showCategory' },
  { key: 'showPromoPrice', labelKey: 'labels.setup.showPromoPrice' },
  { key: 'showCutMarks', labelKey: 'labels.setup.showCutMarks' },
]

/** Imprimer des étiquettes de prix / code-barres (mobile) — cf. étude étiquettes §3.5 et phase 4.
 *  Même moteur que le web (@boutiklic/shared) : choix des articles et des exemplaires, de l'imprimante (profil
 *  A4 ou thermique, cf. Réglages › Imprimantes), du format de planche, puis impression via la boîte de dialogue
 *  du système (`expo-print`). Pas d'aperçu intégré sur mobile (pas de WebView dans l'app) : la fenêtre
 *  d'impression du téléphone montre la mise en page avant d'imprimer. */
export default function Labels({ onBack, products, preselection, onBarcodeAssigned }: LabelsProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { user } = useAuth()
  const { tenant } = useTenant()
  const allowed = user?.role === 'OWNER' || user?.role === 'SELLER'

  // --- données ---
  const [promotions, setPromotions] = useState<PromotionResponse[]>([])
  useEffect(() => {
    // Promotions actives : optionnelles (hors ligne → étiquettes au prix catalogue).
    promotionsApi.getAll(true).then(setPromotions).catch(() => undefined)
  }, [])

  const sortedProducts = useMemo(
    () => products.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name, locale)),
    [products, locale],
  )

  // --- sélection (id → exemplaires) ---
  const [selection, setSelection] = useState<Map<string, number>>(() => {
    const known = new Set(products.map((p) => p.id))
    return new Map((preselection ?? []).filter((w) => known.has(w.productId)).map((w) => [w.productId, w.copies]))
  })
  const [search, setSearch] = useState('')

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
  /** Articles visés par une promotion EN COURS (même règle que la caisse) — pour imprimer les étiquettes promo d'un coup. */
  const promotedIds = useMemo(() => promotedProductIds(promotions, sortedProducts), [promotions, sortedProducts])
  const selectPromoted = () =>
    setSelection((prev) => {
      const next = new Map(prev)
      for (const id of promotedIds) if (!next.has(id)) next.set(id, 1)
      return next
    })
  const selectAllFiltered = () =>
    setSelection((prev) => {
      const next = new Map(prev)
      for (const p of filtered) if (!next.has(p.id)) next.set(p.id, 1)
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
    if (selectedProducts.length === 0) return { doc: null, tooMany: false }
    const models = selectedProducts.map((p) =>
      toLabelModel(p, selection.get(p.id) ?? 1, content.showPromoPrice && promotions.length > 0 ? resolvePrice(p, promotions) : null),
    )
    try {
      const doc = buildLabelsDocument(models, profile, {
        showBarcode: content.showBarcode,
        showShopName: content.showShopName,
        shopName: tenant.name,
        showCategory: content.showCategory,
        showCutMarks: content.showCutMarks,
        startIndex: startOffset,
        locale,
        title: t('labels.documentTitle'),
      })
      return { doc, tooMany: false }
    } catch (e) {
      if (e instanceof RangeError) return { doc: null, tooMany: true }
      throw e
    }
  }, [selectedProducts, selection, content, promotions, profile, tenant.name, startOffset, locale, t])
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
  const [showPrinters, setShowPrinters] = useState(false)

  const handlePrint = async () => {
    if (!doc) return
    setPrintError(null)
    setPrinting(true)
    try {
      await printLabelsDocument(doc.html, profile.layout)
    } catch (e) {
      setPrintError(t('labels.print.error', { error: toErrorMessage(e) }))
    } finally {
      setPrinting(false)
    }
  }

  if (showPrinters) return <PrintSettings onBack={() => setShowPrinters(false)} />

  const Header = (
    <View className="gap-3.5 pb-3">
      <View className="bg-bg-card rounded-2xl border border-border p-4 gap-3">
        <View className="gap-1.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('labels.setup.printer').toUpperCase()}</Text>
          <SelectField
            value={baseProfile.id}
            onChange={(id) => printSettingsActions.setActive(id)}
            options={settings.profiles.map((p) => ({ label: p.name, value: p.id }))}
          />
        </View>
        <View className="gap-1.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('labels.setup.format').toUpperCase()}</Text>
          <SelectField
            value={presetOverride ?? baseProfile.presetId}
            onChange={(id) => setPresetOverride(id === baseProfile.presetId ? null : id)}
            options={formats.map((f) => ({ label: f.label, value: f.id }))}
          />
          <Text className="text-xs text-text-dim">{formats.find((f) => f.id === (presetOverride ?? baseProfile.presetId))?.usage}</Text>
        </View>
        <Pressable onPress={() => setShowPrinters(true)} className="self-start flex-row items-center gap-1.5">
          <Settings2 size={14} color="#0E2038" />
          <Text className="text-[13px] font-bold text-primary">{t('labels.setup.configurePrinters')}</Text>
        </Pressable>
      </View>

      <View className="bg-bg-card rounded-2xl border border-border p-4 gap-1">
        {CONTENT_TOGGLES.map(({ key, labelKey }) => (
          <View key={key} className="flex-row items-center justify-between py-1.5">
            <Text className="flex-1 pr-3 text-[15px] font-semibold">{t(labelKey)}</Text>
            <Switch value={content[key]} onValueChange={(value: boolean) => printSettingsActions.updateContent({ [key]: value })} />
          </View>
        ))}
        {isSheet && (
          <View className="flex-row items-center gap-3 pt-2 mt-1 border-t border-border-hairline">
            <View className="flex-1">
              <Text className="text-[15px] font-semibold">{t('labels.setup.startIndex')}</Text>
              <Text className="text-xs text-text-dim">
                {t('labels.setup.startIndexHint')} (1–{perPage})
              </Text>
            </View>
            <TextInput
              value={startIndex}
              onChangeText={setStartIndex}
              keyboardType="number-pad"
              selectTextOnFocus
              className="w-16 h-11 rounded-xl border border-border-strong bg-bg text-center font-bold"
            />
          </View>
        )}
      </View>

      {doc && doc.issues.length > 0 && (
        <View className="rounded-2xl bg-alerte-bg border border-[#F1DDB4] p-4 gap-2">
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={15} color="#8A6712" />
            <Text className="text-sm font-extrabold text-alerte-text">{t('labels.issues.title')}</Text>
          </View>
          {doc.issues.map((issue, index) => (
            <Text key={`${issue.productId}-${issue.kind}-${index}`} className="text-[13px] text-alerte-text">
              • {t(`labels.issues.${issue.kind}`, { name: productNames.get(issue.productId) ?? issue.productId, barcode: issue.barcode ?? '' })}
            </Text>
          ))}
          {missingCodeIds.length > 0 && content.showBarcode && (
            <Pressable
              onPress={() => generateCodes(missingCodeIds)}
              disabled={missingCodeIds.some((id) => generatingIds.has(id))}
              className="self-start mt-1 h-9 px-3.5 rounded-xl border border-border-strong bg-bg-card items-center justify-center disabled:opacity-50"
            >
              <Text className="text-[13px] font-bold">
                {missingCodeIds.some((id) => generatingIds.has(id)) ? t('labels.codes.generating') : t('labels.codes.generateMissing', { count: missingCodeIds.length })}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View className="gap-2.5">
        <Text className="text-[17px] font-extrabold tracking-tight">{t('labels.products.title')}</Text>
        <View className="h-12 rounded-2xl border border-border-strong bg-bg-card px-3.5 flex-row items-center gap-2.5">
          <Search size={17} color="#A2A9B8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('labels.products.searchPlaceholder')}
            placeholderTextColor="#A2A9B8"
            autoCorrect={false}
            className="flex-1 text-[15px] font-semibold"
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold text-text-muted">{t('labels.products.selectedCount', { count: selection.size })}</Text>
          <View className="flex-row gap-4">
            <Pressable onPress={selectAllFiltered} disabled={filtered.length === 0} className="disabled:opacity-40">
              <Text className="text-xs font-bold text-primary">{t('labels.products.selectAllFiltered')}</Text>
            </Pressable>
            <Pressable onPress={() => setSelection(new Map())} disabled={selection.size === 0} className="disabled:opacity-40">
              <Text className="text-xs font-bold text-text-muted">{t('labels.products.clearSelection')}</Text>
            </Pressable>
          </View>
        </View>
        {promotedIds.length > 0 && (
          <Pressable onPress={selectPromoted} className="self-start">
            <Text className="text-xs font-bold text-primary">{t('labels.promo.selectPromoted', { count: promotedIds.length })}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )

  if (!allowed) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-sm font-semibold text-text-muted">{t('labels.restricted')}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <OfflineBanner />
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[19px] font-extrabold tracking-tight" numberOfLines={1}>{t('labels.pageTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-muted" numberOfLines={1}>{t('labels.pageSubtitle')}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p: Product) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={Header}
        ListEmptyComponent={<Text className="py-6 text-center text-sm text-text-muted">{t('labels.products.empty')}</Text>}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        renderItem={({ item: p }: { item: Product }) => {
          const copies = selection.get(p.id)
          const checked = copies !== undefined
          const generating = generatingIds.has(p.id)
          return (
            <View className={`flex-row items-center gap-3 py-3 px-3 border-b border-border-hairline ${checked ? 'bg-info-bg' : ''}`}>
              <Pressable
                onPress={() => toggle(p.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={t('labels.products.selectAria', { name: p.name })}
                className={`w-6 h-6 rounded-md border items-center justify-center ${checked ? 'bg-primary border-primary' : 'bg-bg-card border-border-strong'}`}
              >
                {checked && <Check size={14} color="#FFFDFA" />}
              </Pressable>
              <Pressable onPress={() => toggle(p.id)} className="flex-1 min-w-0">
                <Text className="text-[15px] font-bold" numberOfLines={1}>{p.name}</Text>
                <Text className="text-xs text-text-dim" numberOfLines={1}>
                  {p.category}
                  {!p.barcode ? <Text className="font-semibold text-alerte-text">{`  ·  ${t('labels.products.noBarcode')}`}</Text> : null}
                </Text>
                {!p.barcode && (
                  <Pressable onPress={() => generateCodes([p.id])} disabled={generating} className="self-start pt-1 disabled:opacity-50">
                    <Text className="text-xs font-bold text-primary">{generating ? t('labels.codes.generating') : t('labels.codes.generate')}</Text>
                  </Pressable>
                )}
              </Pressable>
              {checked && (
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => setCopies(p.id, copies - 1)}
                    disabled={copies <= 1}
                    accessibilityLabel={`− ${t('labels.products.copiesAria', { name: p.name })}`}
                    className="w-8 h-8 rounded-lg bg-bg-elevated items-center justify-center disabled:opacity-40"
                  >
                    <Minus size={14} color="#111418" />
                  </Pressable>
                  <Text className="amount w-8 text-center text-base font-extrabold">{copies}</Text>
                  <Pressable
                    onPress={() => setCopies(p.id, copies + 1)}
                    disabled={copies >= MAX_COPIES_PER_PRODUCT}
                    accessibilityLabel={`+ ${t('labels.products.copiesAria', { name: p.name })}`}
                    className="w-8 h-8 rounded-lg bg-primary items-center justify-center disabled:opacity-40"
                  >
                    <Plus size={14} color="#FFFDFA" />
                  </Pressable>
                </View>
              )}
            </View>
          )
        }}
      />

      <View className="px-5 pt-3 pb-4 gap-2 bg-bg-card border-t border-border">
        {built.tooMany && <Text className="text-[13px] font-semibold text-danger">{t('labels.print.tooMany', { max: MAX_LABELS_PER_JOB })}</Text>}
        {printError && <Text className="text-[13px] font-semibold text-danger">{printError}</Text>}
        {codeMessage && <Text className={`text-[13px] font-semibold ${codeMessage.kind === 'error' ? 'text-danger' : 'text-succes-text'}`}>{codeMessage.text}</Text>}
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold">
              {doc ? `${t('labels.summary.labelCount', { count: doc.labelCount })} · ${t('labels.summary.pageCount', { count: doc.pageCount })}` : t('labels.preview.empty')}
            </Text>
            <Text className="text-[11px] text-text-dim" numberOfLines={2}>{t('labels.print.tip')}</Text>
          </View>
          <Pressable
            onPress={handlePrint}
            disabled={!doc || printing}
            className="h-[52px] px-5 rounded-2xl bg-primary flex-row items-center gap-2 disabled:opacity-40"
          >
            <Printer size={18} color="#FFFDFA" />
            <Text className="text-papier font-extrabold">{printing ? '…' : t('labels.print.button')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
