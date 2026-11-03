import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, UserCheck } from 'lucide-react'
import { customerApi, type CustomerResponse } from '../../lib/customerApi'
import Input from './Input'

interface CustomerPickerProps {
  /** Client actuellement lié (nom affiché en résumé) — null si saisie libre (aucun client choisi). */
  selectedName: string | null
  onSelect: (customer: CustomerResponse) => void
  onClear: () => void
}

/** Sélecteur de client depuis l'annuaire (module customer, doc TVA §7) — utilisé partout où un
 *  `BillingParty`/acheteur se saisit (devis, facture). Ne remplace jamais la saisie libre : c'est
 *  un raccourci de préremplissage, `customerId` reste un simple lien traçable (doc §3.5, décision
 *  actée) — les champs restent modifiables après sélection. */
export default function CustomerPicker({ selectedName, onSelect, onClear }: CustomerPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const timer = setTimeout(() => {
      customerApi
        .search(query || undefined)
        .then(setResults)
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [open, query])

  if (selectedName) {
    return (
      <div className="flex items-center gap-2 px-3.5 min-h-11 py-1 rounded-xl border border-primary bg-info-bg text-sm font-bold">
        <UserCheck size={15} className="text-primary shrink-0" />
        <span className="break-words min-w-0 flex-1">{selectedName}</span>
        <button type="button" onClick={onClear} className="text-text-dim hover:text-danger shrink-0" title={t('customerDirectory.freeEntryCta')}>
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 min-h-9 py-1 px-3 rounded-lg text-left max-w-full border border-dashed border-border-strong text-xs font-bold text-text-muted hover:border-primary hover:text-primary w-fit"
        >
          <Search size={13} /> {t('customerDirectory.chooseExistingCta')}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-border-strong bg-bg">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('customerDirectory.chooseExistingPlaceholder') ?? ''}
            className="h-9"
          />
          <div className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
            {loading ? (
              <div className="text-xs text-text-dim px-2 py-1.5">{t('common.loading')}</div>
            ) : results.length === 0 ? (
              <div className="text-xs text-text-dim px-2 py-1.5">{t('customerDirectory.noMatch')}</div>
            ) : (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="text-left px-2 py-1.5 rounded-lg hover:bg-bg-elevated text-sm"
                >
                  <span className="font-bold break-words">{c.name}</span>
                  {c.phone && <span className="text-text-dim break-all"> · {c.phone}</span>}
                </button>
              ))
            )}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-text-dim hover:text-text self-end">
            {t('customerDirectory.freeEntryCta')}
          </button>
        </div>
      )}
    </div>
  )
}
