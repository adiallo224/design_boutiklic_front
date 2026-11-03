import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Lock } from 'lucide-react'
import {
  INVENTORY_EXPORT_FORMATS,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_REPORTS,
  inventoryExportFileName,
  inventoryReportDef,
  type InventoryExportFormat,
  type InventoryMovementType,
  type InventoryReportType,
} from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { inventoryApi } from '../../../lib/inventoryApi'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { categoriesApi, type CategoryResponse } from '../../../lib/categoriesApi'
import { ApiError, NetworkError, toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import Button from '../../components/Button'
import { useTopBar } from '../../hooks/useTopBar'

const FORMAT_LABELS: Record<InventoryExportFormat, string> = { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' }
const selectClass = 'w-full h-11 rounded-xl border border-border-strong bg-bg-card px-3 font-semibold outline-none focus:border-primary'

/** Exports d'inventaire (Excel, PDF, CSV) : type de rapport + format + filtres à gauche, contenu du fichier à droite.
 *  Contrat partagé avec le mobile via @boutiklic/shared (inventoryExports) ; le fichier est généré par le serveur
 *  (GET /inventory/export), donc l'écran demande une connexion — hors ligne, l'erreur réseau est expliquée, pas masquée.
 *
 *  Valorisation et « inclure les prix » exposent des coûts d'achat : le serveur exige REPORT_FINANCIAL_VIEW. Le client ne connaît
 *  que le rôle, pas les permissions supplémentaires d'un membre : seuls les non-propriétaires voient un cadenas, et c'est le
 *  serveur (403) qui tranche — un membre autorisé n'est donc jamais bloqué à tort. */
export default function DesktopInventoryExports() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  useTopBar({ title: t('inventoryExports.title') }, [t])

  const [type, setType] = useState<InventoryReportType>('general')
  const [format, setFormat] = useState<InventoryExportFormat>('xlsx')
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [depotId, setDepotId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [includePrices, setIncludePrices] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [movementType, setMovementType] = useState<InventoryMovementType | ''>('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    depotsApi.getAll().then((all) => setDepots(all.filter((d) => d.active))).catch(() => setDepots([]))
    categoriesApi.getAll().then(setCategories).catch(() => setCategories([]))
  }, [])

  const def = inventoryReportDef(type)
  const periodInvalid = def.supportsPeriod && from !== '' && to !== '' && from > to

  const handleExport = async () => {
    if (exporting || periodInvalid) return
    setExporting(true)
    setError(null)
    try {
      const blob = await inventoryApi.exportReport({
        type,
        format,
        depotId: depotId || null,
        categoryId: categoryId || null,
        includePrices,
        from: from || null,
        to: to || null,
        movementType: movementType || null,
      })
      await downloadBlob(blob, inventoryExportFileName(type, format, new Date().toISOString().slice(0, 10)))
    } catch (e) {
      if (e instanceof NetworkError) setError(t('inventoryExports.needsConnection'))
      else if (e instanceof ApiError && e.status === 403) setError(t('inventoryExports.forbidden'))
      else setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 lg:gap-8">
      <div className="flex flex-col gap-5 min-w-0">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.reportSection')}</div>
          <div className="flex flex-col gap-2">
            {INVENTORY_REPORTS.map((r) => {
              const locked = r.financial && !isOwner
              return (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => setType(r.type)}
                  className={`min-h-11 py-2 gap-2 rounded-xl px-4 text-sm flex items-center justify-between text-left ${type === r.type ? 'bg-primary text-papier font-extrabold' : 'bg-bg-card border border-border-strong text-text-muted font-semibold'}`}
                >
                  <span>{t(`inventoryExports.report.${r.type}.title`)}</span>
                  {locked && (
                    <span className="flex items-center gap-1 text-[11px] font-bold opacity-80">
                      <Lock size={12} />
                      {t('inventoryExports.ownerOnly')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.formatSection')}</div>
          <div className="flex flex-wrap gap-2.5">
            {INVENTORY_EXPORT_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 min-w-[90px] min-h-11 px-2 rounded-xl text-sm ${format === f ? 'border-2 border-primary bg-info-bg text-primary font-extrabold' : 'border border-border-strong bg-bg-card text-text-muted font-bold'}`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.filtersSection')}</div>

          {depots.length > 1 && (
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
              {t('inventoryExports.depotLabel')}
              <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={selectClass}>
                <option value="">{t('inventoryExports.allDepots')}</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
            {t('inventoryExports.categoryLabel')}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
              <option value="">{t('inventoryExports.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{`${'— '.repeat(c.depth)}${c.name}`}</option>
              ))}
            </select>
          </label>

          {def.supportsPrices && (
            <label className="flex items-center gap-2.5 text-sm font-semibold text-text">
              <input type="checkbox" checked={includePrices} onChange={(e) => setIncludePrices(e.target.checked)} className="w-4 h-4 accent-primary" />
              {t('inventoryExports.includePrices')}
              {!isOwner && <Lock size={12} className="text-text-dim" />}
            </label>
          )}

          {def.supportsPeriod && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
                  {t('inventoryExports.periodFrom')}
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
                  {t('inventoryExports.periodTo')}
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} />
                </label>
              </div>
              <div className="text-xs font-semibold text-text-dim -mt-1">{t('inventoryExports.periodHint')}</div>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-text-muted">
                {t('inventoryExports.movementTypeLabel')}
                <select value={movementType} onChange={(e) => setMovementType(e.target.value as InventoryMovementType | '')} className={selectClass}>
                  <option value="">{t('inventoryExports.allMovementTypes')}</option>
                  {INVENTORY_MOVEMENT_TYPES.map((m) => (
                    <option key={m} value={m}>{t(`inventoryExports.movementType.${m}`)}</option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleExport} disabled={exporting || periodInvalid} loading={exporting} className="min-h-12">
          <Download size={16} className="inline mr-2" />
          {t('inventoryExports.download')}
        </Button>
      </div>

      <div className="rounded-2xl bg-bg-card border border-border p-4 sm:p-6 flex flex-col gap-4 w-full max-w-[560px] min-w-0 h-fit">
        <div className="font-display text-base sm:text-lg font-extrabold break-words">{t(`inventoryExports.report.${type}.title`)}</div>
        <p className="text-sm font-semibold text-text-muted">{t(`inventoryExports.report.${type}.description`)}</p>
        <div className="flex flex-col gap-1.5 pt-3 border-t border-dashed border-border-strong">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.contentsTitle')}</div>
          <div className="text-sm font-semibold break-words">{t(`inventoryExports.report.${type}.columns`)}</div>
        </div>
        {depots.length > 1 && <div className="text-xs font-semibold text-text-dim">{t('inventoryExports.depotColumnNote')}</div>}
        {(def.financial || (def.supportsPrices && includePrices)) && (
          <div className="text-xs font-semibold text-text-dim">{t('inventoryExports.financialNotice')}</div>
        )}
      </div>
    </div>
  )
}
