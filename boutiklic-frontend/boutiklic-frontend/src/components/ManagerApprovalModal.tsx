import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ManagerApprovalModalProps {
  open: boolean
  loading: boolean
  error: string | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

/** Modale de relais gérant (écran B3) — pas de primitive modal dans le repo, overlay mirror de
 * PeriodDropdown (backdrop fixed + panneau). Demande le mot de passe du propriétaire quand un
 * rabais dépasse le seuil autorisé pour le vendeur qui l'accorde. */
export default function ManagerApprovalModal({ open, loading, error, onSubmit, onCancel }: ManagerApprovalModalProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCancel} />
      <div className="fixed inset-x-5 top-1/3 z-50 rounded-[20px] bg-bg-card border border-border-strong shadow-lg p-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-alerte-bg flex items-center justify-center flex-none">
            <Lock size={18} className="text-alerte-text" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[15px] font-extrabold">{t('components.managerApproval.title')}</div>
            <div className="text-[13px] font-semibold text-text-dim">{t('components.managerApproval.subtitle')}</div>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && password && !loading && onSubmit(password)}
          placeholder={t('components.managerApproval.passwordPlaceholder')}
          className="h-12 px-4 rounded-xl border border-border-strong bg-bg text-[15px] font-semibold outline-none focus:border-primary"
        />
        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl border border-border-strong bg-bg text-[15px] font-bold"
          >
            {t('components.cancel')}
          </button>
          <button
            onClick={() => password && onSubmit(password)}
            disabled={!password || loading}
            className="flex-1 h-12 rounded-xl bg-primary text-papier text-[15px] font-extrabold disabled:opacity-40"
          >
            {loading ? '...' : t('components.confirm')}
          </button>
        </div>
      </div>
    </>
  )
}
