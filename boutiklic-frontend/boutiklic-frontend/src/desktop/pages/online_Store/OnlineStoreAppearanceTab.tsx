import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ImagePlus, Monitor, RotateCcw, Smartphone, Tablet, X } from 'lucide-react'
import { toErrorMessage } from '../../../lib/apiClient'
import { fileApi } from '../../../lib/fileApi'
import {
  SOCIAL_PLATFORMS,
  storefrontsApi,
  type AppearanceResponse,
  type PageCode,
  type SocialPlatform,
  type TemplateCode,
  type TemplateResponse,
  type ThemeColors,
} from '../../../lib/storefrontsApi'
import Button from '../../components/Button'
import PageContentModal from './PageContentModal'

interface Props {
  siteId: string
  siteName: string
  disabled?: boolean
}

const COLOR_KEYS = ['primaryColor', 'secondaryColor', 'accentColor', 'buttonColor', 'textColor'] as const
type ColorKey = (typeof COLOR_KEYS)[number]
type Device = 'desktop' | 'tablet' | 'mobile'
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '640px', mobile: '360px' }
const HEX = /^#[0-9a-fA-F]{6}$/

/** Pages dont la vitrine sait afficher le contenu. Les autres (FAQ, blog, CGV...) se règlent déjà mais n'ont pas encore de contenu à afficher. */
const PAGES_WITH_CONTENT: PageCode[] = ['HOME', 'PRODUCTS', 'PROMOTIONS', 'CONTACT', 'ABOUT']
/** Pages optionnelles dont le commerçant rédige le texte (une page sans texte n'apparaît pas dans le menu de la vitrine). */
const EDITABLE_PAGES: PageCode[] = ['FAQ', 'BLOG', 'TERMS', 'PRIVACY', 'RETURNS']

/** Noir ou blanc, selon ce qui se lit le mieux sur cette couleur. */
function readableOn(hex: string): string {
  const channel = (offset: number) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5) > 0.179 ? '#000000' : '#FFFFFF'
}

interface Draft {
  template: TemplateCode
  description: string
  logoUrl: string
  faviconUrl: string
  bannerUrl: string
  colors: Record<ColorKey, string>
  pages: { code: PageCode; enabled: boolean; mandatory: boolean }[]
  links: Record<SocialPlatform, string>
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  seoImageUrl: string
}

function toDraft(a: AppearanceResponse): Draft {
  const links = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, a.socialLinks.find((l) => l.platform === p)?.url ?? ''])) as Record<SocialPlatform, string>
  return {
    template: a.templateCode,
    description: a.description ?? '',
    logoUrl: a.logoUrl ?? '',
    faviconUrl: a.faviconUrl ?? '',
    bannerUrl: a.bannerUrl ?? '',
    colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, a.customTheme[k] ?? ''])) as Record<ColorKey, string>,
    pages: a.pages.map((p) => ({ code: p.code, enabled: p.enabled, mandatory: p.mandatory })),
    links,
    seoTitle: a.seo.title ?? '',
    seoDescription: a.seo.description ?? '',
    seoKeywords: a.seo.keywords ?? '',
    seoImageUrl: a.seo.imageUrl ?? '',
  }
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

