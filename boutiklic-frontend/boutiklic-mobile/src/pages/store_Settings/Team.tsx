import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { TeamMemberResponse, TeamRole } from '../../lib/teamApi'
import SelectField from '../../components/SelectField'
import PhoneNumberField from '../../components/PhoneNumberField'
import { PHONE_COUNTRIES, countryIdFromPhone } from '@boutiklic/shared'
import { toE164Phone } from '../../lib/authApi'
import { useTenant } from '../../hooks/useTenant'

type InviteChannel = 'phone' | 'email'

/** L'invitation par téléphone (SMS) ne fonctionne pas encore : seul l'email est proposé pour l'instant. */
const PHONE_INVITE_ENABLED = false

interface TeamProps {
  onBack: () => void
  members: TeamMemberResponse[]
  isLoading: boolean
  error: string | null
  /** Inviter un membre est réservé au propriétaire, cf. TeamController.invite (hasRole('OWNER')). */
  isOwner: boolean
  onInvite: (identifier: { phone?: string; email?: string }, role: TeamRole) => Promise<void>
  onSelectMember: (member: TeamMemberResponse) => void
}

/** Quotas d'équipe côté client (cf. Tenant.maxTeamMembers/maxSupervisors côté backend) — affichage
 *  seulement, la vraie limite est imposée par l'API (TeamQuotaExceededException). */
const MAX_TEAM_MEMBERS: Record<'PETITE' | 'MOYENNE' | 'GRANDE', number> = { PETITE: 3, MOYENNE: 6, GRANDE: Infinity }
const MAX_SUPERVISORS: Record<'PETITE' | 'MOYENNE' | 'GRANDE', number> = { PETITE: 0, MOYENNE: 1, GRANDE: 3 }

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

