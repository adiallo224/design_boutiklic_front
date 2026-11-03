import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'

interface ManagerApprovalModalDesktopProps {
  open: boolean
  loading: boolean
  error: string | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

/** Version bureau de ManagerApprovalModal.tsx — même contrat (aucune logique métier dupliquée,
 *  cf. CashierFlow.handleManagerApprovalSubmit), juste portée sur la primitive Modal. */
export default function ManagerApprovalModalDesktop({ open, loading, error, onSubmit, onCancel }: ManagerApprovalModalDesktopProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onCancel}
      width={420}
      title={t('components.managerApproval.title')}
      subtitle={t('components.managerApproval.subtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t('components.cancel')}
          </Button>
          <Button onClick={() => password && onSubmit(password)} disabled={!password || loading} loading={loading}>
            {t('components.confirm')}
          </Button>
        </>
      }
    >
      <Input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && password && !loading && onSubmit(password)}
        placeholder={t('components.managerApproval.passwordPlaceholder')}
      />
      {error && <div className="text-[13px] font-semibold text-danger mt-2">{error}</div>}
    </Modal>
  )
}
