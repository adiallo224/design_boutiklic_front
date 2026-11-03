// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }))

const api = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  getAppearance: vi.fn(),
  changeTemplate: vi.fn(),
  updateTheme: vi.fn(),
  updateIdentity: vi.fn(),
  updatePages: vi.fn(),
  updateSocialLinks: vi.fn(),
  updateSeo: vi.fn(),
  getPageContents: vi.fn(),
  savePageContent: vi.fn(),
}))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
vi.mock('../../../lib/storefrontsApi', () => ({ SOCIAL_PLATFORMS: ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'LINKEDIN', 'YOUTUBE'], storefrontsApi: api }))
vi.mock('../../../lib/fileApi', () => ({ fileApi: { upload: vi.fn() } }))

import OnlineStoreAppearanceTab from './OnlineStoreAppearanceTab'

const theme = (primary: string | null) => ({ primaryColor: primary, secondaryColor: null, accentColor: null, buttonColor: null, textColor: null })
const templates = ['FASHION', 'MINIMAL'].map((code) => ({
  code,
  name: code,
  description: `${code} description`,
  defaultTheme: { primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#2563EB', buttonColor: '#111827', textColor: '#111827' },
}))
const pages = (['HOME', 'PRODUCTS', 'PROMOTIONS', 'FAQ'] as const).map((code, position) => ({ code, enabled: code !== 'FAQ', position, mandatory: code === 'HOME' || code === 'PRODUCTS' }))
const appearance = (overrides = {}) => ({
  templateCode: 'MINIMAL',
  description: null,
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  theme: { primaryColor: '#111827', secondaryColor: '#FFFFFF', accentColor: '#2563EB', buttonColor: '#111827', textColor: '#111827' },
  customTheme: theme(null),
  seo: { title: null, description: null, keywords: null, imageUrl: null },
  pages,
  socialLinks: [],
  ...overrides,
})

describe('OnlineStoreAppearanceTab', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.listTemplates.mockResolvedValue(templates)
    api.getAppearance.mockResolvedValue(appearance())
    api.getPageContents.mockResolvedValue({ contents: { FAQ: 'Q1' } })
  })
  afterEach(cleanup)

  const open = async () => {
    render(<OnlineStoreAppearanceTab siteId="s1" siteName="Diallo Store" />)
    await screen.findByRole('radiogroup')
  }

  it('affiche les modèles, le modèle actuel est coché et rien n\'est enregistrable sans changement', async () => {
    await open()
    expect(screen.getByRole('radio', { name: /MINIMAL/ }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByRole('button', { name: 'onlineStore.detail.save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('n\'enregistre que la section modifiée (le modèle)', async () => {
    api.changeTemplate.mockResolvedValue(appearance({ templateCode: 'FASHION' }))
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /FASHION/ }))
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.save' }))
    await waitFor(() => expect(api.changeTemplate).toHaveBeenCalledWith('s1', 'FASHION'))
    expect(api.updateTheme).not.toHaveBeenCalled()
    expect(api.updatePages).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  it('envoie les couleurs choisies, les autres reprennent celles du modèle (null)', async () => {
    api.updateTheme.mockResolvedValue(appearance({ customTheme: theme('#FF0000') }))
    await open()
    fireEvent.change(screen.getByLabelText('onlineStore.appearance.colors.primaryColor'), { target: { value: '#ff0000' } })
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.save' }))
    await waitFor(() => expect(api.updateTheme).toHaveBeenCalledWith('s1', { primaryColor: '#FF0000', secondaryColor: null, accentColor: null, buttonColor: null, textColor: null }))
  })

  it('les pages obligatoires ne se désactivent pas ; réordonner et activer une page est envoyé dans l\'ordre affiché', async () => {
    api.updatePages.mockResolvedValue(appearance())
    await open()
    expect((screen.getByLabelText(/onlineStore.appearance.pages.names.HOME/) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/onlineStore.appearance.pages.names.FAQ/))
    fireEvent.click(screen.getAllByRole('button', { name: 'onlineStore.appearance.pages.moveUp' })[3])
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.save' }))
    await waitFor(() =>
      expect(api.updatePages).toHaveBeenCalledWith('s1', [
        { code: 'HOME', enabled: true },
        { code: 'PRODUCTS', enabled: true },
        { code: 'FAQ', enabled: true },
        { code: 'PROMOTIONS', enabled: true },
      ]),
    )
  })

  it('les liens sociaux vides ne sont pas envoyés', async () => {
    api.updateSocialLinks.mockResolvedValue(appearance())
    await open()
    fireEvent.change(screen.getByLabelText('onlineStore.appearance.social.platforms.INSTAGRAM'), { target: { value: ' https://instagram.com/store ' } })
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.save' }))
    await waitFor(() => expect(api.updateSocialLinks).toHaveBeenCalledWith('s1', [{ platform: 'INSTAGRAM', url: 'https://instagram.com/store' }]))
  })

  it('l\'aperçu suit le modèle choisi et la largeur de l\'appareil', async () => {
    await open()
    expect(screen.getByTestId('appearance-preview').style.width).toBe('100%')
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.appearance.preview.mobile' }))
    expect(screen.getByTestId('appearance-preview').style.width).toBe('360px')
  })

  it('affiche l\'erreur du serveur sans perdre la saisie', async () => {
    api.changeTemplate.mockRejectedValue(new Error('boom'))
    api.getAppearance.mockResolvedValue(appearance())
    await open()
    fireEvent.click(screen.getByRole('radio', { name: /FASHION/ }))
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.save' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /FASHION/ }).getAttribute('aria-checked')).toBe('true')
  })

  describe('rédaction des pages optionnelles', () => {
    it('propose de rédiger seulement les pages optionnelles et indique celles qui le sont déjà', async () => {
      await open()
      expect(screen.getByRole('button', { name: /pages.write/ })).toBeTruthy()
      expect(screen.queryAllByRole('button', { name: /pages\.write/ })).toHaveLength(1)
      expect(screen.getByText('onlineStore.appearance.pages.written')).toBeTruthy()
    })

    it('ouvre le texte existant, l\'enregistre et met l\'indicateur à jour', async () => {
      api.getPageContents.mockResolvedValue({ contents: {} })
      api.savePageContent.mockResolvedValue(undefined)
      await open()
      expect(screen.getByText('onlineStore.appearance.pages.notWritten')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /pages.write/ }))
      const text = (await screen.findByLabelText('onlineStore.appearance.content.label')) as HTMLTextAreaElement
      fireEvent.change(text, { target: { value: 'Q1\n\nR1' } })
      fireEvent.click(screen.getAllByRole('button', { name: 'onlineStore.detail.save' })[0])
      await waitFor(() => expect(api.savePageContent).toHaveBeenCalledWith('s1', 'FAQ', 'Q1\n\nR1'))
      expect(await screen.findByText('onlineStore.appearance.pages.written')).toBeTruthy()
    })

    it('un texte vidé supprime le contenu', async () => {
      api.savePageContent.mockResolvedValue(undefined)
      await open()
      fireEvent.click(screen.getByRole('button', { name: /pages.write/ }))
      const text = (await screen.findByLabelText('onlineStore.appearance.content.label')) as HTMLTextAreaElement
      expect(text.value).toBe('Q1')
      fireEvent.change(text, { target: { value: '  ' } })
      fireEvent.click(screen.getAllByRole('button', { name: 'onlineStore.detail.save' })[0])
      await waitFor(() => expect(api.savePageContent).toHaveBeenCalledWith('s1', 'FAQ', '  '))
      expect(await screen.findByText('onlineStore.appearance.pages.notWritten')).toBeTruthy()
    })

    it('affiche le refus du serveur et garde la fenêtre ouverte', async () => {
      api.savePageContent.mockRejectedValue(new Error('trop long'))
      await open()
      fireEvent.click(screen.getByRole('button', { name: /pages.write/ }))
      const text = (await screen.findByLabelText('onlineStore.appearance.content.label')) as HTMLTextAreaElement
      fireEvent.change(text, { target: { value: 'autre' } })
      fireEvent.click(screen.getAllByRole('button', { name: 'onlineStore.detail.save' })[0])
      expect((await screen.findAllByRole('alert')).some((a) => a.textContent === 'trop long')).toBe(true)
      expect(screen.getByLabelText('onlineStore.appearance.content.label')).toBeTruthy()
    })
  })
})
