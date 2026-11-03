import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  MAX_PROFILE_NAME_LENGTH,
  buildProfileFromForm,
  dpiOptions,
  emptyFormValues,
  formValuesForConnection,
  formValuesForKind,
  formValuesForPreset,
  formValuesFromProfile,
  formatOptions,
  isSupportedLocale,
  parseNetworkTarget,
  type CustomLayoutFields,
  type PrintConnection,
  type PrinterKind,
  type PrintProfile,
  type ProfileFormValues,
} from '@boutiklic/shared'
import { printTestPage } from '../../../lib/printTest'
import { isRawPrintAvailable, listSystemPrinters, rawPrintErrorMessage } from '../../../lib/rawPrint'
import { printSettingsActions } from '../../../lib/printSettingsStore'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface PrintProfileModalDesktopProps {
  open: boolean
  /** null = nouvelle imprimante. */
  profile: PrintProfile | null
  onClose: () => void
  onSaved?: (profile: PrintProfile) => void
}

/** Création / édition d'un profil d'impression (imprimante A4 ou thermique) — cf. étude étiquettes §3.3.
 *  La logique du formulaire (champs texte → profil valide) vit dans @boutiklic/shared (`profileForm.ts`, la même
 *  que sur mobile) : le profil est re-validé par `sanitizeProfile`, donc ce qu'on enregistre est toujours
 *  relisible. La page d'essai s'imprime AVANT d'enregistrer, pour caler le décalage sans tâtonner sur de vraies
 *  planches. */
