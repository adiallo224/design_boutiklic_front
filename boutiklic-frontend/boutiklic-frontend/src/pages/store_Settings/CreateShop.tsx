import { useState } from 'react'
import { COUNTRIES as countries } from '@boutiklic/shared'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { getDeviceId, getDeviceName, DEVICE_PLATFORM } from '../../lib/device'
import { persistSession } from '../../lib/session'
import { notifyAuthChanged } from '../../hooks/useAuth'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { splitQuartier } from '../../lib/shop'
import Onboarding from '../account_Setup/Onboarding'
import ShopIdentity from '../account_Setup/ShopIdentity'
import ShopCountry from '../account_Setup/ShopCountry'
import ShopActivity from '../account_Setup/ShopActivity'
import OnboardingDesktop from '../../desktop/pages/account_Setup/OnboardingDesktop'
import ShopCountryDesktop from '../../desktop/pages/account_Setup/ShopCountryDesktop'
import ShopIdentityDesktop from '../../desktop/pages/account_Setup/ShopIdentityDesktop'
import ShopActivityDesktop from '../../desktop/pages/account_Setup/ShopActivityDesktop'
import { ADD_SHOP_STEPS } from '../../desktop/pages/account_Setup/shopSetupSteps'

interface CreateShopProps {
  ownerPhone: string | null
  onDone: () => void
  onCancel: () => void
}

/** Ajout d'une boutique à un compte déjà authentifié (écran F0, "+ Créer une boutique") — réutilise
 *  les écrans A2/A5/A5b/A6 (Onboarding/ShopIdentity/ShopCountry/ShopActivity), mais rattache la
 *  boutique via attachBoutique (même téléphone, même PIN) plutôt que via completeRegistration (pas
 *  de nouvel OTP). */
export default function CreateShop({ ownerPhone, onDone, onCancel }: CreateShopProps) {
  const isDesktop = useIsDesktop()
  const [step, setStep] = useState(1)
  const [shopName, setShopName] = useState('')
  const [quartier, setQuartier] = useState('Madina, Conakry')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [countryId, setCountryId] = useState('GN')
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
      const device = { deviceId: getDeviceId(), deviceName: getDeviceName(), platform: DEVICE_PLATFORM }

      const tenant = await authApi.createTenant({ name: shopName, phone: ownerPhone ?? undefined, city, currency, applyTax })
      const session = await authApi.attachBoutique(tenant.id, device)

      // Non bloquant : le nom/ville sont déjà posés par createTenant, le quartier est un raffinement.
      await authApi
        .updateTenantIdentity(tenant.id, { name: shopName, city, neighborhood, logoUrl: logoUrl ?? undefined }, session.accessToken)
        .catch(() => undefined)
      await authApi.completeOnboarding(tenant.id, { businessSector: category, shopSize: size }, session.accessToken)

      persistSession(session, tenant.id)
      notifyAuthChanged()
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    const OnboardingView = isDesktop ? OnboardingDesktop : Onboarding
    return <OnboardingView onFinish={() => setStep(2)} onBack={onCancel} />
  }

  if (step === 2) {
    if (isDesktop) {
      return (
        <ShopCountryDesktop
          countryId={countryId}
          setCountryId={setCountryId}
          onContinue={() => setStep(3)}
          onBack={() => setStep(1)}
          steps={ADD_SHOP_STEPS}
          completedStepIds={[]}
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
          steps={ADD_SHOP_STEPS}
          completedStepIds={['pays']}
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
        steps={ADD_SHOP_STEPS}
        completedStepIds={['pays', 'boutique']}
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
