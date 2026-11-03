import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PHONE_COUNTRIES } from '@boutiklic/shared'
import FlagIcon from './FlagIcon'

interface CountryCodePickerProps {
  countryId: string
  setCountryId: (id: string) => void
  className?: string
}

/** Sélecteur d'indicatif téléphonique (drapeau + indicatif + liste mondiale filtrable au clic) —
 *  Login/CreateAccount/ForgotPassword (web). Miroir du CountryCodePicker mobile (React Native),
 *  réutilise le même PHONE_COUNTRIES (@boutiklic/shared, liste mondiale) — une recherche est
 *  nécessaire ici vu le nombre de pays (~247) à faire défiler. */
export default function CountryCodePicker({ countryId, setCountryId, className }: CountryCodePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = PHONE_COUNTRIES.find((c) => c.id === countryId) ?? PHONE_COUNTRIES[0]
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? PHONE_COUNTRIES.filter((c) => c.name.toLowerCase().includes(normalizedQuery) || c.dialCode.includes(normalizedQuery))
    : PHONE_COUNTRIES

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5"
      >
        <FlagIcon countryId={selected.id} className="text-xl" />
        <span className="amount text-lg font-bold text-text-muted">{selected.dialCode}</span>
        <ChevronDown size={16} className="text-text-dim" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-[280px] max-h-80 overflow-hidden rounded-2xl border border-border-strong bg-bg-card shadow-lg flex flex-col">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('components.phoneField.searchPlaceholder')}
            className="m-2 h-9 rounded-lg border border-border-strong bg-bg px-3 text-sm font-semibold outline-none focus:border-primary"
          />
          <div className="overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCountryId(c.id)
                  setOpen(false)
                  setQuery('')
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg-elevated"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <FlagIcon countryId={c.id} className="text-xl flex-none" />
                  <span className="font-semibold text-sm truncate">{c.name}</span>
                </span>
                <span className="flex items-center gap-2 flex-none">
                  <span className="amount font-bold text-text-muted text-sm">{c.dialCode}</span>
                  {c.id === selected.id && <Check size={16} className="text-primary" />}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-text-dim">{t('components.phoneField.noResults')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
