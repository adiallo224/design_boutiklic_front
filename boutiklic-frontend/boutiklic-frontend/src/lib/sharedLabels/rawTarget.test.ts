import { describe, expect, it } from 'vitest'
import { DEFAULT_RAW_PORT, formatNetworkTarget, parseNetworkTarget } from '@boutiklic/shared/src/labels/rawTarget'

describe('parseNetworkTarget', () => {
  it('hôte seul → port 9100 par défaut', () => {
    expect(parseNetworkTarget('192.168.1.50')).toEqual({ host: '192.168.1.50', port: DEFAULT_RAW_PORT })
    expect(parseNetworkTarget('imprimante')).toEqual({ host: 'imprimante', port: 9100 })
    expect(parseNetworkTarget('etiq-caisse.local')).toEqual({ host: 'etiq-caisse.local', port: 9100 })
  })

  it('hôte:port', () => {
    expect(parseNetworkTarget('10.0.0.7:9101')).toEqual({ host: '10.0.0.7', port: 9101 })
    expect(parseNetworkTarget('  10.0.0.7:1  ')).toEqual({ host: '10.0.0.7', port: 1 })
    expect(parseNetworkTarget('h:65535')).toEqual({ host: 'h', port: 65535 })
  })

  it.each([
    null,
    undefined,
    '',
    '   ',
    'http://192.168.1.1',
    '192.168.1.1/print',
    '192.168.1.1:0',
    '192.168.1.1:65536',
    '192.168.1.1:abc',
    '192.168.1.1:',
    'a b',
    '-host',
    'host-',
    'host..local',
    '[::1]:9100',
    'x'.repeat(300),
    'host:9100:1',
  ])('cible invalide rejetée : %j', (input) => {
    expect(parseNetworkTarget(input as string | null | undefined)).toBeNull()
  })

  it('formatNetworkTarget est l’inverse (port par défaut omis)', () => {
    expect(formatNetworkTarget({ host: '10.0.0.7', port: 9100 })).toBe('10.0.0.7')
    expect(formatNetworkTarget({ host: '10.0.0.7', port: 9101 })).toBe('10.0.0.7:9101')
    for (const text of ['10.0.0.7', '10.0.0.7:9101', 'printer.local:1234']) {
      expect(formatNetworkTarget(parseNetworkTarget(text)!)).toBe(text)
    }
  })
})
