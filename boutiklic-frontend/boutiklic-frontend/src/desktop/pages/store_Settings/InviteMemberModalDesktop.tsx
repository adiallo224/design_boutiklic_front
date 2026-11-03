import { useEffect, useState } from 'react'
import { Check, Mail, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { teamApi, type TeamRole, type PermissionCatalogEntry } from '../../../lib/teamApi'
import { toErrorMessage } from '../../../lib/apiClient'
import type { Tenant } from '../../../hooks/useTenant'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface InviteMemberModalDesktopProps {
  open: boolean
  shopSize: Tenant['shopSize']
  nonOwnerCount: number
  supervisorCount: number
  onClose: () => void
  onInvite: (identifier: { phone?: string; email?: string }, role: TeamRole) => Promise<void>
}

/** L'invitation par téléphone (SMS) ne fonctionne pas encore : seul l'email est proposé pour l'instant.
 *  Repasser à `true` pour la rouvrir — le reste du formulaire la gère déjà. */
const PHONE_INVITE_ENABLED = false

const MAX_TEAM_MEMBERS: Record<Tenant['shopSize'], number> = { PETITE: 3, MOYENNE: 6, GRANDE: Infinity }
const MAX_SUPERVISORS: Record<Tenant['shopSize'], number> = { PETITE: 0, MOYENNE: 1, GRANDE: 3 }

function permissionLabels(t: (key: string) => string): Record<string, string> {
  return {
    SALE_CANCEL: t('settings.permission.saleCancel'),
    DISCOUNT_OVERRIDE: t('settings.permission.discountOverride'),
    STOCK_ADJUST: t('settings.permission.stockAdjust'),
    STOCK_COUNT_ENTER: t('settings.permission.stockCountEnter'),
    DEBT_MANAGE: t('settings.permission.debtManage'),
    REPORT_FINANCIAL_VIEW: t('settings.permission.reportFinancialView'),
  }
}

/** W23 — modale 820px : canal (SMS/email), identifiant, puis rôle en cartes comparatives listant
 *  les permissions par défaut de chaque rôle (teamApi.getPermissionsCatalog().defaultRoles) — pas
 *  de champ "nom" : InviteTeamMemberRequest n'en a pas, le nom est saisi par l'invité lui-même à
 *  l'activation (W12). */
export default function InviteMemberModalDesktop({ open, shopSize, nonOwnerCount, supervisorCount, onClose, onInvite }: InviteMemberModalDesktopProps) {
  const { t } = useTranslation()
  const [channel, setChannel] = useState<'phone' | 'email'>(PHONE_INVITE_ENABLED ? 'phone' : 'email')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('SELLER')
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChannel(PHONE_INVITE_ENABLED ? 'phone' : 'email')
    setPhone('')
    setEmail('')
    setRole('SELLER')
    setError(null)
    teamApi.getPermissionsCatalog().then(setCatalog).catch(() => undefined)
  }, [open])

  const maxMembers = MAX_TEAM_MEMBERS[shopSize]
  const maxSupervisors = MAX_SUPERVISORS[shopSize]
  const quotaReached = nonOwnerCount >= maxMembers
  const allRoleOptions: { value: TeamRole; label: string }[] = [
    { value: 'SELLER', label: t('settings.role.seller') },
    { value: 'APPRENTICE', label: t('settings.role.apprentice') },
    { value: 'SUPERVISOR', label: t('settings.role.supervisor') },
  ]
  const roleOptions = allRoleOptions.filter((opt) => opt.value !== 'SUPERVISOR' || supervisorCount < maxSupervisors)

  const isValid = !quotaReached && roleOptions.some((o) => o.value === role) && (channel === 'phone' ? phone.trim().length >= 8 : /\S+@\S+\.\S+/.test(email.trim()))

  const handleSubmit = async () => {
    if (!isValid || inviting) return
    setInviting(true)
    setError(null)
    try {
      await onInvite(channel === 'phone' ? { phone } : { email: email.trim() }, role)
      onClose()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setInviting(false)
    }
  }

  const labels = permissionLabels(t)

  return (
    <Modal open={open} onClose={onClose} width={820} title={t('settings.addMember')}>
      <div className="flex flex-col gap-4">
        {quotaReached && (
          <div className="p-3 rounded-xl bg-info-bg border border-info-border text-[13px] font-semibold text-[#33465E]">
            {t('settings.quotaReached', { max: maxMembers })}
          </div>
        )}

        <div className="p-1 rounded-2xl bg-bg-elevated flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setChannel('phone')}
            disabled={!PHONE_INVITE_ENABLED}
            title={PHONE_INVITE_ENABLED ? undefined : t('settings.phoneInviteSoon')}
            className={`flex-1 min-w-[140px] min-h-10 py-1 px-2 rounded-lg flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${channel === 'phone' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
          >
            <Smartphone size={16} /> {t('settings.phoneChannel')}
            {!PHONE_INVITE_ENABLED && <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-bg-elevated text-text-dim">{t('settings.phoneInviteSoon')}</span>}
          </button>
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={`flex-1 min-w-[140px] min-h-10 py-1 px-2 rounded-lg flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm transition-all ${channel === 'email' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
          >
            <Mail size={16} /> {t('settings.emailChannel')}
          </button>
        </div>

        {!PHONE_INVITE_ENABLED && <p className="text-[12px] font-semibold text-text-dim -mt-2">{t('settings.phoneInviteUnavailableHint')}</p>}

        {channel === 'phone' ? (
          <Input label={t('settings.phoneNumberLabel')} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="amount" placeholder="620 12 34 56" />
        ) : (
          <Input label={t('settings.emailLabel')} value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('settings.emailPlaceholder')} />
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.roleLabel')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roleOptions.map((opt) => {
              const active = role === opt.value
              const granted = catalog.filter((c) => c.defaultRoles.includes(opt.value))
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`min-w-0 p-3.5 rounded-xl text-left flex flex-col gap-2 ${active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
                >
                  <span className={`text-sm font-extrabold ${active ? 'text-primary' : ''}`}>{opt.label}</span>
                  <ul className="flex flex-col gap-1">
                    {granted.length === 0 && <li className="text-[11px] text-text-dim">{t('settings.permissionsDescription')}</li>}
                    {granted.map((g) => (
                      <li key={g.name} className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
                        <Check size={11} className="text-success flex-none" />
                        {labels[g.name] ?? g.name}
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
          </div>
          {roleOptions.length < 3 && (
            <div className="text-[11px] font-semibold text-text-dim">{t('settings.supervisorUnavailable', { count: supervisorCount, max: maxSupervisors })}</div>
          )}
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <Button onClick={handleSubmit} disabled={!isValid || inviting} loading={inviting} className="min-h-12">
          {t('settings.sendInvite')}
        </Button>
      </div>
    </Modal>
  )
}
