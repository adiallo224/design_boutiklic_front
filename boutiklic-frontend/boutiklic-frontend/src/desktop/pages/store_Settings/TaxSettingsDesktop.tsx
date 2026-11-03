import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES } from '@boutiklic/shared'
import { authApi } from '../../../lib/authApi'
import type { Tenant } from '../../../hooks/useTenant'
import { taxApi, type CountryRates, type TaxCategoryResponse } from '../../../lib/taxApi'
import { formatTaxRate } from '../../../lib/taxInheritance'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import Input from '../../components/Input'

interface TaxSettingsDesktopProps {
  tenant: Tenant
  /** Recharge la boutique après un changement (l'interrupteur et le défaut vivent sur le tenant). */
  onChanged: () => void
}

/**
 * Fiscalité de la boutique (propriétaire) : interrupteur TVA, taux disponibles et taux par défaut — dernier étage de la
 * cascade article > catégorie > boutique. Les prix de vente sont TTC : la TVA est extraite du prix, elle ne s'y ajoute pas.
 * Chaque action s'enregistre aussitôt (indépendamment du bouton « Enregistrer » du reste des réglages).
 */
export default function TaxSettingsDesktop({ tenant, onChanged }: TaxSettingsDesktopProps) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<TaxCategoryResponse[]>([])
  const [countryRates, setCountryRates] = useState<CountryRates | null>(null)
  const [defaultId, setDefaultId] = useState(tenant.defaultTaxCategoryId ?? '')
  const [newName, setNewName] = useState('')
  const [newRate, setNewRate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRate, setEditingRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [loadedCategories, loadedRates] = await Promise.all([taxApi.getActiveCategories(), taxApi.getCountryRates()])
      setCategories(loadedCategories)
      setCountryRates(loadedRates)
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }, [])
  // Le pays pilote les taux officiels proposés : on relit quand il change.
  useEffect(() => { load() }, [load, tenant.country])
  // Le tenant arrive vide au premier rendu puis se remplit : on réaligne le défaut affiché.
  useEffect(() => { setDefaultId(tenant.defaultTaxCategoryId ?? '') }, [tenant.defaultTaxCategoryId])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      onChanged()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const parsedRate = (raw: string) => {
    const value = Number(raw.replace(',', '.'))
    return raw.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
  }
  const newRateValue = parsedRate(newRate)
  const editingRateValue = parsedRate(editingRate)

  const changeCountry = (country: string) => country && run(() => authApi.changeCountry(tenant.id, country))
  const importRate = (code: string) => run(() => taxApi.importCountryRate(code))
  const followOfficial = (id: string) => run(() => taxApi.followOfficialRate(id))

  const toggle = () => run(() => taxApi.configure(!tenant.taxEnabled, defaultId || undefined))
  const changeDefault = (id: string) => {
    setDefaultId(id)
    // Activée : le nouveau défaut s'applique tout de suite. Désactivée : il est retenu pour l'activation.
    if (tenant.taxEnabled && id) run(() => taxApi.configure(true, id))
  }
  const addRate = async () => {
    if (newRateValue === null || newName.trim() === '') return
    await run(async () => {
      const created = await taxApi.create({ name: newName.trim(), ratePercent: newRateValue })
      if (!defaultId) setDefaultId(created.id)
    })
    setNewName('')
    setNewRate('')
  }
  const saveRate = async (id: string) => {
    if (editingRateValue === null) return
    await run(() => taxApi.changeRate(id, editingRateValue))
    setEditingId(null)
  }

  const canEnable = categories.length > 0 && (defaultId !== '' || tenant.taxEnabled)

  return (
    <section className="bg-bg-card rounded-2xl border border-border p-6 md:p-7 shadow-sm">
      <h2 className="text-base font-bold text-text mb-2">{t('settings.taxTitle')}</h2>
      <p className="text-xs text-text-muted mb-5 leading-relaxed bg-bg-elevated/50 p-3 rounded-xl border border-border/60">{t('settings.taxHint')}</p>

      <div className="flex flex-col gap-5">
        <label className="flex items-start sm:items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-text">{t('settings.taxEnabledLabel')}</span>
            <span className="text-xs text-text-muted">{tenant.taxEnabled ? t('settings.taxEnabledOn') : t('settings.taxEnabledOff')}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={tenant.taxEnabled}
            disabled={busy || (!tenant.taxEnabled && !canEnable)}
            onChange={toggle}
            className="h-5 w-5 accent-primary"
          />
        </label>
        {!tenant.taxEnabled && !canEnable && <p className="text-xs text-text-muted -mt-3">{t('settings.taxNeedRate')}</p>}
        <p className="text-xs text-text-muted leading-relaxed -mt-3">{t('settings.taxZeroHint')}</p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.taxCountryLabel')}</span>
          <select
            value={tenant.country ?? ''}
            disabled={busy}
            onChange={(e) => changeCountry(e.target.value)}
            className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-medium outline-none focus:border-primary max-w-[420px]"
          >
            {!tenant.country && <option value="">{t('settings.taxCountryPlaceholder')}</option>}
            {tenant.country && !COUNTRIES.some((c) => c.id === tenant.country) && <option value={tenant.country}>{tenant.country}</option>}
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-text-muted leading-relaxed">{t('settings.taxCountryHelp')}</p>
        </div>

        {countryRates && countryRates.rates.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.taxOfficialTitle')}</span>
            <div className="border border-border rounded-xl overflow-hidden">
              {countryRates.rates.map((r) => (
                <div key={r.code} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-border-hairline last:border-b-0">
                  <span className="flex-1 min-w-[120px] text-sm font-semibold break-words">{r.name}</span>
                  <span className="text-sm tabular-nums text-text-secondary">{formatTaxRate(r.ratePercent)} %</span>
                  {r.imported ? (
                    <span className="text-xs font-bold text-success">{t('settings.taxOfficialAdopted')}</span>
                  ) : (
                    <Button onClick={() => importRate(r.code)} disabled={busy}>{t('settings.taxOfficialAdopt')}</Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">{t('settings.taxOfficialHelp')}</p>
          </div>
        )}
        {countryRates && countryRates.country && countryRates.rates.length === 0 && (
          <p className="text-xs text-text-muted leading-relaxed">{t('settings.taxOfficialNone')}</p>
        )}

        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.taxDefaultLabel')}</span>
            <select
              value={defaultId}
              disabled={busy}
              onChange={(e) => changeDefault(e.target.value)}
              className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 font-medium outline-none focus:border-primary max-w-[420px]"
            >
              {defaultId === '' && <option value="">{t('settings.taxDefaultPlaceholder')}</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{t('inventoryCatalog.taxRateOption', { name: c.name, rate: formatTaxRate(c.ratePercent) })}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted leading-relaxed">{t('settings.taxDefaultHelp')}</p>
          </div>
        )}

        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.taxRatesTitle')}</span>
            <div className="border border-border rounded-xl overflow-hidden">
              {categories.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-border-hairline last:border-b-0">
                  <span className="flex-1 min-w-[120px] flex items-center gap-2 text-sm font-semibold break-words">
                    {c.name}
                    {c.officialRateCode && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${c.followsOfficialRate ? 'bg-info-bg text-primary' : 'bg-bg-elevated text-text-muted'}`}>
                        {c.followsOfficialRate ? t('settings.taxBadgeOfficial') : t('settings.taxBadgeCustom')}
                      </span>
                    )}
                  </span>
                  {editingId === c.id ? (
                    <>
                      <input
                        value={editingRate}
                        onChange={(e) => setEditingRate(e.target.value)}
                        inputMode="decimal"
                        autoFocus
                        aria-label={t('settings.taxRateLabel')}
                        className="h-9 w-24 rounded-[9px] border border-border bg-bg px-2.5 text-[13px] outline-none focus:border-primary"
                      />
                      <span className="text-[13px] text-text-muted">%</span>
                      <Button onClick={() => saveRate(c.id)} disabled={busy || editingRateValue === null}>{t('settings.taxSaveRate')}</Button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs font-bold text-text-dim hover:text-text">{t('inventoryCatalog.cancel')}</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm tabular-nums text-text-secondary">{formatTaxRate(c.ratePercent)} %</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setEditingId(c.id); setEditingRate(c.ratePercent === null ? '' : String(c.ratePercent)) }}
                        className="text-xs font-bold text-info-text hover:opacity-80"
                      >
                        {t('settings.taxChangeRate')}
                      </button>
                      {c.officialRateCode && !c.followsOfficialRate && (
                        <button type="button" disabled={busy} onClick={() => followOfficial(c.id)} className="text-xs font-bold text-info-text hover:opacity-80">
                          {t('settings.taxBackToOfficial')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">{t('settings.taxChangeRateHelp')}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text uppercase tracking-wide">{t('settings.taxAddTitle')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3 items-end">
            <Input label={t('settings.taxNameLabel')} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('settings.taxNamePlaceholder') ?? ''} maxLength={100} />
            <Input label={t('settings.taxRateLabel')} value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="18" inputMode="decimal" />
            <Button onClick={addRate} disabled={busy || newRateValue === null || newName.trim() === ''}>{t('settings.taxAddButton')}</Button>
          </div>
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}
      </div>
    </section>
  )
}
