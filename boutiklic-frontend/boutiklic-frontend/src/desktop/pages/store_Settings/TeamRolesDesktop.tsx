import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Lock, Mail, Plus } from 'lucide-react'
import type { Tenant } from '../../../hooks/useTenant'
import { teamApi, type TeamMemberResponse, type TeamRole, type PermissionCatalogEntry } from '../../../lib/teamApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import InviteMemberModalDesktop from './InviteMemberModalDesktop'

const ROLES: TeamRole[] = ['SUPERVISOR', 'SELLER', 'APPRENTICE']

export function getRoleLabel(role: string, t: (key: string) => string) {
  switch (role) {
    case 'OWNER': return { label: t('settings.role.owner'), color: 'bg-info-bg text-primary' }
    case 'SELLER': return { label: t('settings.role.seller'), color: 'bg-succes-bg text-succes-text' }
    case 'SUPERVISOR': return { label: t('settings.role.supervisor'), color: 'bg-alerte-bg text-alerte-text' }
    default: return { label: t('settings.role.apprentice'), color: 'bg-bg-elevated text-text-muted' }
  }
}

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

/** W22 — tableau équipe + matrice des permissions par rôle (colonne gauche), invitations en
 *  attente (colonne droite) — extrait de DesktopSettings.tsx (onglet "Équipe") pour porter le
 *  numéro d'écran de son propre fichier, comme le reste de desktop/pages. Reste monté comme
 *  onglet de W9 (pas de route dédiée) : c'est ce que demande le spec pour cet écran ("onglets
 *  internes"), extraire le composant ne veut pas dire changer la navigation. Non repris :
 *  "dernière activité"/"journal d'accès" (aucun champ API), Relancer/Révoquer une invitation
 *  (aucun endpoint) — écarts déjà documentés côté DesktopSettings.tsx. */
