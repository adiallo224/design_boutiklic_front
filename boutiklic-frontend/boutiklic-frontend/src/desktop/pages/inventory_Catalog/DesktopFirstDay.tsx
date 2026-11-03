import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Truck, Upload, Check } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { productsApi } from '../../../lib/productsApi'
import Button from '../../components/Button'
import { useTopBar } from '../../hooks/useTopBar'

interface DesktopFirstDayProps {
  isOwner: boolean
  onAddFirstProduct: () => void
  onRecordArrival: () => void
  /** Import terminé (au moins un article créé) : la boutique quitte l'état "stock vide". */
  onImported: () => void
}

interface ImportRow {
  name: string
  purchasePrice: number
  salePrice: number
  quantity: number
  alertThreshold: number
  barcode?: string
}

/** Découpe une ligne CSV en respectant les guillemets (Excel encadre les champs contenant le
 *  séparateur) — pas besoin d'une lib entière pour un format aussi simple. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const delimiter = lines[0].includes(';') ? ';' : ','
  const header = splitCsvLine(lines[0], delimiter).map((h) => h.toLowerCase())
  const idx = {
    name: header.findIndex((h) => /nom|name/.test(h)),
    purchase: header.findIndex((h) => /achat|purchase/.test(h)),
    sale: header.findIndex((h) => /vente|sale/.test(h)),
    quantity: header.findIndex((h) => /stock|quant/.test(h)),
    threshold: header.findIndex((h) => /seuil|threshold|alert/.test(h)),
    barcode: header.findIndex((h) => /barre|barcode/.test(h)),
  }
  if (idx.name === -1 || idx.sale === -1) return []

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter)
    const num = (i: number) => (i >= 0 ? Number((cells[i] ?? '0').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0 : 0)
    return {
      name: (cells[idx.name] ?? '').trim(),
      purchasePrice: num(idx.purchase),
      salePrice: num(idx.sale),
      quantity: idx.quantity >= 0 ? Math.round(num(idx.quantity)) : 0,
      alertThreshold: idx.threshold >= 0 ? Math.round(num(idx.threshold)) : 5,
      barcode: idx.barcode >= 0 ? (cells[idx.barcode] || undefined) : undefined,
    }
  }).filter((r) => r.name.length > 0)
}

/** W38 — stock vide, trois façons de démarrer. Saisir à la main / enregistrer un arrivage
 *  réutilisent des écrans existants (ProductSheetModalDesktop, W17) ; l'import CSV est propre au
 *  bureau (clavier physique + fichier local, cf. spec "Notes par écran"). Le mobile n'a qu'un
 *  bouton "Importer une liste existante" qui ne fait rien (`onImport` est un no-op dans
 *  StockFlow.tsx) — ici l'import est réellement câblé : lecture locale du fichier + un appel
 *  productsApi.create par ligne (pas d'endpoint d'import en masse côté backend). */
export default function DesktopFirstDay({ isOwner, onAddFirstProduct, onRecordArrival, onImported }: DesktopFirstDayProps) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useTopBar({ title: t('inventoryCatalog.myStockTitle') }, [t])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      setError(t('inventoryCatalog.importCsvEmpty'))
      return
    }
    setImporting(true)
    setProgress({ done: 0, total: rows.length, failed: 0 })
    let failed = 0
    for (const row of rows) {
      try {
        await productsApi.create({
          name: row.name,
          barcode: row.barcode,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          currency: tenant.currency,
          initialQuantity: row.quantity,
          alertThreshold: row.alertThreshold,
        })
      } catch {
        failed += 1
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total, failed } : p))
    }
    setImporting(false)
    if (failed < rows.length) onImported()
  }

  return (
    <div className="p-8 flex flex-col items-center gap-8 max-w-[720px] mx-auto">
      <div className="w-full flex flex-col gap-2 text-center">
        <div className="font-display text-2xl font-extrabold">{t('inventoryCatalog.myStockTitle')}</div>
        <div className="text-sm font-semibold text-text-muted">{t('inventoryCatalog.noArticlesYet')}</div>
      </div>

      <div
        className="w-full h-[160px] rounded-[24px] bg-[#F4EDE0] border border-border-strong flex items-center justify-center relative overflow-hidden"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg,rgba(216,78,42,.08) 0 2px,transparent 2px 18px)' }}
      >
        <div className="flex gap-3 items-end">
          <div className="w-14 h-[52px] rounded-xl border-2 border-dashed border-[#C9B79E] bg-bg" />
          <div className="w-14 h-[74px] rounded-xl border-2 border-dashed border-[#C9B79E] bg-bg" />
          <div className="w-14 h-[60px] rounded-xl border-2 border-dashed border-[#C9B79E] bg-bg" />
        </div>
        <div className="absolute left-0 right-0 bottom-0 h-3" style={{ background: 'repeating-linear-gradient(90deg,#0E2038 0 14px,#E69D3B 14px 28px,#D84E2A 28px 42px)' }} />
      </div>

      <div className="flex flex-col gap-2 items-center text-center">
        <div className="font-display text-xl font-extrabold">{t('inventoryCatalog.onboardingHeadline1')} {t('inventoryCatalog.onboardingHeadline2')}</div>
        <div className="text-sm text-text-muted max-w-[480px]">{t('inventoryCatalog.onboardingBody')}</div>
      </div>

      {isOwner ? (
        <div className="w-full grid grid-cols-3 gap-3.5">
          <button type="button" onClick={onAddFirstProduct} className="p-5 rounded-2xl border-2 border-primary bg-info-bg flex flex-col items-center gap-2.5 text-center">
            <div className="w-11 h-11 rounded-xl bg-primary text-papier flex items-center justify-center"><Plus size={20} /></div>
            <div className="text-sm font-extrabold">{t('inventoryCatalog.addFirstProductCta')}</div>
          </button>
          <button type="button" onClick={onRecordArrival} className="p-5 rounded-2xl border border-border-strong bg-bg-card flex flex-col items-center gap-2.5 text-center hover:border-primary">
            <div className="w-11 h-11 rounded-xl bg-bg-elevated flex items-center justify-center"><Truck size={20} /></div>
            <div className="text-sm font-extrabold">{t('inventoryCatalog.newArrivalTitle')}</div>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="p-5 rounded-2xl border border-border-strong bg-bg-card flex flex-col items-center gap-2.5 text-center hover:border-primary disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-xl bg-bg-elevated flex items-center justify-center"><Upload size={20} /></div>
            <div className="text-sm font-extrabold">{t('inventoryCatalog.importExistingListCta')}</div>
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="text-[13px] font-semibold text-text-dim text-center py-2">{t('inventoryCatalog.ownerOnlyNotice')}</div>
      )}

      {progress && (
        <div className="w-full p-4 rounded-xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-bold">
            <span>{importing ? t('inventoryCatalog.importCsvProgress', { done: progress.done, total: progress.total }) : t('inventoryCatalog.importCsvDone', { count: progress.total - progress.failed })}</span>
            {!importing && <Check size={16} className="text-success" />}
          </div>
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {progress.failed > 0 && !importing && (
            <div className="text-xs font-semibold text-danger">{t('inventoryCatalog.importCsvFailed', { count: progress.failed })}</div>
          )}
        </div>
      )}

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="text-xs text-text-dim text-center max-w-[480px]">{t('inventoryCatalog.importCsvHint')}</div>

      <Button variant="ghost" onClick={onImported} className="text-text-muted">
        {t('inventoryCatalog.skipForNow')}
      </Button>
    </div>
  )
}
