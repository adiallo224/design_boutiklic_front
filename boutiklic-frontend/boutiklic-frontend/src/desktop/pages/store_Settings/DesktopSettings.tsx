import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, Globe, Image as ImageIcon, Info, Lock, Store } from 'lucide-react'
import { isSupportedLocale, DEFAULT_LOCALE, CURRENCY_LABELS, COST_METHODS, type CostMethod, type Country } from '@boutiklic/shared'
import { useTenant, type Tenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { authApi } from '../../../lib/authApi'
import { userApi } from '../../../lib/userApi'
import { productsApi } from '../../../lib/productsApi'
import { fileApi } from '../../../lib/fileApi'
import { LANGUAGES, getLanguage, setLanguage as persistLanguage } from '../../../lib/language'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import Input from '../../components/Input'
import FlagIcon from '../../../components/FlagIcon'
import { useTopBar } from '../../hooks/useTopBar'
import SecurityDesktop from '../account_Setup/SecurityDesktop'
import DesktopMyPlan from './DesktopMyPlan'
import TeamRolesDesktop from './TeamRolesDesktop'
import DepotsDesktop from './DepotsDesktop'
import SyncStatusDesktop from './SyncStatusDesktop'
import PrintSettingsDesktop from './PrintSettingsDesktop'
import TaxSettingsDesktop from './TaxSettingsDesktop'
import { CONTACT_INFO, whatsappLink } from '../../../pages/contact/contactInfo'
import { usePublicContent } from '../../../pages/publicContent/usePublicContent'

type Tab = 'boutique' | 'equipe' | 'depots' | 'langue' | 'impression' | 'sync' | 'securite' | 'abonnement' | 'aide'

/** W9 — onglets internes (Boutique/Équipe & rôles/Devise & langue/Synchronisation/Sécurité). W22
 *  (TeamRolesDesktop.tsx), W24 (SyncStatusDesktop.tsx) et W31 (SecurityDesktop.tsx) vivent dans
 *  leurs propres fichiers mais restent montés ici comme onglets, pas comme routes — c'est ce que
 *  demande le spec pour ces écrans ("onglets internes" de W9). "Mon profil" (W12) est sorti de
 *  cette liste d'onglets : c'est désormais une route autonome (DesktopMyProfile.tsx) ouverte
 *  depuis la carte profil de la sidebar, pas depuis Réglages — cf. Sidebar.tsx. L'onglet Sécurité
 *  reste atteignable depuis cette route via /reglages?tab=securite (lu ci-dessous). */
export default function DesktopSettings() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { tenant, tenants, refetch: refetchTenant } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  const TABS: { id: Tab; label: string }[] = [
    { id: 'boutique', label: t('settings.shopProfileTitle') },
    { id: 'equipe', label: t('settings.teamTitle') },
    { id: 'depots', label: t('settings.depotsTitle') },
    { id: 'langue', label: t('settings.currencyLanguageTabLabel') },
    { id: 'impression', label: t('labels.settingsTab') },
    { id: 'sync', label: t('settings.sync') },
    { id: 'securite', label: t('auth.securityTitle') },
    { id: 'abonnement', label: t('settings.subscription') },
    { id: 'aide', label: t('settings.helpTab', 'Aide & contact') },
  ]

  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get('tab')
    return TABS.some((tb) => tb.id === requested) ? (requested as Tab) : 'boutique'
  })

  useTopBar({ title: t('settings.title') }, [t])

  return (
    <div className="p-4 sm:p-8">
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg-elevated text-text-muted flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {t('settings.online')}
              </span>
              <span className="text-xs text-text-muted font-medium">{t('settings.activeShopLabel', { name: tenant.name })}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/boutiques')}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-terracotta text-white shadow-sm text-xs font-medium self-start md:self-auto hover:opacity-90 transition-colors"
          >
            <Store size={16} />
            <span>{t('settings.shopsAvailableCount', { count: tenants.length })}</span>
          </button>
        </div>

        <nav aria-label={t('settings.title') ?? undefined} className="mt-8 border-b border-border/70 pb-3">
          <ul className="flex items-center gap-1 sm:gap-2 overflow-x-auto scroll-smooth py-1 text-sm font-medium">
            {TABS.map((tb) => (
              <li key={tb.id} className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={
                    tab === tb.id
                      ? 'inline-flex items-center px-4 py-2 rounded-xl font-semibold bg-primary text-papier shadow-sm transition whitespace-nowrap'
                      : 'inline-flex items-center px-3.5 py-2 rounded-xl text-text-muted hover:text-text hover:bg-bg-elevated/60 transition whitespace-nowrap'
                  }
                >
                  {tb.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {tab === 'boutique' && <BoutiqueTab tenant={tenant} isOwner={isOwner} tenantsCount={tenants.length} onSaved={refetchTenant} onOpenShops={() => navigate('/boutiques')} />}
      {tab === 'equipe' && <TeamRolesDesktop isOwner={isOwner} tenant={tenant} />}
      {tab === 'depots' && <DepotsDesktop isOwner={isOwner} multiDepotEnabled={tenant.multiDepotEnabled} />}
      {tab === 'langue' && <LangueTab tenant={tenant} locale={locale} />}
      {tab === 'impression' && <PrintSettingsDesktop />}
      {tab === 'sync' && <SyncStatusDesktop />}
      {tab === 'securite' && <SecurityDesktop />}
      {tab === 'abonnement' && <DesktopMyPlan embedded />}
      {tab === 'aide' && <HelpTab />}
    </div>
  )
}

/** Aide & contact : mêmes coordonnées que la page publique /contact (contactInfo.ts), plus un accès
 *  au formulaire et aux pages légales. Les pages publiques s'ouvrent dans un nouvel onglet : on reste
 *  dans l'app (et dans la session de caisse en cours). */
function HelpTab() {
  const { t } = useTranslation()
  const { lang } = usePublicContent()
  const wa = whatsappLink(lang)
  const linkClass = 'inline-flex items-center max-w-full px-4 py-2 rounded-xl text-sm font-semibold break-all text-left bg-bg-elevated hover:bg-border border border-border transition'
  const items = [
    wa && { label: 'WhatsApp', href: wa },
    CONTACT_INFO.email && { label: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
    CONTACT_INFO.phone && { label: CONTACT_INFO.phone, href: `tel:${CONTACT_INFO.phone.replace(/\s/g, '')}` },
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <p className="text-sm text-text-muted">{t('settings.helpIntro', 'Un problème ou une question ? Notre équipe vous répond.')}</p>
      <div className="flex flex-col min-[420px]:flex-row flex-wrap gap-3">
        {items.map((it) => (
          <a key={it.href} href={it.href} target="_blank" rel="noreferrer" className={linkClass}>{it.label}</a>
        ))}
        <a href="/contact" target="_blank" rel="noreferrer" className={linkClass}>{t('settings.helpContactForm', 'Formulaire de contact')}</a>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
        <a href="/cgv" target="_blank" rel="noreferrer" className="hover:underline">{t('settings.helpTerms', 'Conditions Générales de Vente')}</a>
        <a href="/confidentialite" target="_blank" rel="noreferrer" className="hover:underline">{t('settings.helpPrivacy', 'Protection des données')}</a>
        <a href="/mentions-legales" target="_blank" rel="noreferrer" className="hover:underline">{t('settings.helpLegal', 'Mentions légales')}</a>
      </div>
    </div>
  )
}

function BoutiqueTab({
  tenant, isOwner, tenantsCount, onSaved, onOpenShops,
}: {
  tenant: Tenant
  isOwner: boolean
  tenantsCount: number
  onSaved: () => void
  onOpenShops: () => void
}) {
  const { t } = useTranslation()
  const SHOP_SIZE_LABELS: Record<Tenant['shopSize'], string> = {
    PETITE: t('settings.shopSize.small'),
    MOYENNE: t('settings.shopSize.medium'),
    GRANDE: t('settings.shopSize.large'),
  }
  const [shopName, setShopName] = useState(tenant.name)
  const [phone, setPhone] = useState(tenant.phone ?? '')
  const [email, setEmail] = useState(tenant.email ?? '')
  const [city, setCity] = useState(tenant.city)
  const [shopSize, setShopSize] = useState(tenant.shopSize)
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl)
  const [threshold, setThreshold] = useState(String(tenant.discountApprovalThresholdPercent))
  // Précision des prix de vente (0 à 2 décimales) — réglage propriétaire distinct de la devise, qui reste figée.
  const [sellingDecimals, setSellingDecimals] = useState(String(tenant.sellingPriceDecimals))
  // Méthode de coût à l'arrivage (étude prix décimaux, section 11) — réglage propriétaire.
  const [costMethod, setCostMethod] = useState<CostMethod>(tenant.costMethod)
  const [taxId, setTaxId] = useState(tenant.taxId ?? '')
  const [rccm, setRccm] = useState(tenant.rccm ?? '')
  const [vatRegistrationKey, setVatRegistrationKey] = useState(tenant.vatRegistrationKey ?? '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** `tenant` arrive vide au premier rendu (chargement async côté useTenant) puis se remplit —
   *  sans ce resync, les champs restaient bloqués sur les valeurs vides capturées par le
   *  useState initial et n'affichaient jamais le nom/ville réels de la boutique. */
  useEffect(() => {
    setShopName(tenant.name)
    setPhone(tenant.phone ?? '')
    setEmail(tenant.email ?? '')
    setCity(tenant.city)
    setShopSize(tenant.shopSize)
    setLogoUrl(tenant.logoUrl)
    setThreshold(String(tenant.discountApprovalThresholdPercent))
    setSellingDecimals(String(tenant.sellingPriceDecimals))
    setCostMethod(tenant.costMethod)
    setTaxId(tenant.taxId ?? '')
    setRccm(tenant.rccm ?? '')
    setVatRegistrationKey(tenant.vatRegistrationKey ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tenant.id, tenant.name, tenant.phone, tenant.email, tenant.city, tenant.shopSize, tenant.logoUrl,
    tenant.discountApprovalThresholdPercent, tenant.sellingPriceDecimals, tenant.costMethod, tenant.taxId, tenant.rccm, tenant.vatRegistrationKey,
  ])

  const hasChanges =
    shopName !== tenant.name
    || phone !== (tenant.phone ?? '')
    || email !== (tenant.email ?? '')
    || city !== tenant.city
    || shopSize !== tenant.shopSize
    || logoUrl !== tenant.logoUrl
    || threshold !== String(tenant.discountApprovalThresholdPercent)
    || sellingDecimals !== String(tenant.sellingPriceDecimals)
    || costMethod !== tenant.costMethod
    || taxId !== (tenant.taxId ?? '')
    || rccm !== (tenant.rccm ?? '')
    || vatRegistrationKey !== (tenant.vatRegistrationKey ?? '')

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const { url } = await fileApi.upload(file)
      setLogoUrl(url)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await authApi.updateTenantIdentity(tenant.id, {
        name: shopName,
        city,
        neighborhood: tenant.neighborhood ?? undefined,
        logoUrl: logoUrl ?? undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      })
      if (shopSize !== tenant.shopSize) await authApi.changeShopSize(tenant.id, shopSize)
      const nextThreshold = Number(threshold)
      if (Number.isInteger(nextThreshold) && nextThreshold !== tenant.discountApprovalThresholdPercent) {
        await authApi.changeDiscountThreshold(tenant.id, nextThreshold)
      }
      if (taxId !== (tenant.taxId ?? '') || rccm !== (tenant.rccm ?? '') || vatRegistrationKey !== (tenant.vatRegistrationKey ?? '')) {
        await authApi.updateLegalIdentifiers(tenant.id, {
          taxId: taxId.trim() || undefined,
          rccm: rccm.trim() || undefined,
          vatRegistrationKey: vatRegistrationKey.trim() || undefined,
        })
      }
      if (costMethod !== tenant.costMethod) await authApi.changeCostMethod(tenant.id, costMethod)
      // La précision des prix de vente a sa propre règle côté serveur : repasser à moins de décimales est refusé (409) tant que des
      // articles actifs ont un prix plus précis. Son échec ne doit pas faire perdre le reste des réglages, déjà enregistrés : on
      // remet le sélecteur sur la valeur réelle et on affiche la raison précise (nombre d'articles, dans la langue de l'utilisateur).
      let precisionError: string | null = null
      if (Number(sellingDecimals) !== tenant.sellingPriceDecimals) {
        try {
          await productsApi.changeSellingPriceDecimals(Number(sellingDecimals))
        } catch (err) {
          precisionError = toErrorMessage(err)
          setSellingDecimals(String(tenant.sellingPriceDecimals))
        }
      }
      onSaved()
      if (precisionError) setError(precisionError)
      else setSaved(true)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Colonne gauche : identité + boutique active */}
      <aside className="lg:col-span-4 flex flex-col gap-5">
        <section className="bg-bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col items-center text-center">
          {/* Le logo occupe toute la largeur de la carte (bord à bord, en haut). */}
          <div className="relative w-full aspect-[4/3] bg-info-bg border-b border-info-border flex items-center justify-center overflow-hidden">
            {logoUrl ? <img src={logoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <Store size={56} className="text-primary" />}
            <span className="absolute top-3 right-3 w-5 h-5 bg-success border-2 border-bg-card rounded-full flex items-center justify-center" title={t('settings.online') ?? undefined}>
              <span className="w-1.5 h-1.5 rounded-full bg-papier" />
            </span>
          </div>
          <div className="w-full p-5 flex flex-col items-center">
          {isOwner && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text hover:text-primary bg-bg hover:bg-bg-elevated border border-border px-3.5 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                <ImageIcon size={14} className="text-text-muted" />
                {uploadingLogo ? t('settings.uploading') : t('settings.changeLogo')}
              </button>
            </>
          )}
          <p className="text-[11px] text-text-muted mt-2">{t('settings.logoHint')}</p>
          </div>
        </section>

        <section className="bg-bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center text-text flex-shrink-0">
              <Store size={18} />
            </div>
            <div className="truncate">
              <div className="text-[11px] font-semibold tracking-wide uppercase text-text-muted">{t('settings.currentShop')}</div>
              <div className="text-sm font-bold text-text truncate">{tenant.name}</div>
              <div className="text-[11px] text-text-muted">{t('settings.shopsCountActive', { count: tenantsCount, name: tenant.name })}</div>
            </div>
          </div>
          <button type="button" aria-label={t('settings.switchShop') ?? undefined} onClick={onOpenShops} className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-bg-elevated transition flex-shrink-0">
            <ChevronsUpDown size={18} />
          </button>
        </section>

        <div className="p-4 rounded-2xl bg-bg-elevated/60 border border-border/60 text-xs text-text-muted leading-relaxed flex items-start gap-2.5">
          <Info size={16} className="mt-0.5 text-text-muted flex-shrink-0" />
          <span>{t('settings.identityTip')}</span>
        </div>
      </aside>

      {/* Colonne droite : formulaire */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {!isOwner && <div className="p-3.5 rounded-xl bg-info-bg border border-info-border text-[13px] text-[#33465E]">{t('settings.ownerOnlyEditProfile')}</div>}

        <section className="bg-bg-card rounded-2xl border border-border p-6 md:p-7 shadow-sm">
          <h2 className="text-base font-bold text-text mb-5">{t('settings.generalInfoTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input label={t('settings.shopNameLabel')} value={shopName} onChange={(e) => setShopName(e.target.value)} disabled={!isOwner} />
            <Input
              type="tel"
              label={t('settings.shopPhoneLabel')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('settings.shopPhonePlaceholder') ?? ''}
              disabled={!isOwner}
            />
            <Input
              type="email"
              label={t('settings.shopEmailLabel')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('settings.shopEmailPlaceholder') ?? ''}
              disabled={!isOwner}
            />
            <Input label={t('settings.cityLabel')} value={city} onChange={(e) => setCity(e.target.value)} disabled={!isOwner} />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.currencyLabel')}</span>
                <span className="text-[11px] text-text-muted">{t('settings.currencyMainLabel')}</span>
              </div>
              <div className="relative flex items-center">
                <input readOnly value={tenant.currency} className="w-full h-11 px-3.5 rounded-xl border border-border-strong bg-bg-elevated/70 text-text font-semibold cursor-not-allowed select-none outline-none" />
                <span className="absolute right-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-bg-elevated text-text">
                  {t('settings.currencyFixedBadge')}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.shopSizeLabel')}</span>
              <select value={shopSize} onChange={(e) => setShopSize(e.target.value as Tenant['shopSize'])} disabled={!isOwner} className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-medium outline-none focus:border-primary disabled:opacity-60">
                {(['PETITE', 'MOYENNE', 'GRANDE'] as const).map((size) => (
                  <option key={size} value={size}>{SHOP_SIZE_LABELS[size]}</option>
                ))}
              </select>
            </div>
            {isOwner && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.discountThreshold')}</span>
                <div className="relative flex items-center">
                  <input value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary" />
                  <span className="pointer-events-none absolute right-3.5 text-sm font-semibold text-text-muted">%</span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">{t('settings.discountThresholdDescription')}</p>
              </div>
            )}
            {isOwner && (
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.sellingPriceDecimalsTitle')}</span>
                <select
                  value={sellingDecimals}
                  onChange={(e) => setSellingDecimals(e.target.value)}
                  className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-medium outline-none focus:border-primary"
                >
                  {[0, 1, 2].map((n) => (
                    <option key={n} value={String(n)}>{t(`settings.sellingPriceDecimalsOption${n}`)}</option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{t('settings.sellingPriceDecimalsHelp')}</p>
              </div>
            )}
            {isOwner && (
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.costMethodTitle')}</span>
                <select
                  value={costMethod}
                  onChange={(e) => setCostMethod(e.target.value as CostMethod)}
                  className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-medium outline-none focus:border-primary"
                >
                  {COST_METHODS.map((m) => (
                    <option key={m} value={m}>{t(`settings.costMethodOption.${m}`)}</option>
                  ))}
                </select>
                <p className="text-[11px] font-semibold text-text mt-0.5 leading-relaxed">{t(`settings.costMethodDescription.${costMethod}`)}</p>
                <p className="text-[11px] text-text-muted leading-relaxed">{t('settings.costMethodHelp')}</p>
              </div>
            )}
          </div>
        </section>

        {isOwner && (
          <section className="bg-bg-card rounded-2xl border border-border p-6 md:p-7 shadow-sm">
            <h2 className="text-base font-bold text-text mb-2">{t('settings.legalIdentifiersTitle')}</h2>
            <p className="text-xs text-text-muted mb-5 leading-relaxed bg-bg-elevated/50 p-3 rounded-xl border border-border/60">{t('settings.legalIdentifiersHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label={t('settings.taxIdLabel')} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder={t('settings.taxIdPlaceholder') ?? ''} />
              <Input label={t('settings.rccmLabel')} value={rccm} onChange={(e) => setRccm(e.target.value)} placeholder={t('settings.rccmPlaceholder') ?? ''} />
              <Input label={t('settings.vatRegistrationKeyLabel')} value={vatRegistrationKey} onChange={(e) => setVatRegistrationKey(e.target.value)} placeholder={t('settings.vatRegistrationKeyPlaceholder') ?? ''} />
            </div>
          </section>
        )}

        {isOwner && <TaxSettingsDesktop tenant={tenant} onChanged={onSaved} />}

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            {saved && !hasChanges && !error && <Check size={16} className="text-success" />}
            {hasChanges ? t('settings.autosaveNotice') : saved && !error ? t('settings.changesSaved') : null}
          </div>
          {isOwner && (
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges || shopName.trim().length === 0 || city.trim().length === 0}
              loading={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Check size={16} />
              {t('settings.saveChanges')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

const LANGUAGE_FLAG: Record<string, string> = { fr: 'fr', en: 'gb', pt: 'pt' }

function LangueTab({ tenant, locale }: { tenant: Tenant; locale: string }) {
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState(() => LANGUAGES.find((l) => l.code === getLanguage().code) ?? LANGUAGES[0])

  const selectLanguage = (code: string) => {
    const lang = LANGUAGES.find((l) => l.code === code)
    if (!lang) return
    setSelected(lang)
    persistLanguage(code)
    i18n.changeLanguage(code)
    userApi.updateLanguage(code).catch(() => undefined)
  }

  const languageHint: Record<string, string> = {
    fr: t('settings.languageHintFr'),
    en: t('settings.languageHintEn'),
    pt: t('settings.languageHintPt'),
  }
  const currencyName = CURRENCY_LABELS[tenant.currency as Country['currency']] ?? tenant.currency

  return (
    <div className="max-w-3xl bg-bg-card rounded-3xl border border-border p-6 sm:p-10 shadow-sm">
      <div className="mb-8 pb-6 border-b border-border/60 flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-alerte-bg text-alerte-text mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            {t('settings.globalSettingsBadge')}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text">{t('settings.regionalPreferencesTitle')}</h1>
          <p className="mt-1.5 text-sm text-text-muted leading-relaxed max-w-xl">{t('settings.regionalPreferencesSubtitle')}</p>
        </div>
        <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-alerte-bg border border-warning/30 items-center justify-center text-alerte-text flex-shrink-0">
          <Globe size={22} />
        </div>
      </div>

      <div className="flex flex-col gap-9">
        <section>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('settings.billingCurrencyLabel')}</span>
            <span className="text-xs text-text-muted flex items-center gap-1 flex-shrink-0">
              <Lock size={13} />
              {t('settings.lockedAtRegister')}
            </span>
          </div>
          <div className="rounded-2xl bg-bg-elevated/50 border border-border p-4 sm:p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center font-bold text-text text-sm flex-shrink-0">
              {tenant.currency}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-text">{tenant.currency} ({locale})</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-succes-bg text-succes-text">{t('settings.activeBadge')}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{currencyName} · {t('settings.currencySeparatorHint')}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-text-muted italic">{t('settings.currencyComplianceNote')}</p>
        </section>

        <section>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('settings.languageInterfaceLabel')}</span>
            <span className="text-xs text-text-muted flex-shrink-0">{t('settings.defaultChoiceLabel')}</span>
          </div>
          <div className="flex flex-col gap-3">
            {LANGUAGES.map((lang) => {
              const active = selected.code === lang.code
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => selectLanguage(lang.code)}
                  className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all duration-200 text-left ${
                    active ? 'bg-bg-card border-primary shadow-[0_0_0_2px_var(--color-primary)]' : 'bg-bg-elevated/40 border-border hover:bg-bg-card hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <FlagIcon countryId={LANGUAGE_FLAG[lang.code] ?? lang.code} className="text-2xl flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-text">{lang.name}</span>
                      <span className="block text-xs text-text-muted">{languageHint[lang.code]}</span>
                    </div>
                  </div>
                  {active ? (
                    <div className="w-7 h-7 rounded-full bg-primary text-papier flex items-center justify-center flex-shrink-0">
                      <Check size={15} className="stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border-strong flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <div className="pt-6 border-t border-border/60 flex items-center gap-2 text-xs text-text-muted">
          <Check size={16} className="text-success" />
          {t('settings.instantSyncNotice')}
        </div>
      </div>
    </div>
  )
}

