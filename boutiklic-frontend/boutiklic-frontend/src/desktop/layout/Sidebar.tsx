import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, LogOut, PanelLeft, Store } from 'lucide-react'
import { NAV_ITEMS, SHOP_SWITCH_PATH, MY_PROFILE_PATH, visibleNavItems } from './navConfig'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useTenant } from '../../hooks/useTenant'
import { notifyAuthChanged } from '../../hooks/useAuth'
import { userApi, type CurrentUserResponse } from '../../lib/userApi'
import { authApi } from '../../lib/authApi'
import { getDeviceId } from '../../lib/device'
import { clearSession } from '../../lib/session'
import { getRoleLabel } from '../pages/store_Settings/TeamRolesDesktop'

const COLLAPSE_KEY = 'boutiklic_sidebar_collapsed'
/** En dessous de cette largeur de fenêtre, la sidebar se réduit automatiquement (icônes seules) —
 *  ne change jamais l'UI affichée (cf. useIsDesktop.ts : reste toujours la même UI bureau), juste
 *  le confort d'affichage sur une fenêtre étroite. */
const NARROW_WINDOW_QUERY = '(max-width: 1280px)'

/** Barre latérale bureau — 252px ↔ 88px, état manuel persisté (règle de traduction n°1) combiné à
 *  un repli automatique si la fenêtre devient étroite (`isNarrow`, non persisté) : la préférence
 *  manuelle de l'utilisateur reste intacte dans localStorage, seul l'affichage se replie tant que
 *  la fenêtre est étroite, et revient à cette préférence une fois la fenêtre réagrandie. Le
 *  sélecteur de boutique ouvre W6 et réutilise useTenant() (source unique du switch, pas de
 *  dropdown dupliqué ici). Carte profil + déconnexion en bas : même mécanique que le bouton
 *  "Déconnexion" de DesktopSettings.tsx (revokeDevice + clearSession + redirection /login), pas
 *  une seconde implémentation. */