export default function PrintProfileModalDesktop({ open, profile, onClose, onSaved }: PrintProfileModalDesktopProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  const [values, setValues] = useState<ProfileFormValues>(emptyFormValues)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])
  const [printersError, setPrintersError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setError(null)
    setValues(profile ? formValuesFromProfile(profile) : emptyFormValues())
  }, [open, profile])

  /** Profil construit depuis le formulaire (nom compris ou non), ou null si les dimensions sont invalides. */
  const draft = useMemo(
    () =>
      buildProfileFromForm(values, {
        id: profile?.id ?? 'draft',
        fallbackName: t('labels.defaultProfileName'),
      }),
    [values, profile, t],
  )
  const candidate = values.name.trim() === '' ? null : draft

  const rawAvailable = isRawPrintAvailable()
  const isThermal = values.kind === 'THERMAL_ROLL'
  const wantsDirect = isThermal && values.connection !== 'SYSTEM_DIALOG'
  /** Envoi direct demandé mais cible absente/invalide : `sanitizeProfile` le ramènerait au dialogue système. */
  const targetInvalid = wantsDirect && draft !== null && draft.connection === 'SYSTEM_DIALOG'
  const networkTarget = values.connection === 'NETWORK' ? parseNetworkTarget(values.device) : null

  const refreshPrinters = () => {
    setPrintersError(null)
    listSystemPrinters()
      .then(setPrinters)
      .catch((e) => setPrintersError(rawPrintErrorMessage(e)))
  }
  useEffect(() => {
    if (open && rawAvailable && wantsDirect && values.connection === 'USB_RAW') refreshPrinters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rawAvailable, wantsDirect, values.connection])

  const nameMissing = touched && values.name.trim() === ''
  const layoutInvalid = draft === null

  const handleSave = () => {
    setTouched(true)
    if (!candidate || targetInvalid) return
    const toSave: PrintProfile = { ...candidate, id: profile?.id ?? printSettingsActions.newProfileId() }
    if (!printSettingsActions.saveProfile(toSave)) {
      setError(t('labels.editor.invalidLayout'))
      return
    }
    onSaved?.(toSave)
    onClose()
  }

  const handleTestPage = async () => {
    if (!draft) return
    setError(null)
    setTesting(true)
    try {
      await printTestPage(draft, { sampleName: t('labels.test.sampleName'), title: t('labels.test.title'), locale })
    } catch (e) {
      setError(t(wantsDirect && rawAvailable ? 'labels.print.directError' : 'labels.print.error', { error: rawPrintErrorMessage(e) }))
    } finally {
      setTesting(false)
    }
  }

  const options = formatOptions(t, values.kind, true)
  const isCustom = values.presetId === 'custom'
  const setField = (key: keyof CustomLayoutFields) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, custom: { ...prev.custom, [key]: e.target.value } }))

  const numberInput = (label: string, value: string, onChange: (e: ChangeEvent<HTMLInputElement>) => void) => (
    <Input label={label} value={value} onChange={onChange} inputMode="decimal" />
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      title={profile ? t('labels.editor.editTitle') : t('labels.editor.newTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={handleTestPage} loading={testing} disabled={!draft || targetInvalid} className="mr-auto">
            {t('labels.profiles.testPage')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('labels.editor.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={layoutInvalid || targetInvalid}>
            {t('labels.editor.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Input
          label={t('labels.editor.name')}
          value={values.name}
          onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
          onBlur={() => setTouched(true)}
          placeholder={t('labels.editor.namePlaceholder') ?? ''}
          maxLength={MAX_PROFILE_NAME_LENGTH}
          error={nameMissing ? t('labels.editor.nameRequired') : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.editor.kind')}</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('labels.editor.kind') ?? undefined}>
            {(['SHEET_A4', 'THERMAL_ROLL'] as PrinterKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={values.kind === k}
                onClick={() => setValues((prev) => formValuesForKind(prev, k))}
                className={`h-11 rounded-xl border text-sm font-bold transition-colors ${
                  values.kind === k ? 'bg-primary text-papier border-primary' : 'bg-bg-card text-text border-border-strong hover:bg-bg-elevated'
                }`}
              >
                {k === 'SHEET_A4' ? t('labels.profiles.kindSheet') : t('labels.profiles.kindThermal')}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.editor.format')}</span>
          <select
            value={values.presetId}
            onChange={(e) => setValues((prev) => formValuesForPreset(prev, e.target.value))}
            className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-text-dim">{options.find((o) => o.id === values.presetId)?.usage}</span>
        </label>

        {isCustom && (
          <fieldset className="rounded-xl border border-border p-4 flex flex-col gap-3.5">
            <legend className="px-2 text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.editor.customTitle')}</legend>
            {values.kind === 'SHEET_A4' ? (
              <div className="grid grid-cols-2 gap-3.5">
                {numberInput(t('labels.editor.columns'), values.custom.columns, setField('columns'))}
                {numberInput(t('labels.editor.rows'), values.custom.rows, setField('rows'))}
                {numberInput(t('labels.editor.cellWidth'), values.custom.cellWidth, setField('cellWidth'))}
                {numberInput(t('labels.editor.cellHeight'), values.custom.cellHeight, setField('cellHeight'))}
                {numberInput(t('labels.editor.marginLeft'), values.custom.marginLeft, setField('marginLeft'))}
                {numberInput(t('labels.editor.marginTop'), values.custom.marginTop, setField('marginTop'))}
                {numberInput(t('labels.editor.gutterX'), values.custom.gutterX, setField('gutterX'))}
                {numberInput(t('labels.editor.gutterY'), values.custom.gutterY, setField('gutterY'))}
                {numberInput(t('labels.editor.padding'), values.custom.padding, setField('padding'))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {numberInput(t('labels.editor.rollWidth'), values.custom.cellWidth, setField('cellWidth'))}
                {numberInput(t('labels.editor.rollHeight'), values.custom.cellHeight, setField('cellHeight'))}
                {numberInput(t('labels.editor.padding'), values.custom.padding, setField('padding'))}
              </div>
            )}
          </fieldset>
        )}

        <div className="grid grid-cols-3 gap-3.5">
          {numberInput(t('labels.editor.offsetX'), values.offsetX, (e) => setValues((prev) => ({ ...prev, offsetX: e.target.value })))}
          {numberInput(t('labels.editor.offsetY'), values.offsetY, (e) => setValues((prev) => ({ ...prev, offsetY: e.target.value })))}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.editor.dpi')}</span>
            <select
              value={values.dpi}
              onChange={(e) => setValues((prev) => ({ ...prev, dpi: Number(e.target.value) }))}
              className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
            >
              {dpiOptions(values.kind, values.dpi).map((value) => (
                <option key={value} value={value}>
                  {value} dpi
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-3 text-xs text-text-dim">{t('labels.editor.offsetHint')}</p>

        {isThermal && (
          <fieldset className="rounded-xl border border-border p-4 flex flex-col gap-3.5">
            <legend className="px-2 text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.direct.title')}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('labels.direct.title') ?? undefined}>
              {(['SYSTEM_DIALOG', 'USB_RAW', 'NETWORK'] as PrintConnection[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={values.connection === c}
                  onClick={() => setValues((prev) => formValuesForConnection(prev, c))}
                  className={`h-11 rounded-xl border text-sm font-bold transition-colors ${
                    values.connection === c ? 'bg-primary text-papier border-primary' : 'bg-bg-card text-text border-border-strong hover:bg-bg-elevated'
                  }`}
                >
                  {t(`labels.direct.connection.${c}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-dim">{t(`labels.direct.connectionHint.${values.connection}`)}</p>

            {wantsDirect && !rawAvailable && (
              <div className="rounded-xl bg-alerte-bg px-4 py-3 text-[13px] font-semibold text-alerte-text">{t('labels.direct.desktopOnly')}</div>
            )}

            {wantsDirect && (
              <>
                <div className="grid grid-cols-2 gap-3.5">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.direct.language')}</span>
                    <select
                      value={values.language}
                      onChange={(e) => setValues((prev) => ({ ...prev, language: e.target.value as ProfileFormValues['language'] }))}
                      className="h-11 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
                    >
                      <option value="TSPL">TSPL (TSC, Xprinter…)</option>
                      <option value="ZPL">ZPL (Zebra)</option>
                    </select>
                  </label>
                  {numberInput(t('labels.direct.gap'), values.gap, (e) => setValues((prev) => ({ ...prev, gap: e.target.value })))}
                </div>

                {values.connection === 'USB_RAW' && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{t('labels.direct.printer')}</span>
                    <div className="flex gap-2">
                      <select
                        value={values.device}
                        onChange={(e) => setValues((prev) => ({ ...prev, device: e.target.value }))}
                        className="h-11 min-w-0 flex-1 px-3.5 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
                      >
                        <option value="">{t('labels.direct.choosePrinter')}</option>
                        {values.device !== '' && !printers.includes(values.device) && <option value={values.device}>{values.device}</option>}
                        {printers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <Button variant="secondary" onClick={refreshPrinters} disabled={!rawAvailable} className="!h-11 !px-3.5">
                        {t('labels.direct.refresh')}
                      </Button>
                    </div>
                    {printersError && <span className="text-xs font-semibold text-danger">{printersError}</span>}
                    {rawAvailable && !printersError && printers.length === 0 && <span className="text-xs text-text-dim">{t('labels.direct.noPrinter')}</span>}
                  </label>
                )}

                {values.connection === 'NETWORK' && (
                  <Input
                    label={t('labels.direct.address')}
                    value={values.device}
                    onChange={(e) => setValues((prev) => ({ ...prev, device: e.target.value }))}
                    placeholder="192.168.1.50:9100"
                    error={values.device.trim() !== '' && !networkTarget ? t('labels.direct.addressInvalid') : undefined}
                  />
                )}
                <p className="text-xs text-text-dim">{t('labels.direct.gapHint')}</p>
              </>
            )}
          </fieldset>
        )}

        {layoutInvalid && <div className="text-[13px] font-semibold text-danger">{t('labels.editor.invalidLayout')}</div>}
        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </Modal>
  )
}
