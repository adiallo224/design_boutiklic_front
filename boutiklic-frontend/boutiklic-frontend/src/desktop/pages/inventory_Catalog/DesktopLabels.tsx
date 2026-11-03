import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, Printer, Search, Settings2 } from 'lucide-react'
import { MAX_LABELS_PER_JOB, clampCopies } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { loadCatalogWithStock } from '../../../lib/productCatalog'
import { toErrorMessage } from '../../../lib/apiClient'
import { MAX_COPIES_PER_PRODUCT, PRINT_SETTINGS_PATH, parseLabelPreselection, readPreselectionState } from '../../../lib/labelPrint'
import { useLabelJob } from '../../../lib/useLabelJob'
import type { Product } from '../../../types'
import Button from '../../components/Button'
import Input from '../../components/Input'
import LabelPreview from '../../components/LabelPreview'
import { useTopBar } from '../../hooks/useTopBar'

const selectClass = 'h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary'

/** Imprimer des étiquettes de prix / code-barres (route /stock/etiquettes) — cf. étude étiquettes §3.5.
 *  Choix des articles et du nombre d'exemplaires, du profil d'impression (A4 ou thermique, cf. Réglages ›
 *  Impression), du format de planche (modifiable ici sans toucher au profil), aperçu fidèle (même document
 *  HTML que l'impression), puis impression via la boîte de dialogue du système. La logique vit dans
 *  `useLabelJob` (partagée avec l'écran étroit) ; cette page ne garde que le chargement du catalogue et le rendu.
 *  Les raccourcis contextuels (fiche article, plus tard arrivage/promotions) arrivent ici avec des articles
 *  pré-sélectionnés (`?product=` / `?items=`, cf. lib/labelPrint.ts). */
