import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, LogOut, Plus } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth, notifyAuthChanged } from '../../../hooks/useAuth'
import { authApi } from '../../../lib/authApi'
import { getDeviceId } from '../../../lib/device'
import { clearSession } from '../../../lib/session'
import { useTopBar } from '../../hooks/useTopBar'
import CreateShop from '../../../pages/store_Settings/CreateShop'

const TILE_COLORS = ['bg-primary', 'bg-terracotta', 'bg-warning', 'bg-success', 'bg-violet']

/** W6 — Mes boutiques. Cartes (boutique active en bordure émeraude, "Basculer" pour les autres,
 *  carte pointillée "Créer une boutique") + repli de la sidebar ouvre cet écran (cf. spec). Les
 *  chiffres "CA du mois / références / équipe" du spec ne sont pas exposés par useTenant() (pas
 *  d'appel cross-tenant bon marché disponible) — on affiche ce qui est réellement disponible :
 *  ville, secteur, devise, statut. */
export default function DesktopShops() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tenants, tenantsError, activeTenantId, switchTenant, archiveTenant, unarchiveTenant } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useTopBar({ title: t('settings.myShops') }, [t])

  const activeCount = tenants.filter((tr) => tr.membershipActive).length

  const handleSwitch = async (id: string) => {
    setActionError(null)
    await switchTenant(id)
  }

  const handleLogout = async () => {
    try {
      await authApi.revokeDevice(getDeviceId())
    } catch {
      // best-effort, cf. SettingsFlow.handleLogout
    }
    clearSession()
    notifyAuthChanged()
    navigate('/login')
  }

  if (creating) {
    return (
      <CreateShop
        ownerPhone={null}
        onDone={() => {
          setCreating(false)
          navigate('/dashboard')
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {tenantsError && (
        <div className="text-[13px] font-semibold text-danger p-3.5 rounded-xl bg-[#F7E3E1] border border-danger/30">
          {t('settings.loadShopsError', { error: tenantsError })}
        </div>
      )}
      {actionError && (
        <div className="text-[13px] font-semibold text-danger p-3.5 rounded-xl bg-[#F7E3E1] border border-danger/30">{actionError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tenants.map((tenantRow, i) => {
          const isActive = tenantRow.id === activeTenantId
          const isArchived = !tenantRow.membershipActive
          const isConfirmingArchive = confirmArchiveId === tenantRow.id
          return (
            <div
              key={tenantRow.id}
              onClick={isActive ? () => navigate('/reglages') : undefined}
              className={`flex flex-col gap-3 p-4 sm:p-5 min-w-0 rounded-2xl bg-bg-card ${
                isActive ? 'border-2 border-success cursor-pointer hover:bg-bg-elevated/50 transition-colors' : 'border border-border'
              } ${isArchived ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                {tenantRow.logoUrl ? (
                  <div className="w-12 h-12 rounded-2xl flex-none overflow-hidden bg-bg-elevated">
                    <img src={tenantRow.logoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-none ${TILE_COLORS[i % TILE_COLORS.length]}`}
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(230,157,59,.3) 0 3px,transparent 3px 11px)' }}
                  >
                    <div className="w-4 h-4 rounded border-[3px] border-papier" style={{ borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
                  </div>
                )}
                {isActive && <span className="px-2.5 py-1 rounded-full bg-succes-bg text-success text-xs font-extrabold">{t('settings.activeBadge')}</span>}
                {isArchived && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-bg-elevated text-text-dim">{t('settings.archivedBadge')}</span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="text-base font-extrabold break-words">{tenantRow.name}</div>
                <div className="text-[13px] font-semibold text-text-dim break-words">
                  {tenantRow.city}
                  {tenantRow.businessSector ? ` · ${tenantRow.businessSector}` : ''} · {tenantRow.currency}
                </div>
              </div>

              <div className="mt-auto pt-2">
                {isConfirmingArchive ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        archiveTenant(tenantRow.id)
                        setConfirmArchiveId(null)
                      }}
                      className="flex-1 min-w-[90px] min-h-9 py-1 px-2 rounded-lg bg-danger text-papier text-[13px] font-extrabold"
                    >
                      {t('settings.confirm')}
                    </button>
                    <button type="button" onClick={() => setConfirmArchiveId(null)} className="flex-1 min-w-[90px] min-h-9 py-1 px-2 rounded-lg bg-bg-elevated text-encre text-[13px] font-extrabold">
                      {t('settings.cancel')}
                    </button>
                  </div>
                ) : isArchived ? (
                  <button
                    type="button"
                    onClick={() => unarchiveTenant(tenantRow.id)}
                    className="w-full min-h-9 py-1 rounded-lg bg-bg-elevated text-encre text-[13px] font-extrabold flex items-center justify-center gap-1.5"
                  >
                    <ArchiveRestore size={14} />
                    {t('settings.reactivate')}
                  </button>
                ) : !isActive ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitch(tenantRow.id)}
                      className="flex-1 min-w-[90px] min-h-9 py-1 px-2 rounded-lg bg-bg-elevated text-encre text-[13px] font-extrabold"
                    >
                      {t('settings.switchButton')}
                    </button>
                    {activeCount > 1 && (
                      <button
                        type="button"
                        onClick={() => setConfirmArchiveId(tenantRow.id)}
                        className="w-9 h-9 rounded-lg bg-bg-elevated text-text-dim flex items-center justify-center"
                        aria-label={t('settings.archiveAria')}
                      >
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}

        {isOwner && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex flex-col items-center justify-center gap-2 p-4 sm:p-5 text-center rounded-2xl border-2 border-dashed border-border-strong text-text-muted hover:text-primary hover:border-primary min-h-[168px]"
          >
            <Plus size={22} />
            <span className="text-sm font-bold">{t('settings.createShopHint')}</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="self-start mt-2 px-5 min-h-11 py-2 text-left rounded-xl border border-border bg-bg-card flex items-center gap-2.5 text-danger font-bold text-sm"
      >
        <LogOut size={16} />
        {t('settings.logoutAction')}
      </button>
    </div>
  )
}
