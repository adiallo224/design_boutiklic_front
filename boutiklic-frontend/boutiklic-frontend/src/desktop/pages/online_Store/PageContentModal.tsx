import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toErrorMessage } from '../../../lib/apiClient'
import { storefrontsApi, type PageCode } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import Modal from '../../components/Modal'

/** Limite du serveur (caractères). */
export const PAGE_CONTENT_MAX = 20000

interface Props {
  open: boolean
  siteId: string
  /** Page optionnelle à rédiger (FAQ, blog, CGV, confidentialité, retours). */
  code: PageCode
  /** Texte actuel ('' = pas encore rédigée). */
  initial: string
  onClose: () => void
  /** Appelé avec le texte enregistré ('' si la page a été vidée). */
  onSaved: (code: PageCode, body: string) => void
}

/** Rédaction d'une page optionnelle : du texte simple, les paragraphes sont séparés par une ligne vide. Une page vide n'apparaît pas dans le menu de la vitrine. */
export default function PageContentModal({ open, siteId, code, initial, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBody(initial)
    setError(null)
  }, [open, initial, code])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await storefrontsApi.savePageContent(siteId, code, body)
      onSaved(code, body.trim())
      onClose()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const tooLong = body.length > PAGE_CONTENT_MAX
  const unchanged = body.trim() === initial.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={720}
      title={t('onlineStore.appearance.content.title', { page: t(`onlineStore.appearance.pages.names.${code}`) })}
      subtitle={t('onlineStore.appearance.content.hint')}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('onlineStore.create.cancel')}</Button>
          <Button onClick={save} loading={saving} disabled={unchanged || tooLong}>{t('onlineStore.detail.save')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="page-content-body" className="sr-only">{t('onlineStore.appearance.content.label')}</label>
        <textarea
          id="page-content-body"
          value={body}
          rows={14}
          onChange={(e) => setBody(e.target.value)}
          className="rounded-xl border border-border-strong bg-bg px-3.5 py-2.5 font-medium text-text outline-none focus:border-primary resize-y"
        />
        <div className="flex items-center justify-between gap-3 text-xs font-semibold">
          <span className="text-text-dim">{t('onlineStore.appearance.content.emptyHint')}</span>
          <span className={tooLong ? 'text-danger' : 'text-text-dim'}>{body.length} / {PAGE_CONTENT_MAX}</span>
        </div>
        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