export default function TeamRolesDesktop({ isOwner, tenant }: { isOwner: boolean; tenant: Tenant }) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<TeamMemberResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selected, setSelected] = useState<TeamMemberResponse | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    teamApi.getTeam().then(setMembers).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])
  useEffect(() => {
    teamApi.getPermissionsCatalog().then(setCatalog).catch(() => undefined)
  }, [])

  const nonOwnerCount = members.filter((m) => m.role !== 'OWNER').length
  const supervisorCount = members.filter((m) => m.role === 'SUPERVISOR').length
  const activeCount = members.filter((m) => m.status === 'ACTIVE').length
  const pending = members.filter((m) => m.status !== 'ACTIVE')
  const labels = permissionLabels(t)

  const handleInvite = async (identifier: { phone?: string; email?: string }, role: TeamRole) => {
    const payload = identifier.phone ? { phone: identifier.phone, role } : { email: identifier.email, role }
    await teamApi.invite(payload, tenant.name)
    await load()
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-success" />
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text">{t('settings.teamTitle')}</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">{t('settings.teamSubtitle')}</p>
        </div>
        {isOwner && (
          <Button variant="accent" onClick={() => setInviteOpen(true)} className="inline-flex items-center justify-center gap-2">
            <Plus size={16} />
            {t('settings.addMember')}
          </Button>
        )}
      </section>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border-hairline flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="font-bold text-text text-base">{t('settings.currentMembersTitle')}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg-elevated text-text-muted">
                {t('settings.activeMembersCount', { count: activeCount })}
              </span>
            </div>
            <span className="text-xs text-text-dim font-medium hidden sm:inline">{t('settings.permissionsSynced')}</span>
          </div>
          {isLoading ? (
            <div className="px-6 py-10 text-center text-sm font-semibold text-text-dim">{t('common.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-bold tracking-wider uppercase text-text-muted bg-bg-elevated/60 border-b border-border-hairline">
                    <th className="py-3.5 px-6">{t('settings.member')}</th>
                    <th className="py-3.5 px-6">{t('settings.roleLabel')}</th>
                    <th className="py-3.5 px-6 text-center">{t('settings.accessStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline text-sm">
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 px-6 text-center text-text-dim">{t('common.loading')}</td>
                    </tr>
                  )}
                  {members.map((m) => {
                    const initials = (m.displayName || m.phone || m.email || '?').slice(0, 2).toUpperCase()
                    const roleInfo = getRoleLabel(m.role, t)
                    return (
                      <tr key={m.userId} onClick={() => setSelected(m)} className="hover:bg-bg-elevated/40 transition-colors cursor-pointer">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${roleInfo.color}`}>{initials}</div>
                            <div className="min-w-0">
                              <p className="font-semibold text-text truncate">{m.displayName || m.phone || m.email}</p>
                              <p className="text-xs text-text-muted truncate mt-0.5">{m.phone || m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${roleInfo.color}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {m.status === 'ACTIVE' ? (
                            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-succes-bg text-succes-text text-xs font-medium">
                              <Check size={14} className="stroke-[2.5]" />
                              {t('settings.memberActiveStatus')}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-alerte-bg text-alerte-text text-xs font-semibold">{t('settings.invitedBadge')}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border-hairline">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('settings.pendingInvitesTitle')}</h2>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-elevated text-[11px] font-bold text-text-muted">{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-alerte-bg border border-alerte-text/20 text-alerte-text flex items-center justify-center mb-3">
                  <Mail size={26} />
                </div>
                <p className="font-semibold text-text text-sm">{t('settings.noPendingInvitesTitle')}</p>
                <p className="text-xs text-text-muted mt-1 max-w-[210px]">{t('settings.noPendingInvitesText')}</p>
              </div>
            ) : (
              <div className="py-4 flex flex-col gap-2.5">
                {pending.map((m) => (
                  <div key={m.userId} className="p-3 rounded-xl bg-bg-elevated/50 border border-border-hairline">
                    <div className="font-semibold text-sm text-text">{m.phone || m.email}</div>
                    <div className="text-xs text-text-muted mt-0.5">{getRoleLabel(m.role, t).label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isOwner && (
            <div className="pt-4 border-t border-border-hairline text-center">
              <button type="button" onClick={() => setInviteOpen(true)} className="text-xs font-semibold text-primary hover:text-primary-dark inline-flex items-center gap-1 transition-colors">
                {t('settings.sendNewInvite')}
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <MemberPermissionsPanel key={selected.userId} member={selected} isOwner={isOwner} shopSize={tenant.shopSize} onChanged={load} onClose={() => setSelected(null)} />
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-text">{t('settings.permissionsGridTitle')}</h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">{t('settings.permissionsGridSubtitle')}</p>
        </div>
        {catalog.length > 0 && (
          <div className="bg-bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-bg-elevated/60 border-b border-border">
                    <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-text-muted w-1/2">{t('settings.permissionsTitle')}</th>
                    {ROLES.map((r) => (
                      <th key={r} className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-text text-center w-1/6">
                        <span className={`inline-block px-2.5 py-1 rounded-lg font-semibold ${getRoleLabel(r, t).color}`}>{getRoleLabel(r, t).label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline text-sm">
                  {catalog.map((entry, i) => (
                    <tr key={entry.name} className={i % 2 === 1 ? 'bg-bg-elevated/20' : undefined}>
                      <td className="py-4 px-6 font-medium text-text">{labels[entry.name] ?? entry.name}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="py-4 px-6 text-center">
                          {entry.defaultRoles.includes(r) ? (
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-succes-bg text-succes-text">
                              <Check size={15} className="stroke-[2.8]" />
                            </div>
                          ) : (
                            <span className="text-text-dim font-bold text-lg select-none">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <InviteMemberModalDesktop
        open={inviteOpen}
        shopSize={tenant.shopSize}
        nonOwnerCount={nonOwnerCount}
        supervisorCount={supervisorCount}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  )
}

function MemberPermissionsPanel({
  member, isOwner, shopSize, onChanged, onClose,
}: {
  member: TeamMemberResponse
  isOwner: boolean
  shopSize: Tenant['shopSize']
  onChanged: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const canManage = isOwner && shopSize === 'GRANDE' && member.role !== 'OWNER'
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [extra, setExtra] = useState(member.extraPermissions)
  const [pending, setPending] = useState<string | null>(null)
  const labels = permissionLabels(t)

  useEffect(() => {
    if (!canManage) return
    teamApi.getPermissionsCatalog().then(setCatalog).catch(() => undefined)
  }, [canManage])

  const toggle = async (permission: string, granted: boolean) => {
    setPending(permission)
    try {
      if (granted) {
        await teamApi.revokePermission(member.userId, permission)
        setExtra((prev) => prev.filter((p) => p !== permission))
      } else {
        await teamApi.grantPermission(member.userId, permission)
        setExtra((prev) => [...prev, permission])
      }
      onChanged()
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="p-5 rounded-2xl bg-bg-card border-2 border-primary shadow-sm flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-text">{member.displayName || member.phone || member.email}</span>
        <button type="button" onClick={onClose} className="text-text-dim text-xs font-bold">✕</button>
      </div>
      {!canManage ? (
        <div className="text-xs text-text-dim">{t('settings.permissionsDescription')}</div>
      ) : (
        catalog.map((entry) => {
          const isDefault = entry.defaultRoles.includes(member.role)
          const granted = isDefault || extra.includes(entry.name)
          return (
            <button key={entry.name} type="button" disabled={isDefault || pending === entry.name} onClick={() => toggle(entry.name, granted)} className="flex items-center gap-2 text-left disabled:opacity-60">
              <span className={`w-5 h-5 rounded flex items-center justify-center flex-none ${granted ? 'bg-primary' : 'border border-border-strong'}`}>
                {granted && <Check size={12} className="text-papier" />}
              </span>
              <span className="flex-1 text-xs font-semibold">{labels[entry.name] ?? entry.name}</span>
              {isDefault && <Lock size={12} className="text-text-dim" />}
            </button>
          )
        })
      )}
    </div>
  )
}
