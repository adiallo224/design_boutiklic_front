import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_LOCALE,
  MAX_PROFILE_NAME_LENGTH,
  buildProfileFromForm,
  buildTestDocument,
  dpiOptions,
  emptyFormValues,
  formValuesForKind,
  formValuesForPreset,
  formValuesFromProfile,
  formatOptions,
  isSupportedLocale,
  type CustomLayoutFields,
  type PrinterKind,
  type PrintProfile,
  type ProfileFormValues,
} from '@boutiklic/shared'
import SelectField from '../../components/SelectField'
import { toErrorMessage } from '../../lib/apiClient'
import { printLabelsDocument } from '../../lib/printLabels'
import { printSettingsActions } from '../../lib/printSettingsStore'

interface PrintProfileEditorProps {
  /** null = nouvelle imprimante. */
  profile: PrintProfile | null
  onBack: () => void
}

const inputClass = 'h-[54px] rounded-xl border border-border-strong bg-bg px-4 font-semibold'

function Field({ label, value, onChangeText, keyboardType = 'decimal-pad', error, maxLength }: {
  label: string
  value: string
  onChangeText: (value: string) => void
  keyboardType?: 'default' | 'decimal-pad'
  error?: string
  maxLength?: number
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-xs font-extrabold tracking-widest text-text-dim">{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className={`${inputClass} ${error ? 'border-danger' : ''}`}
      />
      {error && <Text className="text-xs font-semibold text-danger">{error}</Text>}
    </View>
  )
}

/** Création / édition d'un profil d'impression (imprimante A4 ou thermique) — cf. étude étiquettes §3.3.
 *  La logique du formulaire (champs texte → profil valide) vit dans @boutiklic/shared (`profileForm.ts`, la même
 *  que sur le web) : le profil est re-validé par `sanitizeProfile`, donc ce qu'on enregistre est toujours
 *  relisible. La page d'essai s'imprime AVANT d'enregistrer, pour caler le décalage sans tâtonner sur de vraies
 *  planches. */
