import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { notifyAuthChanged } from '../../hooks/useAuth'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { authApi, toE164Phone } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { getDeviceId, getDeviceName, DEVICE_PLATFORM } from '../../lib/device'
import { persistSession, storePendingSignup, setActiveTenantId, getUserId, getActiveTenantId } from '../../lib/session'
import { isPlatformAuthenticatorAvailable, loginWithWebAuthnCredential } from '../../lib/webauthnApi'
import { PHONE_COUNTRIES, PHONE_SIGNUP_ENABLED } from '@boutiklic/shared'
import Login from './Login'
import CreateAccount from './CreateAccount'
import VerifyCode from './VerifyCode'
import ForgotPassword from './ForgotPassword'
import ResetPassword from './ResetPassword'
import RecoveryPinEntry from './RecoveryPinEntry'
import AcceptInvite from './AcceptInvite'
import LoginDesktop from '../../desktop/pages/account_Setup/LoginDesktop'
import CreateAccountDesktop from '../../desktop/pages/account_Setup/CreateAccountDesktop'
import VerifyCodeDesktop from '../../desktop/pages/account_Setup/VerifyCodeDesktop'
import ForgotPasswordDesktop from '../../desktop/pages/account_Setup/ForgotPasswordDesktop'
import ResetPasswordDesktop from '../../desktop/pages/account_Setup/ResetPasswordDesktop'
import RecoveryPinEntryDesktop from '../../desktop/pages/account_Setup/RecoveryPinEntryDesktop'
import AcceptInviteDesktop from '../../desktop/pages/account_Setup/AcceptInviteDesktop'

const OTP_LENGTH = 6

type Mode = 'login' | 'signup' | 'forgot' | 'acceptInvite'
type Channel = 'phone' | 'email'
type SignupStep = 'form' | 'verify'
type ForgotStep = 'channel' | 'verify' | 'recoveryPin' | 'newPassword'

