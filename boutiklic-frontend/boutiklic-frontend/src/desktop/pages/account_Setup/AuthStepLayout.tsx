import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import StepRail from '../../components/StepRail'
import type { StepDef } from './shopSetupSteps'
import { useTranslation } from 'react-i18next'

interface AuthStepLayoutProps {
  steps: StepDef[]
  currentStepId: string
  completedStepIds: string[]
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  children: ReactNode
}

/** Gabarit "rail d'étapes à gauche" de W10 — partagé par CreateAccountDesktop (AuthFlow) et
 *  OnboardingDesktop/ShopCountryDesktop/ShopIdentityDesktop/ShopActivityDesktop (ShopSetupFlow),
 *  et réutilisé tel quel par CreateShop.tsx (ajout d'une boutique, W6). */
export default function AuthStepLayout({ steps, currentStepId, completedStepIds, title, subtitle, onBack, backLabel, children }: AuthStepLayoutProps) {
  const { t } = useTranslation()
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId))
  const currentStep = steps[currentIndex]
  return (
    <div className="min-h-dvh md:h-dvh flex flex-col md:flex-row bg-bg">
      <div className="md:w-[240px] md:shrink-0 bg-bg-card border-b md:border-b-0 md:border-r border-border px-4 py-3.5 md:px-6 md:py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-extrabold text-text">BOUTIKLIC</span>
          {/* Fenêtre étroite : le rail vertical est remplacé par « étape x/y » + une barre de progression. */}
          <span className="md:hidden text-xs font-bold text-text-muted truncate">
            {currentIndex + 1}/{steps.length} · {currentStep ? t(currentStep.labelKey) : ''}
          </span>
        </div>
        <div className="md:hidden -mt-5 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= currentIndex ? 'bg-primary' : 'bg-bg-elevated'}`} />
          ))}
        </div>
        <div className="hidden md:block">
          <StepRail
            steps={steps.map((s) => ({ id: s.id, label: t(s.labelKey) }))}
            currentStepId={currentStepId}
            completedStepIds={completedStepIds}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0 md:overflow-y-auto flex flex-col items-center justify-center px-4 sm:px-6 py-6 md:py-10">
        <div className="w-full max-w-[520px] flex flex-col gap-6">
          {onBack && (
            <button type="button" onClick={onBack} className="self-start flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text">
              <ChevronLeft size={18} strokeWidth={2.4} />
              {backLabel}
            </button>
          )}
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-text">{title}</h1>
            {subtitle && <p className="text-sm font-semibold text-text-muted">{subtitle}</p>}
          </div>
          <div className="rounded-[22px] bg-bg-card border border-border-strong shadow-[0_12px_30px_-14px_rgba(17,20,24,.12)] p-5 sm:p-7 flex flex-col gap-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
