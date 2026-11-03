import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COUNTRIES as countries } from '@boutiklic/shared'
import { notifyAuthChanged } from '../../hooks/useAuth'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { getDeviceId, getDeviceName, DEVICE_PLATFORM } from '../../lib/device'
import { persistSession, readPendingSignup, clearPendingSignup } from '../../lib/session'
import { splitQuartier } from '../../lib/shop'
import Onboarding from './Onboarding'
import ShopIdentity from './ShopIdentity'
import ShopCountry from './ShopCountry'
import ShopActivity from './ShopActivity'
import OnboardingDesktop from '../../desktop/pages/account_Setup/OnboardingDesktop'
import ShopCountryDesktop from '../../desktop/pages/account_Setup/ShopCountryDesktop'
import ShopIdentityDesktop from '../../desktop/pages/account_Setup/ShopIdentityDesktop'
import ShopActivityDesktop from '../../desktop/pages/account_Setup/ShopActivityDesktop'
import { SIGNUP_STEPS } from '../../desktop/pages/account_Setup/shopSetupSteps'

export default function ShopSetupFlow() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [step, setStep] = useState(1)
  const [shopName, setShopName] = useState('Boutique Mariama')
  const [quartier, setQuartier] = useState('Madina, Conakry')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [countryId, setCountryId] = useState('GN')
  const [category, setCategory] = useState('ALIMENTATION')
  const [size, setSize] = useState<'PETITE' | 'MOYENNE' | 'GRANDE'>('MOYENNE')
  // Non par défaut : la plupart des petites boutiques ne sont pas assujetties à la TVA (cf. TaxChoice).
  const [applyTax, setApplyTax] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cet écran suppose un OTP déjà vérifié (onboardingToken en sessionStorage) : accès direct sinon.
    if (!readPendingSignup()) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const handleFinish = async () => {
    const pending = readPendingSignup()
    if (!pending) {
      navigate('/login', { replace: true })
      return
    }

    setError(null)
    setLoading(true)
    try {
      const { neighborhood, city } = splitQuartier(quartier)
      const currency = countries.find((c) => c.id === countryId)?.currency ?? 'GNF'
      const tenant = await authApi.createTenant({
        name: shopName,
        phone: pending.phone ?? undefined,
        city,
        currency,
        applyTax,
      })

      const session = await authApi.completeRegistration({
        onboardingToken: pending.onboardingToken,
        tenantId: tenant.id,
        password: pending.password,
        displayName: pending.displayName,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: DEVICE_PLATFORM,
      })

      // Non bloquant : le nom/ville sont déjà posés par createTenant, le quartier est un raffinement.
      await authApi
        .updateTenantIdentity(tenant.id, { name: shopName, city, neighborhood, logoUrl: logoUrl ?? undefined }, session.accessToken)
        .catch(() => undefined)

      await authApi.completeOnboarding(tenant.id, { businessSector: category, shopSize: size }, session.accessToken)

      persistSession(session, tenant.id)
      clearPendingSignup()
      notifyAuthChanged()
      navigate('/')
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    const OnboardingView = isDesktop ? OnboardingDesktop : Onboarding
    return <OnboardingView onFinish={() => setStep(2)} />
  }

  if (step === 2) {
    if (isDesktop) {
      return (
        <ShopCountryDesktop
          countryId={countryId}
          setCountryId={setCountryId}
          onContinue={() => setStep(3)}
          onBack={() => setStep(1)}
          steps={SIGNUP_STEPS}
          completedStepIds={['compte']}
        />
      )
    }
    return <ShopCountry countryId={countryId} setCountryId={setCountryId} onContinue={() => setStep(3)} onBack={() => setStep(1)} />
  }

  if (step === 3) {
    if (isDesktop) {
      return (
        <ShopIdentityDesktop
          shopName={shopName}
          setShopName={setShopName}
          quartier={quartier}
          setQuartier={setQuartier}
          logoUrl={logoUrl}
          setLogoUrl={setLogoUrl}
          onContinue={() => setStep(4)}
          onBack={() => setStep(2)}
          steps={SIGNUP_STEPS}
          completedStepIds={['compte', 'pays']}
        />
      )
    }
    return (
      <ShopIdentity
        shopName={shopName}
        setShopName={setShopName}
        quartier={quartier}
        setQuartier={setQuartier}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        onContinue={() => setStep(4)}
        onBack={() => setStep(2)}
      />
    )
  }

  if (isDesktop) {
    return (
      <ShopActivityDesktop
        onBack={() => setStep(3)}
        category={category}
        setCategory={setCategory}
        size={size}
        setSize={setSize}
        applyTax={applyTax}
        setApplyTax={setApplyTax}
        onFinish={handleFinish}
        steps={SIGNUP_STEPS}
        completedStepIds={['compte', 'pays', 'boutique']}
        loading={loading}
        error={error}
      />
    )
  }
  return (
    <ShopActivity
      onBack={() => setStep(3)}
      category={category}
      setCategory={setCategory}
      size={size}
      setSize={setSize}
      applyTax={applyTax}
      setApplyTax={setApplyTax}
      onFinish={handleFinish}
      loading={loading}
      error={error}
    />
  )
}