/** Onglet « Apparence » : template, identité visuelle, couleurs, pages, réseaux sociaux et SEO, avec un aperçu qui suit les choix en direct. Tout est enregistré d'un coup. */
export default function OnlineStoreAppearanceTab({ siteId, siteName, disabled = false }: Props) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<TemplateResponse[]>([])
  const [saved, setSaved] = useState<Draft | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [pageTexts, setPageTexts] = useState<Partial<Record<PageCode, string>>>({})
  const [editingPage, setEditingPage] = useState<PageCode | null>(null)

  const apply = useCallback((a: AppearanceResponse) => {
    const d = toDraft(a)
    setSaved(d)
    setDraft(d)
  }, [])

  useEffect(() => {
    storefrontsApi.getPageContents(siteId).then((r) => setPageTexts(r.contents)).catch(() => undefined)
    Promise.all([storefrontsApi.listTemplates(), storefrontsApi.getAppearance(siteId)])
      .then(([tpl, a]) => {
        setTemplates(tpl)
        apply(a)
      })
      .catch((e) => setError(toErrorMessage(e)))
  }, [siteId, apply])

  const patch = (changes: Partial<Draft>) => {
    setJustSaved(false)
    setDraft((d) => (d ? { ...d, ...changes } : d))
  }

  const templateDefaults = templates.find((x) => x.code === draft?.template)?.defaultTheme
  /** Couleur réellement appliquée = celle choisie, sinon celle du template. */
  const effective = useMemo(() => {
    const out = {} as Record<ColorKey, string>
    for (const k of COLOR_KEYS) out[k] = draft && HEX.test(draft.colors[k]) ? draft.colors[k] : (templateDefaults?.[k] ?? '#111827')
    return out
  }, [draft, templateDefaults])

  if (error && !draft) return <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>
  if (!draft || !saved) return <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>

  const invalidColor = COLOR_KEYS.find((k) => draft.colors[k] !== '' && !HEX.test(draft.colors[k]))
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const dirty = !same(draft, saved)

  const save = async () => {
    setBusy(true)
    setError(null)
    setJustSaved(false)
    try {
      let latest: AppearanceResponse | null = null
      if (draft.template !== saved.template) latest = await storefrontsApi.changeTemplate(siteId, draft.template)
      if (!same(draft.colors, saved.colors)) {
        const theme = Object.fromEntries(COLOR_KEYS.map((k) => [k, orNull(draft.colors[k])])) as unknown as ThemeColors
        latest = await storefrontsApi.updateTheme(siteId, theme)
      }
      if (draft.description !== saved.description || draft.logoUrl !== saved.logoUrl || draft.faviconUrl !== saved.faviconUrl || draft.bannerUrl !== saved.bannerUrl) {
        latest = await storefrontsApi.updateIdentity(siteId, {
          description: orNull(draft.description),
          logoUrl: orNull(draft.logoUrl),
          faviconUrl: orNull(draft.faviconUrl),
          bannerUrl: orNull(draft.bannerUrl),
        })
      }
      if (!same(draft.pages, saved.pages)) latest = await storefrontsApi.updatePages(siteId, draft.pages.map((p) => ({ code: p.code, enabled: p.enabled })))
      if (!same(draft.links, saved.links)) {
        latest = await storefrontsApi.updateSocialLinks(
          siteId,
          SOCIAL_PLATFORMS.filter((p) => draft.links[p].trim() !== '').map((platform) => ({ platform, url: draft.links[platform].trim() })),
        )
      }
      if (draft.seoTitle !== saved.seoTitle || draft.seoDescription !== saved.seoDescription || draft.seoKeywords !== saved.seoKeywords || draft.seoImageUrl !== saved.seoImageUrl) {
        latest = await storefrontsApi.updateSeo(siteId, {
          title: orNull(draft.seoTitle),
          description: orNull(draft.seoDescription),
          keywords: orNull(draft.seoKeywords),
          imageUrl: orNull(draft.seoImageUrl),
        })
      }
      if (latest) apply(latest)
      setJustSaved(true)
    } catch (e) {
      setError(toErrorMessage(e))
      // Une partie des sections a pu être enregistrée avant l'erreur : on relit l'état du serveur sans écraser la saisie en cours.
      storefrontsApi.getAppearance(siteId).then((a) => setSaved(toDraft(a))).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const movePage = (index: number, delta: -1 | 1) => {
    const next = [...draft.pages]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    patch({ pages: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          <Section title={t('onlineStore.appearance.template.title')} hint={t('onlineStore.appearance.template.hint')}>
            <div role="radiogroup" aria-label={t('onlineStore.appearance.template.title')} className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              {templates.map((tpl) => (
                <button
                  key={tpl.code}
                  type="button"
                  role="radio"
                  aria-checked={draft.template === tpl.code}
                  disabled={disabled}
                  onClick={() => patch({ template: tpl.code })}
                  className={`text-left rounded-xl border-2 p-3 flex flex-col gap-2 ${draft.template === tpl.code ? 'border-terracotta bg-bg-elevated' : 'border-border hover:border-border-strong'}`}
                >
                  <span className="flex gap-1" aria-hidden="true">
                    {[tpl.defaultTheme.primaryColor, tpl.defaultTheme.secondaryColor, tpl.defaultTheme.accentColor].map((c, i) => (
                      <span key={i} className="h-5 w-8 rounded border border-border" style={{ background: c ?? '#fff' }} />
                    ))}
                  </span>
                  <span className="font-extrabold text-sm">{tpl.name}</span>
                  <span className="text-xs font-medium text-text-dim">{tpl.description}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t('onlineStore.appearance.identity.title')}>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
              {t('onlineStore.appearance.identity.description')}
              <textarea
                value={draft.description}
                maxLength={2000}
                rows={3}
                disabled={disabled}
                onChange={(e) => patch({ description: e.target.value })}
                className="rounded-xl border border-border-strong bg-bg px-3.5 py-2.5 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary"
              />
            </label>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
              <ImagePicker label={t('onlineStore.appearance.identity.logo')} url={draft.logoUrl} disabled={disabled} onChange={(url) => patch({ logoUrl: url })} />
              <ImagePicker label={t('onlineStore.appearance.identity.favicon')} url={draft.faviconUrl} disabled={disabled} onChange={(url) => patch({ faviconUrl: url })} />
              <ImagePicker label={t('onlineStore.appearance.identity.banner')} url={draft.bannerUrl} disabled={disabled} onChange={(url) => patch({ bannerUrl: url })} />
            </div>
          </Section>

          <Section title={t('onlineStore.appearance.colors.title')} hint={t('onlineStore.appearance.colors.hint')}>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              {COLOR_KEYS.map((key) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label htmlFor={`color-${key}`} className="text-xs font-bold text-text-muted uppercase tracking-wide">{t(`onlineStore.appearance.colors.${key}`)}</label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`color-${key}`}
                      type="color"
                      value={effective[key]}
                      disabled={disabled}
                      onChange={(e) => patch({ colors: { ...draft.colors, [key]: e.target.value.toUpperCase() } })}
                      className="h-10 w-12 rounded-lg border border-border-strong bg-bg cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-text-muted">{draft.colors[key] === '' ? t('onlineStore.appearance.colors.templateDefault') : draft.colors[key]}</span>
                    {draft.colors[key] !== '' && (
                      <button
                        type="button"
                        aria-label={t('onlineStore.appearance.colors.clear')}
                        disabled={disabled}
                        onClick={() => patch({ colors: { ...draft.colors, [key]: '' } })}
                        className="text-text-dim hover:text-text"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={disabled || COLOR_KEYS.every((k) => draft.colors[k] === '')}
              onClick={() => patch({ colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, ''])) as Record<ColorKey, string> })}
              className="self-start inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            >
              <RotateCcw size={14} />
              {t('onlineStore.appearance.colors.reset')}
            </button>
          </Section>

          <Section title={t('onlineStore.appearance.pages.title')} hint={t('onlineStore.appearance.pages.hint')}>
            <ul className="flex flex-col gap-2">
              {draft.pages.map((page, index) => (
                <li key={page.code} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                  <input
                    id={`page-${page.code}`}
                    type="checkbox"
                    checked={page.enabled}
                    disabled={disabled || page.mandatory}
                    onChange={(e) => patch({ pages: draft.pages.map((p) => (p.code === page.code ? { ...p, enabled: e.target.checked } : p)) })}
                    className="h-5 w-5"
                  />
                  <label htmlFor={`page-${page.code}`} className="flex-1 text-sm font-bold">
                    {t(`onlineStore.appearance.pages.names.${page.code}`)}
                    {EDITABLE_PAGES.includes(page.code) && <span className="ml-2 text-xs font-semibold text-text-dim">{t(pageTexts[page.code] ? 'onlineStore.appearance.pages.written' : 'onlineStore.appearance.pages.notWritten')}</span>}
                  </label>
                  {EDITABLE_PAGES.includes(page.code) && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setEditingPage(page.code)}
                      aria-label={t('onlineStore.appearance.pages.write', { page: t(`onlineStore.appearance.pages.names.${page.code}`) })}
                      className="text-xs font-extrabold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {t(pageTexts[page.code] ? 'onlineStore.appearance.pages.edit' : 'onlineStore.appearance.pages.writeShort')}
                    </button>
                  )}
                  <button type="button" aria-label={t('onlineStore.appearance.pages.moveUp')} disabled={disabled || index === 0} onClick={() => movePage(index, -1)} className="p-1 text-text-muted hover:text-text disabled:opacity-30">
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" aria-label={t('onlineStore.appearance.pages.moveDown')} disabled={disabled || index === draft.pages.length - 1} onClick={() => movePage(index, 1)} className="p-1 text-text-muted hover:text-text disabled:opacity-30">
                    <ArrowDown size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('onlineStore.appearance.social.title')} hint={t('onlineStore.appearance.social.hint')}>
            <div className="grid grid-cols-1 gap-3">
              {SOCIAL_PLATFORMS.map((platform) => (
                <label key={platform} className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
                  {t(`onlineStore.appearance.social.platforms.${platform}`)}
                  <input
                    type="url"
                    inputMode="url"
                    value={draft.links[platform]}
                    maxLength={500}
                    disabled={disabled}
                    placeholder={platform === 'WHATSAPP' ? '+224 620 00 00 00' : 'https://'}
                    onChange={(e) => patch({ links: { ...draft.links, [platform]: e.target.value } })}
                    className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title={t('onlineStore.appearance.seo.title')} hint={t('onlineStore.appearance.seo.hint')}>
            <TextField label={t('onlineStore.appearance.seo.seoTitle')} value={draft.seoTitle} maxLength={70} disabled={disabled} onChange={(v) => patch({ seoTitle: v })} />
            <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
              {t('onlineStore.appearance.seo.seoDescription')}
              <textarea
                value={draft.seoDescription}
                maxLength={320}
                rows={3}
                disabled={disabled}
                onChange={(e) => patch({ seoDescription: e.target.value })}
                className="rounded-xl border border-border-strong bg-bg px-3.5 py-2.5 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary"
              />
            </label>
            <TextField label={t('onlineStore.appearance.seo.keywords')} value={draft.seoKeywords} maxLength={500} disabled={disabled} onChange={(v) => patch({ seoKeywords: v })} />
            <ImagePicker label={t('onlineStore.appearance.seo.image')} url={draft.seoImageUrl} disabled={disabled} onChange={(url) => patch({ seoImageUrl: url })} />
          </Section>
        </div>

        <aside aria-label={t('onlineStore.appearance.preview.title')} className="xl:sticky xl:top-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-extrabold">{t('onlineStore.appearance.preview.title')}</h3>
            <div role="group" aria-label={t('onlineStore.appearance.preview.device')} className="flex gap-1">
              {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([id, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={device === id}
                  aria-label={t(`onlineStore.appearance.preview.${id}`)}
                  onClick={() => setDevice(id)}
                  className={`h-9 w-9 rounded-lg border grid place-items-center ${device === id ? 'border-terracotta bg-bg-elevated text-text' : 'border-border text-text-muted hover:text-text'}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border-strong bg-bg-elevated p-3 overflow-x-auto">
            <Preview name={siteName} draft={draft} colors={effective} width={DEVICE_WIDTH[device]} written={pageTexts} pagesLabel={(c) => t(`onlineStore.appearance.pages.names.${c}`)} />
          </div>
          <p className="text-xs font-medium text-text-dim">{t('onlineStore.appearance.preview.note')}</p>
        </aside>
      </div>

      {editingPage && (
        <PageContentModal
          open
          siteId={siteId}
          code={editingPage}
          initial={pageTexts[editingPage] ?? ''}
          onClose={() => setEditingPage(null)}
          onSaved={(code, body) => setPageTexts((texts) => ({ ...texts, [code]: body || undefined }))}
        />
      )}
      {error && <div role="alert" className="text-[13px] font-semibold text-danger">{error}</div>}
      {invalidColor && <div role="alert" className="text-[13px] font-semibold text-danger">{t('onlineStore.appearance.colors.invalid')}</div>}
      {!disabled && (
        <div className="flex items-center gap-3">
          <Button onClick={save} loading={busy} disabled={!dirty || invalidColor !== undefined}>{t('onlineStore.detail.save')}</Button>
          {justSaved && !dirty && <span role="status" className="text-sm font-bold text-succes-text">{t('onlineStore.detail.saved')}</span>}
        </div>
      )}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-strong bg-bg-card p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-extrabold">{title}</h3>
        {hint && <p className="text-xs font-medium text-text-dim">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function TextField({ label, value, maxLength, disabled, onChange }: { label: string; value: string; maxLength: number; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wide">
      {label}
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-semibold normal-case tracking-normal text-text outline-none focus:border-primary"
      />
    </label>
  )
}

/** Choix d'une image : envoi immédiat du fichier (PNG, JPG ou SVG), puis on garde son adresse. */
function ImagePicker({ label, url, disabled, onChange }: { label: string; url: string; disabled?: boolean; onChange: (url: string) => void }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      onChange((await fileApi.upload(file)).url)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{label}</span>
      <div className="relative h-24 rounded-xl border border-dashed border-border-strong bg-bg-elevated grid place-items-center overflow-hidden">
        {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" /> : null}
        {!url && (
          <button type="button" disabled={disabled || uploading} onClick={() => input.current?.click()} className="flex flex-col items-center gap-1 text-xs font-bold text-text-muted hover:text-text">
            <ImagePlus size={20} />
            {uploading ? t('common.loading') : t('onlineStore.appearance.identity.upload')}
          </button>
        )}
        {url && !disabled && (
          <button type="button" aria-label={t('onlineStore.appearance.identity.remove')} onClick={() => onChange('')} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-bg/90 grid place-items-center text-text-muted hover:text-text">
            <X size={14} />
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/svg+xml" aria-label={label} className="sr-only" tabIndex={-1} onChange={pick} />
      {error && <span role="alert" className="text-xs font-semibold text-danger">{error}</span>}
    </div>
  )
}

/** Maquette de la vitrine (en-tête, bandeau, articles) avec les couleurs et le template choisis. Ce n'est pas la vraie vitrine : un site brouillon n'est pas accessible au public. */
function Preview({ name, draft, colors, width, written, pagesLabel }: { name: string; draft: Draft; colors: Record<ColorKey, string>; width: string; written: Partial<Record<PageCode, string>>; pagesLabel: (code: PageCode) => string }) {
  const filledHeader = draft.template === 'ELECTRONICS' || draft.template === 'RESTAURANT' || draft.template === 'LUXURY'
  const headerBg = filledHeader ? colors.primaryColor : colors.secondaryColor
  const headerText = filledHeader ? readableOn(colors.primaryColor) : colors.textColor
  const radius = draft.template === 'FASHION' || draft.template === 'LUXURY' ? 0 : draft.template === 'RESTAURANT' ? 16 : draft.template === 'ELECTRONICS' ? 6 : 10
  const nav = draft.pages.filter((p) => p.enabled && (PAGES_WITH_CONTENT.includes(p.code) || Boolean(written[p.code])))
  return (
    <div
      data-testid="appearance-preview"
      className="mx-auto overflow-hidden border border-border"
      style={{ width, maxWidth: '100%', background: colors.secondaryColor, color: colors.textColor, fontFamily: draft.template === 'LUXURY' ? 'Georgia, serif' : undefined }}
    >
      <div className="px-4 py-3 flex items-center gap-2 text-sm font-bold" style={{ background: headerBg, color: headerText, justifyContent: draft.template === 'LUXURY' ? 'center' : 'flex-start' }}>
        {draft.logoUrl ? <img src={draft.logoUrl} alt="" className="h-6 w-auto" /> : null}
        <span>{name}</span>
      </div>
      <div className="px-4 py-1.5 flex gap-3 text-[11px] font-semibold overflow-hidden" style={{ background: headerBg, color: headerText, opacity: 0.85 }}>
        {nav.map((p) => <span key={p.code}>{pagesLabel(p.code)}</span>)}
      </div>
      <div
        className="px-4 py-6"
        style={{
          background: draft.bannerUrl ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${draft.bannerUrl}") center/cover` : filledHeader ? colors.primaryColor : colors.secondaryColor,
          color: draft.bannerUrl ? '#fff' : filledHeader ? readableOn(colors.primaryColor) : colors.textColor,
          textAlign: draft.template === 'LUXURY' ? 'center' : 'left',
        }}
      >
        <div className="text-lg font-extrabold" style={{ textTransform: draft.template === 'FASHION' ? 'uppercase' : undefined }}>{name}</div>
        {draft.description && <div className="text-xs mt-1 line-clamp-2">{draft.description}</div>}
      </div>
      <div className="p-4 grid gap-3" style={{ gridTemplateColumns: draft.template === 'RESTAURANT' ? '1fr' : `repeat(${draft.template === 'ELECTRONICS' ? 4 : 2}, minmax(0, 1fr))` }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="border p-2 flex flex-col gap-1.5" style={{ borderColor: `${colors.textColor}33`, borderRadius: radius }}>
            <div className="h-12" style={{ background: `${colors.textColor}14`, borderRadius: Math.min(radius, 8) }} />
            <div className="text-[11px] font-bold">Article {n}</div>
            <div className="text-[11px] font-extrabold" style={{ color: colors.accentColor }}>12 000 GNF</div>
            <div className="text-[11px] font-bold text-center py-1" style={{ background: colors.buttonColor, color: readableOn(colors.buttonColor), borderRadius: radius }}>+</div>
          </div>
        ))}
      </div>
    </div>
  )
}
