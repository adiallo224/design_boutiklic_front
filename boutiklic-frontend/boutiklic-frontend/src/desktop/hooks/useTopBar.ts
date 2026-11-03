import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { DesktopOutletContext } from '../layout/DesktopLayout'
import type { TopBarConfig } from '../layout/TopBar'

/** Publie le contenu de la TopBar (titre/recherche/action) pour l'écran monté. `deps` doit
 *  lister des valeurs primitives (pas l'objet `config`, recréé à chaque rendu) pour éviter une
 *  boucle de mise à jour — même idiome que useOutbox.ts (exhaustive-deps volontairement
 *  désactivé). */
export function useTopBar(config: TopBarConfig, deps: unknown[] = []) {
  const { setTopBar } = useOutletContext<DesktopOutletContext>()
  useEffect(() => {
    setTopBar(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
