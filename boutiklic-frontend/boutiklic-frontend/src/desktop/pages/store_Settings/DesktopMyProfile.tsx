import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Camera, Lock, LogOut, Mail, Monitor, Pencil } from 'lucide-react'
import { PHONE_COUNTRIES, splitE164Phone } from '@boutiklic/shared'
import { notifyAuthChanged } from '../../../hooks/useAuth'
import { authApi, toE164Phone } from '../../../lib/authApi'
import CountryCodePicker from '../../../components/CountryCodePicker'
import { userApi, type CurrentUserResponse, type UpdatePersonalProfileRequest } from '../../../lib/userApi'
import { deviceApi, type DeviceResponse } from '../../../lib/deviceApi'
import { fileApi } from '../../../lib/fileApi'
import { getDeviceId } from '../../../lib/device'
import { clearSession } from '../../../lib/session'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import Input from '../../components/Input'
import { useTopBar } from '../../hooks/useTopBar'
import { getRoleLabel } from './TeamRolesDesktop'

/** W12 — "Mon profil", ouvert depuis la carte profil de la sidebar (cf. Sidebar.tsx), pas depuis
 *  les onglets Réglages : sorti de DesktopSettings.tsx (W9) pour devenir une route autonome. La
 *  maquette de référence (study/web/mon_profil) affiche aussi un badge email "Vérifié", une date
 *  "Membre depuis...", un statut 2FA et des préférences de notification (rapports hebdo, alertes
 *  de connexion) : aucun de ces champs n'existe côté API (CurrentUserResponse n'a ni vérification
 *  email, ni createdAt, ni 2FA, et il n'y a aucun endpoint de préférences de notification) — non
 *  repris, même logique que les écarts déjà documentés pour l'onglet Équipe. La carte "Sécurité &
 *  Accès" reste réelle : mot de passe et sessions renvoient vers l'onglet Sécurité de Réglages
 *  (/reglages?tab=securite, lu par DesktopSettings.tsx) qui les gère vraiment, plutôt que de
 *  dupliquer une fausse action ici. */
