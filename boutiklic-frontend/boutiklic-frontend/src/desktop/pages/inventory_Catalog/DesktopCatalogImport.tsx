import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Upload, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { CURRENCY_LABELS } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import {
  importApi,
  isTerminalImportStatus,
  type ImportFieldKey,
  type ImportLineAction,
  type ImportReportResponse,
  type ImportStatusResponse,
  type PreviewResponse,
} from '../../../lib/importApi'
import Button from '../../components/Button'
import { useTopBar } from '../../hooks/useTopBar'

const FIELD_KEYS: ImportFieldKey[] = ['nom', 'code_barres', 'categorie', 'prix_achat', 'prix_vente', 'quantite_initiale']
const POLL_INTERVAL_MS = 1800
const PREVIEW_DEBOUNCE_MS = 400

/** Badge d'action (Phase 2, dédoublonnage par code-barres) — "sera créé/mis à jour" à l'aperçu
 *  (avant confirmation), "créé/mis à jour" dans le rapport final (après traitement). */
function ActionBadge({ action, phase, t }: { action: ImportLineAction | null; phase: 'preview' | 'report'; t: (key: string) => string }) {
  if (!action) return null
  const key = phase === 'preview'
    ? (action === 'CREATED' ? 'inventoryCatalog.importActionWillCreate' : 'inventoryCatalog.importActionWillUpdate')
    : (action === 'CREATED' ? 'inventoryCatalog.importActionCreated' : 'inventoryCatalog.importActionUpdated')
  const colorClass = action === 'CREATED' ? 'text-succes-text' : 'text-info-text'
  return <span className={`text-xs font-bold ${colorClass}`}>{t(key)}</span>
}

/** Import de catalogue produits par fichier (Phase 1 + dédoublonnage Phase 2) — cf. boutiklic-core
 *  module catalog_import.
 *  Un seul écran, étapes gérées en interne par la présence de `preview`/`importJobId`/`status`
 *  plutôt que des sous-routes séparées : le contexte (fichier + mapping) doit rester en mémoire
 *  d'une étape à l'autre, et le retour arrière n'a pas de sens ici (le fichier est déjà envoyé).
 *  Hors ligne non géré : un import de plusieurs milliers d'articles nécessite un aller-retour
 *  serveur, aucune queue offline ne fait sens pour cette action (contrairement à l'arrivage). */
