import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, ArrowLeft, Lock, ShieldCheck, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLastKnownShop, clearLastKnownShop, type LastKnownShop } from '../../../lib/session'

type ActiveNav = 'login' | 'signup'

interface AuthDesktopShellProps {
  active: ActiveNav
  onNavigateLogin: () => void
  onNavigateSignup: () => void
  children: ReactNode
}

const FRAUNCES_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600&display=swap'

/** W2 — refonte visuelle (étude study/connexion_web/code.html) : carte unique centrée avec bandeau
 *  de progression en en-tête, remplace l'ancien panneau bicolore (marque indigo + formulaire) de W1.
 *  Écarts assumés vis-à-vis du mockup :
 *  - Le bandeau "Boutique active : <nom> · Changer" (affiché uniquement sur l'étape login) est
 *    alimenté par un repère réel propre à cet appareil (session.ts, lastKnownShop), écrit par
 *    useTenant() dès qu'un nom de boutique est résolu — jamais une valeur inventée. Absent tant
 *    qu'aucune boutique n'a jamais été active sur ce terminal.
 *  - "Connexion rapide par code PIN caissier" reste désactivé (cf. LoginDesktop, W1) : aucun accès
 *    par PIN n'existe côté serveur.
 */
export default function AuthDesktopShell({ active, onNavigateLogin, onNavigateSignup, children }: AuthDesktopShellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [lastShop, setLastShop] = useState<LastKnownShop | null>(() => getLastKnownShop())

  // Police Fraunces (titres) : uniquement utilisée sur ces écrans d'auth, pas chargée ailleurs dans l'app.
  useEffect(() => {
    if (document.querySelector(`link[href="${FRAUNCES_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FRAUNCES_HREF
    document.head.appendChild(link)
    return () => link.remove()
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="w-full bg-bg/90 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <a href="/" className="flex items-center gap-3 flex-none" title="Accueil Boutiklic">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-or flex-none">
                <Store size={18} />
              </div>
              <div className="hidden sm:flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-lg tracking-tight text-primary">BOUTIKLIC</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-or/20 text-primary border border-or/40 uppercase tracking-widest">v2.6</span>
                </div>
                <span className="text-[11px] font-medium text-text-muted tracking-wide uppercase">{t('auth.systemCaisseLabel')}</span>
              </div>
            </a>

            <nav aria-label="Progression du parcours" className="hidden lg:flex items-center gap-1 pl-6 border-l border-border text-xs font-semibold">
              {active === 'login' ? (
                <span className="px-3 py-1 rounded-full bg-primary text-papier shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-or" />
                  {t('auth.navLoginLabel')}
                </span>
              ) : (
                <button type="button" onClick={onNavigateLogin} className="text-text-muted hover:text-terracotta px-3 py-1 rounded-full transition-colors">
                  {t('auth.navLoginLabel')}
                </button>
              )}
              <span className="text-text-dim/60 px-1">›</span>
              {active === 'signup' ? (
                <span className="px-3 py-1 rounded-full bg-primary text-papier shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-or" />
                  {t('auth.createAccountLink')}
                </span>
              ) : (
                <button type="button" onClick={onNavigateSignup} className="text-text-muted hover:text-terracotta px-3 py-1 rounded-full transition-colors">
                  {t('auth.createAccountLink')}
                </button>
              )}
              <span className="text-text-dim/60 px-1">›</span>
              <span className="text-text-dim/60 px-3 py-1 cursor-not-allowed">{t('auth.navVerificationLabel')}</span>
              <span className="text-text-dim/60 px-1">›</span>
              <span className="text-text-dim/60 px-3 py-1 cursor-not-allowed">{t('auth.navShopSetupLabel')}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-none">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hidden sm:inline-flex items-center text-xs font-semibold text-text-muted hover:text-terracotta transition-colors py-1.5 px-3 rounded-lg border border-border bg-bg-card"
            >
              <ArrowLeft size={14} className="mr-1.5" />
              {t('auth.backToShowcase')}
            </button>
            <div
              className="h-9 w-9 rounded-full bg-primary/5 border border-border flex items-center justify-center text-text-muted"
              title={t('auth.avatarHelpTitle')}
            >
              <User size={17} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-lg min-w-0">
          {active === 'login' && lastShop && (
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 text-xs">
              <div className="flex items-center gap-2 text-text-muted font-medium min-w-0">
                <span className="w-2 h-2 rounded-full bg-succes-text animate-pulse flex-none" />
                <span>
                  {t('auth.activeShopLabel')}{' '}
                  <strong className="text-text font-semibold break-words">
                    {lastShop.name}
                    {lastShop.city ? ` · ${lastShop.city}` : ''}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearLastKnownShop()
                  setLastShop(null)
                }}
                className="text-terracotta hover:underline font-semibold"
              >
                {t('auth.changeShopAction')}
              </button>
            </div>
          )}

          <section className="bg-bg-card rounded-3xl p-5 sm:p-10 shadow-lg border border-border/80 min-w-0">{children}</section>

          <div className="mt-5 text-center text-xs text-text-muted">
            {t('auth.needHelp')}{' '}
            <a href="#" className="font-semibold text-primary hover:text-terracotta underline decoration-border">
              {t('auth.whatsappSupportLink')}
            </a>
          </div>
        </div>
      </main>

      <footer className="w-full bg-bg-elevated py-4 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-succes-text flex-none" />
            <span className="font-semibold text-primary amount">{t('auth.networkStatusFooter')}</span>
            <span className="hidden md:inline text-border">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-text-muted">
              {t('auth.footerSecureTerminal')}
              <Lock size={12} className="text-succes-text" />
            </span>
          </div>
          <div className="text-text-dim font-semibold">{t('auth.copyrightNotice', { year: new Date().getFullYear() })}</div>
        </div>
      </footer>
    </div>
  )
}

export function ShellSecurityFootnote() {
  const { t } = useTranslation()
  return (
    <div className="mt-7 flex items-start gap-2.5 p-3.5 rounded-xl bg-info-bg/70">
      <ShieldCheck size={17} className="text-primary flex-none mt-0.5" />
      <p className="text-xs font-semibold text-info-text leading-snug">
        <strong className="font-extrabold">{t('auth.localSecurityTitle')} :</strong> {t('auth.localSecurityText')}
      </p>
    </div>
  )
}
