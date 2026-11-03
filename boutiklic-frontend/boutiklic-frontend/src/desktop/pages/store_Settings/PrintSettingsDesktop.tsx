import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { isSupportedLocale, DEFAULT_LOCALE, type PrintProfile } from '@boutiklic/shared'
import { formatMm, perPageLabel, presetLabel } from '../../../lib/labelFormats'
import { printTestPage } from '../../../lib/printTest'
import { rawPrintErrorMessage, willPrintDirectly } from '../../../lib/rawPrint'
import { printSettingsActions, usePrintSettings } from '../../../lib/printSettingsStore'
import Button from '../../components/Button'
import PrintProfileModalDesktop from './PrintProfileModalDesktop'

/** Onglet « Impression » des Réglages : les imprimantes (profils A4 / thermique) de CET appareil —
 *  cf. étude étiquettes §3.3. Réglages locaux, jamais envoyés au serveur : chaque poste a ses propres
 *  imprimantes. Ouvert depuis la page Étiquettes via /reglages?tab=impression. */
export default function PrintSettingsDesktop() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const settings = usePrintSettings()

  const [editing, setEditing] = useState<PrintProfile | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openEditor = (profile: PrintProfile | null) => {
    setEditing(profile)
    setShowEditor(true)
  }

  const handleTestPage = async (profile: PrintProfile) => {
    setError(null)
    setTestingId(profile.id)
    try {
      await printTestPage(profile, { sampleName: t('labels.test.sampleName'), title: t('labels.test.title'), locale })
    } catch (e) {
      setError(t(willPrintDirectly(profile) ? 'labels.print.directError' : 'labels.print.error', { error: rawPrintErrorMessage(e) }))
    } finally {
      setTestingId(null)
    }
  }

  const only = settings.profiles.length <= 1

  /** « Boîte de dialogue du système » ou « Envoi direct · TSPL · <cible> ». */
  const connectionSummary = (profile: PrintProfile) =>
    profile.connection === 'USB_RAW' || profile.connection === 'NETWORK'
      ? `${t('labels.direct.summary')} · ${profile.language} · ${profile.deviceId ?? ''}`
      : t('labels.profiles.connectionSystem')

  return (
    <section className="max-w-[900px] flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold text-text">{t('labels.profiles.title')}</h2>
          <p className="mt-1.5 text-sm text-text-muted leading-relaxed max-w-xl">{t('labels.profiles.intro')}</p>
        </div>
        <Button variant="accent" onClick={() => openEditor(null)} className="shrink-0 inline-flex items-center gap-2">
          <Plus size={16} />
          {t('labels.profiles.add')}
        </Button>
      </header>

      <ul className="flex flex-col gap-3">
        {settings.profiles.map((profile) => {
          const isActive = profile.id === settings.activeProfileId
          const isConfirming = confirmDeleteId === profile.id
          const offsets = profile.offsetXMm !== 0 || profile.offsetYMm !== 0
          return (
            <li key={profile.id} className={`rounded-2xl border bg-bg-card p-5 flex flex-col gap-3 ${isActive ? 'border-primary' : 'border-border'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold text-text truncate">{profile.name}</h3>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-succes-bg text-succes-text text-xs font-bold">
                        <Check size={12} />
                        {t('labels.profiles.isDefault')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-text-muted">
                    {profile.kind === 'SHEET_A4' ? t('labels.profiles.kindSheet') : t('labels.profiles.kindThermal')}
                  </div>
                  <div className="mt-0.5 text-sm text-text-muted">
                    {profile.presetId === 'custom'
                      ? `${t('labels.presets.custom')} — ${formatMm(profile.layout.cellWidthMm)} × ${formatMm(profile.layout.cellHeightMm)} mm`
                      : presetLabel(t, profile.presetId)}
                    {' · '}
                    {perPageLabel(t, profile.layout)}
                  </div>
                  <div className="mt-0.5 text-xs text-text-dim">
                    {profile.dpi} dpi · {connectionSummary(profile)}
                    {offsets && ` · ${t('labels.editor.offsetX')} ${formatMm(profile.offsetXMm)}, ${t('labels.editor.offsetY')} ${formatMm(profile.offsetYMm)}`}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {!isActive && (
                    <Button variant="secondary" className="!h-9 !px-3.5" onClick={() => printSettingsActions.setActive(profile.id)}>
                      {t('labels.profiles.setDefault')}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="!h-9 !px-3.5 inline-flex items-center gap-1.5"
                    loading={testingId === profile.id}
                    onClick={() => handleTestPage(profile)}
                  >
                    <Printer size={14} />
                    {t('labels.profiles.testPage')}
                  </Button>
                  <Button variant="secondary" className="!h-9 !px-3.5 inline-flex items-center gap-1.5" onClick={() => openEditor(profile)}>
                    <Pencil size={14} />
                    {t('labels.profiles.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!h-9 !px-3 text-danger"
                    disabled={only}
                    title={only ? t('labels.profiles.keepOne') ?? undefined : undefined}
                    aria-label={t('labels.profiles.delete') ?? undefined}
                    onClick={() => setConfirmDeleteId(profile.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>

              {isConfirming && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-alerte-bg px-4 py-3">
                  <span className="text-sm font-semibold text-alerte-text">{t('labels.profiles.deleteConfirm', { name: profile.name })}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="!h-9 !px-3.5"
                      onClick={() => {
                        printSettingsActions.deleteProfile(profile.id)
                        setConfirmDeleteId(null)
                      }}
                    >
                      {t('labels.profiles.delete')}
                    </Button>
                    <Button variant="secondary" className="!h-9 !px-3.5" onClick={() => setConfirmDeleteId(null)}>
                      {t('labels.editor.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <div className="rounded-xl bg-info-bg border border-info-border p-4 text-sm text-info-text leading-relaxed">
        <p>{t('labels.profiles.testHint')}</p>
        <p className="mt-2">{t('labels.profiles.connectionNote')}</p>
      </div>

      <PrintProfileModalDesktop
        open={showEditor}
        profile={editing}
        onClose={() => setShowEditor(false)}
      />
    </section>
  )
}
