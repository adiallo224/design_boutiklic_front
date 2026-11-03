import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import { stockCountsApi, type StockCountImportResponse } from '../../../lib/stockCountsApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import Modal from '../../components/Modal'

interface StockCountImportModalProps {
  open: boolean
  countId: string
  onClose: () => void
  /** Appelé après un import appliqué : l'écran recharge le comptage. */
  onApplied: (importedCount: number) => void
}

/** Import d'une feuille de comptage remplie : le fichier est d'abord lu en aperçu (rien n'est enregistré), puis appliqué sur demande.
 *  Une ligne en erreur bloque l'application, sauf si l'utilisateur choisit d'ignorer les lignes en erreur. */
export default function StockCountImportModal({ open, countId, onClose, onApplied }: StockCountImportModalProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<StockCountImportResponse | null>(null)
  const [skipInvalid, setSkipInvalid] = useState(false)
  const [reading, setReading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setSkipInvalid(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const handleFile = async (selected: File | null) => {
    setPreview(null)
    setError(null)
    setSkipInvalid(false)
    setFile(selected)
    if (!selected) return
    setReading(true)
    try {
      setPreview(await stockCountsApi.importSheet(countId, selected, { apply: false }))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setReading(false)
    }
  }

  const hasErrors = (preview?.errors.length ?? 0) > 0
  const canApply = !!file && !!preview && preview.readyCount > 0 && (!hasErrors || skipInvalid)

  const handleApply = async () => {
    if (!file || !canApply || applying) return
    setApplying(true)
    setError(null)
    try {
      const result = await stockCountsApi.importSheet(countId, file, { apply: true, skipInvalid })
      if (!result.applied) {
        setPreview(result)
        return
      }
      reset()
      onApplied(result.readyCount)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setApplying(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      width={640}
      title={t('stockCounts.import.title')}
      subtitle={t('stockCounts.import.subtitle')}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={close}>{t('stockCounts.dismiss')}</Button>
          <Button onClick={handleApply} loading={applying} disabled={!canApply}>{t('stockCounts.import.apply')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong bg-bg-elevated px-3 sm:px-4 py-4 cursor-pointer text-sm font-bold text-text">
          <FileUp size={18} className="flex-none" />
          <span className="flex-1 min-w-0 break-all">{file ? file.name : t('stockCounts.import.choose')}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {reading && <div className="text-sm font-semibold text-text-dim">{t('stockCounts.import.reading')}</div>}
        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        {preview && (
          <div className="flex flex-col gap-3">
            {preview.readyCount > 0 ? (
              <div className="text-sm font-extrabold text-succes-text">{t('stockCounts.import.ready', { count: preview.readyCount })}</div>
            ) : (
              <div className="text-sm font-semibold text-text-muted">{t('stockCounts.import.nothingToImport')}</div>
            )}
            {preview.emptyCount > 0 && (
              <div className="text-sm font-semibold text-text-muted">{t('stockCounts.import.empty', { count: preview.emptyCount })}</div>
            )}

            {hasErrors && (
              <div className="flex flex-col gap-2">
                <div className="text-sm font-extrabold text-danger">{t('stockCounts.import.errors', { count: preview.errors.length })}</div>
                <ul className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border text-[13px]">
                  {preview.errors.map((err) => (
                    <li key={`${err.row}-${err.code}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                      <span className="font-extrabold text-text-muted flex-none">{t('stockCounts.import.errorRow', { row: err.row })}</span>
                      <span className="font-semibold flex-1 basis-[160px] min-w-0 break-words">{t(`stockCounts.importError.${err.code}`, { defaultValue: err.message })}</span>
                      {err.reference && <span className="text-text-dim break-all max-w-full">{err.reference}</span>}
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2.5 text-sm font-semibold text-text">
                  <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} className="w-4 h-4 mt-0.5 flex-none accent-primary" />
                  {t('stockCounts.import.skipInvalid')}
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