export default function DesktopLabels() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const allowed = user?.role === 'OWNER' || user?.role === 'SELLER'

  useTopBar({ title: t('labels.pageTitle') }, [t])

  // --- catalogue ---
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadCatalogWithStock()
      .then((catalog) => {
        if (!cancelled) setProducts(catalog.products.filter((p) => p.isActive))
      })
      .catch((e) => {
        if (!cancelled) setLoadError(toErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // État de navigation (sélection multiple du stock, arrivage) d'abord ; sinon URL (fiche article : ?product=).
  const preselection = useMemo(() => readPreselectionState(location.state) ?? parseLabelPreselection(searchParams), [location.state, searchParams])
  const handleBarcodeAssigned = useCallback(
    (productId: string, barcode: string) => setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, barcode } : p))),
    [],
  )

  const job = useLabelJob({ products, preselection, shopName: tenant.name, onBarcodeAssigned: handleBarcodeAssigned })
  const {
    filtered, search, setSearch, selection, toggle, setCopies, selectAllFiltered, clearSelection, promotedIds, selectPromoted,
    settings, baseProfile, profile, presetOverride, setPresetOverride, formats, perPage, isSheet, startIndex, setStartIndex, content,
    doc, tooMany, productNames, generatingIds, codeMessage, generateCodes, missingCodeIds, printing, printError, print,
    direct, sentCount, canFallback, printViaDialog,
  } = job

  // Groupes catégorie repliables (triés alphabétiquement) — l'ancienne liste plate devient trop
  // longue à parcourir dès qu'un catalogue dépasse une vingtaine d'articles.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const toggleCategory = (category: string) =>
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    filtered.forEach((p) => {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  if (!allowed) {
    return <div className="p-8 text-sm font-semibold text-text-muted">{t('labels.restricted')}</div>
  }

  const selectedCount = selection.size
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selection.has(p.id))

  return (
    <div className="p-4 sm:p-8">
      <p className="mb-4 sm:mb-6 text-sm text-text-muted">{t('labels.pageSubtitle')}</p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,440px)_1fr] gap-6 items-start">
        {/* ---- Articles ---- */}
        <section className="rounded-2xl border border-border bg-bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col gap-3">
            <h2 className="font-display text-lg font-extrabold text-text">{t('labels.products.title')}</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('labels.products.searchPlaceholder') ?? ''} className="w-full pl-10" />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span className="text-text-muted">{t('labels.products.selectedCount', { count: selectedCount })}</span>
              {allFilteredSelected ? (
                <button type="button" onClick={clearSelection} className="ml-auto pl-4 text-text-muted hover:underline">
                  {t('labels.products.clearSelection')}
                </button>
              ) : (
                <button type="button" onClick={selectAllFiltered} disabled={filtered.length === 0} className="ml-auto pl-4 text-primary hover:underline disabled:opacity-40">
                  {t('labels.products.selectAllFiltered')}
                </button>
              )}
            </div>
            {promotedIds.length > 0 && (
              <button
                type="button"
                onClick={selectPromoted}
                title={t('labels.promo.hint') ?? undefined}
                className="self-start text-xs font-bold text-primary hover:underline"
              >
                {t('labels.promo.selectPromoted', { count: promotedIds.length })}
              </button>
            )}
          </div>

          <div className="max-h-[60vh] xl:max-h-[calc(100vh-330px)] min-h-[240px] overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-sm text-text-muted">{t('common.loading')}</div>
            ) : loadError ? (
              <div className="p-6 text-sm font-semibold text-danger">{t('labels.loadError')} {loadError}</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-text-muted">{t('labels.products.empty')}</div>
            ) : (
              groupedByCategory.map(([category, items]) => {
                const isCollapsed = collapsedCategories.has(category)
                const selectedInCategory = items.filter((p) => selection.has(p.id)).length
                return (
                  <div key={category}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`sticky top-0 z-10 w-full flex items-center justify-between gap-3 px-4 py-2 text-left border-b border-border ${
                        isCollapsed ? 'bg-bg-card hover:bg-bg-elevated' : 'bg-terracotta text-white border-transparent'
                      }`}
                    >
                      <span className={`flex items-center gap-1.5 min-w-0 text-xs font-extrabold uppercase tracking-wide ${isCollapsed ? 'text-text-dim' : ''}`}>
                        <ChevronDown size={14} className={`shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        <span className="truncate">{category}</span>
                        <span className={`font-semibold normal-case ${isCollapsed ? 'text-text-dim' : 'text-white/70'}`}>({items.length})</span>
                      </span>
                      {selectedInCategory > 0 && (
                        <span className={`shrink-0 text-[11px] font-bold ${isCollapsed ? 'text-primary' : 'text-white'}`}>
                          {t('labels.products.selectedCount', { count: selectedInCategory })}
                        </span>
                      )}
                    </button>
                    {!isCollapsed && (
                      <ul>
                        {items.map((p) => {
                          const copies = selection.get(p.id)
                          const checked = copies !== undefined
                          return (
                            <li key={p.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-4 sm:pl-8 pr-4 py-3 border-b border-border-hairline ${checked ? 'bg-info-bg' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(p.id)}
                                aria-label={t('labels.products.selectAria', { name: p.name }) ?? undefined}
                                className="w-4 h-4 accent-[#0E2038] shrink-0"
                              />
                              <button type="button" onClick={() => toggle(p.id)} className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-bold break-words">{p.name}</div>
                                <div className="text-xs text-text-dim break-words">
                                  {p.category}
                                  {!p.barcode && <span className="ml-2 font-semibold text-alerte-text">· {t('labels.products.noBarcode')}</span>}
                                </div>
                              </button>
                              {!p.barcode && (
                                <button
                                  type="button"
                                  onClick={() => generateCodes([p.id])}
                                  disabled={generatingIds.has(p.id)}
                                  title={t('labels.codes.hint') ?? undefined}
                                  className="shrink-0 text-xs font-bold text-primary hover:underline disabled:opacity-50"
                                >
                                  {generatingIds.has(p.id) ? t('labels.codes.generating') : t('labels.codes.generate')}
                                </button>
                              )}
                              {checked && (
                                <input
                                  type="number"
                                  min={1}
                                  max={MAX_COPIES_PER_PRODUCT}
                                  value={copies}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const n = Number(e.target.value)
                                    setCopies(p.id, Number.isFinite(n) ? clampCopies(n) : 1)
                                  }}
                                  aria-label={t('labels.products.copiesAria', { name: p.name }) ?? undefined}
                                  className="w-16 h-9 px-2 rounded-lg border border-border-strong bg-bg text-center font-bold outline-none focus:border-primary shrink-0"
                                />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ---- Réglages + aperçu ---- */}
        <div className="flex flex-col gap-6 min-w-0">
          <section className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5 flex flex-col gap-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.setup.printer')}</span>
                <select value={baseProfile.id} onChange={(e) => job.setActiveProfile(e.target.value)} className={selectClass}>
                  {settings.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.setup.format')}</span>
                <select value={presetOverride ?? baseProfile.presetId} onChange={(e) => setPresetOverride(e.target.value === baseProfile.presetId ? null : e.target.value)} className={selectClass}>
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="-mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs text-text-dim">
              <span>{formats.find((f) => f.id === (presetOverride ?? baseProfile.presetId))?.usage}</span>
              <button type="button" onClick={() => navigate(PRINT_SETTINGS_PATH)} className="shrink-0 inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
                <Settings2 size={13} />
                {t('labels.setup.configurePrinters')}
              </button>
            </div>

            <fieldset className="border-t border-border pt-4">
              <legend className="sr-only">{t('labels.setup.contentTitle')}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-semibold">
                {(
                  [
                    ['showBarcode', 'labels.setup.showBarcode'],
                    ['showShopName', 'labels.setup.showShopName'],
                    ['showCategory', 'labels.setup.showCategory'],
                    ['showPromoPrice', 'labels.setup.showPromoPrice'],
                    ['showCutMarks', 'labels.setup.showCutMarks'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={content[key]} onChange={(e) => job.updateContent({ [key]: e.target.checked })} className="w-4 h-4 accent-[#0E2038]" />
                    {t(labelKey)}
                  </label>
                ))}
              </div>
            </fieldset>

            {isSheet && (
              <div className="flex items-end gap-3 border-t border-border pt-4">
                <Input
                  label={t('labels.setup.startIndex')}
                  type="number"
                  min={1}
                  max={perPage}
                  value={startIndex}
                  onChange={(e) => setStartIndex(e.target.value)}
                  className="w-24"
                />
                <span className="pb-3 text-xs text-text-dim">
                  {t('labels.setup.startIndexHint')} (1–{perPage})
                </span>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5 flex flex-col gap-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold text-text">{t('labels.preview.title')}</h2>
                {doc && (
                  <div className="text-sm text-text-muted">
                    {t('labels.summary.labelCount', { count: doc.labelCount })} · {t('labels.summary.pageCount', { count: doc.pageCount })}
                  </div>
                )}
              </div>
              <Button onClick={print} loading={printing} disabled={!doc} className="inline-flex items-center gap-2">
                <Printer size={16} />
                {t('labels.print.button')}
              </Button>
            </div>

            {tooMany && <div className="text-[13px] font-semibold text-danger">{t('labels.print.tooMany', { max: MAX_LABELS_PER_JOB })}</div>}
            {printError && <div className="text-[13px] font-semibold text-danger">{printError}</div>}
            {canFallback && (
              <div>
                <Button variant="secondary" className="!h-9 !px-3.5" onClick={printViaDialog} loading={printing}>
                  {t('labels.print.viaDialog')}
                </Button>
              </div>
            )}
            {sentCount !== null && <div className="text-[13px] font-semibold text-succes-text">{t('labels.print.sent', { count: sentCount })}</div>}
            {codeMessage && (
              <div className={`text-[13px] font-semibold ${codeMessage.kind === 'error' ? 'text-danger' : 'text-succes-text'}`}>{codeMessage.text}</div>
            )}

            {doc && doc.issues.length > 0 && (
              <div className="rounded-xl bg-alerte-bg border border-[#F1DDB4] p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-alerte-text">
                  <AlertTriangle size={15} />
                  {t('labels.issues.title')}
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-[13px] text-alerte-text list-disc pl-5">
                  {doc.issues.map((issue, index) => (
                    <li key={`${issue.productId}-${issue.kind}-${index}`}>
                      {t(`labels.issues.${issue.kind}`, { name: productNames.get(issue.productId) ?? issue.productId, barcode: issue.barcode ?? '' })}
                    </li>
                  ))}
                </ul>
                {missingCodeIds.length > 0 && content.showBarcode && (
                  <Button
                    variant="secondary"
                    className="mt-3 !h-9 !px-3.5"
                    loading={missingCodeIds.some((id) => generatingIds.has(id))}
                    onClick={() => generateCodes(missingCodeIds)}
                    title={t('labels.codes.hint') ?? undefined}
                  >
                    {t('labels.codes.generateMissing', { count: missingCodeIds.length })}
                  </Button>
                )}
              </div>
            )}

            <LabelPreview
              html={doc?.html ?? null}
              pageWidthMm={profile.layout.pageWidthMm}
              title={t('labels.preview.frameTitle')}
              emptyText={t('labels.preview.empty')}
            />

            <p className="text-xs text-text-dim">{direct ? t('labels.print.directTip') : t('labels.print.tip')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
