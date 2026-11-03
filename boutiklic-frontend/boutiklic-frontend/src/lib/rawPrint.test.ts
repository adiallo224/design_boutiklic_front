import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'
import { buildTestCommands } from '@boutiklic/shared/src/labels/labelCommands'

const core = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => core)

import { isDirectProfile, listSystemPrinters, printTestDirect, rawPrintErrorMessage, sendLabelCommands, willPrintDirectly } from './rawPrint'

const roll = (extra: Partial<Parameters<typeof createPrintProfile>[0]> = {}) =>
  createPrintProfile({ id: 'r', name: 'Caisse', kind: 'THERMAL_ROLL', ...extra })
const usb = roll({ connection: 'USB_RAW', language: 'TSPL', deviceId: 'TSC TE200' })
const network = roll({ connection: 'NETWORK', language: 'ZPL', deviceId: '192.168.1.50:9101' })

beforeEach(() => {
  core.invoke.mockReset()
  core.isTauri.mockReset()
  core.isTauri.mockReturnValue(true)
})

describe('willPrintDirectly', () => {
  it('direct seulement pour un rouleau en envoi direct ET dans l’app bureau', () => {
    expect(willPrintDirectly(usb)).toBe(true)
    core.isTauri.mockReturnValue(false)
    expect(willPrintDirectly(usb)).toBe(false) // navigateur : dialogue système
    expect(isDirectProfile(usb)).toBe(true)
  })

  it('un profil « dialogue système » n’est jamais direct', () => {
    expect(willPrintDirectly(roll())).toBe(false)
    expect(willPrintDirectly(createPrintProfile({ id: 'a', name: 'A4', kind: 'SHEET_A4' }))).toBe(false)
  })
})

describe('sendLabelCommands', () => {
  it('USB : print_raw avec le nom de l’imprimante et les octets exacts de la charge utile', async () => {
    const job = buildTestCommands(usb)
    await sendLabelCommands(usb, job)
    expect(core.invoke).toHaveBeenCalledTimes(1)
    const [command, args] = core.invoke.mock.calls[0]
    expect(command).toBe('print_raw')
    expect(args.printer).toBe('TSC TE200')
    expect(Array.isArray(args.data)).toBe(true)
    expect(String.fromCharCode(...args.data)).toContain('SIZE 50 mm')
    expect(args.data.every((b: number) => Number.isInteger(b) && b >= 0 && b <= 255)).toBe(true)
  })

  it('réseau : send_tcp avec hôte et port séparés (9100 par défaut)', async () => {
    await sendLabelCommands(network, buildTestCommands(network))
    expect(core.invoke.mock.calls[0][0]).toBe('send_tcp')
    expect(core.invoke.mock.calls[0][1]).toMatchObject({ host: '192.168.1.50', port: 9101 })
    const bare = { ...network, deviceId: '10.0.0.7' }
    await sendLabelCommands(bare, buildTestCommands(bare))
    expect(core.invoke.mock.calls[1][1]).toMatchObject({ host: '10.0.0.7', port: 9100 })
  })

  it('hors app bureau : erreur explicite, aucune commande Tauri', async () => {
    core.isTauri.mockReturnValue(false)
    await expect(sendLabelCommands(usb, buildTestCommands(usb))).rejects.toThrow(/application bureau/)
    expect(core.invoke).not.toHaveBeenCalled()
  })

  it('cible manquante ou invalide : erreur, rien n’est envoyé', async () => {
    const job = buildTestCommands(usb)
    await expect(sendLabelCommands({ ...usb, deviceId: null }, job)).rejects.toThrow()
    await expect(sendLabelCommands({ ...network, deviceId: 'http://x/y' }, job)).rejects.toThrow()
    expect(core.invoke).not.toHaveBeenCalled()
  })

  it('l’erreur Rust (chaîne) remonte telle quelle et se lit', async () => {
    core.invoke.mockRejectedValue('Imprimante « TSC » introuvable')
    await expect(printTestDirect(usb)).rejects.toBe('Imprimante « TSC » introuvable')
    expect(rawPrintErrorMessage('Imprimante « TSC » introuvable')).toBe('Imprimante « TSC » introuvable')
    expect(rawPrintErrorMessage(new Error('x'))).toBe('x')
  })
})

describe('listSystemPrinters', () => {
  it('liste vide hors app bureau, sans appel', async () => {
    core.isTauri.mockReturnValue(false)
    expect(await listSystemPrinters()).toEqual([])
    expect(core.invoke).not.toHaveBeenCalled()
  })

  it('app bureau : renvoie la liste de list_printers', async () => {
    core.invoke.mockResolvedValue(['TSC TE200', 'PDF'])
    expect(await listSystemPrinters()).toEqual(['TSC TE200', 'PDF'])
    expect(core.invoke).toHaveBeenCalledWith('list_printers')
  })
})
