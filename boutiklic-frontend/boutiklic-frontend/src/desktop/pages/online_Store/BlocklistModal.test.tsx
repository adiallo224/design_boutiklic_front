// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, string>) => (options?.value ? `${key}:${options.value}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
vi.mock('../../../lib/onlineOrdersApi', () => ({ onlineOrdersApi: { blocklist: vi.fn(), unblock: vi.fn() } }))

import { onlineOrdersApi, type BlocklistEntry } from '../../../lib/onlineOrdersApi'
import BlocklistModal from './BlocklistModal'

const api = onlineOrdersApi as unknown as Record<'blocklist' | 'unblock', ReturnType<typeof vi.fn>>
const entry = (id: string, o: Partial<BlocklistEntry> = {}): BlocklistEntry => ({ id, kind: 'PHONE', value: `+22462000000${id}`, reason: null, createdBy: 'u1', createdAt: '2026-10-20T10:00:00Z', ...o })

beforeEach(() => {
  api.blocklist.mockResolvedValue([entry('1', { reason: 'Faux ordres' }), entry('2', { kind: 'IP_HASH', value: 'a1b2c3' })])
  api.unblock.mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('BlocklistModal', () => {
  it("ne charge rien tant que la fenêtre est fermée", () => {
    render(<BlocklistModal open={false} onClose={vi.fn()} />)

    expect(api.blocklist).not.toHaveBeenCalled()
  })

  it("liste les téléphones, et ne montre JAMAIS l'empreinte d'une connexion", async () => {
    render(<BlocklistModal open onClose={vi.fn()} />)

    expect(await screen.findByText('+224620000001')).toBeTruthy()
    expect(screen.getByText(/Faux ordres/)).toBeTruthy()
    expect(screen.getByText('onlineOrders.blocklist.connection')).toBeTruthy()
    expect(screen.queryByText('a1b2c3')).toBeNull()
  })

  it("débloquer retire la ligne après confirmation", async () => {
    render(<BlocklistModal open onClose={vi.fn()} />)
    await screen.findByText('+224620000001')

    fireEvent.click(screen.getAllByRole('button', { name: 'onlineOrders.blocklist.unblock' })[0])

    await waitFor(() => expect(api.unblock).toHaveBeenCalledWith('1'))
    await waitFor(() => expect(screen.queryByText('+224620000001')).toBeNull())
    expect(screen.getByText('onlineOrders.blocklist.connection')).toBeTruthy()
  })

  it("sans confirmation, rien n'est débloqué", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<BlocklistModal open onClose={vi.fn()} />)
    await screen.findByText('+224620000001')

    fireEvent.click(screen.getAllByRole('button', { name: 'onlineOrders.blocklist.unblock' })[0])

    expect(api.unblock).not.toHaveBeenCalled()
    expect(screen.getByText('+224620000001')).toBeTruthy()
  })

  it("un échec garde la ligne et affiche l'erreur", async () => {
    api.unblock.mockRejectedValue(new Error('Accès refusé'))
    render(<BlocklistModal open onClose={vi.fn()} />)
    await screen.findByText('+224620000001')

    fireEvent.click(screen.getAllByRole('button', { name: 'onlineOrders.blocklist.unblock' })[0])

    expect(await screen.findByText('Accès refusé')).toBeTruthy()
    expect(screen.getByText('+224620000001')).toBeTruthy()
  })

  it("liste vide: message dédié", async () => {
    api.blocklist.mockResolvedValue([])
    render(<BlocklistModal open onClose={vi.fn()} />)

    expect(await screen.findByText('onlineOrders.blocklist.empty')).toBeTruthy()
  })
})