export default function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { tenant } = useTenant()
  const entitlements = useEntitlements()
  const [manualCollapsed, setManualCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_WINDOW_QUERY).matches)
  const collapsed = manualCollapsed || isNarrow
  const [me, setMe] = useState<CurrentUserResponse | null>(null)
  // Le menu ne montre que ce que le rôle ET l'offre permettent (cf. visibleNavItems).
  const navItems = visibleNavItems(NAV_ITEMS, { role: me?.role, has: entitlements.has })
  const [loggingOut, setLoggingOut] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  /** Sidebar réduite = plus de sous-menu déplié inline (pas la place) : un survol affiche les
   *  enfants dans un volet flottant à droite de l'icône, positionné en `fixed` (calculé depuis le
   *  rectangle de l'item survolé) pour ne pas être rogné par le `overflow-y-auto` de la nav. */
  const [flyoutItemId, setFlyoutItemId] = useState<string | null>(null)
  const [flyoutTop, setFlyoutTop] = useState(0)
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Un trajet de souris en diagonale (icône → un élément bas du volet) traverse forcément une
   *  zone qui n'appartient ni à l'icône (rangée ~44px) ni encore au volet (plus haut que ça) —
   *  fermer au premier `mouseleave` couperait le volet avant que la souris ne l'atteigne. Un
   *  court délai annulable laisse le temps d'y arriver, cf. les menus à survol classiques. */
  const openFlyout = useCallback((id: string, top?: number) => {
    if (flyoutCloseTimer.current) {
      clearTimeout(flyoutCloseTimer.current)
      flyoutCloseTimer.current = null
    }
    if (top !== undefined) setFlyoutTop(top)
    setFlyoutItemId(id)
  }, [])

  const scheduleCloseFlyout = useCallback((id: string) => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current)
    flyoutCloseTimer.current = setTimeout(() => {
      setFlyoutItemId((current) => (current === id ? null : current))
    }, 250)
  }, [])

  useEffect(() => () => { if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current) }, [])

  useEffect(() => {
    userApi.getMe().then(setMe).catch(() => undefined)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia(NARROW_WINDOW_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authApi.revokeDevice(getDeviceId())
    } catch {
      // best-effort
    }
    clearSession()
    notifyAuthChanged()
    navigate('/login')
  }

  const toggleCollapsed = useCallback(() => {
    setManualCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  return (
    <aside
      className="desktop-sidebar h-dvh flex flex-col bg-primary text-papier shrink-0 transition-[width] duration-150"
      style={{ width: collapsed ? 88 : 252 }}
    >
      <div className={`h-[74px] flex items-center justify-between shrink-0 border-b border-white/10 ${collapsed ? 'px-3' : 'px-5'}`}>
        <span className="font-display text-lg font-extrabold truncate">{collapsed ? 'BC' : 'BOUTIKLIC'}</span>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex-none p-1.5 rounded-lg text-ink-300 hover:bg-white/10 hover:text-papier"
          title={t(collapsed ? 'desktopShell.sidebar.expand' : 'desktopShell.sidebar.collapse')}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate(SHOP_SWITCH_PATH)}
        className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-white/10 hover:bg-white/15 text-left"
        title={t('desktopShell.sidebar.switchShop')}
      >
        <Store size={18} className="shrink-0 text-ink-300" />
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 truncate text-sm font-bold">{tenant.name || '—'}</span>
            <ChevronRight size={16} className="text-ink-300 shrink-0" />
          </>
        )}
      </button>

      <nav className="flex-1 min-h-0 overflow-y-auto mt-4 px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const hasChildren = !!item.children?.length
          const matchesPath = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`)
          const onChildRoute = hasChildren && item.children!.some((c) => matchesPath(c.path))
          // Un sous-menu peut pointer vers une route techniquement imbriquée sous un AUTRE item
          // (ex. "Nouvel arrivage" sous Fournisseurs pointe vers /stock/arrivage) : sans cette
          // exclusion, l'item "Stock" se surlignerait aussi par simple préfixe de chemin.
          const claimedByOtherItem = navItems.some(
            (other) => other.id !== item.id && (other.children ?? []).some((c) => matchesPath(c.path)),
          )
          const parentActive = matchesPath(item.path) && !onChildRoute && !claimedByOtherItem
          const expanded = hasChildren && (expandedId === item.id || (expandedId === null && onChildRoute))
          const showFlyout = hasChildren && collapsed && flyoutItemId === item.id
          return (
            <div
              key={item.id}
              className="flex flex-col"
              onMouseEnter={hasChildren && collapsed ? (e) => openFlyout(item.id, e.currentTarget.getBoundingClientRect().top) : undefined}
              onMouseLeave={hasChildren && collapsed ? () => scheduleCloseFlyout(item.id) : undefined}
            >
              <NavLink
                to={item.path}
                onClick={() => { if (hasChildren) setExpandedId(expanded ? '' : item.id) }}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  parentActive ? 'bg-terracotta text-white shadow-[0_6px_16px_-6px_rgba(216,78,42,0.5)]' : 'text-ink-300 hover:bg-white/10'
                }`}
              >
                <Icon size={19} className="shrink-0" />
                {!collapsed && <span className="flex-1 min-w-0 truncate">{t(item.labelKey)}</span>}
                {hasChildren && !collapsed && (
                  <ChevronDown size={15} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                )}
                {hasChildren && collapsed && (
                  <span className="absolute top-1/2 -translate-y-1/2 right-1.5 w-1.5 h-1.5 rounded-full bg-or" />
                )}
              </NavLink>
              {hasChildren && !collapsed && expanded && (
                <div className="flex flex-col gap-1 mt-1 ml-5 pl-3.5 border-l border-white/10">
                  {item.children!.map((child) => (
                    <NavLink
                      key={child.id}
                      to={child.path}
                      className={({ isActive }) =>
                        `rounded-lg px-3 py-2 text-[13px] font-bold transition-colors ${
                          isActive ? 'bg-white/15 text-papier' : 'text-ink-300 hover:bg-white/10 hover:text-papier'
                        }`
                      }
                    >
                      {t(child.labelKey)}
                    </NavLink>
                  ))}
                </div>
              )}
              {showFlyout && (
                <div
                  className="fixed left-[88px] min-w-[200px] p-1.5 rounded-xl bg-primary border border-white/10 shadow-2xl z-50 flex flex-col gap-0.5"
                  style={{ top: flyoutTop }}
                  onMouseEnter={() => openFlyout(item.id)}
                  onMouseLeave={() => scheduleCloseFlyout(item.id)}
                >
                  <NavLink
                    to={item.path}
                    onClick={() => setFlyoutItemId(null)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-colors ${
                      parentActive ? 'bg-terracotta text-white' : 'text-ink-300 hover:bg-white/10 hover:text-papier'
                    }`}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                  {item.children!.map((child) => (
                    <NavLink
                      key={child.id}
                      to={child.path}
                      className={({ isActive }) =>
                        `rounded-lg px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
                          isActive ? 'bg-white/15 text-papier' : 'text-ink-300 hover:bg-white/10 hover:text-papier'
                        }`
                      }
                    >
                      {t(child.labelKey)}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className={`mx-3 mb-1 p-2.5 rounded-xl bg-white/10 flex flex-col gap-2 ${collapsed ? 'items-center' : ''}`}>
        <div className={collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2.5'}>
          <button
            type="button"
            onClick={() => navigate(MY_PROFILE_PATH)}
            title={t('desktopShell.sidebar.myProfile')}
            className={collapsed
              ? 'flex items-center justify-center rounded-lg p-1 hover:bg-white/10'
              : 'flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg -m-1 p-1 hover:bg-white/10'}
          >
            <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center text-papier text-xs font-extrabold overflow-hidden flex-none">
              {me?.avatarUrl ? <img src={me.avatarUrl} alt="" className="w-full h-full object-cover" /> : (me?.displayName ?? '—').slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate leading-tight">{me?.displayName ?? '—'}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-ink-300 truncate">{me ? getRoleLabel(me.role, t).label : ''}</div>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={t('desktopShell.sidebar.logout')}
            className={`text-ink-300 hover:text-papier flex-none disabled:opacity-50 ${collapsed ? 'p-1 rounded-lg hover:bg-white/10' : ''}`}
          >
            <LogOut size={16} />
          </button>
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#6EE7B7] px-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] animate-pulse" />
            {t('desktopShell.sidebar.readyOffline')}
          </div>
        )}
      </div>
    </aside>
  )
}
