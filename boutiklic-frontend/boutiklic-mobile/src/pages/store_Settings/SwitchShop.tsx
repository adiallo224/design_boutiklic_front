import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { Archive, ArchiveRestore, LogOut, Plus, Info } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { Tenant } from '../../hooks/useTenant'

interface SwitchShopProps {
  tenants: Tenant[]
  tenantsError?: string | null
  actionError?: string | null
  activeTenantId: string
  /** Créer une nouvelle boutique est réservé au propriétaire, cf. AuthController.attachBoutique. */
  isOwner: boolean
  onSwitch: (tenantId: string) => void
  onArchive?: (tenantId: string) => void
  onUnarchive?: (tenantId: string) => void
  onContinue?: () => void
  onCreateNew?: () => void
  onLogout: () => void
  ownerName: string
}

const TILE_COLORS = ['#0E2038', '#D84E2A', '#E69D3B', '#0E7A52', '#7B5EA7']

/** Écran racine de l'onglet "Plus" (F0) — pas de flèche retour ici : le retour se fait
 *  depuis l'écran Réglages (F3), qui revient vers celui-ci. */
export default function SwitchShop({
  tenants,
  tenantsError,
  actionError,
  activeTenantId,
  isOwner,
  onSwitch,
  onArchive,
  onUnarchive,
  onContinue,
  onCreateNew,
  onLogout,
  ownerName,
}: SwitchShopProps) {
  const { t } = useTranslation()
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew()
      return
    }
    // Filet de sécurité si ce composant est monté sans onCreateNew câblé.
    setShowComingSoon(true)
  }

  const activeCount = tenants.filter((t) => t.membershipActive).length

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4">
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.myShops')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">
            {t('settings.shopsCountOwner', { count: tenants.length, name: ownerName })}
          </Text>
        </View>
        {isOwner && (
          <Pressable onPress={handleCreateNew} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
            <Plus size={18} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {tenantsError && (
          <View className="p-3.5 rounded-2xl bg-[#F7E3E1] border border-danger/30">
            <Text className="text-[13px] font-semibold text-danger">{t('settings.loadShopsError', { error: tenantsError })}</Text>
          </View>
        )}
        {actionError && (
          <View className="p-3.5 rounded-2xl bg-[#F7E3E1] border border-danger/30">
            <Text className="text-[13px] font-semibold text-danger">{actionError}</Text>
          </View>
        )}
        {tenants.map((tenantRow, i) => {
          const isActive = tenantRow.id === activeTenantId
          const isArchived = !tenantRow.membershipActive
          const isConfirmingArchive = confirmArchiveId === tenantRow.id
          const clickable = isActive && onContinue && !isConfirmingArchive

          const content = (
            <>
              <View className="w-[52px] h-[52px] rounded-2xl items-center justify-center" style={{ backgroundColor: TILE_COLORS[i % TILE_COLORS.length] }}>
                <View className="w-[19px] h-[19px] rounded" style={{ borderWidth: 3, borderColor: '#FFFDFA', borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[17px] font-extrabold" numberOfLines={1}>
                    {tenantRow.name}
                  </Text>
                  {isArchived && (
                    <View className="px-1.5 py-0.5 rounded-full bg-bg-elevated">
                      <Text className="text-[9px] font-extrabold text-text-dim">{t('settings.archivedBadge')}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-[13px] font-semibold text-text-dim" numberOfLines={1}>
                  {tenantRow.city}
                  {tenantRow.businessSector ? ` · ${tenantRow.businessSector}` : ''}
                </Text>
              </View>

              {isConfirmingArchive ? (
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => {
                      onArchive?.(tenantRow.id)
                      setConfirmArchiveId(null)
                    }}
                    className="px-3 py-2 rounded-[11px] bg-danger active:scale-95"
                  >
                    <Text className="text-papier text-[13px] font-extrabold">{t('settings.confirm')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setConfirmArchiveId(null)} className="px-3 py-2 rounded-[11px] bg-bg-elevated active:scale-95">
                    <Text className="text-encre text-[13px] font-extrabold">{t('settings.cancel')}</Text>
                  </Pressable>
                </View>
              ) : isActive ? (
                <View className="px-3 py-1.5 rounded-[9px] bg-succes-bg">
                  <Text className="text-success text-xs font-extrabold">{t('settings.activeBadge')}</Text>
                </View>
              ) : isArchived ? (
                <Pressable onPress={() => onUnarchive?.(tenantRow.id)} className="px-3.5 py-2 rounded-[11px] bg-bg-elevated active:scale-95 flex-row items-center gap-1.5">
                  <ArchiveRestore size={14} color="#111418" />
                  <Text className="text-encre text-[13px] font-extrabold">{t('settings.reactivate')}</Text>
                </Pressable>
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <Pressable onPress={() => onSwitch(tenantRow.id)} className="px-3.5 py-2 rounded-[11px] bg-bg-elevated active:scale-95">
                    <Text className="text-encre text-[13px] font-extrabold">{t('settings.switchButton')}</Text>
                  </Pressable>
                  {onArchive && activeCount > 1 && (
                    <Pressable onPress={() => setConfirmArchiveId(tenantRow.id)} className="w-9 h-9 rounded-[11px] bg-bg-elevated items-center justify-center active:scale-95">
                      <Archive size={15} color="#A2A9B8" />
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )

          const rowClass = `w-full flex-row items-center gap-3.5 p-4 rounded-[18px] bg-bg-card ${isActive ? 'border-2 border-success' : 'border border-border'} ${isArchived ? 'opacity-60' : ''}`

          return clickable ? (
            <Pressable key={tenantRow.id} onPress={onContinue} className={`${rowClass} active:scale-[0.98]`}>
              {content}
            </Pressable>
          ) : (
            <View key={tenantRow.id} className={rowClass}>
              {content}
            </View>
          )
        })}

        {isOwner && <Text className="text-[13px] text-text-dim -mt-1">{t('settings.createShopHint')}</Text>}
        {showComingSoon && <Text className="text-[13px] font-semibold text-text-dim text-center -mt-1.5">{t('settings.comingSoon')}</Text>}

        <View className="mt-1.5 flex-row gap-2.5 p-4 rounded-2xl bg-info-bg border border-info-border">
          <Info size={18} color="#0E2038" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] leading-relaxed text-[#33465E]">
            {t('settings.archiveInfo')}
          </Text>
        </View>

        <Pressable onPress={onLogout} className="mt-1.5 w-full bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5">
          <View className="w-10 h-10 rounded-xl bg-[#F7E3E1] items-center justify-center">
            <LogOut size={19} color="#C6362F" />
          </View>
          <Text className="flex-1 text-base font-bold text-danger">{t('settings.logoutAction')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
