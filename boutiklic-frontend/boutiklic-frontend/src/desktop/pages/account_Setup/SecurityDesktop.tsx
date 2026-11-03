import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, ShieldCheck, Fingerprint, Clock, KeyRound, Check, Monitor, Eye, EyeOff } from 'lucide-react'
import { isSupportedLocale, DEFAULT_LOCALE, formatDate, formatTime } from '@boutiklic/shared'
import { deviceApi, type DeviceResponse } from '../../../lib/deviceApi'
import { authApi } from '../../../lib/authApi'
import { userApi } from '../../../lib/userApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { clearSession } from '../../../lib/session'
import { notifyAuthChanged } from '../../../hooks/useAuth'
import { AUTO_LOCK_NEVER, AUTO_LOCK_OPTIONS, getAutoLockMinutes, setAutoLockMinutes } from '../../../lib/autoLock'
import { webauthnApi, isPlatformAuthenticatorAvailable, registerWebAuthnCredential } from '../../../lib/webauthnApi'
import Button from '../../components/Button'
import Input from '../../components/Input'

function formatLastActive(iso: string, locale: 'fr' | 'en' | 'pt', t: (key: string, options?: Record<string, unknown>) => string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = formatTime(date, locale)
  if (sameDay) return t('auth.lastActiveToday', { time })
  if (date.toDateString() === yesterday.toDateString()) return t('auth.lastActiveYesterday', { time })
  return t('auth.lastActiveOn', { date: formatDate(date, locale), time })
}

/** W31 — remplace PIN/empreinte tactile mobile par un formulaire bureau : délai de verrouillage en
 *  segmented control, code de reprise à 6 chiffres au clavier physique (pas de pavé numérique,
 *  règle de traduction n°8), appareils connectés, aperçu de l'écran verrouillé. Tout tient sur un
 *  seul écran scrollable (pas de sous-écrans empilés comme Security.tsx mobile) : la largeur
 *  bureau permet d'éviter la cascade RecoveryPinSetup/AutoLockSettings. WebAuthn reste proposé
 *  (Windows Hello / Touch ID navigateur sont de vrais authentificateurs de plateforme, cf.
 *  isPlatformAuthenticatorAvailable) même si le spec bureau ne cite que le code de reprise — retirer
 *  une méthode de connexion déjà fonctionnelle aurait été une régression, pas une traduction. */
