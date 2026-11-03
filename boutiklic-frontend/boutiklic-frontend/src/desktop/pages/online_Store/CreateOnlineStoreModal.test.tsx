// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, string>) => (options?.hostname ? `${key}:${options.hostname}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../../lib/apiClient', () => {
  class ApiError extends Error {
    status: number
    errorCode?: string
    constructor(message: string, status: number, errorCode?: string) {
      super(message)
      this.status = status
      this.errorCode = errorCode
    }
  }
  return { ApiError, toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }
})
vi.mock('../../../lib/storefrontsApi', () => ({
  STOREFRONT_ERROR: { slugTaken: 'STOREFRONT_003', notIncluded: 'STOREFRONT_004' },
  storefrontsApi: { create: vi.fn(), checkSlug: vi.fn() },
}))

import { ApiError } from '../../../lib/apiClient'
import { storefrontsApi } from '../../../lib/storefrontsApi'
import CreateOnlineStoreModal from './CreateOnlineStoreModal'

const api = storefrontsApi as unknown as Record<'create' | 'checkSlug', ReturnType<typeof vi.fn>>
const onCreated = vi.fn()
const onClose = vi.fn()

const nameInput = () => screen.getByLabelText('onlineStore.create.name') as HTMLInputElement
const slugInput = () => screen.getByLabelText('onlineStore.create.slug') as HTMLInputElement
const submit = () => screen.getByRole('button', { name: 'onlineStore.create.submit' })

function open() {
  return render(<CreateOnlineStoreModal open onClose={onClose} onCreated={onCreated} defaultPhone="+224620000000" />)
}
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  api.checkSlug.mockImplementation(async (slug: string) => ({ slug, available: true, reason: null, hostname: `${slug}.boutiklic.com` }))
  api.create.mockResolvedValue({ id: 'new-site' })
})
afterEach(cleanup)

