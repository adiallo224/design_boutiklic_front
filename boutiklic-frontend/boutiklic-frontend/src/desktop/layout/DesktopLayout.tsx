import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import UpdateBanner from '../components/UpdateBanner'
import type { TopBarConfig } from './TopBar'
import { useDesktopShortcuts } from '../hooks/useDesktopShortcuts'

export interface DesktopOutletContext {
  setTopBar: (config: TopBarConfig) => void
}

/** Grille sidebar + (topbar + contenu routé). Le contenu de la TopBar est publié par chaque
 *  écran via l'outlet context (voir useTopBar) plutôt qu'un Context React dédié. */
export default function DesktopLayout() {
  const [topBar, setTopBarState] = useState<TopBarConfig>({})
  const setTopBar = useCallback((config: TopBarConfig) => setTopBarState(config), [])
  useDesktopShortcuts()

  return (
    <div className="h-dvh grid overflow-hidden" style={{ gridTemplateColumns: 'auto 1fr' }}>
      <Sidebar />
      <div className="flex flex-col min-w-0 min-h-0">
        <UpdateBanner />
        <TopBar config={topBar} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Outlet context={{ setTopBar } satisfies DesktopOutletContext} />
        </div>
      </div>
    </div>
  )
}
