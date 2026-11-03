import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { userApi } from '../lib/userApi'
import { toErrorMessage } from '../lib/apiClient'

interface LockScreenProps {
  onUnlock: () => void
}

/** Écran de verrouillage auto plein écran (Sécurité, A4) — déclenché par useIdleTimer, monté dans
 * App.tsx pour couvrir toute la app authentifiée quel que soit l'onglet actif. */
export default function LockScreen({ onUnlock }: LockScreenProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnlock = async () => {
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await userApi.verifyPassword(password)
      setPassword('')
      onUnlock()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-encre flex flex-col items-center justify-center px-6 gap-5">
      <div className="w-16 h-16 rounded-full bg-papier/10 flex items-center justify-center text-3xl">🔒</div>
      <div className="text-papier text-lg font-extrabold">{t('components.lockScreen.title')}</div>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          placeholder={t('components.lockScreen.passwordPlaceholder')}
          className="h-12 px-4 rounded-xl bg-papier/10 border border-papier/20 text-papier placeholder:text-papier/50 font-semibold outline-none focus:border-papier/50"
        />
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={handleUnlock}
          disabled={!password || submitting}
          className="h-12 rounded-xl bg-primary text-papier font-extrabold disabled:opacity-40"
        >
          {submitting ? '...' : t('components.lockScreen.unlock')}
        </button>
      </div>
    </div>
  )
}
