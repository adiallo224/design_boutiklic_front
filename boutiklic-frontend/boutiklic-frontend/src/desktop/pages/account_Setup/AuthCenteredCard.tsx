import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

interface AuthCenteredCardProps {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  children: ReactNode
  width?: number
}

/** Écran bureau centré (W11, W25, et les écrans de connexion mot de passe oublié) — même
 *  gabarit que le mobile mais recentré pour une fenêtre large, pas un simple étirement. */
export default function AuthCenteredCard({ title, subtitle, onBack, backLabel, children, width = 460 }: AuthCenteredCardProps) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-bg px-4 sm:px-6 py-8">
      <div className="w-full flex flex-col gap-6" style={{ maxWidth: width }}>
        {onBack && (
          <button type="button" onClick={onBack} className="self-start flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text">
            <ChevronLeft size={18} strokeWidth={2.4} />
            {backLabel}
          </button>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-xl min-[400px]:text-2xl font-extrabold tracking-tight text-text break-words">{title}</h1>
          {subtitle && <p className="text-sm font-semibold text-text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-[22px] bg-bg-card border border-border-strong shadow-[0_12px_30px_-14px_rgba(17,20,24,.12)] p-5 sm:p-7 flex flex-col gap-4">
          {children}
        </div>
      </div>
    </div>
  )
}