describe('CreateOnlineStoreModal', () => {
  it("propose l'adresse à partir du nom, tant que l'utilisateur ne l'a pas écrite lui-même", () => {
    open()

    type(nameInput(), 'Chez Mamadou & Fils')
    expect(slugInput().value).toBe('chez-mamadou-fils')

    type(slugInput(), 'mon-adresse')
    type(nameInput(), 'Un autre nom')
    expect(slugInput().value).toBe('mon-adresse')
  })

  it('vérifie la disponibilité après une pause de frappe et affiche le nom d\'hôte obtenu', async () => {
    open()

    type(nameInput(), 'Chez Mamadou')

    expect(await screen.findByText(/onlineStore\.create\.available:chez-mamadou\.boutiklic\.com/)).toBeTruthy()
    expect(api.checkSlug).toHaveBeenCalledTimes(1)
    expect(api.checkSlug).toHaveBeenCalledWith('chez-mamadou')
  })

  it("une adresse invalide est refusée localement, sans interroger le serveur", async () => {
    open()

    // Référence gardée AVANT toute saisie: le message d'erreur s'affiche dans l'étiquette du champ et change son nom accessible.
    const slug = slugInput()
    type(nameInput(), 'X')
    type(slug, 'ab')
    expect(screen.getByText('onlineStore.create.problems.tooShort')).toBeTruthy()
    type(slug, 'ma--boutique')
    expect(screen.getByText('onlineStore.create.problems.hyphens')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 500))

    expect(api.checkSlug).not.toHaveBeenCalled()
    expect(submit()).toHaveProperty('disabled', true)
  })

  it("une adresse déjà prise ou réservée bloque la création et dit pourquoi", async () => {
    api.checkSlug.mockResolvedValue({ slug: 'mamode', available: false, reason: 'TAKEN', hostname: null })
    open()

    type(nameInput(), 'Mamode')

    expect(await screen.findByText('onlineStore.create.reasons.TAKEN')).toBeTruthy()
    expect(submit()).toHaveProperty('disabled', true)
  })

  it("le bouton reste désactivé pendant la vérification, puis s'active", async () => {
    let resolve!: (v: unknown) => void
    api.checkSlug.mockReturnValue(new Promise((r) => (resolve = r)))
    open()

    type(nameInput(), 'Mamode')
    await screen.findByText('onlineStore.create.checking')
    expect(submit()).toHaveProperty('disabled', true)

    resolve({ slug: 'mamode', available: true, reason: null, hostname: 'mamode.boutiklic.com' })
    await waitFor(() => expect(submit()).toHaveProperty('disabled', false))
  })

  it("une réponse tardive d'une saisie périmée est ignorée", async () => {
    const slow: Array<(v: unknown) => void> = []
    api.checkSlug.mockImplementation((slug: string) => new Promise((r) => slow.push(() => r({ slug, available: slug === 'beta', reason: slug === 'beta' ? null : 'TAKEN', hostname: `${slug}.boutiklic.com` }))))
    open()

    type(slugInput(), 'alpha')
    await waitFor(() => expect(api.checkSlug).toHaveBeenCalledTimes(1))
    type(slugInput(), 'beta')
    await waitFor(() => expect(api.checkSlug).toHaveBeenCalledTimes(2))
    slow[1](undefined)
    await screen.findByText(/available:beta\.boutiklic\.com/)
    slow[0](undefined)
    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByText('onlineStore.create.reasons.TAKEN')).toBeNull()
    expect(screen.getByText(/available:beta\.boutiklic\.com/)).toBeTruthy()
  })

  it('envoie exactement ce qui a été saisi, sans champ vide', async () => {
    open()
    type(nameInput(), '  Chez Mamadou  ')
    await screen.findByText(/available/)
    fireEvent.change(screen.getByLabelText('onlineStore.create.whatsapp'), { target: { value: '' } })

    fireEvent.click(submit())

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    expect(api.create).toHaveBeenCalledWith({ slug: 'chez-mamadou', name: 'Chez Mamadou', locale: 'fr', contactPhone: '+224620000000', contactWhatsapp: undefined, contactEmail: undefined })
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'new-site' }))
  })

  it("une offre sans vente en ligne (402) donne un message clair, sans fermer la fenêtre", async () => {
    api.create.mockRejectedValue(new ApiError('Votre offre n’inclut pas...', 402, 'STOREFRONT_004'))
    open()
    type(nameInput(), 'Mamode')
    await screen.findByText(/available/)

    fireEvent.click(submit())

    expect((await screen.findByRole('alert')).textContent).toContain('onlineStore.errors.notIncluded')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it("une adresse prise entre-temps (course) revient à l'état « déjà prise »", async () => {
    api.create.mockRejectedValue(new ApiError('prise', 409, 'STOREFRONT_003'))
    open()
    type(nameInput(), 'Mamode')
    await screen.findByText(/available/)

    fireEvent.click(submit())

    expect(await screen.findByText('onlineStore.create.reasons.TAKEN')).toBeTruthy()
    expect(submit()).toHaveProperty('disabled', true)
  })

  it("l'envoi ne peut pas partir deux fois (double clic)", async () => {
    let resolve!: (v: unknown) => void
    api.create.mockReturnValue(new Promise((r) => (resolve = r)))
    open()
    type(nameInput(), 'Mamode')
    await screen.findByText(/available/)

    // Référence gardée: pendant l'envoi le bouton affiche « … » au lieu de son libellé.
    const button = submit()
    fireEvent.click(button)
    fireEvent.click(button)
    resolve({ id: 'x' })

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(api.create).toHaveBeenCalledTimes(1)
  })

  it('se remet à zéro à chaque ouverture', () => {
    const { rerender } = open()
    type(nameInput(), 'Ancien nom')

    rerender(<CreateOnlineStoreModal open={false} onClose={onClose} onCreated={onCreated} defaultPhone="+224620000000" />)
    rerender(<CreateOnlineStoreModal open onClose={onClose} onCreated={onCreated} defaultPhone="+224620000000" />)

    expect(nameInput().value).toBe('')
    expect(slugInput().value).toBe('')
  })
})
