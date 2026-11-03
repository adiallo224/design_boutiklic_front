import { useCallback, useEffect, useState } from 'react'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTenant } from '../../hooks/useTenant'
import { useAuth, notifyAuthChanged } from '../../hooks/useAuth'
import { clearSession, getAccessToken, getActiveTenantId } from '../../lib/session'
import { getDeviceId } from '../../lib/device'
import { teamApi, type TeamMemberResponse, type TeamRole } from '../../lib/teamApi'
import { userApi } from '../../lib/userApi'
import { authApi, toE164Phone } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useOutbox } from '../../hooks/useOutbox'
import { getLanguage, setLanguage, type Language as LanguageValue } from '../../lib/language'
import i18n from '../../i18n'
import { getLastExportAt, recordExportNow } from '../../lib/dataExport'
import { openWhatsApp } from '../../lib/whatsapp'
import { SUPPORT_WHATSAPP_NUMBER } from '../../lib/support'
import Security from '../account_Setup/Security'
import Settings from './Settings'
import ShopProfile from './ShopProfile'
import SwitchShop from './SwitchShop'
import CreateShop from './CreateShop'
import Team from './Team'
import MemberProfile from './MemberProfile'
import Depots from './Depots'
import Language from './Language'
import SyncPending from './SyncPending'
import SyncSuccess from './SyncSuccess'
import DiscountThresholdSettings from './DiscountThresholdSettings'
import SellingPricePrecisionSettings from './SellingPricePrecisionSettings'
import CostMethodSettings from './CostMethodSettings'
import TaxSettings from './TaxSettings'
import PrintSettings from './PrintSettings'

type View = 'home' | 'profile' | 'switchShop' | 'createShop' | 'team' | 'memberProfile' | 'depots' | 'security' | 'language' | 'syncPending' | 'syncSuccess' | 'discountThreshold' | 'sellingPricePrecision' | 'costMethod' | 'tax' | 'printers'

const DEFAULT_LANGUAGE: LanguageValue = { code: 'fr', name: 'Français' }

/** notifyAuthChanged() après clearSession() déclenche la bascule automatique vers les routes non
 *  authentifiées (app/_layout.tsx, Stack.Protected) — pas besoin de router.push('/login') ici. */