export default function AuthFlow() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const [searchParams] = useSearchParams()
  // Permet à la page vitrine (LandingPage) d'ouvrir directement l'inscription via /login?mode=signup
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'login')
  const [channel, setChannel] = useState<Channel>('phone')
  // Inscription par téléphone désactivée (SMS non configurés) : on force l'email à l'inscription
  useEffect(() => {
    if (mode === 'signup' && !PHONE_SIGNUP_ENABLED) setChannel('email')
  }, [mode])
  const [signupStep, setSignupStep] = useState<SignupStep>('form')
  const [forgotStep, setForgotStep] = useState<ForgotStep>('channel')
  const [countryId, setCountryId] = useState('GN')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState<string[]>([])
  const [resendIn, setResendIn] = useState(45)
  const [resetOtp, setResetOtp] = useState<string[]>([])
  const [resetResendIn, setResetResendIn] = useState(45)
  const [resetOnboardingToken, setResetOnboardingToken] = useState('')
  const [recoveryPinRequired, setRecoveryPinRequired] = useState(false)
  const [recoveryPin, setRecoveryPin] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fingerprintReady, setFingerprintReady] = useState(false)
  const [fingerprintLoading, setFingerprintLoading] = useState(false)

  // Écran A3e (invité reconnu, cf. study/BOUTIKLIC Interfaces.dc.md) : rempli par handleConfirmOtp
  // quand l'OTP vérifié correspond à un membre PENDING_ACTIVATION (existingMemberships avec
  // credentialAlreadySet: false) — pas de nouvelle boutique à créer, juste nom + mot de passe.
  const [inviteOnboardingToken, setInviteOnboardingToken] = useState('')
  const [inviteTenantId, setInviteTenantId] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteBoutiqueName, setInviteBoutiqueName] = useState<string | null>(null)
  const [inviteLogoUrl, setInviteLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    // Posé par apiClient.ts quand le refresh token de cet appareil a été révoqué (ex. mot de
    // passe changé ailleurs, cf. AuthCommandService.resetPassword) — explique la déconnexion au
    // lieu de la laisser passer pour un bug silencieux.
    if (localStorage.getItem('boutiklic_forced_logout')) {
      localStorage.removeItem('boutiklic_forced_logout')
      setError(t('auth.sessionExpiredPasswordChanged'))
    }
  }, [])

  useEffect(() => {
    // "Utiliser mon empreinte" n'a de sens que sur un appareil déjà connu (déjà connecté par mot
    // de passe une fois ici) — sinon aucun credential WebAuthn ne peut exister pour ce (user, device).
    if (!getUserId() || !getActiveTenantId()) return
    isPlatformAuthenticatorAvailable().then(setFingerprintReady)
  }, [])

  const handleFingerprintLogin = async () => {
    const userId = getUserId()
    const tenantId = getActiveTenantId()
    if (!userId || !tenantId) return
    setError(null)
    setFingerprintLoading(true)
    try {
      const session = await loginWithWebAuthnCredential(tenantId, userId, getDeviceId())
      persistSession(session, session.tenantId)
      notifyAuthChanged()
      navigate('/')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setFingerprintLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'signup' && signupStep === 'verify' && resendIn > 0) {
      const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
      return () => clearTimeout(t)
    }
    if (mode === 'forgot' && forgotStep === 'verify' && resetResendIn > 0) {
      const t = setTimeout(() => setResetResendIn((s) => s - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [mode, signupStep, resendIn, forgotStep, resetResendIn])

  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'

  const handleLogin = async () => {
    // La boutique connue sur cet appareil (si déjà connecté ici) accélère/désambiguïse la résolution
    // côté serveur, mais n'est plus obligatoire : si absente, le backend résout le compte par
    // téléphone/email + mot de passe (cf. authApi.login, AuthCommandService.login).
    const cachedTenantId = localStorage.getItem('boutiklic_active_tenant_id') ?? undefined
    setError(null)
    setLoading(true)
    try {
      const session = await authApi.login({
        tenantId: cachedTenantId,
        phone: channel === 'phone' ? toE164Phone(phone, dialCode) : undefined,
        email: channel === 'email' ? email : undefined,
        password,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: DEVICE_PLATFORM,
      })
      persistSession(session, session.tenantId)
      notifyAuthChanged()
      navigate('/')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleReceiveCode = async () => {
    setError(null)
    setLoading(true)
    try {
      if (channel === 'phone') {
        await authApi.requestOtp(toE164Phone(phone, dialCode))
      } else {
        await authApi.requestOtpEmail(email)
      }
      setOtp([])
      setResendIn(45)
      setSignupStep('verify')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendIn > 0) return
    setError(null)
    try {
      if (channel === 'phone') {
        await authApi.requestOtp(toE164Phone(phone, dialCode))
      } else {
        await authApi.requestOtpEmail(email)
      }
      setResendIn(45)
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  const handleKeypadDigit = (d: string) => {
    if (otp.length < OTP_LENGTH) setOtp([...otp, d])
  }

  const handleKeypadClear = () => {
    setOtp(otp.slice(0, -1))
  }

  const handleConfirmOtp = async () => {
    setError(null)
    setLoading(true)
    try {
      const code = otp.join('')
      const phoneE164 = channel === 'phone' ? toE164Phone(phone, dialCode) : null
      const { onboardingToken, existingMemberships } =
        channel === 'phone' ? await authApi.verifyOtp(phoneE164!, code) : await authApi.verifyOtpEmail(email, code)

      // Un membre a été invité (F2 "Ajouter un membre") sur cet identifiant mais n'a pas encore de
      // mot de passe (User PENDING_ACTIVATION, cf. User.invite/inviteByEmail) : on le reconnaît ici et
      // on l'emmène directement sur l'écran d'activation (A3e) plutôt que vers le login (il n'a pas de
      // mot de passe à taper) ou la création de boutique (il rejoint celle de l'invitant, pas une neuve).
      const pendingInvite = existingMemberships.find((m) => !m.credentialAlreadySet)
      if (pendingInvite) {
        setInviteOnboardingToken(onboardingToken)
        setInviteTenantId(pendingInvite.tenantId)
        setInviteRole(pendingInvite.role)
        setInviteBoutiqueName(null)
        setInviteLogoUrl(null)
        setOtp([])
        setMode('acceptInvite')
        authApi
          .getTenantInviteSummary(pendingInvite.tenantId)
          .then((summary) => {
            setInviteBoutiqueName(summary.name)
            setInviteLogoUrl(summary.logoUrl)
          })
          .catch(() => setInviteBoutiqueName(t('auth.defaultShopName')))
        return
      }

      // Un compte existe déjà pour cet identifiant sur une autre boutique : pas de doublon via
      // l'inscription anonyme, on renvoie vers la connexion (cf. AuthCommandService.completeByEmail/Phone).
      if (existingMemberships.length > 0) {
        // Une seule boutique connue : on peut résoudre le tenantId nous-mêmes et laisser l'utilisateur
        // taper son mot de passe directement (sinon l'écran login reste bloqué, cf. handleLogin — pas de
        // tenantId en localStorage sur un appareil qui ne s'est jamais connecté ici).
        if (existingMemberships.length === 1) {
          setActiveTenantId(existingMemberships[0].tenantId)
          setError(t('auth.accountFoundEnterPassword'))
        } else {
          // Plusieurs boutiques pour cet identifiant : pas de sélecteur dédié pour l'instant
          // (le backend n'expose pas encore de liste "mes boutiques" hors session, cf. useTenant.ts).
          setError(t('auth.identityAlreadyRegistered'))
        }
        setOtp([])
        setSignupStep('form')
        setMode('login')
        return
      }

      storePendingSignup({ onboardingToken, phone: phoneE164, password, displayName: name || t('settings.role.owner') })
      navigate('/create-shop')
    } catch (e) {
      setError(toErrorMessage(e))
      setOtp([])
    } finally {
      setLoading(false)
    }
  }

  /** Écran A3e, bouton "Activer mon compte" : active le User PENDING_ACTIVATION créé par l'invitant
   *  (F2) sur inviteTenantId — aucune boutique créée, contrairement à handleConfirmOtp/ShopSetupFlow. */
  const handleActivateInvite = async () => {
    setError(null)
    setLoading(true)
    try {
      const session = await authApi.completeRegistration({
        onboardingToken: inviteOnboardingToken,
        tenantId: inviteTenantId,
        password,
        displayName: name.trim() || t('settings.member'),
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: DEVICE_PLATFORM,
      })
      persistSession(session, session.tenantId)
      notifyAuthChanged()
      navigate('/')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  /** Écran A3e, lien "Ce n'est pas vous ? Changer de numéro" : abandonne l'invitation reconnue et
   *  revient au formulaire de saisie de l'identifiant. */
  const handleChangeNumberFromInvite = () => {
    setError(null)
    setPassword('')
    setInviteOnboardingToken('')
    setInviteTenantId('')
    setInviteRole('')
    setInviteBoutiqueName(null)
    setInviteLogoUrl(null)
    setSignupStep('form')
    setMode('signup')
  }

  const handleSendResetCode = async () => {
    setError(null)
    setLoading(true)
    try {
      if (channel === 'phone') {
        await authApi.requestOtp(toE164Phone(phone, dialCode))
      } else {
        await authApi.requestOtpEmail(email)
      }
      setResetOtp([])
      setResetResendIn(45)
      setForgotStep('verify')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleResendResetCode = async () => {
    if (resetResendIn > 0) return
    setError(null)
    try {
      if (channel === 'phone') {
        await authApi.requestOtp(toE164Phone(phone, dialCode))
      } else {
        await authApi.requestOtpEmail(email)
      }
      setResetResendIn(45)
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  const handleResetDigit = (d: string) => {
    if (resetOtp.length < OTP_LENGTH) setResetOtp([...resetOtp, d])
  }

  const handleResetClear = () => setResetOtp(resetOtp.slice(0, -1))

  const handleResetConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      const code = resetOtp.join('')
      const { onboardingToken, existingMemberships } =
        channel === 'phone' ? await authApi.verifyOtp(toE164Phone(phone, dialCode), code) : await authApi.verifyOtpEmail(email, code)
      setResetOnboardingToken(onboardingToken)
      // Exigé seulement si au moins une boutique de ce compte a configuré un code de récupération
      // (cf. AuthCommandService.checkRecoveryPin) — la vérification réelle reste côté serveur.
      const needsRecoveryPin = existingMemberships.some((m) => m.hasRecoveryPin)
      setRecoveryPinRequired(needsRecoveryPin)
      setRecoveryPin([])
      setForgotStep(needsRecoveryPin ? 'recoveryPin' : 'newPassword')
    } catch (e) {
      setError(toErrorMessage(e))
      setResetOtp([])
    } finally {
      setLoading(false)
    }
  }

  const handleRecoveryPinDigit = (d: string) => {
    if (recoveryPin.length < 6) setRecoveryPin([...recoveryPin, d])
  }

  const handleRecoveryPinClear = () => setRecoveryPin(recoveryPin.slice(0, -1))

  const handleRecoveryPinConfirm = () => {
    setError(null)
    setForgotStep('newPassword')
  }

  const handleResetPasswordSubmit = async (newPassword: string) => {
    setError(null)
    setLoading(true)
    try {
      const cachedTenantId = localStorage.getItem('boutiklic_active_tenant_id') ?? undefined
      const session = await authApi.resetPassword({
        onboardingToken: resetOnboardingToken,
        tenantId: cachedTenantId,
        password: newPassword,
        recoveryPin: recoveryPinRequired ? recoveryPin.join('') : undefined,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: DEVICE_PLATFORM,
      })
      persistSession(session, session.tenantId)
      notifyAuthChanged()
      setForgotStep('channel')
      setMode('login')
      navigate('/')
    } catch (e) {
      setError(toErrorMessage(e))
      // Code de récupération refusé côté serveur : retour à sa saisie plutôt que de rester bloqué
      // sur l'écran mot de passe avec une erreur qui ne s'y rapporte pas.
      if (recoveryPinRequired) {
        setRecoveryPin([])
        setForgotStep('recoveryPin')
      }
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'acceptInvite') {
    const AcceptInviteView = isDesktop ? AcceptInviteDesktop : AcceptInvite
    return (
      <AcceptInviteView
        boutiqueName={inviteBoutiqueName}
        logoUrl={inviteLogoUrl}
        role={inviteRole}
        name={name}
        setName={setName}
        password={password}
        setPassword={setPassword}
        onActivate={handleActivateInvite}
        onChangeNumber={handleChangeNumberFromInvite}
        loading={loading}
        error={error}
      />
    )
  }

  if (mode === 'forgot' && forgotStep === 'newPassword') {
    const ResetPasswordView = isDesktop ? ResetPasswordDesktop : ResetPassword
    return (
      <ResetPasswordView
        onBack={() => {
          setError(null)
          setForgotStep(recoveryPinRequired ? 'recoveryPin' : 'verify')
        }}
        onSubmit={handleResetPasswordSubmit}
        loading={loading}
        error={error}
      />
    )
  }

  if (mode === 'forgot' && forgotStep === 'recoveryPin') {
    const RecoveryPinEntryView = isDesktop ? RecoveryPinEntryDesktop : RecoveryPinEntry
    return (
      <RecoveryPinEntryView
        pin={recoveryPin}
        onBack={() => {
          setError(null)
          setForgotStep('verify')
        }}
        onDigit={handleRecoveryPinDigit}
        onClear={handleRecoveryPinClear}
        onConfirm={handleRecoveryPinConfirm}
        loading={loading}
        error={error}
      />
    )
  }

  if (mode === 'forgot' && forgotStep === 'verify') {
    const VerifyCodeView = isDesktop ? VerifyCodeDesktop : VerifyCode
    return (
      <VerifyCodeView
        mode="reset"
        channel={channel}
        countryId={countryId}
        phone={phone}
        email={email}
        otp={resetOtp}
        resendIn={resetResendIn}
        onBack={() => {
          setError(null)
          setForgotStep('channel')
        }}
        onDigit={handleResetDigit}
        onClear={handleResetClear}
        onConfirm={handleResetConfirm}
        onResend={handleResendResetCode}
        loading={loading}
        error={error}
      />
    )
  }

  if (mode === 'forgot') {
    const ForgotPasswordView = isDesktop ? ForgotPasswordDesktop : ForgotPassword
    return (
      <ForgotPasswordView
        channel={channel}
        setChannel={setChannel}
        countryId={countryId}
        setCountryId={setCountryId}
        phone={phone}
        setPhone={setPhone}
        email={email}
        setEmail={setEmail}
        onSendCode={handleSendResetCode}
        onBack={() => {
          setError(null)
          setMode('login')
        }}
        onSwitchToSignup={() => {
          setError(null)
          setMode('signup')
        }}
        loading={loading}
        error={error}
      />
    )
  }

  if (mode === 'signup' && signupStep === 'verify') {
    const VerifyCodeView = isDesktop ? VerifyCodeDesktop : VerifyCode
    return (
      <VerifyCodeView
        channel={channel}
        countryId={countryId}
        phone={phone}
        email={email}
        otp={otp}
        resendIn={resendIn}
        onBack={() => {
          setError(null)
          setSignupStep('form')
        }}
        onDigit={handleKeypadDigit}
        onClear={handleKeypadClear}
        onConfirm={handleConfirmOtp}
        onResend={handleResendCode}
        loading={loading}
        error={error}
      />
    )
  }

  if (mode === 'signup') {
    const CreateAccountView = isDesktop ? CreateAccountDesktop : CreateAccount
    return (
      <CreateAccountView
        channel={channel}
        setChannel={setChannel}
        countryId={countryId}
        setCountryId={setCountryId}
        phone={phone}
        setPhone={setPhone}
        email={email}
        setEmail={setEmail}
        name={name}
        setName={setName}
        password={password}
        setPassword={setPassword}
        onReceiveCode={handleReceiveCode}
        onSwitchToLogin={() => {
          setError(null)
          setMode('login')
        }}
        loading={loading}
        error={error}
      />
    )
  }

  const LoginView = isDesktop ? LoginDesktop : Login
  return (
    <LoginView
      channel={channel}
      setChannel={setChannel}
      countryId={countryId}
      setCountryId={setCountryId}
      phone={phone}
      setPhone={setPhone}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      onLogin={handleLogin}
      onSwitchToSignup={() => {
        setError(null)
        setMode('signup')
      }}
      onForgotPassword={() => {
        setError(null)
        setMode('forgot')
      }}
      onFingerprintLogin={fingerprintReady ? handleFingerprintLogin : undefined}
      fingerprintLoading={fingerprintLoading}
      loading={loading}
      error={error}
    />
  )
}
