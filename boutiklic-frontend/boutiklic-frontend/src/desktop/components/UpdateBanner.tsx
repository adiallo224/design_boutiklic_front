import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppUpdate } from '../hooks/useAppUpdate'

/** Bandeau « nouvelle version disponible » en haut de l'app desktop, avec les nouveautés dépliables. Invisible
 *  hors Tauri ou tant qu'aucune mise à jour n'est proposée. Une mise à jour obligatoire (version minimale
 *  supportée dépassée) bloque l'app derrière un écran qui n'offre que l'installation. */
export default function UpdateBanner() {
  const { t } = useTranslation()
  const { update, mandatory, status, install, dismiss } = useAppUpdate()
  const [showNotes, setShowNotes] = useState(false)
  if (!update) return null

  const installing = status === 'installing'
  const notes = update.body?.trim()
  const installButton = (tone: string) => (
    <button
      type="button"
      onClick={() => void install()}
      disabled={installing}
      className={`rounded px-3 py-1 font-medium disabled:opacity-60 ${tone}`}
    >
      {installing ? t('appUpdate.installing') : t('appUpdate.install')}
    </button>
  )

  if (mandatory) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
        <div className="w-full max-w-md rounded-lg bg-papier p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-primary">{t('appUpdate.mandatoryTitle')}</h2>
          <p className="mt-2 text-sm">{t('appUpdate.mandatoryBody', { version: update.version })}</p>
          {notes && <p className="mt-3 whitespace-pre-line text-sm opacity-80">{notes}</p>}
          {status === 'error' && <p className="mt-3 text-sm text-red-600">{t('appUpdate.failed')}</p>}
          <div className="mt-5 flex justify-end">
            {installButton('bg-primary text-papier')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-primary text-papier px-4 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          {status === 'error' ? t('appUpdate.failed') : t('appUpdate.available', { version: update.version })}
          {notes && (
            <button type="button" onClick={() => setShowNotes((v) => !v)} className="ml-3 underline opacity-90">
              {t('appUpdate.whatsNew')}
            </button>
          )}
        </span>
        <span className="flex items-center gap-2">
          {installButton('bg-papier text-primary')}
          {!installing && (
            <button type="button" onClick={dismiss} className="px-2 py-1 opacity-80 hover:opacity-100">
              {t('appUpdate.later')}
            </button>
          )}
        </span>
      </div>
      {showNotes && notes && <p className="mt-2 whitespace-pre-line opacity-90">{notes}</p>}
    </div>
  )
}