export default function SettingsFlow() {
  const { tenant, tenants, tenantsError, activeTenantId, switchTenant, archiveTenant, unarchiveTenant, formatCurrency, error: tenantActionError, refetch: refetchTenant } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const [view, setView] = useState<View>('switchShop')
  const [notifStock, setNotifStock] = useState(true)
  const [language, setLanguageState] = useState<LanguageValue>(DEFAULT_LANGUAGE)
  const [exportingData, setExportingData] = useState(false)
  const [lastExportAt, setLastExportAt] = useState<string | null>(null)
  const { pendingCount: pendingOps } = useOutbox()
  const [members, setMembers] = useState<TeamMemberResponse[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<TeamMemberResponse | null>(null)

  useEffect(() => {
    getLanguage().then(setLanguageState)
    getLastExportAt().then(setLastExportAt)
  }, [])

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    setTeamError(null)
    try {
      setMembers(await teamApi.getTeam())
    } catch (e) {
      setTeamError(toErrorMessage(e))
    } finally {
      setTeamLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  useEffect(() => {
    // Best-effort : resynchronise la langue depuis le compte (autre appareil) — si hors-ligne,
    // on garde la valeur en cache local (cf. OfflineBanner, pattern outbox).
    userApi
      .getMe()
      .then(async (me) => {
        await setLanguage(me.language)
        i18n.changeLanguage(me.language)
        setLanguageState(await getLanguage())
      })
      .catch(() => {})
  }, [])

  const currentMember = members.find((m) => m.userId === user?.id)
  const ownerName = currentMember?.displayName || tenant.name

  const handleInvite = async (identifier: { phone?: string; email?: string }, role: TeamRole) => {
    const payload = identifier.phone ? { phone: toE164Phone(identifier.phone), role } : { email: identifier.email, role }
    await teamApi.invite(payload, tenant.name)
    await loadTeam()
  }

  /** Écrit l'export ZIP sur disque puis ouvre la feuille de partage OS — mirror du pattern déjà
   *  établi dans ExportReport.tsx (File.downloadFileAsync + expo-sharing). */
  const handleExportData = async () => {
    if (exportingData) return
    setExportingData(true)
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
      const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
      const destination = new File(Paths.cache, `boutiklic-export-${Date.now()}.zip`)
      const file = await File.downloadFileAsync(`${apiBase}/reports/data-export`, destination, {
        headers: { Authorization: `Bearer ${token ?? ''}`, 'X-Tenant-ID': tenantId ?? '' },
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri)
      }
      await recordExportNow()
      setLastExportAt(await getLastExportAt())
    } catch {
      // Best-effort : pas de blocage de l'écran Réglages si l'export échoue, cf. autres flux best-effort du fichier.
    } finally {
      setExportingData(false)
    }
  }

  const handleLogout = async () => {
    try {
      await authApi.revokeDevice(await getDeviceId())
    } catch {
      // Déconnexion locale malgré tout : on ne bloque pas l'utilisateur si le serveur est injoignable.
    }
    await clearSession()
    notifyAuthChanged()
  }

  if (view === 'profile') {
    return (
      <ShopProfile
        onBack={() => setView('home')}
        tenant={tenant}
        formatCurrency={formatCurrency}
        tenantsCount={tenants.length}
        isOwner={isOwner}
        onOpenSwitchShop={() => setView('switchShop')}
        onSaved={refetchTenant}
      />
    )
  }
  if (view === 'switchShop') {
    return (
      <SwitchShop
        tenants={tenants}
        tenantsError={tenantsError}
        activeTenantId={activeTenantId}
        isOwner={isOwner}
        onSwitch={(id) => {
          switchTenant(id)
          setView('home')
        }}
        onArchive={archiveTenant}
        onUnarchive={unarchiveTenant}
        actionError={tenantActionError}
        onContinue={() => setView('home')}
        onCreateNew={() => setView('createShop')}
        onLogout={handleLogout}
        ownerName={ownerName}
      />
    )
  }
  if (view === 'createShop') {
    return <CreateShop ownerPhone={tenant.phone} onDone={() => setView('home')} onCancel={() => setView('switchShop')} />
  }
  if (view === 'team') {
    return (
      <Team
        onBack={() => setView('home')}
        members={members}
        isLoading={teamLoading}
        error={teamError}
        isOwner={isOwner}
        onInvite={handleInvite}
        onSelectMember={(member) => {
          setSelectedMember(member)
          setView('memberProfile')
        }}
      />
    )
  }
  if (view === 'memberProfile' && selectedMember) {
    return (
      <MemberProfile
        member={selectedMember}
        onBack={() => setView('team')}
        isOwner={isOwner}
        shopSize={tenant.shopSize}
        onPermissionsChanged={loadTeam}
      />
    )
  }
  if (view === 'depots') return <Depots onBack={() => setView('home')} isOwner={isOwner} multiDepotEnabled={tenant.multiDepotEnabled} />
  if (view === 'security') return <Security onBack={() => setView('home')} />
  if (view === 'printers') return <PrintSettings onBack={() => setView('home')} />
  if (view === 'sellingPricePrecision') {
    return <SellingPricePrecisionSettings onBack={() => setView('home')} tenant={tenant} isOwner={isOwner} onSaved={refetchTenant} />
  }
  if (view === 'tax') {
    return <TaxSettings onBack={() => setView('home')} tenant={tenant} isOwner={isOwner} onSaved={refetchTenant} />
  }
  if (view === 'costMethod') {
    return <CostMethodSettings onBack={() => setView('home')} tenant={tenant} isOwner={isOwner} onSaved={refetchTenant} />
  }
  if (view === 'discountThreshold') {
    return <DiscountThresholdSettings onBack={() => setView('home')} tenant={tenant} isOwner={isOwner} onSaved={refetchTenant} />
  }
  if (view === 'language') {
    return (
      <Language
        selectedCode={language.code}
        onBack={() => setView('home')}
        onSelect={async (code) => {
          await setLanguage(code)
          i18n.changeLanguage(code)
          setLanguageState(await getLanguage())
          setView('home')
          // Best-effort : le choix reste appliqué localement même hors-ligne (cf. OfflineBanner).
          userApi.updateLanguage(code).catch(() => {})
        }}
      />
    )
  }
  if (view === 'syncPending') return <SyncPending onBack={() => setView('home')} onSynced={() => setView('syncSuccess')} />
  if (view === 'syncSuccess') return <SyncSuccess onBack={() => setView('home')} />

  return (
    <Settings
      tenant={tenant}
      tenantsCount={tenants.length}
      teamCount={members.length}
      pendingOps={pendingOps}
      notifStock={notifStock}
      language={language.name}
      onBack={() => setView('switchShop')}
      onToggleNotifStock={() => setNotifStock((s) => !s)}
      onOpenProfile={() => setView('profile')}
      onOpenTeam={() => setView('team')}
      onOpenDepots={() => setView('depots')}
      onOpenSecurity={() => setView('security')}
      onOpenSync={() => setView(pendingOps > 0 ? 'syncPending' : 'syncSuccess')}
      onOpenLanguage={() => setView('language')}
      onOpenDiscountThreshold={() => setView('discountThreshold')}
      onOpenSellingPricePrecision={() => setView('sellingPricePrecision')}
      onOpenCostMethod={() => setView('costMethod')}
      onOpenTax={() => setView('tax')}
      onOpenPrinters={() => setView('printers')}
      exportingData={exportingData}
      lastExportAt={lastExportAt}
      onExportData={handleExportData}
      onOpenWhatsAppSupport={() => openWhatsApp(SUPPORT_WHATSAPP_NUMBER, "Bonjour, j'ai besoin d'aide avec BOUTIKLIC.")}
    />
  )
}