export default function Team({ onBack, members, isLoading, error, isOwner, onInvite, onSelectMember }: TeamProps) {
  const { t } = useTranslation()
  const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
    { value: 'SELLER', label: t('settings.role.seller') },
    { value: 'APPRENTICE', label: t('settings.role.apprentice') },
    { value: 'SUPERVISOR', label: t('settings.role.supervisor') },
  ]
  const { tenant } = useTenant()
  const [showAddMember, setShowAddMember] = useState(false)
  const [channel, setChannel] = useState<InviteChannel>(PHONE_INVITE_ENABLED ? 'phone' : 'email')
  const [countryId, setCountryId] = useState('GN')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('SELLER')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Préselectionne l'indicatif de la boutique (dérivé de son téléphone déjà enregistré) dès qu'il
  // est connu, plutôt que de rester figé sur la Guinée — cf. countryIdFromPhone.
  useEffect(() => {
    if (tenant.phone) setCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'

  const nonOwnerCount = members.filter((m) => m.role !== 'OWNER').length
  const supervisorCount = members.filter((m) => m.role === 'SUPERVISOR').length
  const maxMembers = MAX_TEAM_MEMBERS[tenant.shopSize]
  const maxSupervisors = MAX_SUPERVISORS[tenant.shopSize]
  const quotaReached = nonOwnerCount >= maxMembers
  const availableRoleOptions = ROLE_OPTIONS.filter((opt) => opt.value !== 'SUPERVISOR' || supervisorCount < maxSupervisors)

  const isValid =
    !quotaReached &&
    availableRoleOptions.some((opt) => opt.value === role) &&
    (channel === 'phone' ? phone.trim().length >= 8 : /\S+@\S+\.\S+/.test(email.trim()))

  const handleInvite = async () => {
    setInviting(true)
    setInviteError(null)
    try {
      await onInvite(channel === 'phone' ? { phone: toE164Phone(phone, dialCode) } : { email: email.trim() }, role)
      setPhone('')
      setEmail('')
      setRole('SELLER')
      setShowAddMember(false)
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : t('common.errorGeneric'))
    } finally {
      setInviting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4">
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <View>
            <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.teamTitle')}</Text>
            {Number.isFinite(maxMembers) && (
              <Text className="text-[11px] font-bold text-text-dim">
                {t('settings.membersCount', { count: nonOwnerCount, max: maxMembers })}
              </Text>
            )}
          </View>
        </View>
        {isOwner && (
          <Pressable
            onPress={() => setShowAddMember(true)}
            disabled={quotaReached}
            className="w-10 h-10 rounded-xl bg-primary items-center justify-center disabled:opacity-40"
          >
            <Plus size={18} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {quotaReached && (
          <View className="p-3 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] font-semibold text-[#33465E]">
              {t('settings.quotaReached', { max: maxMembers })}
            </Text>
          </View>
        )}
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : (
          members.map((member) => {
            const roleInfo = getRoleLabel(member.role, t)
            return (
              <Pressable key={member.userId} onPress={() => onSelectMember(member)} className="w-full bg-bg-card rounded-2xl border border-border p-3.5 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-bg-elevated items-center justify-center">
                  <Text className="text-lg">👤</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold" numberOfLines={1}>
                      {member.displayName || member.phone || member.email}
                    </Text>
                    <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: roleInfo.bg }}>
                      <Text className="text-[9px] font-extrabold" style={{ color: roleInfo.color }}>
                        {roleInfo.label}
                      </Text>
                    </View>
                    {member.status !== 'ACTIVE' && (
                      <View className="px-1.5 py-0.5 rounded-full bg-alerte-bg">
                        <Text className="text-[9px] font-extrabold text-alerte-text">{t('settings.invitedBadge')}</Text>
                      </View>
                    )}
                  </View>
                  {member.displayName && <Text className="text-xs text-text-dim font-semibold">{member.phone || member.email}</Text>}
                </View>
                <ChevronRight size={16} color="#A2A9B8" />
              </Pressable>
            )
          })
        )}

        {isOwner && showAddMember && (
          <View className="mt-2 bg-bg-card rounded-2xl border border-border p-4 gap-3.5">
            <Text className="text-sm font-extrabold">{t('settings.addMember')}</Text>

            <View className="flex-row gap-2">
              <Pressable onPress={() => PHONE_INVITE_ENABLED && setChannel('phone')} disabled={!PHONE_INVITE_ENABLED} className={`flex-1 py-2.5 rounded-xl items-center ${!PHONE_INVITE_ENABLED ? 'opacity-50' : ''} ${channel === 'phone' ? 'bg-info-bg border-2 border-primary' : 'bg-bg-elevated border border-border'}`}>
                <Text className={`text-xs font-extrabold ${channel === 'phone' ? 'text-primary' : 'text-text-muted'}`}>{t('settings.phoneChannel')}{!PHONE_INVITE_ENABLED ? ` · ${t('settings.phoneInviteSoon')}` : ''}</Text>
              </Pressable>
              <Pressable onPress={() => setChannel('email')} className={`flex-1 py-2.5 rounded-xl items-center ${channel === 'email' ? 'bg-info-bg border-2 border-primary' : 'bg-bg-elevated border border-border'}`}>
                <Text className={`text-xs font-extrabold ${channel === 'email' ? 'text-primary' : 'text-text-muted'}`}>{t('settings.emailChannel')}</Text>
              </Pressable>
            </View>

            {channel === 'phone' ? (
              <PhoneNumberField countryId={countryId} setCountryId={setCountryId} phone={phone} setPhone={setPhone} />
            ) : (
              <View className="gap-2">
                <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.emailLabel')}</Text>
                <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder={t('settings.emailPlaceholder')} className="h-[52px] rounded-xl border border-border-strong bg-bg px-4 font-bold" />
              </View>
            )}

            <View className="gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.roleLabel')}</Text>
              <SelectField value={role} onChange={(v) => setRole(v as TeamRole)} options={availableRoleOptions.map((o) => ({ label: o.label, value: o.value }))} />
              {availableRoleOptions.length < ROLE_OPTIONS.length && (
                <Text className="text-[11px] font-semibold text-text-dim">
                  {t('settings.supervisorUnavailable', { count: supervisorCount, max: maxSupervisors })}
                </Text>
              )}
            </View>

            {inviteError && <Text className="text-[13px] font-semibold text-danger">{inviteError}</Text>}
            <Pressable onPress={handleInvite} disabled={inviting || !isValid} className="w-full bg-primary py-3 rounded-xl items-center active:scale-95 disabled:opacity-50">
              <Text className="text-papier font-extrabold">{inviting ? t('settings.sendingInvite') : t('settings.sendInvite')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
