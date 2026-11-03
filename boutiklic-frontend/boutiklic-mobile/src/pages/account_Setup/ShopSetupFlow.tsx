import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { notifyAuthChanged } from '../../hooks/useAuth'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { getDeviceId, getDeviceName, DEVICE_PLATFORM } from '../../lib/device'
import { persistSession, readPendingSignup, clearPendingSignup } from '../../lib/session'
import { splitQuartier } from '../../lib/shop'
import Onboarding from './Onboarding'
import ShopIdentity from './ShopIdentity'
import ShopCountry, { countries } from './ShopCountry'
import ShopActivity from './ShopActivity'

export default function ShopSetupFlow() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [shopName, setShopName] = useState('Boutique Mariama')
  const [quartier, setQuartier] = useState('Madina, Conakry')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null)
  const [countryId, setCountryId] = useState('GN')
  const [category, setCategory] = useState('ALIMENTATION')
  const [size, setSize] = useState<'PETITE' | 'MOYENNE' | 'GRANDE'>('MOYENNE')
  // Non par défaut : la plupart des petites boutiques ne sont pas assujetties à la TVA (cf. TaxChoice).
  const [applyTax, setApplyTax] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cet écran suppose un OTP déjà vérifié (onboardingToken persisté) : accès direct sinon.
    readPendingSignup().then((pending) => {
      if (!pending) router.replace('/login')
    })
  }, [router])

  const handleFinish = async () => {
    const pending = await readPendingSignup()
    if (!pending) {
      router.replace('/login')
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
        deviceId: await getDeviceId(),
        deviceName: getDeviceName(),
        platform: DEVICE_PLATFORM,
      })

      // Non bloquant : le nom/ville sont déjà posés par createTenant, le quartier est un raffinement.
      await authApi
        .updateTenantIdentity(tenant.id, { name: shopName, city, neighborhood, logoUrl: logoUrl ?? undefined }, session.accessToken)
        .catch(() => undefined)

      if (latitude != null && longitude != null && accuracyMeters != null) {
        await authApi.relocateTenant(tenant.id, { latitude, longitude, accuracyMeters }, session.accessToken).catch(() => undefined)
      }

      await authApi.completeOnboarding(tenant.id, { businessSector: category, shopSize: size }, session.accessToken)

      await persistSession(session, tenant.id)
      await clearPendingSignup()
      notifyAuthChanged()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    return <Onboarding onFinish={() => setStep(2)} />
  }

  if (step === 2) {
    return <ShopCountry countryId={countryId} setCountryId={setCountryId} onContinue={() => setStep(3)} onBack={() => setStep(1)} />
  }

  if (step === 3) {
    return (
      <ShopIdentity
        shopName={shopName}
        setShopName={setShopName}
        quartier={quartier}
        setQuartier={setQuartier}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        latitude={latitude}
        longitude={longitude}
        accuracyMeters={accuracyMeters}
        onLocationChange={(lat, lng, accuracy) => {
          setLatitude(lat)
          setLongitude(lng)
          setAccuracyMeters(accuracy)
        }}
        onContinue={() => setStep(4)}
        onBack={() => setStep(2)}
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
