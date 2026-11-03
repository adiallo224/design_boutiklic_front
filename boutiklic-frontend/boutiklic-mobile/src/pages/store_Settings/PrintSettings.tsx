import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { Check, ChevronLeft, Pencil, Plus, Printer, Trash2 } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, buildTestDocument, formatMm, isSupportedLocale, perPageLabel, presetLabel, type PrintProfile } from '@boutiklic/shared'
import { toErrorMessage } from '../../lib/apiClient'
import { printLabelsDocument } from '../../lib/printLabels'
import { printSettingsActions, usePrintSettings } from '../../lib/printSettingsStore'
import PrintProfileEditor from './PrintProfileEditor'

interface PrintSettingsProps {
  onBack: () => void
}

/** Écran « Imprimantes » : les profils d'impression (A4 / thermique) de CET appareil — cf. étude étiquettes §3.3.
 *  Réglages locaux, jamais envoyés au serveur. Ouvert depuis Réglages et depuis l'écran Étiquettes. */
export default function PrintSettings({ onBack }: PrintSettingsProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const settings = usePrintSettings()

  /** `undefined` = liste ; `null` = nouvelle imprimante ; sinon profil édité. */
  const [editing, setEditing] = useState<PrintProfile | null | undefined>(undefined)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTestPage = async (profile: PrintProfile) => {
    setError(null)
    setTestingId(profile.id)
    try {
      const doc = buildTestDocument(profile, { sampleName: t('labels.test.sampleName'), title: t('labels.test.title'), locale })
      await printLabelsDocument(doc.html, profile.layout)
    } catch (e) {
      setError(t('labels.print.error', { error: toErrorMessage(e) }))
    } finally {
      setTestingId(null)
    }
  }

  if (editing !== undefined) return <PrintProfileEditor profile={editing} onBack={() => setEditing(undefined)} />

  const only = settings.profiles.length <= 1

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{t('labels.profiles.title')}</Text>
        <Pressable onPress={() => setEditing(null)} className="h-10 px-3.5 rounded-xl bg-primary flex-row items-center gap-1.5">
          <Plus size={16} color="#FFFDFA" />
          <Text className="text-papier text-[13px] font-extrabold">{t('labels.profiles.add')}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}>
        <Text className="text-sm leading-relaxed text-text-muted">{t('labels.profiles.intro')}</Text>

        {settings.profiles.map((profile) => {
          const isActive = profile.id === settings.activeProfileId
          const offsets = profile.offsetXMm !== 0 || profile.offsetYMm !== 0
          return (
            <View key={profile.id} className={`bg-bg-card rounded-2xl border p-4 gap-3 ${isActive ? 'border-primary' : 'border-border'}`}>
              <View className="gap-1">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-base font-extrabold" numberOfLines={1}>{profile.name}</Text>
                  {isActive && (
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-succes-bg">
                      <Check size={12} color="#1F5C43" />
                      <Text className="text-xs font-bold text-succes-text">{t('labels.profiles.isDefault')}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm text-text-muted">{profile.kind === 'SHEET_A4' ? t('labels.profiles.kindSheet') : t('labels.profiles.kindThermal')}</Text>
                <Text className="text-sm text-text-muted">
                  {profile.presetId === 'custom'
                    ? `${t('labels.presets.custom')} — ${formatMm(profile.layout.cellWidthMm)} × ${formatMm(profile.layout.cellHeightMm)} mm`
                    : presetLabel(t, profile.presetId)}
                  {' · '}
                  {perPageLabel(t, profile.layout)}
                </Text>
                <Text className="text-xs text-text-dim">
                  {profile.dpi} dpi · {t('labels.profiles.connectionSystem')}
                  {offsets ? ` · ${t('labels.editor.offsetX')} ${formatMm(profile.offsetXMm)}, ${t('labels.editor.offsetY')} ${formatMm(profile.offsetYMm)}` : ''}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {!isActive && (
                  <Pressable onPress={() => printSettingsActions.setActive(profile.id)} className="h-9 px-3 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
                    <Text className="text-[13px] font-bold">{t('labels.profiles.setDefault')}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => handleTestPage(profile)}
                  disabled={testingId === profile.id}
                  className="h-9 px-3 rounded-xl border border-border-strong bg-bg-card flex-row items-center gap-1.5 disabled:opacity-50"
                >
                  <Printer size={14} color="#111418" />
                  <Text className="text-[13px] font-bold">{testingId === profile.id ? '…' : t('labels.profiles.testPage')}</Text>
                </Pressable>
                <Pressable onPress={() => setEditing(profile)} className="h-9 px-3 rounded-xl border border-border-strong bg-bg-card flex-row items-center gap-1.5">
                  <Pencil size={14} color="#111418" />
                  <Text className="text-[13px] font-bold">{t('labels.profiles.edit')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDeleteId(profile.id)}
                  disabled={only}
                  accessibilityLabel={t('labels.profiles.delete')}
                  className="h-9 w-9 rounded-xl items-center justify-center disabled:opacity-30"
                >
                  <Trash2 size={16} color="#C6362F" />
                </Pressable>
              </View>

              {only && <Text className="text-xs text-text-dim">{t('labels.profiles.keepOne')}</Text>}

              {confirmDeleteId === profile.id && !only && (
                <View className="rounded-xl bg-alerte-bg p-3 gap-2.5">
                  <Text className="text-sm font-semibold text-alerte-text">{t('labels.profiles.deleteConfirm', { name: profile.name })}</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => {
                        printSettingsActions.deleteProfile(profile.id)
                        setConfirmDeleteId(null)
                      }}
                      className="flex-1 h-10 rounded-xl bg-danger items-center justify-center"
                    >
                      <Text className="text-papier text-[13px] font-extrabold">{t('labels.profiles.delete')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setConfirmDeleteId(null)} className="flex-1 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
                      <Text className="text-[13px] font-bold">{t('labels.editor.cancel')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )
        })}

        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        <View className="p-3.5 rounded-2xl bg-info-bg border border-info-border gap-2">
          <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('labels.profiles.testHint')}</Text>
          <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('labels.profiles.connectionNote')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}
