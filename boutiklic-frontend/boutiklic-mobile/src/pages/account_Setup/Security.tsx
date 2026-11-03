import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Shield, Fingerprint, Clock, KeyRound, Trash2 } from 'lucide-react-native'
import { deviceApi, type DeviceResponse } from '../../lib/deviceApi'
import { authApi } from '../../lib/authApi'
import { userApi } from '../../lib/userApi'
import { toErrorMessage } from '../../lib/apiClient'
import { AUTO_LOCK_NEVER, getAutoLockMinutes, setAutoLockMinutes } from '../../lib/autoLock'
import { webauthnApi, isPasskeySupported, registerWebAuthnCredential } from '../../lib/webauthnApi'
import RecoveryPinSetup from './RecoveryPinSetup'
import AutoLockSettings from './AutoLockSettings'
import DeleteAccount from './DeleteAccount'
import { formatRelativeDay, formatTime } from '../../lib/dateFormat'

function formatLastActive(iso: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t('auth.dayAtTime', { day: formatRelativeDay(iso), time: formatTime(iso) })
}

export default function Security({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false)
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false)
  const [fingerprintBusy, setFingerprintBusy] = useState(false)
  const [fingerprintError, setFingerprintError] = useState<string | null>(null)
  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const [pinConfigured, setPinConfigured] = useState(false)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [showAutoLockSettings, setShowAutoLockSettings] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [autoLockMinutes, setAutoLockMinutesState] = useState(5)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const loadPinStatus = async () => {
    try {
      const { configured } = await authApi.getRecoveryPinStatus()
      setPinConfigured(configured)
    } catch {
      // Best-effort : l'écran reste utilisable (bouton "Configurer" par défaut) si le statut échoue à charger.
    }
  }

  const loadDevices = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setDevices(await deviceApi.list())
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }

  const loadWebAuthnStatus = async () => {
    const available = isPasskeySupported()
    setFingerprintAvailable(available)
    if (!available) return
    try {
      const { enabled } = await webauthnApi.getStatus()
      setFingerprintEnabled(enabled)
    } catch {
      // Best-effort : le toggle reste utilisable (état OFF par défaut) si le statut échoue à charger.
    }
  }

  useEffect(() => {
    loadDevices()
    loadPinStatus()
    loadWebAuthnStatus()
    getAutoLockMinutes().then(setAutoLockMinutesState)
  }, [])

  const handleToggleFingerprint = async () => {
    setFingerprintError(null)
    setFingerprintBusy(true)
    try {
      if (fingerprintEnabled) {
        await webauthnApi.removeCredential()
        setFingerprintEnabled(false)
      } else {
        await registerWebAuthnCredential()
        setFingerprintEnabled(true)
      }
    } catch (e) {
      setFingerprintError(toErrorMessage(e))
    } finally {
      setFingerprintBusy(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError(t('auth.passwordMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.passwordsMismatch'))
      return
    }
    setSavingPassword(true)
    setPasswordError(null)
    try {
      await userApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
      setPasswordSuccess(true)
    } catch (e) {
      setPasswordError(toErrorMessage(e))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId)
    setError(null)
    try {
      await deviceApi.revoke(deviceId)
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setRevokingId(null)
    }
  }

  if (showPinSetup) {
    return (
      <RecoveryPinSetup
        configured={pinConfigured}
        onBack={() => setShowPinSetup(false)}
        onDone={(stillConfigured) => {
          setPinConfigured(stillConfigured)
          setShowPinSetup(false)
        }}
      />
    )
  }

  if (showDeleteAccount) {
    return <DeleteAccount onBack={() => setShowDeleteAccount(false)} />
  }

  if (showAutoLockSettings) {
    return (
      <AutoLockSettings
        selectedMinutes={autoLockMinutes}
        onBack={() => setShowAutoLockSettings(false)}
        onSelect={async (minutes) => {
          await setAutoLockMinutes(minutes)
          setAutoLockMinutesState(minutes)
          setShowAutoLockSettings(false)
        }}
      />
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.securityTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View className="p-5 rounded-[20px] bg-info-bg border border-info-border gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-[#5C7396]">{t('auth.protectionLabel')}</Text>
          <Text className="text-lg font-extrabold text-primary">
            {fingerprintAvailable && fingerprintEnabled ? t('auth.protectionExcellent') : t('auth.protectionGood')}
          </Text>
          <Text className="text-sm leading-relaxed text-[#33465E]">
            {fingerprintAvailable && !fingerprintEnabled
              ? t('auth.addFingerprintHint')
              : t('auth.changePasswordRegularlyHint')}
          </Text>
        </View>

        <View className="rounded-[20px] border border-border bg-bg-card overflow-hidden">
          <Pressable
            onPress={() => {
              setShowPasswordForm((s) => !s)
              setPasswordSuccess(false)
              setPasswordError(null)
            }}
            className="flex-row items-center gap-3.5 p-[18px] border-b border-border-hairline"
          >
            <View className="w-[42px] h-[42px] rounded-[13px] bg-[#F4EDE0] items-center justify-center">
              <Shield size={20} color="#D84E2A" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold">{t('auth.changePasswordTitle')}</Text>
              <Text className="text-[13px] text-text-dim">{t('auth.changePasswordSubtitle')}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>

          {showPasswordForm && (
            <View className="p-[18px] border-b border-border-hairline gap-2.5">
              <TextInput
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={t('auth.currentPasswordPlaceholder')}
                className="h-12 rounded-xl border border-border-strong bg-bg px-4 font-semibold"
              />
              <TextInput
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('auth.newPasswordPlaceholder')}
                className="h-12 rounded-xl border border-border-strong bg-bg px-4 font-semibold"
              />
              <TextInput
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.confirmNewPasswordPlaceholder')}
                className="h-12 rounded-xl border border-border-strong bg-bg px-4 font-semibold"
              />
              {passwordError && <Text className="text-[13px] font-semibold text-danger">{passwordError}</Text>}
              <Pressable
                onPress={handleChangePassword}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="h-12 rounded-xl bg-primary items-center justify-center disabled:opacity-50"
              >
                <Text className="text-papier font-extrabold">{savingPassword ? t('auth.saving') : t('auth.save')}</Text>
              </Pressable>
            </View>
          )}
          {passwordSuccess && (
            <View className="px-[18px] py-3 border-b border-border-hairline">
              <Text className="text-[13px] font-semibold text-success">{t('auth.passwordUpdated')}</Text>
            </View>
          )}

          <Pressable onPress={() => setShowPinSetup(true)} className="flex-row items-center gap-3.5 p-[18px] border-b border-border-hairline">
            <View className="w-[42px] h-[42px] rounded-[13px] bg-info-bg items-center justify-center">
              <KeyRound size={20} color="#0E2038" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold">{t('auth.recoveryCodeTitle')}</Text>
              <Text className="text-[13px] text-text-dim">{pinConfigured ? t('auth.recoveryCodeConfiguredHint') : t('auth.recoveryCodeNotConfiguredHint')}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          {fingerprintAvailable && (
            <View className="border-b border-border-hairline">
              <Pressable onPress={handleToggleFingerprint} disabled={fingerprintBusy} className="flex-row items-center gap-3.5 p-[18px] disabled:opacity-60">
                <View className="w-[42px] h-[42px] rounded-[13px] bg-succes-bg items-center justify-center">
                  <Fingerprint size={20} color="#0E7A52" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-bold">{t('auth.fingerprintTitle')}</Text>
                  <Text className="text-[13px] text-text-dim">{t('auth.fingerprintSubtitle')}</Text>
                </View>
                <View className={`w-[52px] h-[31px] rounded-full p-[3px] flex-row ${fingerprintEnabled ? 'bg-success justify-end' : 'bg-bg-elevated justify-start'}`}>
                  <View className="w-[25px] h-[25px] rounded-full bg-papier" />
                </View>
              </Pressable>
              {fingerprintError && <Text className="px-[18px] pb-3.5 text-[13px] font-semibold text-danger">{fingerprintError}</Text>}
            </View>
          )}
          <Pressable onPress={() => setShowAutoLockSettings(true)} className="flex-row items-center gap-3.5 p-[18px]">
            <View className="w-[42px] h-[42px] rounded-[13px] bg-bg items-center justify-center">
              <Clock size={20} color="#676E7E" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold">{t('auth.autoLockTitle')}</Text>
              <Text className="text-[13px] text-text-dim">{autoLockMinutes === AUTO_LOCK_NEVER ? t('auth.autoLockNever') : t('auth.autoLockAfterMinutes', { minutes: autoLockMinutes })}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
        </View>

        <Pressable onPress={() => setShowDeleteAccount(true)} className="flex-row items-center gap-3.5 p-[18px] rounded-[20px] border border-border bg-bg-card">
          <View className="w-[42px] h-[42px] rounded-[13px] bg-bg items-center justify-center">
            <Trash2 size={20} color="#C0392B" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-bold text-danger">{t('auth.deleteAccountTitle')}</Text>
            <Text className="text-[13px] text-text-dim">{t('auth.deleteAccountSubtitle')}</Text>
          </View>
          <ChevronRight size={18} color="#A2A9B8" />
        </Pressable>

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.connectedDevicesLabel')}</Text>
          {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
          {isLoading ? (
            <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
          ) : devices.length === 0 ? (
            <Text className="text-[13px] font-semibold text-text-dim">{t('auth.noDeviceConnected')}</Text>
          ) : (
            devices.map((d) => (
              <View key={d.id} className="flex-row items-center gap-3 p-4 rounded-2xl border border-border">
                <View className={`w-2.5 h-2.5 rounded-full ${d.current ? 'bg-success' : 'bg-[#DDD2C3]'}`} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold">
                    {d.deviceName}
                    {d.current ? t('auth.thisDeviceSuffix') : ''}
                  </Text>
                  <Text className="text-[13px] text-text-dim">{formatLastActive(d.lastActiveAt, t)}</Text>
                </View>
                {!d.current && (
                  <Pressable onPress={() => handleRevoke(d.id)} disabled={revokingId === d.id}>
                    <Text className="text-sm font-bold text-danger" style={{ opacity: revokingId === d.id ? 0.5 : 1 }}>
                      {revokingId === d.id ? '...' : t('auth.remove')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}