export default function PrintProfileEditor({ profile, onBack }: PrintProfileEditorProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  const [values, setValues] = useState<ProfileFormValues>(() => (profile ? formValuesFromProfile(profile) : emptyFormValues()))
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setValues(profile ? formValuesFromProfile(profile) : emptyFormValues())
    setTouched(false)
    setError(null)
  }, [profile])

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
  const nameMissing = touched && values.name.trim() === ''
  const layoutInvalid = draft === null

  const handleSave = () => {
    setTouched(true)
    if (!candidate) return
    const toSave: PrintProfile = { ...candidate, id: profile?.id ?? printSettingsActions.newProfileId() }
    if (!printSettingsActions.saveProfile(toSave)) {
      setError(t('labels.editor.invalidLayout'))
      return
    }
    onBack()
  }

  const handleTestPage = async () => {
    if (!draft) return
    setError(null)
    setTesting(true)
    try {
      const doc = buildTestDocument(draft, { sampleName: t('labels.test.sampleName'), title: t('labels.test.title'), locale })
      await printLabelsDocument(doc.html, draft.layout)
    } catch (e) {
      setError(t('labels.print.error', { error: toErrorMessage(e) }))
    } finally {
      setTesting(false)
    }
  }

  const options = formatOptions(t, values.kind, true)
  const setField = (key: keyof CustomLayoutFields) => (text: string) => setValues((prev) => ({ ...prev, custom: { ...prev.custom, [key]: text } }))

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{profile ? t('labels.editor.editTitle') : t('labels.editor.newTitle')}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-4">
          <Field
            label={t('labels.editor.name')}
            value={values.name}
            onChangeText={(text) => setValues((prev) => ({ ...prev, name: text }))}
            keyboardType="default"
            maxLength={MAX_PROFILE_NAME_LENGTH}
            error={nameMissing ? t('labels.editor.nameRequired') : undefined}
          />

          <View className="gap-1.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('labels.editor.kind').toUpperCase()}</Text>
            <View className="flex-row gap-2">
              {(['SHEET_A4', 'THERMAL_ROLL'] as PrinterKind[]).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setValues((prev) => formValuesForKind(prev, k))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: values.kind === k }}
                  className={`flex-1 min-h-[48px] px-2 rounded-xl border items-center justify-center ${values.kind === k ? 'bg-primary border-primary' : 'bg-bg-card border-border-strong'}`}
                >
                  <Text className={`text-[13px] font-bold text-center ${values.kind === k ? 'text-papier' : 'text-text'}`}>
                    {k === 'SHEET_A4' ? t('labels.profiles.kindSheet') : t('labels.profiles.kindThermal')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('labels.editor.format').toUpperCase()}</Text>
            <SelectField
              value={values.presetId}
              onChange={(presetId) => setValues((prev) => formValuesForPreset(prev, presetId))}
              options={options.map((o) => ({ label: o.label, value: o.id }))}
            />
            <Text className="text-xs text-text-dim">{options.find((o) => o.id === values.presetId)?.usage}</Text>
          </View>
        </View>

        {values.presetId === 'custom' && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-4">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('labels.editor.customTitle').toUpperCase()}</Text>
            {values.kind === 'SHEET_A4' ? (
              <>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.columns')} value={values.custom.columns} onChangeText={setField('columns')} />
                  <Field label={t('labels.editor.rows')} value={values.custom.rows} onChangeText={setField('rows')} />
                </View>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.cellWidth')} value={values.custom.cellWidth} onChangeText={setField('cellWidth')} />
                  <Field label={t('labels.editor.cellHeight')} value={values.custom.cellHeight} onChangeText={setField('cellHeight')} />
                </View>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.marginLeft')} value={values.custom.marginLeft} onChangeText={setField('marginLeft')} />
                  <Field label={t('labels.editor.marginTop')} value={values.custom.marginTop} onChangeText={setField('marginTop')} />
                </View>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.gutterX')} value={values.custom.gutterX} onChangeText={setField('gutterX')} />
                  <Field label={t('labels.editor.gutterY')} value={values.custom.gutterY} onChangeText={setField('gutterY')} />
                </View>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.padding')} value={values.custom.padding} onChangeText={setField('padding')} />
                </View>
              </>
            ) : (
              <>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.rollWidth')} value={values.custom.cellWidth} onChangeText={setField('cellWidth')} />
                  <Field label={t('labels.editor.rollHeight')} value={values.custom.cellHeight} onChangeText={setField('cellHeight')} />
                </View>
                <View className="flex-row gap-3">
                  <Field label={t('labels.editor.padding')} value={values.custom.padding} onChangeText={setField('padding')} />
                </View>
              </>
            )}
          </View>
        )}

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-3">
          <View className="flex-row gap-3">
            <Field label={t('labels.editor.offsetX')} value={values.offsetX} onChangeText={(text) => setValues((prev) => ({ ...prev, offsetX: text }))} />
            <Field label={t('labels.editor.offsetY')} value={values.offsetY} onChangeText={(text) => setValues((prev) => ({ ...prev, offsetY: text }))} />
          </View>
          <Text className="text-xs text-text-dim">{t('labels.editor.offsetHint')}</Text>
          <View className="gap-1.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('labels.editor.dpi').toUpperCase()}</Text>
            <SelectField
              value={String(values.dpi)}
              onChange={(dpi) => setValues((prev) => ({ ...prev, dpi: Number(dpi) }))}
              options={dpiOptions(values.kind, values.dpi).map((dpi) => ({ label: `${dpi} dpi`, value: String(dpi) }))}
            />
          </View>
        </View>

        {layoutInvalid && <Text className="text-[13px] font-semibold text-danger text-center">{t('labels.editor.invalidLayout')}</Text>}
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}

        <View className="gap-3">
          <Pressable onPress={handleSave} disabled={layoutInvalid} className="w-full bg-primary py-4 rounded-2xl items-center disabled:opacity-50">
            <Text className="text-papier font-extrabold">{t('labels.editor.save')}</Text>
          </Pressable>
          <Pressable onPress={handleTestPage} disabled={!draft || testing} className="w-full bg-bg-card border border-border-strong py-4 rounded-2xl items-center disabled:opacity-50">
            <Text className="font-extrabold">{testing ? '…' : t('labels.profiles.testPage')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
