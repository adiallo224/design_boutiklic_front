import { Check } from 'lucide-react'

export interface Step {
  id: string
  label: string
}

interface StepRailProps {
  steps: Step[]
  currentStepId: string
  completedStepIds?: string[]
}

/** Rail d'étapes à gauche des formulaires à étapes bureau (W10) — chrome pur, le contenu de
 *  chaque étape reste les composants d'assistant existants (ShopCountry/ShopIdentity/...). */
export default function StepRail({ steps, currentStepId, completedStepIds = [] }: StepRailProps) {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step, i) => {
        const isCurrent = step.id === currentStepId
        const isDone = completedStepIds.includes(step.id)
        return (
          <li key={step.id} className="flex items-center gap-3 py-2.5">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold shrink-0 ${
                isCurrent ? 'bg-primary text-papier' : isDone ? 'bg-success text-papier' : 'bg-bg-elevated text-text-dim'
              }`}
            >
              {isDone && !isCurrent ? <Check size={14} /> : i + 1}
            </span>
            <span
              className={`text-sm ${
                isCurrent ? 'font-extrabold text-text' : isDone ? 'font-semibold text-text-muted' : 'text-text-dim'
              }`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
