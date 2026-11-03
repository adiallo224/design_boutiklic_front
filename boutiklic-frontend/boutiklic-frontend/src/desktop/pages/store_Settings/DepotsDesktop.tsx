import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, Check, Plus, Sparkles, Warehouse } from 'lucide-react'
import { depotsApi, type DepotResponse } from '../../../lib/depotsApi'
import { toErrorMessage } from '../../../lib/apiClient'
import Button from '../../components/Button'
import Input from '../../components/Input'
import Modal from '../../components/Modal'

/** Phase 2 de l'étude study/etude_multi_depots_transferts.md — gestion des dépôts d'une boutique
 *  (créer/renommer/désactiver). Pas de sélecteur de dépôt sur les écrans stock existants (C1/C2/C5)
 *  dans cet incrément : les endpoints d'ajustement/arrivage restent résolus au dépôt par défaut côté
 *  serveur (cf. étude §2.2) — mélanger un écran de gestion additif avec un changement de comportement
 *  sur des flux qui touchent la caisse aurait été plus risqué que nécessaire pour cet incrément ;
 *  le sélecteur suit dans un incrément séparé une fois ceci vérifié en usage réel. */
export default function DepotsDesktop({ isOwner, multiDepotEnabled }: { isOwner: boolean; multiDepotEnabled: boolean }) {
  const { t } = useTranslation()
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  const [renaming, setRenaming] = useState<DepotResponse | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    depotsApi.getAll().then(setDepots).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
  }, [])

  useEffect(load, [load])

  const handleCreate = async () => {
    if (newName.trim().length === 0 || savingNew) return
    setSavingNew(true)
    setError(null)
    try {
      await depotsApi.create({ name: newName.trim() })
      setCreating(false)
      setNewName('')
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSavingNew(false)
    }
  }

  const openRename = (depot: DepotResponse) => {
    setRenaming(depot)
    setRenameValue(depot.name)
    setError(null)
  }

  const handleRename = async () => {
    if (!renaming || renameValue.trim().length === 0 || savingRename) return
    setSavingRename(true)
    setError(null)
    try {
      await depotsApi.rename(renaming.id, { name: renameValue.trim() })
      setRenaming(null)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSavingRename(false)
    }
  }

  const handleDeactivate = async (depot: DepotResponse) => {
    setDeactivatingId(depot.id)
    setError(null)
    try {
      await depotsApi.deactivate(depot.id)
      await load()
    } catch (e) {
      // Message serveur explicite si le dépôt contient encore du stock (INVENTORY_003, cf.
      // DepotCommandService.deactivate) — affiché tel quel, pas besoin de le reformuler ici.
      setError(toErrorMessage(e))
    } finally {
      setDeactivatingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">{t('settings.depotsTitle')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('settings.depotsSubtitle')}</p>
        </div>
        {isOwner && multiDepotEnabled && (
          <Button variant="accent" onClick={() => setCreating(true)} className="inline-flex items-center justify-center gap-2">
            <Plus size={16} />
            {t('settings.addDepot')}
          </Button>
        )}
      </section>

      {isOwner && !multiDepotEnabled && (
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-bg-elevated/60 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-text">{t('settings.multiDepotUpsellTitle')}</p>
              <p className="text-sm text-text-muted mt-0.5">{t('settings.multiDepotUpsellMessage')}</p>
            </div>
          </div>
          <Button variant="secondary" className="flex-shrink-0" disabled>
            {t('settings.contactSalesCta')}
          </Button>
        </section>
      )}

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      <section className="bg-bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm font-semibold text-text-dim">{t('common.loading')}</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold tracking-wider uppercase text-text-muted bg-bg-elevated/60 border-b border-border-hairline">
                <th className="py-3.5 px-6">{t('settings.depotNameLabel')}</th>
                <th className="py-3.5 px-6 text-center">{t('settings.depotStatusLabel')}</th>
                {isOwner && <th className="py-3.5 px-6 text-right">{t('inventoryCatalog.actionColumn')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline text-sm">
              {depots.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 3 : 2} className="py-10 px-6 text-center text-text-dim">
                    {t('settings.depotsEmptyState')}
                  </td>
                </tr>
              )}
              {depots.map((d) => (
                <tr key={d.id}>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center text-text-muted flex-shrink-0">
                        <Warehouse size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-text break-words">{d.name}</p>
                        {d.isDefault && <p className="text-xs text-text-muted mt-0.5">{t('settings.defaultDepotBadge')}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {d.active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-succes-bg text-succes-text text-xs font-medium">
                        <Check size={14} className="stroke-[2.5]" />
                        {t('settings.depotActiveStatus')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-bg-elevated text-text-dim text-xs font-semibold">
                        {t('settings.depotInactiveStatus')}
                      </span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="py-4 px-6 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openRename(d)}
                          className="px-2.5 py-1.5 rounded-lg border border-border-strong text-xs font-bold text-text hover:bg-bg-elevated transition-colors"
                        >
                          {t('settings.renameDepotCta')}
                        </button>
                        {!d.isDefault && d.active && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(d)}
                            disabled={deactivatingId === d.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border-strong text-xs font-bold text-danger hover:bg-bg-elevated transition-colors disabled:opacity-50"
                          >
                            <Ban size={12} />
                            {t('settings.deactivateDepotCta')}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} width={440} title={t('settings.newDepotModalTitle')}>
        <div className="flex flex-col gap-3">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('settings.depotNamePlaceholder')} autoFocus />
          <Button onClick={handleCreate} disabled={newName.trim().length === 0 || savingNew} loading={savingNew}>
            {t('inventoryCatalog.create')}
          </Button>
        </div>
      </Modal>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} width={440} title={t('settings.renameDepotModalTitle')}>
        <div className="flex flex-col gap-3">
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder={t('settings.depotNamePlaceholder')} autoFocus />
          <Button onClick={handleRename} disabled={renameValue.trim().length === 0 || savingRename} loading={savingRename}>
            {t('settings.saveChanges')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
