import { useEffect, useState } from 'react'
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native'
import { ChevronLeft, Phone, Mail, Lock, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { teamApi, type TeamMemberResponse, type PermissionCatalogEntry } from '../../lib/teamApi'
import { toErrorMessage } from '../../lib/apiClient'
import type { Tenant } from '../../hooks/useTenant'

interface MemberProfileProps {
  member: TeamMemberResponse
  onBack: () => void
  isOwner: boolean
  shopSize: Tenant['shopSize']
  /** Recharge la liste de l'équipe côté parent après un octroi/retrait de permission. */
  onPermissionsChanged: () => void
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

function getRoleLabel(role: string, t: (key: string) => string) {
  switch (role) {
    case 'OWNER':
      return { label: t('settings.role.owner'), bg: '#EAF0F7', color: '#0E2038' }
    case 'SELLER':
      return { label: t('settings.role.seller'), bg: '#E6F1EC', color: '#1F5C43' }
    case 'SUPERVISOR':
      return { label: t('settings.role.supervisor'), bg: '#FEF4E6', color: '#8A6712' }
    default:
      return { label: t('settings.role.apprentice'), bg: '#F4EDE0', color: '#676E7E' }
  }
}

function initials(name: string | null | undefined): string {
  if (!name || !name.trim()) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function MemberProfile({ member, onBack, isOwner, shopSize, onPermissionsChanged }: MemberProfileProps) {
  const { t } = useTranslation()
  const roleInfo = getRoleLabel(member.role, t)
  const isPending = member.status !== 'ACTIVE'
  // Invité par téléphone ou par email (cf. Team.tsx "Ajouter un membre") — displayName reste vide
  // tant que le compte n'est pas activé (cf. User.invite côté backend).
  const displayLabel = member.displayName || member.phone || member.email || t('settings.member')
  const contact = member.phone || member.email

  // Personnalisation des permissions réservée aux boutiques GRANDE (cf. étude "Fonctionnalités par
  // taille de boutique") — le OWNER a déjà tout par défaut, l'éditer n'aurait aucun effet.
  const canManagePermissions = isOwner && shopSize === 'GRANDE' && member.role !== 'OWNER'

  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [extraPermissions, setExtraPermissions] = useState<string[]>(member.extraPermissions)
  const [pendingPermission, setPendingPermission] = useState<string | null>(null)
  const [permError, setPermError] = useState<string | null>(null)

  useEffect(() => {
    setExtraPermissions(member.extraPermissions)
  }, [member.extraPermissions])

  useEffect(() => {
    if (!canManagePermissions) return
    setCatalogLoading(true)
    setCatalogError(null)
    teamApi
      .getPermissionsCatalog()
      .then(setCatalog)
      .catch((e) => setCatalogError(toErrorMessage(e)))
      .finally(() => setCatalogLoading(false))
  }, [canManagePermissions])

  const togglePermission = async (permission: string, currentlyGranted: boolean) => {
    setPendingPermission(permission)
    setPermError(null)
    try {
      if (currentlyGranted) {
        await teamApi.revokePermission(member.userId, permission)
        setExtraPermissions((prev) => prev.filter((p) => p !== permission))
      } else {
        await teamApi.grantPermission(member.userId, permission)
        setExtraPermissions((prev) => [...prev, permission])
      }
      onPermissionsChanged()
    } catch (e) {
      setPermError(toErrorMessage(e))
    } finally {
      setPendingPermission(null)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.member')}</Text>
      </View>

      <View className="flex-1 px-5 pb-8 gap-4">
        <View className="bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5">
          <View className="w-14 h-14 rounded-full bg-primary items-center justify-center">
            <Text className="text-papier text-lg font-extrabold">{initials(member.displayName)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold" numberOfLines={1}>
              {displayLabel}
            </Text>
            {member.displayName && contact && <Text className="text-text-muted text-xs font-semibold">{contact}</Text>}
            <View className="flex-row items-center gap-1.5 mt-1.5">
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: roleInfo.bg }}>
                <Text className="text-[10px] font-extrabold" style={{ color: roleInfo.color }}>
                  {roleInfo.label}
                </Text>
              </View>
              {isPending && (
                <View className="px-2 py-0.5 rounded-full bg-alerte-bg">
                  <Text className="text-[10px] font-extrabold text-alerte-text">{t('settings.invitedBadge')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {isPending && (
          <View className="p-4 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.memberNotActivatedNotice')}</Text>
          </View>
        )}

        {member.phone ? (
          <Pressable onPress={() => Linking.openURL(`tel:${member.phone}`)} className="h-[52px] rounded-xl border border-border-strong bg-bg-card items-center justify-center flex-row gap-2">
            <Phone size={18} color="#111418" />
            <Text className="text-base font-bold">{t('settings.call')}</Text>
          </Pressable>
        ) : member.email ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${member.email}`)} className="h-[52px] rounded-xl border border-border-strong bg-bg-card items-center justify-center flex-row gap-2">
            <Mail size={18} color="#111418" />
            <Text className="text-base font-bold">{t('settings.sendEmail')}</Text>
          </Pressable>
        ) : null}

        {canManagePermissions && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-3">
            <View>
              <Text className="text-sm font-extrabold">{t('settings.permissionsTitle')}</Text>
              <Text className="text-xs text-text-muted font-semibold mt-0.5">
                {t('settings.permissionsDescription')}
              </Text>
            </View>

            {catalogLoading && (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" />
                <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
              </View>
            )}
            {catalogError && <Text className="text-[13px] font-semibold text-danger">{catalogError}</Text>}
            {permError && <Text className="text-[13px] font-semibold text-danger">{permError}</Text>}

            {!catalogLoading &&
              !catalogError &&
              catalog.map((entry) => {
                const isDefaultForRole = entry.defaultRoles.includes(member.role)
                const granted = isDefaultForRole || extraPermissions.includes(entry.name)
                const isPendingToggle = pendingPermission === entry.name
                return (
                  <Pressable
                    key={entry.name}
                    disabled={isDefaultForRole || isPendingToggle}
                    onPress={() => togglePermission(entry.name, granted)}
                    className="flex-row items-center gap-3 py-1"
                    style={{ opacity: isDefaultForRole || isPendingToggle ? 0.6 : 1 }}
                  >
                    <View
                      className={`w-6 h-6 rounded-lg border items-center justify-center ${
                        granted ? 'bg-primary border-primary' : 'border-border-strong bg-bg'
                      }`}
                    >
                      {granted && <Check size={15} color="#FFFDFA" strokeWidth={3} />}
                    </View>
                    <Text className="flex-1 text-[13px] font-bold">{permissionLabels(t)[entry.name] ?? entry.name}</Text>
                    {isDefaultForRole && <Lock size={14} color="#A2A9B8" />}
                  </Pressable>
                )
              })}
          </View>
        )}
      </View>
    </View>
  )
}