export default function DesktopCatalogImport() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const isOwner = user?.role === 'OWNER'

  useTopBar({ title: t('inventoryCatalog.importCatalogTitle') }, [t])

  const [file, setFile] = useState<File | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [currency, setCurrency] = useState(tenant.currency)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [importJobId, setImportJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<ImportStatusResponse | null>(null)
  const [report, setReport] = useState<ImportReportResponse | null>(null)
  const [starting, setStarting] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCurrency((prev) => prev || tenant.currency)
  }, [tenant.currency])

  const runPreview = useCallback(async (targetFile: File, targetMapping: Record<string, string>, targetCurrency: string, isInitial: boolean) => {
    setLoadingPreview(true)
    setError(null)
    try {
      const result = await importApi.preview(targetFile, targetMapping, targetCurrency)
      setPreview(result)
      if (isInitial) setMapping(result.suggestedMapping)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  const handleFileSelected = (selected: File) => {
    setFile(selected)
    setPreview(null)
    setMapping({})
    setImportJobId(null)
    setStatus(null)
    setReport(null)
    setError(null)
    runPreview(selected, {}, currency, true)
  }

  // Ne se déclenche que sur un changement de mapping/devise après l'aperçu initial — le premier
  // appel est fait explicitement par handleFileSelected pour connaître suggestedMapping avant de
  // pouvoir comparer quoi que ce soit.
  useEffect(() => {
    if (!file || !preview) return
    const timer = setTimeout(() => runPreview(file, mapping, currency, false), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, currency])

  // Poll tant que le job n'est pas dans un état terminal — un setTimeout rechaîné après chaque
  // réponse plutôt qu'un setInterval, pour ne jamais chevaucher deux requêtes de statut.
  useEffect(() => {
    if (!importJobId || (status && isTerminalImportStatus(status.status))) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const next = await importApi.getStatus(importJobId)
        if (!cancelled) setStatus(next)
      } catch (e) {
        if (!cancelled) setError(toErrorMessage(e))
      }
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [importJobId, status])

  useEffect(() => {
    if (!importJobId || !status || !isTerminalImportStatus(status.status)) return
    importApi.getReport(importJobId).then(setReport).catch((e) => setError(toErrorMessage(e)))
  }, [importJobId, status])

  const handleDownloadTemplate = async () => {
    if (downloadingTemplate) return
    setDownloadingTemplate(true)
    setError(null)
    try {
      const blob = await importApi.downloadTemplate()
      await downloadBlob(blob, 'template-import-catalogue.xlsx')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleStart = async () => {
    if (!file || starting) return
    setStarting(true)
    setError(null)
    try {
      const result = await importApi.start(file, mapping, currency)
      setImportJobId(result.importJobId)
      setStatus({ id: result.importJobId, status: 'PENDING', totalLines: preview?.totalLines ?? 0, successCount: 0, errorCount: 0, progressPercent: 0 })
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  // Rien n'est persisté avant la confirmation (preview ne crée ni produit ni catégorie/stock) :
  // annuler revient simplement à effacer le fichier/mapping en mémoire, comme avant tout choix.
  const handleCancel = () => {
    setFile(null)
    setPreview(null)
    setMapping({})
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRetry = async () => {
    if (!importJobId || retrying) return
    setRetrying(true)
    setError(null)
    try {
      const next = await importApi.retry(importJobId)
      setStatus(next)
      setReport(null)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setRetrying(false)
    }
  }

  const validSampleCount = preview?.sample.filter((line) => line.valid).length ?? 0

  if (!isOwner) {
    return (
      <div className="p-4 sm:p-8">
        <div className="p-4 rounded-xl border border-border-strong bg-bg-card text-sm font-semibold text-text-muted">
          {t('inventoryCatalog.importOwnerOnly')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-terracotta">{t('inventoryCatalog.categoriesTitle')}</div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-text">{t('inventoryCatalog.importCatalogTitle')}</h1>
          <p className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.importCatalogSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="min-h-10 px-3.5 py-1.5 text-left rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text disabled:opacity-50"
        >
          <Download size={16} />
          {t('inventoryCatalog.importDownloadTemplate')}
        </button>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      {!importJobId && (
        <>
          <div className="p-4 rounded-xl border border-border-strong bg-bg-card flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) handleFileSelected(selected)
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
              <Upload size={16} />
              {file ? t('inventoryCatalog.importChangeFile') : t('inventoryCatalog.importChooseFile')}
            </Button>
            <span className="text-sm font-semibold text-text-muted break-all min-w-0 flex-1 basis-[160px]">{file ? file.name : t('inventoryCatalog.importNoFileChosen')}</span>
          </div>

          {file && preview && (
            <>
              <div className="p-4 rounded-xl border border-border-strong bg-bg-card flex flex-col gap-3">
                <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.importMappingHeader')}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FIELD_KEYS.map((field) => (
                    <div key={field} className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t(`inventoryCatalog.importField.${field}`)}</span>
                      <select
                        value={mapping[field] ?? ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                      >
                        <option value="">{t('inventoryCatalog.importFieldUnmapped')}</option>
                        {preview.headers.map((header) => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('inventoryCatalog.importCurrencyLabel')}</span>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary"
                    >
                      {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border-strong bg-bg-card flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.importPreviewHeader')}</span>
                  <span className="text-[13px] font-semibold text-text-muted">
                    {t('inventoryCatalog.importPreviewCounts', { total: preview.totalLines, errors: preview.errorLines })}
                  </span>
                </div>
                {loadingPreview ? (
                  <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">{t('inventoryCatalog.productNameLabel')}</th>
                          <th className="px-3 py-2">{t('inventoryCatalog.importStatusColumn')}</th>
                          <th className="px-3 py-2">{t('inventoryCatalog.importActionColumn')}</th>
                          <th className="px-3 py-2">{t('inventoryCatalog.importErrorColumn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((line) => (
                          <tr key={line.lineNumber} className={`border-t border-border-hairline ${line.valid ? '' : 'bg-[#FDF1EC]'}`}>
                            <td className="px-3 py-2 amount text-text-dim">{line.lineNumber}</td>
                            <td className="px-3 py-2 font-semibold break-words max-w-[220px]">{line.rawData[mapping['nom']] ?? '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {line.valid ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-succes-text"><CheckCircle2 size={14} /> {t('inventoryCatalog.importLineOk')}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-danger"><XCircle size={14} /> {t('inventoryCatalog.importLineError')}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap"><ActionBadge action={line.action} phase="preview" t={t} /></td>
                            <td className="px-3 py-2 text-xs text-danger font-semibold min-w-[140px]">{line.errors.join(' · ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Button onClick={handleStart} disabled={starting || loadingPreview || validSampleCount === 0} loading={starting} className="min-h-12 px-6 sm:px-8">
                  {t('inventoryCatalog.importConfirmCta', { count: preview.totalLines })}
                </Button>
                <Button variant="secondary" onClick={handleCancel} disabled={starting} className="min-h-12 px-6 sm:px-8">
                  {t('inventoryCatalog.importCancelCta')}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {importJobId && status && (
        <div className="p-4 rounded-xl border border-border-strong bg-bg-card flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.importProgressHeader')}</span>
            <span className="text-[13px] font-bold text-text">{t(`inventoryCatalog.importStatus.${status.status}`)}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${status.progressPercent}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="font-semibold text-text-muted">{t('inventoryCatalog.importTotalLines', { count: status.totalLines })}</span>
            <span className="font-semibold text-succes-text">{t('inventoryCatalog.importSuccessLines', { count: status.successCount })}</span>
            <span className="font-semibold text-danger">{t('inventoryCatalog.importErrorLines', { count: status.errorCount })}</span>
          </div>

          {isTerminalImportStatus(status.status) && report && (
            <>
              <div className="rounded-xl border border-border max-h-[360px] overflow-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-bg-elevated text-left text-xs font-bold text-text-muted uppercase tracking-wide">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">{t('inventoryCatalog.importStatusColumn')}</th>
                      <th className="px-3 py-2">{t('inventoryCatalog.importActionColumn')}</th>
                      <th className="px-3 py-2">{t('inventoryCatalog.importErrorColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lines.map((line) => (
                      <tr key={line.lineNumber} className="border-t border-border-hairline">
                        <td className="px-3 py-2 amount text-text-dim">{line.lineNumber}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {line.status === 'OK' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-succes-text"><CheckCircle2 size={14} /> {t('inventoryCatalog.importLineOk')}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-danger"><XCircle size={14} /> {t('inventoryCatalog.importLineError')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap"><ActionBadge action={line.action} phase="report" t={t} /></td>
                        <td className="px-3 py-2 text-xs text-danger font-semibold min-w-[140px]">{line.errorReason ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {status.errorCount > 0 && (
                  <Button variant="secondary" onClick={handleRetry} disabled={retrying} loading={retrying} className="flex items-center gap-2">
                    <RefreshCw size={15} />
                    {t('inventoryCatalog.importRetryCta', { count: status.errorCount })}
                  </Button>
                )}
                <Button onClick={() => navigate('/stock')}>{t('inventoryCatalog.importDoneCta')}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
