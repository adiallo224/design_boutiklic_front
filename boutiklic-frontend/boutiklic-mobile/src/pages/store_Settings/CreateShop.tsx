import { useState } from 'react'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { getDeviceId, getDeviceName, DEVICE_PLATFORM } from '../../lib/device'
import { persistSession } from '../../lib/session'
import { notifyAuthChanged } from '../../hooks/useAuth'
import { splitQuartier } from '../../lib/shop'
import { countryIdFromPhone } from '@boutiklic/shared'
import Onboarding from '../account_Setup/Onboarding'
import ShopIdentity from '../account_Setup/ShopIdentity'
import ShopCountry, { countries } from '../account_Setup/ShopCountry'
import ShopActivity from '../account_Setup/ShopActivity'

interface CreateShopProps {
  ownerPhone: string | null
  onDone: () => void
  onCancel: () => void
}

/** Ajout d'une boutique à un compte déjà authentifié (écran F0, "+ Créer une boutique") — réutilise
 *  les écrans A2/A5/A5b/A6, mais rattache la boutique via attachBoutique (même téléphone, même PIN)
 *  plutôt que via completeRegistration (pas de nouvel OTP). */
export default function CreateShop({ ownerPhone, onDone, onCancel }: CreateShopProps) {
  const [step, setStep] = useState(1)
  const [shopName, setShopName] = useState('')
  const [quartier, setQuartier] = useState('Madina, Conakry')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null)
  const [countryId, setCountryId] = useState(() => countryIdFromPhone(ownerPhone))
  const [category, setCategory] = useState('ALIMENTATION')
  const [size, setSize] = useState<'PETITE' | 'MOYENNE' | 'GRANDE'>('MOYENNE')
  // Non par défaut : la plupart des petites boutiques ne sont pas assujetties à la TVA (cf. TaxChoice).
  const [applyTax, setApplyTax] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFinish = async () => {
    setError(null)
    setLoading(true)
    try {
      const { neighborhood, city } = splitQuartier(quartier)
      const currency = countries.find((c) => c.id === countryId)?.currency ?? 'GNF'
      const device = { deviceId: await getDeviceId(), deviceName: getDeviceName(), platform: DEVICE_PLATFORM }

      const tenant = await authApi.createTenant({ name: shopName, phone: ownerPhone ?? undefined, city, currency, applyTax })
      const session = await authApi.attachBoutique(tenant.id, device)

      // Non bloquant : le nom/ville sont déjà posés par createTenant, le quartier est un raffinement.
      await authApi
        .updateTenantIdentity(tenant.id, { name: shopName, city, neighborhood, logoUrl: logoUrl ?? undefined }, session.accessToken)
        .catch(() => undefined)

      if (latitude != null && longitude != null && accuracyMeters != null) {
        await authApi.relocateTenant(tenant.id, { latitude, longitude, accuracyMeters }, session.accessToken).catch(() => undefined)
      }

      await authApi.completeOnboarding(tenant.id, { businessSector: category, shopSize: size }, session.accessToken)

      await persistSession(session, tenant.id)
      notifyAuthChanged()
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    return <Onboarding onFinish={() => setStep(2)} onBack={onCancel} />
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
    <ShopActivity onBack={() => setStep(3)} category={category} setCategory={setCategory} size={size} setSize={setSize} applyTax={applyTax} setApplyTax={setApplyTax} onFinish={handleFinish} loading={loading} error={error} />
  )
}
