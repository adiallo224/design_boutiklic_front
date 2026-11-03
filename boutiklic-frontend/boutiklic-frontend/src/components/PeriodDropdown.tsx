import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  const isCustomReady = customFrom !== '' && customTo !== ''

  const PERIOD_OPTIONS: { id: Period; label: string }[] = [
    { id: 'today', label: t('components.period.today') },
    { id: 'week', label: t('components.period.week') },
    { id: 'month', label: t('components.period.month') },
    { id: 'custom', label: t('components.period.custom') },
  ]

  const buttonLabel =
    period === 'today' ? t('components.period.today') :
    period === 'week' ? t('components.period.thisWeek') :
    period === 'month' ? t('components.period.thisMonth') :
    isCustomReady ? `${fmtShort(customFrom)} - ${fmtShort(customTo)}` : t('components.period.custom')

  const selectPeriod = (p: Period) => {
    onPeriodChange(p)
    if (p !== 'custom') setMenuOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="h-10 px-3.5 rounded-[13px] bg-bg-card border border-border-strong flex items-center gap-2"
      >
        <div className="text-sm font-bold">{buttonLabel}</div>
        <ChevronDown size={16} className={`text-text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-12 z-20 w-[220px] rounded-[16px] bg-bg-card border border-border-strong shadow-lg p-2 flex flex-col gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => selectPeriod(opt.id)}
                className={`h-10 px-3 rounded-[10px] text-left text-sm font-semibold ${
                  period === opt.id ? 'bg-primary text-papier font-extrabold' : 'text-[#5C5147]'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {period === 'custom' && (
              <div className="flex flex-col gap-1.5 pt-1.5 mt-1 border-t border-dashed border-[#DDD2C3]">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => onCustomFromChange(e.target.value)}
                  className="h-9 rounded-lg border border-border-strong bg-bg px-2.5 text-sm font-semibold outline-none focus:border-primary"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => onCustomToChange(e.target.value)}
                  className="h-9 rounded-lg border border-border-strong bg-bg px-2.5 text-sm font-semibold outline-none focus:border-primary"
                />
                {isCustomReady && (
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="h-9 rounded-lg bg-primary text-papier text-sm font-extrabold"
                  >
                    {t('components.confirm')}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