export default function SecurityDesktop() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const [fingerprintAvailable, setFingerprintAvailable] = useState(false)
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false)
  const [fingerprintBusy, setFingerprintBusy] = useState(false)
  const [fingerprintError, setFingerprintError] = useState<string | null>(null)

  const [autoLockMinutes, setAutoLockMinutesState] = useState(() => getAutoLockMinutes())

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [pinConfigured, setPinConfigured] = useState(false)
  const [showPinForm, setShowPinForm] = useState(false)
  const [pinMode, setPinMode] = useState<'set' | 'disable'>('set')
  const [pinCurrentPassword, setPinCurrentPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSuccess, setPinSuccess] = useState(false)

  useEffect(() => {
    deviceApi.list().then(setDevices).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
    authApi.getRecoveryPinStatus().then(({ configured }) => setPinConfigured(configured)).catch(() => undefined)
    isPlatformAuthenticatorAvailable().then((available) => {
      setFingerprintAvailable(available)
      if (available) webauthnApi.getStatus().then(({ enabled }) => setFingerprintEnabled(enabled)).catch(() => undefined)
    })
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

  const pinsMismatch = confirmPin.length > 0 && newPin !== confirmPin
  const isDisablingPin = pinMode === 'disable'
  const canSubmitPin = isDisablingPin
    ? !pinSaving && pinCurrentPassword.length > 0
    : !pinSaving && pinCurrentPassword.length > 0 && newPin.length === 6 && confirmPin.length === 6 && !pinsMismatch

  const handleSubmitPin = async () => {
    setPinError(null)
    setPinSaving(true)
    try {
      if (isDisablingPin) {
        await authApi.disableRecoveryPin(pinCurrentPassword)
        setPinConfigured(false)
      } else {
        await authApi.setRecoveryPin(pinCurrentPassword, newPin)
        setPinConfigured(true)
      }
      setPinCurrentPassword('')
      setNewPin('')
      setConfirmPin('')
      setShowPinForm(false)
      setPinSuccess(true)
    } catch (e) {
      setPinError(toErrorMessage(e))
    } finally {
      setPinSaving(false)
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

  const handleRevokeAllOthers = async () => {
    const others = devices.filter((d) => !d.current)
    if (others.length === 0) return
    setRevokingAll(true)
    setError(null)
    try {
      await Promise.all(others.map((d) => deviceApi.revoke(d.id)))
      setDevices((prev) => prev.filter((d) => d.current))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setRevokingAll(false)
    }
  }

  const otherDevicesCount = devices.filter((d) => !d.current).length

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await authApi.deleteAccount(deletePassword)
      clearSession()
      notifyAuthChanged()
    } catch (e) {
      setDeleteError(toErrorMessage(e))
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="p-4 sm:p-5 md:p-6 rounded-2xl bg-info-bg border border-info-border flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-bold uppercase tracking-widest text-[#5C7396]">{t('auth.protectionLabel')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg md:text-xl font-bold text-primary">{fingerprintAvailable && fingerprintEnabled ? t('auth.protectionExcellent') : t('auth.protectionGood')}</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-papier rounded-full flex-shrink-0">
              <Check size={12} strokeWidth={3} />
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[#33465E] pt-0.5">
            {fingerprintAvailable && !fingerprintEnabled ? t('auth.addFingerprintHint') : t('auth.changePasswordRegularlyHint')}
          </p>
        </div>
        <div className="hidden sm:flex p-2.5 bg-bg-card/70 rounded-xl text-primary flex-shrink-0">
          <ShieldCheck size={26} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card shadow-sm divide-y divide-border-hairline overflow-hidden">
        <div>
          <button
            type="button"
            onClick={() => { setShowPasswordForm((s) => !s); setPasswordSuccess(false); setPasswordError(null) }}
            className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 md:p-6 text-left hover:bg-bg-elevated/30 transition-colors"
          >
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#F4EDE0] flex items-center justify-center flex-none">
                <Shield size={20} className="text-terracotta" />
              </div>
              <div>
                <div className="text-base font-bold text-text">{t('auth.changePasswordTitle')}</div>
                <div className="text-sm text-text-muted mt-0.5">{t('auth.changePasswordFullSubtitle')}</div>
              </div>
            </div>
            <span className="px-4 py-2 text-sm font-semibold text-text bg-bg-elevated rounded-lg flex-shrink-0 self-start sm:self-auto">{t('settings.change')}</span>
          </button>
          {showPasswordForm && (
            <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 flex flex-col gap-2.5 max-w-[380px]">
              <PasswordField label={t('auth.currentPasswordLabel')} value={currentPassword} onChange={setCurrentPassword} placeholder={t('auth.currentPasswordPlaceholder')} />
              <PasswordField label={t('auth.newPasswordLabel')} value={newPassword} onChange={setNewPassword} placeholder={t('auth.newPasswordPlaceholder')} />
              <PasswordField label={t('auth.confirmNewPasswordLabel')} value={confirmPassword} onChange={setConfirmPassword} placeholder={t('auth.confirmNewPasswordPlaceholder')} />
              {passwordError && <div className="text-[13px] font-semibold text-danger">{passwordError}</div>}
              <Button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword} loading={savingPassword} className="self-start">
                {t('auth.save')}
              </Button>
            </div>
          )}
          {passwordSuccess && !showPasswordForm && <div className="px-5 md:px-6 pb-5 md:pb-6 text-[13px] font-semibold text-success">{t('auth.passwordUpdated')}</div>}
        </div>

        <div>
          <button
            type="button"
            onClick={() => { setShowPinForm((s) => !s); setPinMode('set'); setPinSuccess(false); setPinError(null) }}
            className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 md:p-6 text-left hover:bg-bg-elevated/30 transition-colors"
          >
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info-bg flex items-center justify-center flex-none">
                <KeyRound size={20} className="text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-text">{t('auth.recoveryCodeTitle')}</span>
                  {!pinConfigured && <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-warning/15 text-alerte-text border border-warning/40">{t('auth.recommendedBadge')}</span>}
                </div>
                <div className="text-sm text-text-muted mt-0.5">{pinConfigured ? t('auth.recoveryCodeConfiguredHint') : t('auth.recoveryCodeNotConfiguredHint')}</div>
              </div>
            </div>
            <span className="px-4 py-2 text-sm font-semibold text-primary bg-info-bg border border-info-border rounded-lg flex-shrink-0 self-start sm:self-auto">
              {pinConfigured ? t('settings.change') : t('auth.configureAction')}
            </span>
          </button>
          {showPinForm && (
            <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 flex flex-col gap-2.5 max-w-[380px]">
              <div className="text-[13px] leading-relaxed text-text-muted">{isDisablingPin ? t('auth.disableRecoveryExplainer') : t('auth.setupRecoveryExplainer')}</div>
              <PasswordField label={t('auth.currentPasswordLabel')} value={pinCurrentPassword} onChange={setPinCurrentPassword} placeholder={t('auth.currentPasswordPlaceholder')} />
              {!isDisablingPin && (
                <>
                  <Input label={t('auth.newCodeLabel')} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="amount tracking-[.3em]" placeholder="••••••" />
                  <Input label={t('auth.confirmCodeLabel')} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="amount tracking-[.3em]" placeholder="••••••" error={pinsMismatch ? t('auth.codesMismatch') : undefined} />
                </>
              )}
              {pinConfigured && (
                <button type="button" onClick={() => setPinMode((m) => (m === 'disable' ? 'set' : 'disable'))} className="text-[13px] font-bold text-terracotta text-left">
                  {isDisablingPin ? t('auth.switchToSetupNew') : t('auth.disableRecoveryCode')}
                </button>
              )}
              {pinError && <div className="text-[13px] font-semibold text-danger">{pinError}</div>}
              <Button variant={isDisablingPin ? 'danger' : 'primary'} onClick={handleSubmitPin} disabled={!canSubmitPin} loading={pinSaving} className="self-start">
                {isDisablingPin ? t('auth.disable') : t('auth.save')}
              </Button>
            </div>
          )}
          {pinSuccess && !showPinForm && <div className="px-5 md:px-6 pb-5 md:pb-6 text-[13px] font-semibold text-success">{t('auth.passwordUpdated')}</div>}
        </div>

        {fingerprintAvailable && (
          <div>
            <button type="button" onClick={handleToggleFingerprint} disabled={fingerprintBusy} className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 md:p-6 text-left hover:bg-bg-elevated/30 transition-colors disabled:opacity-60">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-succes-bg flex items-center justify-center flex-none">
                  <Fingerprint size={20} className="text-success" />
                </div>
                <div>
                  <div className="text-base font-bold text-text">{t('auth.fingerprintTitle')}</div>
                  <div className="text-sm text-text-muted mt-0.5">{t('auth.fingerprintSubtitle')}</div>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full p-0.5 flex-none flex self-start sm:self-auto ${fingerprintEnabled ? 'bg-primary justify-end' : 'bg-bg-elevated justify-start'}`}>
                <div className="w-6 h-6 rounded-full bg-papier" />
              </div>
            </button>
            {fingerprintError && <div className="px-5 md:px-6 pb-4 text-[13px] font-semibold text-danger">{fingerprintError}</div>}
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 md:p-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center flex-none">
              <Clock size={20} className="text-text-muted" />
            </div>
            <div>
              <div className="text-base font-bold text-text">{t('auth.autoLockTitle')}</div>
              <div className="text-sm text-text-muted mt-0.5">{autoLockMinutes === AUTO_LOCK_NEVER ? t('auth.autoLockDisabledHint') : t('auth.lockedScreenPreviewHint', { minutes: autoLockMinutes })}</div>
            </div>
          </div>
          <select
            value={autoLockMinutes}
            onChange={(e) => { const minutes = Number(e.target.value); setAutoLockMinutes(minutes); setAutoLockMinutesState(minutes) }}
            aria-label={t('auth.autoLockTitle')}
            className="h-11 w-full sm:w-auto sm:min-w-[200px] px-3.5 rounded-xl border border-border-strong bg-bg-card text-sm font-semibold text-text outline-none focus:border-primary self-start lg:self-auto"
          >
            {AUTO_LOCK_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === AUTO_LOCK_NEVER ? t('auth.autoLockNever') : `${minutes} min`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('auth.connectedDevicesLabel')}</h3>
            <p className="text-sm text-text-muted">{t('auth.connectedDevicesSubtitle')}</p>
          </div>
          {otherDevicesCount > 0 && (
            <button type="button" onClick={handleRevokeAllOthers} disabled={revokingAll} className="text-xs font-semibold text-danger hover:underline disabled:opacity-50 text-left sm:text-right">
              {revokingAll ? t('auth.disconnectingAll') : t('auth.disconnectAllOthers')}
            </button>
          )}
        </div>
        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
        <div className="bg-bg-card border border-border rounded-2xl shadow-sm divide-y divide-border-hairline overflow-hidden">
          {isLoading ? (
            <div className="p-5 text-sm font-semibold text-text-dim">{t('common.loading')}</div>
          ) : devices.length === 0 ? (
            <div className="p-5 text-sm font-semibold text-text-dim">{t('auth.noDeviceConnected')}</div>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 sm:p-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-bg-elevated text-text-muted flex items-center justify-center flex-shrink-0">
                    <Monitor size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text break-words">{d.deviceName}</span>
                      {d.current && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-succes-bg text-succes-text border border-success/20 flex-shrink-0">
                          {t('auth.currentSessionBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{formatLastActive(d.lastActiveAt, locale, t)}</p>
                  </div>
                </div>
                {d.current ? (
                  <span className="text-xs font-semibold text-success hidden sm:block flex-shrink-0">{t('auth.sessionActiveLabel')}</span>
                ) : (
                  <button type="button" onClick={() => handleRevoke(d.id)} disabled={revokingId === d.id} className="text-sm font-bold text-danger disabled:opacity-50 flex-shrink-0">
                    {revokingId === d.id ? '...' : t('auth.remove')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-danger/30 bg-bg-card p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold text-danger">{t('auth.deleteAccountTitle')}</span>
            <span className="text-[13px] text-text-muted">{t('auth.deleteAccountSubtitle')}</span>
          </div>
          <button type="button" onClick={() => { setShowDeleteForm((s) => !s); setDeleteError(null) }} className="text-sm font-bold text-danger flex-shrink-0">
            {showDeleteForm ? t('settings.cancel') : t('auth.deleteAccountTitle')}
          </button>
        </div>
        {showDeleteForm && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] leading-relaxed text-text-muted">{t('auth.deleteAccountWarning')}</p>
            <PasswordField label={t('auth.currentPasswordLabel')} value={deletePassword} onChange={setDeletePassword} placeholder={t('auth.currentPasswordPlaceholder')} />
            {deleteError && <p className="text-[13px] font-semibold text-danger">{deleteError}</p>}
            <Button variant="danger" onClick={handleDeleteAccount} disabled={!deletePassword} loading={deleting} className="self-start">
              {t('auth.deleteAccountConfirm')}
            </Button>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border/60 flex items-center gap-2 text-xs text-text-muted">
        <Check size={16} className="text-success flex-shrink-0" />
        {t('auth.securityAutosaveNotice')}
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{label}</span>
      <div className="h-11 rounded-xl border border-border-strong bg-bg flex items-center px-3.5 gap-2.5">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 text-sm font-semibold outline-none bg-transparent" />
        <button type="button" onClick={() => setShow((s) => !s)} disabled={value.length === 0} className="text-text-dim disabled:opacity-40">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}