export default function DesktopMyProfile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [user, setUser] = useState<CurrentUserResponse | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<DeviceResponse[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useTopBar({ title: t('settings.myProfileTitle') }, [t])

  useEffect(() => {
    userApi.getMe().then((me) => {
      setUser(me)
      setNameDraft(me.displayName)
      setSavedSecondary(me.secondaryContact)
      setSecCountryId(splitE164Phone(me.secondaryContact?.startsWith('+') ? me.secondaryContact : me.phone).countryId)
      setProfileDraft({
        birthDate: me.birthDate, gender: me.gender, secondaryContact: me.secondaryContact,
        addressLine: me.addressLine, city: me.city, countryId: me.countryId, jobTitle: me.jobTitle,
      })
    }).catch((e) => setError(toErrorMessage(e)))
    deviceApi.list().then(setDevices).catch(() => undefined)
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

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || !user) return
    setSavingName(true)
    try {
      await userApi.updateDisplayName(trimmed)
      setUser({ ...user, displayName: trimmed })
      setEditingName(false)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    try {
      const { url } = await fileApi.upload(file)
      await userApi.updateAvatar(url)
      setUser({ ...user, avatarUrl: url })
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authApi.revokeDevice(getDeviceId())
    } catch {
      // best-effort
    }
    clearSession()
    notifyAuthChanged()
    navigate('/login')
  }

  const handleManageSecurity = () => navigate('/reglages?tab=securite')

  if (!user) return <div className="p-4 sm:p-8 text-sm font-semibold text-text-dim">{t('common.loading')}</div>

  const currentDevice = devices.find((d) => d.current)
  const roleInfo = getRoleLabel(user.role, t)

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section className="bg-bg-card rounded-3xl border border-border p-4 sm:p-8 min-w-0 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="relative flex-none">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary text-papier flex items-center justify-center font-bold text-2xl sm:text-3xl overflow-hidden ring-4 ring-bg">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.displayName.slice(0, 2).toUpperCase()}
                </div>
                <label className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-bg-card text-text-muted border border-border shadow-sm hover:text-primary transition-colors cursor-pointer">
                  <Camera size={15} />
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                {editingName ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
                    <Button onClick={handleSaveName} disabled={savingName} loading={savingName} className="h-11 px-3.5 text-xs">{t('settings.save')}</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text break-words min-w-0">{user.displayName}</h1>
                    <button type="button" onClick={() => setEditingName(true)} className="p-1.5 text-text-dim hover:text-text hover:bg-bg-elevated rounded-lg transition-colors" aria-label={t('settings.editMyNameAria')}>
                      <Pencil size={15} />
                    </button>
                  </div>
                )}
                {user.email && (
                  <div className="flex items-center gap-2 text-text-muted text-sm">
                    <Mail size={15} className="text-text-dim flex-shrink-0" />
                    <span className="break-all min-w-0">{user.email}</span>
                  </div>
                )}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit ${roleInfo.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {roleInfo.label}
                </span>
              </div>
            </div>

            {user.phone && (
              <>
                <div className="my-6 border-t border-border-hairline" />
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3 rounded-xl bg-bg-elevated/50 border border-border-hairline text-sm max-w-xs">
                  <span className="text-text-muted">{t('settings.phoneFieldLabel')}</span>
                  <span className="font-semibold text-text break-all">{user.phone}</span>
                </div>
              </>
            )}
          </section>

          <section className="bg-bg-card rounded-3xl border border-border p-4 sm:p-8 min-w-0 shadow-sm flex flex-col gap-5">
            <div>
              <h2 className="font-bold text-base text-text">{t('settings.personalInfoTitle')}</h2>
              <p className="text-xs text-text-dim mt-1">{t('settings.personalInfoHint')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="date"
                label={t('settings.birthDateLabel')}
                value={profileDraft.birthDate ?? ''}
                onChange={(e) => setProfileDraft({ ...profileDraft, birthDate: e.target.value || null })}
              />

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('settings.genderLabel')}</span>
                <select
                  value={profileDraft.gender ?? ''}
                  onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value || null })}
                  className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
                >
                  <option value="">{t('settings.genderPlaceholder')}</option>
                  <option value="male">{t('settings.gender.male')}</option>
                  <option value="female">{t('settings.gender.female')}</option>
                  <option value="other">{t('settings.gender.other')}</option>
                </select>
              </label>

              {user.email ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('settings.secondaryPhoneLabel')}</span>
                  <div className="flex items-center gap-2 min-h-11 px-3 rounded-xl border border-border-strong bg-bg">
                    <CountryCodePicker countryId={secCountryId} setCountryId={(id) => {
                      const { national } = splitE164Phone(profileDraft.secondaryContact)
                      const dial = PHONE_COUNTRIES.find((c) => c.id === id)?.dialCode
                      setSecCountryId(id)
                      setProfileDraft({ ...profileDraft, secondaryContact: national ? toE164Phone(national, dial) : null })
                    }} />
                    <input
                      value={(() => {
                        const dial = PHONE_COUNTRIES.find((c) => c.id === secCountryId)?.dialCode ?? ''
                        const v = profileDraft.secondaryContact
                        return v && v.startsWith(dial) ? v.slice(dial.length) : ''
                      })()}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/D/g, '')
                        const dial = PHONE_COUNTRIES.find((c) => c.id === secCountryId)?.dialCode
                        setProfileDraft({ ...profileDraft, secondaryContact: digits ? toE164Phone(digits, dial) : null })
                      }}
                      inputMode="tel"
                      placeholder="620 12 34 56"
                      className="flex-1 min-w-0 bg-transparent font-semibold outline-none"
                    />
                  </div>
                </div>
              ) : (
                <Input
                  type="email"
                  label={t('settings.secondaryEmailLabel')}
                  placeholder="nom@exemple.com"
                  value={profileDraft.secondaryContact ?? ''}
                  onChange={(e) => setProfileDraft({ ...profileDraft, secondaryContact: e.target.value || null })}
                />
              )}

              {secondaryChanged && (
                <div className="flex flex-col gap-2 md:col-span-2 p-3.5 rounded-xl bg-info-bg border border-info-border">
                  <span className="text-[13px] font-semibold text-text">
                    {user.email
                      ? t('settings.secondaryCodeIntroEmail', { to: user.email })
                      : t('settings.secondaryCodeIntroSms', { to: user.phone })}
                  </span>
                  <div className="flex flex-wrap items-end gap-3">
                    <Input
                      label={t('settings.secondaryCodeLabel')}
                      inputMode="numeric"
                      maxLength={6}
                      value={secCode}
                      onChange={(e) => setSecCode(e.target.value.replace(/D/g, ''))}
                      className="tracking-[0.3em]"
                    />
                    <Button variant="secondary" onClick={handleSendSecCode} loading={sendingSecCode} disabled={sendingSecCode}>
                      {secCodeSent ? t('settings.secondaryCodeSent') : t('settings.secondaryCodeSend')}
                    </Button>
                  </div>
                </div>
              )}

              <Input
                label={t('settings.jobTitleLabel')}
                value={profileDraft.jobTitle ?? ''}
                onChange={(e) => setProfileDraft({ ...profileDraft, jobTitle: e.target.value || null })}
              />

              <Input
                label={t('settings.addressLabel')}
                value={profileDraft.addressLine ?? ''}
                onChange={(e) => setProfileDraft({ ...profileDraft, addressLine: e.target.value || null })}
              />

              <Input
                label={t('settings.cityLabel')}
                value={profileDraft.city ?? ''}
                onChange={(e) => setProfileDraft({ ...profileDraft, city: e.target.value || null })}
              />

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('settings.countryLabel')}</span>
                <select
                  value={profileDraft.countryId ?? ''}
                  onChange={(e) => setProfileDraft({ ...profileDraft, countryId: e.target.value || null })}
                  className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
                >
                  <option value="">{t('settings.genderPlaceholder')}</option>
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {profileError && <div className="text-[13px] font-semibold text-danger">{profileError}</div>}
            {profileSaved && <div className="text-[13px] font-semibold text-success">{t('settings.profileSaved')}</div>}

            <Button onClick={handleSaveProfile} disabled={savingProfile || (secondaryChanged && secCode.length !== 6)} loading={savingProfile} className="self-start px-5">
              {t('settings.save')}
            </Button>
          </section>

          {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-danger/5 hover:bg-danger/10 border border-danger/20 text-danger font-semibold text-sm transition-all disabled:opacity-50"
          >
            <LogOut size={16} />
            {loggingOut ? t('settings.loggingOut') : t('settings.logout')}
          </button>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <section className="bg-bg-card rounded-3xl border border-border p-4 sm:p-6 shadow-sm min-w-0 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-base text-text">{t('settings.securityAccessTitle')}</h2>
              <span className="text-xs font-semibold text-text-muted bg-bg-elevated px-2.5 py-1 rounded-full">{t('settings.memberActiveStatus')}</span>
            </div>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleManageSecurity} className="flex items-center justify-between gap-3 p-3 sm:p-3.5 text-left rounded-2xl bg-bg-elevated/50 border border-border-hairline hover:border-border transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-bg-card border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                    <Lock size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">{t('settings.passwordRowTitle')}</div>
                    <div className="text-xs text-text-dim break-words">{t('settings.passwordRowHint')}</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary flex-shrink-0">{t('settings.change')}</span>
              </button>

              <button type="button" onClick={handleManageSecurity} className="flex items-center justify-between gap-3 p-3 sm:p-3.5 text-left rounded-2xl bg-bg-elevated/50 border border-border-hairline hover:border-border transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-bg-card border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                    <Monitor size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text">{t('settings.sessionsRowTitle')}</div>
                    <div className="text-xs text-text-dim break-words">{currentDevice ? currentDevice.deviceName : t('settings.activeSessionsCount', { count: devices.length })}</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-text-muted flex-shrink-0">{t('settings.manage')}</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <p className="text-center text-xs text-text-dim pt-2">{t('settings.profileFooterNote', { year: new Date().getFullYear() })}</p>
    </div>
  )
}
