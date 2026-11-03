import { useRef, useState } from 'react'
import { View, Text, Pressable, Modal, Dimensions } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import DateField from './DateField'

export type Period = 'today' | 'week' | 'month' | 'custom'

export function fmtLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentWeekRange(): { from: string; to: string } {
  const now = new Date()
  const dow = now.getDay()
  const diffToMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: fmtLocalDate(monday), to: fmtLocalDate(sunday) }
}

export function fmtShort(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

interface PeriodDropdownProps {
  period: Period
  onPeriodChange: (period: Period) => void
  customFrom: string
  customTo: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
}

export default function PeriodDropdown({
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: PeriodDropdownProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<View>(null)
  const isCustomReady = customFrom !== '' && customTo !== ''

  const PERIOD_OPTIONS: { id: Period; label: string }[] = [
    { id: 'today', label: t('components.period.today') },
    { id: 'week', label: t('components.period.week') },
    { id: 'month', label: t('components.period.month') },
    { id: 'custom', label: t('components.period.custom') },
  ]

  /** Le menu est un Modal (rendu hors de l'arbre, au-dessus de tout) — sa position est donc
   *  mesurée par rapport à l'écran au moment de l'ouverture, pas héritée du flux normal. */
  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ top: y + height + 4, right: Dimensions.get('window').width - (x + width) })
      setMenuOpen(true)
    })
  }

  const buttonLabel =
    period === 'today'
      ? t('components.period.today')
      : period === 'week'
        ? t('components.period.thisWeek')
        : period === 'month'
          ? t('components.period.thisMonth')
          : isCustomReady
            ? `${fmtShort(customFrom)} - ${fmtShort(customTo)}`
            : t('components.period.custom')

  const selectPeriod = (p: Period) => {
    onPeriodChange(p)
    if (p !== 'custom') setMenuOpen(false)
  }

  return (
    <View>
      <Pressable
        ref={triggerRef}
        onPress={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        className="h-10 px-3.5 rounded-[13px] bg-bg-card border border-border-strong flex-row items-center gap-2"
      >
        <Text className="text-sm font-bold">{buttonLabel}</Text>
        <ChevronDown size={16} color="#676E7E" style={{ transform: [{ rotate: menuOpen ? '180deg' : '0deg' }] }} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: menuAnchor.top, right: menuAnchor.right }}
            className="w-[220px] rounded-[16px] bg-bg-card border border-border-strong p-2 gap-1"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => selectPeriod(opt.id)}
                className={`h-10 px-3 rounded-[10px] justify-center ${period === opt.id ? 'bg-primary' : ''}`}
              >
                <Text className={`text-sm ${period === opt.id ? 'text-papier font-extrabold' : 'text-[#5C5147] font-semibold'}`}>{opt.label}</Text>
              </Pressable>
            ))}
            {period === 'custom' && (
              <View className="gap-1.5 pt-1.5 mt-1 border-t border-dashed border-[#DDD2C3]">
                <DateField
                  value={customFrom}
                  onChange={onCustomFromChange}
                  placeholder={t('components.period.fromDate')}
                  className="h-9 rounded-lg border border-border-strong bg-bg px-2.5 justify-center"
                />
                <DateField
                  value={customTo}
                  onChange={onCustomToChange}
                  placeholder={t('components.period.toDate')}
                  className="h-9 rounded-lg border border-border-strong bg-bg px-2.5 justify-center"
                />
                {isCustomReady && (
                  <Pressable onPress={() => setMenuOpen(false)} className="h-9 rounded-lg bg-primary items-center justify-center">
                    <Text className="text-papier text-sm font-extrabold">{t('components.confirm')}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
