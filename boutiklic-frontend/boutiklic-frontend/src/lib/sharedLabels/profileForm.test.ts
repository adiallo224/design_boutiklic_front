import { describe, expect, it } from 'vitest'
import { gridLayout, labelsPerPage } from '@boutiklic/shared/src/labels/layouts'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'
import {
  buildProfileFromForm,
  emptyFormValues,
  fieldsFromLayout,
  formValuesForConnection,
  formValuesForKind,
  formValuesForPreset,
  formValuesFromProfile,
  layoutFromFields,
  parseDecimal,
} from '@boutiklic/shared/src/labels/profileForm'

const options = { id: 'p1', fallbackName: 'A4' }

describe('parseDecimal', () => {
  it('accepte la virgule et le point', () => {
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal('0')).toBe(0)
    expect(parseDecimal('-2')).toBe(-2)
  })

  it('NaN si non numérique', () => {
    expect(parseDecimal('')).toBeNaN()
    expect(parseDecimal('abc')).toBeNaN()
  })
})

describe('valeurs initiales', () => {
  it('nouvelle imprimante : A4, 24 par page, 300 dpi, décalage 0', () => {
    const values = emptyFormValues()
    expect(values).toMatchObject({ name: '', kind: 'SHEET_A4', presetId: 'small-24', offsetX: '0', offsetY: '0', dpi: 300 })
    const profile = buildProfileFromForm({ ...values, name: 'Rayon' }, options)!
    expect(labelsPerPage(profile.layout)).toBe(24)
  })

  it('reprend fidèlement un profil existant', () => {
    const existing = { ...createPrintProfile({ id: 'x', name: 'Caisse', kind: 'THERMAL_ROLL', presetId: 'roll-40x30' }), offsetXMm: 1.5, offsetYMm: -2, dpi: 300 }
    expect(formValuesFromProfile(existing)).toMatchObject({ name: 'Caisse', kind: 'THERMAL_ROLL', presetId: 'roll-40x30', offsetX: '1.5', offsetY: '-2', dpi: 300 })
  })
})

describe('changement de type / de format', () => {
  it('changer de type repart des défauts de ce type (préréglage, dpi, grille)', () => {
    const thermal = formValuesForKind(emptyFormValues(), 'THERMAL_ROLL')
    expect(thermal).toMatchObject({ kind: 'THERMAL_ROLL', presetId: 'roll-50x30', dpi: 203 })
    expect(thermal.custom.cellWidth).toBe('50')
    const back = formValuesForKind(thermal, 'SHEET_A4')
    expect(back).toMatchObject({ kind: 'SHEET_A4', presetId: 'small-24', dpi: 300 })
  })

  it('« même type » est sans effet (aucune perte de saisie)', () => {
    const values = { ...emptyFormValues(), name: 'Garde-moi', offsetX: '3' }
    expect(formValuesForKind(values, 'SHEET_A4')).toBe(values)
  })

  it('passer en personnalisé préremplit avec les dimensions du format courant', () => {
    const custom = formValuesForPreset({ ...emptyFormValues(), presetId: 'a6' }, 'custom')
    expect(custom.presetId).toBe('custom')
    expect(custom.custom).toMatchObject({ columns: '2', rows: '2', cellWidth: '105', cellHeight: '148.5' })
  })

  it('rester en personnalisé conserve les champs déjà saisis', () => {
    const edited = { ...emptyFormValues(), presetId: 'custom', custom: { ...fieldsFromLayout(gridLayout(3, 8)), cellWidth: '61' } }
    expect(formValuesForPreset(edited, 'custom').custom.cellWidth).toBe('61')
  })

  it('choisir un préréglage ordinaire ne touche pas aux champs personnalisés', () => {
    const values = emptyFormValues()
    expect(formValuesForPreset(values, 'a5')).toEqual({ ...values, presetId: 'a5' })
  })
})

