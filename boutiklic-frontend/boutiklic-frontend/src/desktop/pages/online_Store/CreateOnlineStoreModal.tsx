import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, toErrorMessage } from '../../../lib/apiClient'
import { slugProblem, slugify } from '../../../lib/slug'
import { STOREFRONT_ERROR, storefrontsApi, type SlugAvailabilityResponse, type StorefrontLocale, type StorefrontResponse } from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Modal from '../../components/Modal'

const LOCALES: { value: StorefrontLocale; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
]

const SLUG_CHECK_DELAY_MS = 400

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (site: StorefrontResponse) => void
  /** Numéro de la boutique, proposé comme contact par défaut (modifiable). */
  defaultPhone?: string | null
  /** Domaine de base affiché dans l'aperçu avant que le serveur ne confirme le nom d'hôte complet. */
  baseDomain?: string
}

type SlugState = { kind: 'idle' } | { kind: 'checking' } | { kind: 'result'; result: SlugAvailabilityResponse }

/** Création d'un site : nom, adresse (proposée à partir du nom, vérifiée au fil de la saisie), langue et contacts. */
export default function CreateOnlineStoreModal({ open, onClose, onCreated, defaultPhone, baseDomain = 'boutiklic.com' }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [locale, setLocale] = useState<StorefrontLocale>('fr')
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [slugState, setSlugState] = useState<SlugState>({ kind: 'idle' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestCheck = useRef(0)

  // Remise à zéro à chaque ouverture.
  useEffect(() => {
    if (!open) return
    setName('')
    setSlug('')
    setSlugTouched(false)
    setLocale('fr')
    setPhone(defaultPhone ?? '')
    setWhatsapp('')
    setEmail('')
    setSlugState({ kind: 'idle' })
    setError(null)
  }, [open, defaultPhone])

  const problem = slug ? slugProblem(slug) : null

  // Vérification de disponibilité, après une courte pause de frappe ; une réponse tardive d'une saisie périmée est ignorée.
  useEffect(() => {
    if (!open || !slug || problem) {
      setSlugState({ kind: 'idle' })
      return
    }
    const ticket = ++latestCheck.current
    setSlugState({ kind: 'checking' })
    const timer = window.setTimeout(() => {
      storefrontsApi
        .checkSlug(slug)
        .then((result) => ticket === latestCheck.current && setSlugState({ kind: 'result', result }))
        .catch(() => ticket === latestCheck.current && setSlugState({ kind: 'idle' }))
    }, SLUG_CHECK_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [open, slug, problem])

  const onNameChange = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const slugAvailable = slugState.kind === 'result' && slugState.result.available
  const canSubmit = name.trim() !== '' && slug !== '' && !problem && slugState.kind !== 'checking' && !(slugState.kind === 'result' && !slugState.result.available) && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const site = await storefrontsApi.create({
        slug,
        name: name.trim(),
        locale,
        contactPhone: phone.trim() || undefined,
        contactWhatsapp: whatsapp.trim() || undefined,
        contactEmail: email.trim() || undefined,
      })
      onCreated(site)
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === STOREFRONT_ERROR.notIncluded) setError(t('onlineStore.errors.notIncluded'))
      else if (e instanceof ApiError && e.errorCode === STOREFRONT_ERROR.slugTaken) setSlugState({ kind: 'result', result: { slug, available: false, reason: 'TAKEN', hostname: null } })
      else setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const slugHint = (() => {
    if (!slug) return t('onlineStore.create.slugHint')
    if (problem) return t(`onlineStore.create.problems.${problem}`)
    if (slugState.kind === 'checking') return t('onlineStore.create.checking')
    if (slugState.kind === 'result') {
      return slugState.result.available
        ? t('onlineStore.create.available', { hostname: slugState.result.hostname ?? `${slug}.${baseDomain}` })
        : t(`onlineStore.create.reasons.${slugState.result.reason ?? 'INVALID'}`)
    }
    return `${slug}.${baseDomain}`
  })()
  const slugBad = !!problem || (slugState.kind === 'result' && !slugState.result.available)

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={t('onlineStore.create.title')}
      subtitle={t('onlineStore.create.subtitle')}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('onlineStore.create.cancel')}</Button>
          <Button onClick={submit} loading={saving} disabled={!canSubmit}>{t('onlineStore.create.submit')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label={t('onlineStore.create.name')} value={name} maxLength={120} onChange={(e) => onNameChange(e.target.value)} placeholder={t('onlineStore.create.namePlaceholder')} autoFocus />

        <div className="flex flex-col gap-1.5 min-w-0">
          <Input
            label={t('onlineStore.create.slug')}
            value={slug}
            maxLength={40}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
            error={slugBad ? slugHint : undefined}
            aria-describedby="slug-hint"
          />
          {!slugBad && (
            <span id="slug-hint" role="status" className={`text-xs font-semibold break-words ${slugAvailable ? 'text-succes-text' : 'text-text-dim'}`}>
              {slugAvailable ? '✓ ' : ''}{slugHint}
            </span>
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
          {t('onlineStore.create.locale')}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as StorefrontLocale)}
            className="h-11 w-full rounded-xl border border-border-strong bg-bg px-3 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary"
          >
            {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label={t('onlineStore.create.phone')} value={phone} maxLength={30} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="+224 620 00 00 00" />
          <Input label={t('onlineStore.create.whatsapp')} value={whatsapp} maxLength={30} inputMode="tel" onChange={(e) => setWhatsapp(e.target.value)} placeholder="+224 620 00 00 00" />
        </div>
        <Input label={t('onlineStore.create.email')} type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
        <p className="text-xs font-medium text-text-dim">{t('onlineStore.create.contactHint')}</p>

        {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
