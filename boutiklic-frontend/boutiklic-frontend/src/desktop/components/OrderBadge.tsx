import type { Tone } from '../../lib/onlineOrderActions'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-bg-elevated text-text-muted',
  info: 'bg-bg-elevated text-text',
  warn: 'bg-alerte-bg text-alerte-text',
  ok: 'bg-succes-bg text-succes-text',
  bad: 'bg-alerte-bg text-danger',
}

/** Pastille d'état d'une commande en ligne (commande, paiement, remise). Le libellé est déjà traduit par l'appelant. */
export default function OrderBadge({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${TONE_CLASSES[tone]}`}>{label}</span>
}