describe('buildProfileFromForm', () => {
  it('construit un profil valide depuis un préréglage', () => {
    const profile = buildProfileFromForm({ ...emptyFormValues(), name: '  Rayon A4  ', presetId: 'a6', offsetX: '1,5', offsetY: '-2' }, options)!
    expect(profile).toMatchObject({ id: 'p1', name: 'Rayon A4', kind: 'SHEET_A4', presetId: 'a6', offsetXMm: 1.5, offsetYMm: -2 })
    expect(labelsPerPage(profile.layout)).toBe(4)
  })

  it('nom vide → nom de secours (page d’essai)', () => {
    expect(buildProfileFromForm(emptyFormValues(), options)!.name).toBe('A4')
  })

  it('tronque le nom trop long', () => {
    expect(buildProfileFromForm({ ...emptyFormValues(), name: 'N'.repeat(200) }, options)!.name).toHaveLength(40)
  })

  it('décalage non numérique → null', () => {
    expect(buildProfileFromForm({ ...emptyFormValues(), offsetX: 'beaucoup' }, options)).toBeNull()
    expect(buildProfileFromForm({ ...emptyFormValues(), offsetY: '' }, options)).toBeNull()
  })

  it('format A4 personnalisé valide (planche avec marges et gouttières)', () => {
    const custom = { columns: '3', rows: '8', cellWidth: '63.5', cellHeight: '33.9', marginLeft: '7.25', marginTop: '13.1', gutterX: '2.5', gutterY: '0', padding: '3' }
    const profile = buildProfileFromForm({ ...emptyFormValues(), presetId: 'custom', custom }, options)!
    expect(profile.presetId).toBe('custom')
    expect(profile.layout).toMatchObject({ columns: 3, rows: 8, cellWidthMm: 63.5, marginLeftMm: 7.25, gutterXMm: 2.5 })
  })

  it.each([
    ['ne tient pas dans la largeur', { cellWidth: '80' }],
    ['colonnes non entières', { columns: '2.5' }],
    ['dimension nulle', { cellHeight: '0' }],
    ['champ vide', { padding: '' }],
    ['champ texte', { marginTop: 'abc' }],
  ])('format personnalisé invalide : %s → null', (_label, patch) => {
    const custom = { ...fieldsFromLayout(gridLayout(3, 8)), ...patch }
    expect(buildProfileFromForm({ ...emptyFormValues(), presetId: 'custom', custom }, options)).toBeNull()
  })

  it('rouleau personnalisé', () => {
    const base = formValuesForKind(emptyFormValues(), 'THERMAL_ROLL')
    const values = { ...base, presetId: 'custom', custom: { ...base.custom, cellWidth: '58', cellHeight: '40' } }
    const profile = buildProfileFromForm(values, options)!
    expect(profile.layout).toMatchObject({ pageWidthMm: 58, pageHeightMm: 40, columns: 1, rows: 1 })
  })

  describe('envoi direct (imprimante thermique)', () => {
    const thermal = () => formValuesForKind(emptyFormValues(), 'THERMAL_ROLL')

    it('USB : imprimante Windows + langage TSPL/ZPL', () => {
      const profile = buildProfileFromForm({ ...thermal(), connection: 'USB_RAW', language: 'TSPL', device: 'TSC TE200' }, options)!
      expect(profile).toMatchObject({ connection: 'USB_RAW', language: 'TSPL', deviceId: 'TSC TE200', gapMm: 2 })
    })

    it('réseau : « hôte » ou « hôte:port » valides seulement', () => {
      const values = { ...thermal(), connection: 'NETWORK' as const, language: 'ZPL' as const }
      expect(buildProfileFromForm({ ...values, device: '192.168.1.50' }, options)).toMatchObject({ connection: 'NETWORK', deviceId: '192.168.1.50' })
      expect(buildProfileFromForm({ ...values, device: 'imprimante.local:9101' }, options)).toMatchObject({ connection: 'NETWORK', deviceId: 'imprimante.local:9101' })
      // cible invalide → retombe sur le dialogue système plutôt que d'enregistrer un profil qui échouera
      expect(buildProfileFromForm({ ...values, device: 'http://x/y' }, options)).toMatchObject({ connection: 'SYSTEM_DIALOG', language: 'HTML', deviceId: null })
      expect(buildProfileFromForm({ ...values, device: '' }, options)).toMatchObject({ connection: 'SYSTEM_DIALOG' })
    })

    it('un envoi direct sans langage d’imprimante (HTML) retombe sur le dialogue système', () => {
      expect(buildProfileFromForm({ ...thermal(), connection: 'USB_RAW', language: 'HTML', device: 'TSC' }, options)).toMatchObject({ connection: 'SYSTEM_DIALOG', language: 'HTML' })
    })

    it('une planche A4 ne peut jamais être en envoi direct', () => {
      expect(buildProfileFromForm({ ...emptyFormValues(), connection: 'USB_RAW', language: 'TSPL', device: 'TSC' }, options)).toMatchObject({ connection: 'SYSTEM_DIALOG', deviceId: null })
    })

    it('changer de type d’imprimante remet le dialogue système', () => {
      const direct = { ...thermal(), connection: 'USB_RAW' as const, language: 'TSPL' as const, device: 'TSC' }
      expect(formValuesForKind(direct, 'SHEET_A4')).toMatchObject({ connection: 'SYSTEM_DIALOG', language: 'HTML', device: '' })
    })

    it('changer de mode d’envoi : langage TSPL par défaut, cible vidée, dialogue système = retour au HTML', () => {
      const usb = formValuesForConnection(thermal(), 'USB_RAW')
      expect(usb).toMatchObject({ connection: 'USB_RAW', language: 'TSPL', device: '' })
      const zpl = { ...usb, language: 'ZPL' as const, device: 'TSC' }
      // passer d'USB à réseau garde le langage choisi mais pas la cible (un nom d'imprimante n'est pas une adresse)
      expect(formValuesForConnection(zpl, 'NETWORK')).toMatchObject({ connection: 'NETWORK', language: 'ZPL', device: '' })
      expect(formValuesForConnection(zpl, 'SYSTEM_DIALOG')).toMatchObject({ connection: 'SYSTEM_DIALOG', language: 'HTML', device: '' })
      expect(formValuesForConnection(emptyFormValues(), 'USB_RAW')).toMatchObject({ connection: 'SYSTEM_DIALOG', language: 'HTML' })
      expect(formValuesForConnection(zpl, 'USB_RAW')).toBe(zpl)
    })

    it('intervalle entre étiquettes : saisi en texte, borné, invalide → null', () => {
      expect(buildProfileFromForm({ ...thermal(), gap: '3,5' }, options)).toMatchObject({ gapMm: 3.5 })
      expect(buildProfileFromForm({ ...thermal(), gap: '99' }, options)).toMatchObject({ gapMm: 10 })
      expect(buildProfileFromForm({ ...thermal(), gap: 'x' }, options)).toBeNull()
    })

    it('aller-retour profil direct → formulaire → profil', () => {
      const original = createPrintProfile({ id: 'd', name: 'Caisse', kind: 'THERMAL_ROLL', connection: 'NETWORK', language: 'ZPL', deviceId: '10.0.0.7:9100', gapMm: 3 })
      expect(buildProfileFromForm(formValuesFromProfile(original), { id: 'd', fallbackName: 'x' })).toEqual({ ...original, deviceId: '10.0.0.7:9100' })
    })
  })

  it('aller-retour profil → formulaire → profil', () => {
    const original = { ...createPrintProfile({ id: 'r', name: 'Rayon', kind: 'SHEET_A4', presetId: 'std-10' }), offsetXMm: 0.5, offsetYMm: 1 }
    expect(buildProfileFromForm(formValuesFromProfile(original), { id: 'r', fallbackName: 'x' })).toEqual(original)
  })

  it('layoutFromFields ne lève jamais : champs invalides → grille invalide (NaN), rejetée ensuite par sanitize', () => {
    expect(() => layoutFromFields('SHEET_A4', { ...fieldsFromLayout(gridLayout(3, 8)), cellWidth: 'x' })).not.toThrow()
  })
})
