import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Image, ScrollView } from 'react-native'
import { ChevronLeft, ChevronRight, Pencil, Camera, Shield, Store, LogOut } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { PHONE_COUNTRIES, splitE164Phone } from '@boutiklic/shared'
import { userApi, type CurrentUserResponse, type UpdatePersonalProfileRequest } from '../../lib/userApi'
import { authApi, toE164Phone } from '../../lib/authApi'
import PhoneNumberField from '../../components/PhoneNumberField'
import { fileApi } from '../../lib/fileApi'
import { getDeviceId } from '../../lib/device'
import { clearSession, notifyAuthChanged } from '../../lib/session'
import { toErrorMessage } from '../../lib/apiClient'
import { useTenant } from '../../hooks/useTenant'
import SelectField from '../../components/SelectField'
import DateField from '../../components/DateField'
import Security from '../account_Setup/Security'
import SwitchShop from './SwitchShop'

type Subview = 'security' | 'switchShop' | null

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

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/** notifyAuthChanged() après clearSession() déclenche la bascule automatique vers les routes non
 *  authentifiées (app/_layout.tsx, Stack.Protected) — pas besoin de router.push('/login') ici. */
export default function MyProfile({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const { tenant, tenants, tenantsError, activeTenantId, switchTenant, archiveTenant, unarchiveTenant, error: tenantActionError } = useTenant()
  const [subview, setSubview] = useState<Subview>(null)
  const [user, setUser] = useState<CurrentUserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [loggingOut, setLoggingOut] = useState(false)

  const [profileDraft, setProfileDraft] = useState<UpdatePersonalProfileRequest>({
    birthDate: null, gender: null, secondaryContact: null, addressLine: null, city: null, countryId: null, jobTitle: null,
  })
  // Contact secondaire : téléphone (indicatif + numéro) si le compte a été créé par email, email sinon
  const [secCountryId, setSecCountryId] = useState('GN')
  // Code de confirmation (envoyé au contact principal) exigé quand le contact secondaire change
  const [savedSecondary, setSavedSecondary] = useState<string | null>(null)
  const [secCode, setSecCode] = useState('')
  const [secCodeSent, setSecCodeSent] = useState(false)
  const [sendingSecCode, setSendingSecCode] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    userApi
      .getMe()
      .then((me) => {
        setUser(me)
        setNameDraft(me.displayName)
        setSavedSecondary(me.secondaryContact)
        setSecCountryId(splitE164Phone(me.secondaryContact?.startsWith('+') ? me.secondaryContact : me.phone).countryId)
        setProfileDraft({
          birthDate: me.birthDate, gender: me.gender, secondaryContact: me.secondaryContact,
          addressLine: me.addressLine, city: me.city, countryId: me.countryId, jobTitle: me.jobTitle,
        })
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  const secondaryChanged = !!profileDraft.secondaryContact
    && profileDraft.secondaryContact.trim().toLowerCase() !== (savedSecondary ?? '').toLowerCase()

  const handleSendSecCode = async () => {
    setSendingSecCode(true)
    setProfileError(null)
    try {
      await userApi.requestSecondaryContactOtp()
      setSecCodeSent(true)
    } catch (e) {
      setProfileError(toErrorMessage(e))
    } finally {
      setSendingSecCode(false)
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileError(null)
    setProfileSaved(false)
    try {
      await userApi.updatePersonalProfile({ ...profileDraft, secondaryContactCode: secondaryChanged ? secCode : null })
      setSavedSecondary(profileDraft.secondaryContact)
      setSecCode('')
      setSecCodeSent(false)
      setProfileSaved(true)
    } catch (e) {
      setProfileError(toErrorMessage(e))
    } finally {
      setSavingProfile(false)
    }
  }

  const genderOptions = [
    { value: 'male', label: t('settings.gender.male') },
    { value: 'female', label: t('settings.gender.female') },
    { value: 'other', label: t('settings.gender.other') },
  ]
  const countryOptions = PHONE_COUNTRIES.map((c) => ({ value: c.id, label: c.name }))

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !user) return
    setSavingName(true)
    setNameError(null)
    try {
      await userApi.updateDisplayName(trimmed)
      setUser({ ...user, displayName: trimmed })
      setEditingName(false)
    } catch (e) {
      setNameError(toErrorMessage(e))
    } finally {
      setSavingName(false)
    }
  }

  /** Même séquence que SettingsFlow.handleLogout (révocation appareil best-effort + purge session locale). */
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authApi.revokeDevice(await getDeviceId())
    } catch {
      // Déconnexion locale malgré tout : on ne bloque pas l'utilisateur si le serveur est injoignable.
    }
    await clearSession()
    notifyAuthChanged()
  }

  const handleAvatarChange = async () => {
    if (!user) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
    if (result.canceled) return
    const asset = result.assets[0]
    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      const { url } = await fileApi.upload({ uri: asset.uri, name: asset.fileName ?? 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' })
      await userApi.updateAvatar(url)
      setUser({ ...user, avatarUrl: url })
    } catch (err) {
      setAvatarError(toErrorMessage(err))
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (subview === 'security') {
    return <Security onBack={() => setSubview(null)} />
  }

  if (subview === 'switchShop') {
    return (
      <SwitchShop
        tenants={tenants}
        tenantsError={tenantsError}
        actionError={tenantActionError}
        activeTenantId={activeTenantId}
        isOwner={user?.role === 'OWNER'}
        onSwitch={(id) => {
          switchTenant(id)
          setSubview(null)
        }}
        onArchive={archiveTenant}
        onUnarchive={unarchiveTenant}
        onLogout={handleLogout}
        ownerName={user?.displayName ?? tenant.name}
      />
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.myProfileTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : user ? (
          <>
            <View className="bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5">
              <View className="relative">
                <View className="w-14 h-14 rounded-full bg-primary items-center justify-center overflow-hidden">
                  {user.avatarUrl ? <Image source={{ uri: user.avatarUrl }} className="w-full h-full" /> : <Text className="text-papier text-lg font-extrabold">{initials(user.displayName)}</Text>}
                </View>
                <Pressable onPress={handleAvatarChange} disabled={uploadingAvatar} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-encre border-2 border-bg-card items-center justify-center">
                  <Camera size={12} color="#FFFDFA" />
                </Pressable>
              </View>
              <View className="flex-1">
                {editingName ? (
                  <View className="gap-2">
                    <TextInput value={nameDraft} onChangeText={setNameDraft} autoFocus className="h-10 rounded-lg border border-border-strong bg-bg px-3 font-bold" />
                    {nameError && <Text className="text-[12px] font-semibold text-danger">{nameError}</Text>}
                    <View className="flex-row gap-2">
                      <Pressable onPress={handleSaveName} disabled={savingName} className="px-3 py-1.5 rounded-lg bg-primary disabled:opacity-50">
                        <Text className="text-papier text-xs font-extrabold">{savingName ? '...' : t('settings.save')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingName(false)
                          setNameDraft(user.displayName)
                          setNameError(null)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-bg-elevated"
                      >
                        <Text className="text-text-muted text-xs font-bold">{t('settings.cancel')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-extrabold" numberOfLines={1}>
                        {user.displayName}
                      </Text>
                      <Pressable onPress={() => setEditingName(true)}>
                        <Pencil size={14} color="#A2A9B8" />
                      </Pressable>
                    </View>
                    <Text className="text-text-muted text-xs font-semibold">{user.phone ?? user.email}</Text>
                    <View className="self-start mt-1.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: getRoleLabel(user.role, t).bg }}>
                      <Text className="text-[10px] font-extrabold" style={{ color: getRoleLabel(user.role, t).color }}>
                        {getRoleLabel(user.role, t).label}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
            {avatarError && <Text className="-mt-2 text-[13px] font-semibold text-danger">{avatarError}</Text>}

            <View className="bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5">
              <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
                <Store size={19} color="#0E2038" />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-extrabold tracking-widest text-text-dim">{t('settings.currentShop')}</Text>
                <Text className="text-base font-bold" numberOfLines={1}>
                  {tenant.name}
                </Text>
              </View>
              {user.role === 'OWNER' && tenants.length > 1 && (
                <Pressable onPress={() => setSubview('switchShop')} className="px-3.5 py-2 rounded-[11px] bg-bg-elevated active:scale-95">
                  <Text className="text-encre text-[13px] font-extrabold">{t('settings.change')}</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => setSubview('security')} className="w-full bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5">
              <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
                <Shield size={19} color="#0E2038" />
              </View>
              <Text className="flex-1 text-base font-bold">{t('settings.security')}</Text>
              <ChevronRight size={18} color="#A2A9B8" />
            </Pressable>

            <View className="bg-bg-card rounded-2xl border border-border p-4 gap-4">
              <View>
                <Text className="text-base font-extrabold">{t('settings.personalInfoTitle')}</Text>
                <Text className="text-text-dim text-xs font-semibold mt-0.5">{t('settings.personalInfoHint')}</Text>
              </View>

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.birthDateLabel')}</Text>
                <DateField value={profileDraft.birthDate ?? ''} onChange={(v) => setProfileDraft({ ...profileDraft, birthDate: v || null })} className="h-11 rounded-xl border border-border-strong bg-bg px-3 justify-center" />
              </View>

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.genderLabel')}</Text>
                <SelectField value={profileDraft.gender ?? ''} onChange={(v) => setProfileDraft({ ...profileDraft, gender: v || null })} options={genderOptions} placeholder={t('settings.genderPlaceholder')} className="h-11" />
              </View>

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.secondaryContactLabel')}</Text>
                {user.email ? (
                  <PhoneNumberField
                    label={t('settings.secondaryPhoneLabel')}
                    countryId={secCountryId}
                    setCountryId={(id) => {
                      const { national } = splitE164Phone(profileDraft.secondaryContact)
                      setSecCountryId(id)
                      setProfileDraft({ ...profileDraft, secondaryContact: national ? toE164Phone(national, PHONE_COUNTRIES.find((c) => c.id === id)?.dialCode) : null })
                    }}
                    phone={(() => {
                      const dial = PHONE_COUNTRIES.find((c) => c.id === secCountryId)?.dialCode ?? ''
                      const v = profileDraft.secondaryContact
                      return v && v.startsWith(dial) ? v.slice(dial.length) : ''
                    })()}
                    setPhone={(digits) => setProfileDraft({ ...profileDraft, secondaryContact: digits ? toE164Phone(digits, PHONE_COUNTRIES.find((c) => c.id === secCountryId)?.dialCode) : null })}
                  />
                ) : (
                  <TextInput
                    value={profileDraft.secondaryContact ?? ''}
                    onChangeText={(v) => setProfileDraft({ ...profileDraft, secondaryContact: v || null })}
                    placeholder="nom@exemple.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="h-11 rounded-xl border border-border-strong bg-bg px-3 font-semibold"
                  />
                )}
              </View>

              {secondaryChanged && (
                <View className="gap-2 p-3.5 rounded-xl bg-info-bg border border-info-border">
                  <Text className="text-[13px] font-semibold text-text">
                    {user.email
                      ? t('settings.secondaryCodeIntroEmail', { to: user.email })
                      : t('settings.secondaryCodeIntroSms', { to: user.phone })}
                  </Text>
                  <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.secondaryCodeLabel')}</Text>
                  <TextInput
                    value={secCode}
                    onChangeText={(v: string) => setSecCode(v.replace(/D/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                    className="h-11 rounded-xl border border-border-strong bg-bg px-3 font-extrabold tracking-widest"
                  />
                  <Pressable onPress={handleSendSecCode} disabled={sendingSecCode} className="h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center disabled:opacity-50">
                    <Text className="font-extrabold text-primary">{sendingSecCode ? '...' : secCodeSent ? t('settings.secondaryCodeSent') : t('settings.secondaryCodeSend')}</Text>
                  </Pressable>
                </View>
              )}

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.jobTitleLabel')}</Text>
                <TextInput
                  value={profileDraft.jobTitle ?? ''}
                  onChangeText={(v) => setProfileDraft({ ...profileDraft, jobTitle: v || null })}
                  className="h-11 rounded-xl border border-border-strong bg-bg px-3 font-semibold"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.addressLabel')}</Text>
                <TextInput
                  value={profileDraft.addressLine ?? ''}
                  onChangeText={(v) => setProfileDraft({ ...profileDraft, addressLine: v || null })}
                  className="h-11 rounded-xl border border-border-strong bg-bg px-3 font-semibold"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.cityLabel')}</Text>
                <TextInput
                  value={profileDraft.city ?? ''}
                  onChangeText={(v) => setProfileDraft({ ...profileDraft, city: v || null })}
                  className="h-11 rounded-xl border border-border-strong bg-bg px-3 font-semibold"
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('settings.countryLabel')}</Text>
                <SelectField value={profileDraft.countryId ?? ''} onChange={(v) => setProfileDraft({ ...profileDraft, countryId: v || null })} options={countryOptions} placeholder={t('settings.genderPlaceholder')} className="h-11" />
              </View>

              {profileError && <Text className="text-[13px] font-semibold text-danger">{profileError}</Text>}
              {profileSaved && <Text className="text-[13px] font-semibold text-success">{t('settings.profileSaved')}</Text>}

              <Pressable onPress={handleSaveProfile} disabled={savingProfile || (secondaryChanged && secCode.length !== 6)} className="h-11 rounded-xl bg-primary items-center justify-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{savingProfile ? '...' : t('settings.save')}</Text>
              </Pressable>
            </View>

            <Pressable onPress={handleLogout} disabled={loggingOut} className="h-12 rounded-xl border border-danger/30 bg-danger/5 items-center justify-center flex-row gap-2 disabled:opacity-50">
              <LogOut size={18} color="#C6362F" />
              <Text className="text-danger font-extrabold">{loggingOut ? t('settings.loggingOut') : t('settings.logout')}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}
