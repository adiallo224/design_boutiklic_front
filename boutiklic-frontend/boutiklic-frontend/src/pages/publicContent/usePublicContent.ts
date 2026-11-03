import { useTranslation } from 'react-i18next'
import { fr, type PublicContent } from './fr'
import { en } from './en'
import { pt } from './pt'

export type PublicLang = 'fr' | 'en' | 'pt'

const CONTENT: Record<PublicLang, PublicContent> = { fr, en, pt }

/** Langue des pages publiques hors landing : celle d'i18next (choix fait sur la landing, sinon langue
 *  enregistrée, sinon navigateur), repliée sur le français si elle n'est pas traduite. Se met à jour
 *  tout seul quand la langue change (useTranslation). */
export function usePublicContent(): { lang: PublicLang; c: PublicContent } {
  const { i18n } = useTranslation()
  const lang = (['fr', 'en', 'pt'] as const).find((l) => i18n.language?.toLowerCase().startsWith(l)) ?? 'fr'
  return { lang, c: CONTENT[lang] }
}

/** Même contenu hors composant React (ex : message WhatsApp pré-rempli). */
export function getPublicContent(lang: PublicLang): PublicContent {
  return CONTENT[lang]
}
