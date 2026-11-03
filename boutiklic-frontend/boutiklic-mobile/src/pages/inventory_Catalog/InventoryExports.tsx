import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, Switch } from 'react-native'
import { ChevronLeft, Download, Lock } from 'lucide-react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import {
  INVENTORY_EXPORT_FORMATS,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_REPORTS,
  buildInventoryExportQuery,
  inventoryExportFileName,
  inventoryReportDef,
  type InventoryExportFormat,
  type InventoryMovementType,
  type InventoryReportType,
} from '@boutiklic/shared'
import { useAuth } from '../../hooks/useAuth'
import { depotsApi, type DepotResponse } from '../../lib/depotsApi'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { NetworkError, toErrorMessage } from '../../lib/apiClient'
import { getAccessToken, getActiveTenantId } from '../../lib/session'
import SelectField from '../../components/SelectField'
import DateField from '../../components/DateField'

interface InventoryExportsProps {
  onBack: () => void
}

const FORMAT_LABELS: Record<InventoryExportFormat, string> = { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' }

/** Exports d'inventaire (Excel, PDF, CSV) — même contrat que l'écran bureau (@boutiklic/shared, inventoryExports). Le fichier est
 *  généré par le serveur (GET /inventory/export), écrit dans le cache puis proposé à la feuille de partage de l'OS : il faut donc
 *  une connexion. Valorisation et « inclure les prix » exposent des coûts d'achat : le serveur répond 403 sans la permission
 *  financière (le client ne connaît que le rôle, pas les permissions supplémentaires — d'où un cadenas indicatif, pas un blocage). */
export default function InventoryExports({ onBack }: InventoryExportsProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'

  const [type, setType] = useState<InventoryReportType>('general')
  const [format, setFormat] = useState<InventoryExportFormat>('xlsx')
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [depotId, setDepotId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [includePrices, setIncludePrices] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [movementType, setMovementType] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    depotsApi.getAll().then((all) => setDepots(all.filter((d) => d.active))).catch(() => setDepots([]))
    categoriesApi.getAll().then(setCategories).catch(() => setCategories([]))
  }, [])

  const def = inventoryReportDef(type)
  const periodInvalid = def.supportsPeriod && from !== '' && to !== '' && from > to

  const depotOptions = useMemo(
    () => [{ label: t('inventoryExports.allDepots'), value: '' }, ...depots.map((d) => ({ label: d.name, value: d.id }))],
    [depots, t],
  )
  const categoryOptions = useMemo(
    () => [{ label: t('inventoryExports.allCategories'), value: '' }, ...categories.map((c) => ({ label: `${'— '.repeat(c.depth)}${c.name}`, value: c.id }))],
    [categories, t],
  )
  const movementOptions = useMemo(
    () => [
      { label: t('inventoryExports.allMovementTypes'), value: '' },
      ...INVENTORY_MOVEMENT_TYPES.map((m) => ({ label: t(`inventoryExports.movementType.${m}`), value: m })),
    ],
    [t],
  )

  /** Écrit le fichier exporté dans le cache puis ouvre la feuille de partage OS (pas de téléchargement navigateur en RN).
   *  `File.downloadFileAsync` rejette sur un statut HTTP non-2xx sans créer de fichier : un 403 n'est donc jamais partagé. */
  const handleExport = async () => {
    if (exporting || periodInvalid) return
    setExporting(true)
    setError(null)
    try {
      const query = buildInventoryExportQuery({
        type,
        format,
        depotId: depotId || null,
        categoryId: categoryId || null,
        includePrices,
        from: from || null,
        to: to || null,
        movementType: (movementType || null) as InventoryMovementType | null,
      })
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
      const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
      const destination = new File(Paths.cache, inventoryExportFileName(type, format, new Date().toISOString().slice(0, 10)))
      const file = await File.downloadFileAsync(`${apiBase}/inventory/export?${query}`, destination, {
        headers: { Authorization: `Bearer ${token ?? ''}`, 'X-Tenant-ID': tenantId ?? '' },
        idempotent: true,
      })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri)
      }
    } catch (e) {
      setError(exportErrorMessage(e, t))
    } finally {
      setExporting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryExports.title')}</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-8 gap-4">
        <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryExports.subtitle')}</Text>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.reportSection')}</Text>
          {INVENTORY_REPORTS.map((r) => (
            <Pressable
              key={r.type}
              onPress={() => setType(r.type)}
              className={`h-[46px] rounded-xl px-4 flex-row items-center justify-between ${type === r.type ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}
            >
              <Text className={`text-sm ${type === r.type ? 'text-papier font-extrabold' : 'text-[#5C5147] font-semibold'}`}>
                {t(`inventoryExports.report.${r.type}.title`)}
              </Text>
              {r.financial && !isOwner && <Lock size={13} color={type === r.type ? '#FFFDFA' : '#5C5147'} />}
            </Pressable>
          ))}
          <Text className="text-xs font-semibold text-text-dim">{t(`inventoryExports.report.${type}.description`)}</Text>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.formatSection')}</Text>
          <View className="flex-row gap-2">
            {INVENTORY_EXPORT_FORMATS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFormat(f)}
                className={`flex-1 h-[46px] rounded-xl items-center justify-center ${format === f ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
              >
                <Text className={`text-sm ${format === f ? 'text-primary font-extrabold' : 'text-[#5C5147] font-bold'}`}>{FORMAT_LABELS[f]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryExports.filtersSection')}</Text>

          {depots.length > 1 && <SelectField value={depotId} onChange={setDepotId} options={depotOptions} />}
          <SelectField value={categoryId} onChange={setCategoryId} options={categoryOptions} />

          {def.supportsPrices && (
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-sm font-semibold">{t('inventoryExports.includePrices')}</Text>
              <Switch value={includePrices} onValueChange={setIncludePrices} />
            </View>
          )}

          {def.supportsPeriod && (
            <>
              <View className="flex-row gap-2.5">
                <DateField
                  value={from}
                  onChange={setFrom}
                  placeholder={t('inventoryExports.periodFrom')}
                  className="flex-1 h-[44px] rounded-xl border border-border-strong bg-bg-card px-3 justify-center"
                  textClassName="font-semibold"
                />
                <DateField
                  value={to}
                  onChange={setTo}
                  placeholder={t('inventoryExports.periodTo')}
                  className="flex-1 h-[44px] rounded-xl border border-border-strong bg-bg-card px-3 justify-center"
                  textClassName="font-semibold"
                />
              </View>
              <Text className="text-xs font-semibold text-text-dim">{t('inventoryExports.periodHint')}</Text>
              <SelectField value={movementType} onChange={setMovementType} options={movementOptions} />
            </>
          )}
        </View>

        {(def.financial || (def.supportsPrices && includePrices)) && (
          <Text className="text-xs font-semibold text-text-dim">{t('inventoryExports.financialNotice')}</Text>
        )}
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        <Pressable
          onPress={handleExport}
          disabled={exporting || periodInvalid}
          className="h-[52px] rounded-xl bg-primary flex-row items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download size={16} color="#FFFDFA" />
          <Text className="text-papier text-sm font-extrabold">{exporting ? '…' : t('inventoryExports.download')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

/** `downloadFileAsync` rejette avec un message contenant le statut HTTP (`UnableToDownload`, ex. « … 403 ») : on le traduit. */
function exportErrorMessage(e: unknown, t: (key: string) => string): string {
  if (e instanceof NetworkError) return t('inventoryExports.needsConnection')
  const message = e instanceof Error ? e.message : ''
  if (/\b403\b/.test(message)) return t('inventoryExports.forbidden')
  if (/\b(401|5\d\d|4\d\d)\b/.test(message)) return toErrorMessage(e)
  return t('inventoryExports.needsConnection')
}
