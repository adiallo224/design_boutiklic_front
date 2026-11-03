import { getPublicContent, type PublicLang } from '../publicContent/usePublicContent'

/**
 * Coordonnées publiques de Boutiklic — source unique pour la page Contact, le bouton WhatsApp
 * flottant de la landing et l'onglet Aide des Réglages. Un champ vide est simplement masqué.
 * Les textes qui dépendent de la langue (ville, horaires, message WhatsApp) sont dans
 * pages/publicContent (clés common.*).
 */
export const CONTACT_INFO = {
  /** Numéro WhatsApp au format international, chiffres uniquement, sans "+" (ex : '33753959950'). */
  whatsapp: '33753959950',
  /** Numéro WhatsApp tel qu'affiché (ex : '+33 7 53 95 99 50'). */
  whatsappDisplay: '+33 7 53 95 99 50',
  email: 'contact.btk@boutiklic.com',
  phone: '+33 7 53 95 99 50',
  address: 'Sonfonia, commune de Ratoma',
  /** Engagement affiché sous les cartes, ex : 'Temps de réponse moyen de moins de 15 minutes pendant les heures d’ouverture.' */
  responseTime: '',
}

/** Lien wa.me avec le message pré-rempli dans la langue demandée. */
export function whatsappLink(lang: PublicLang): string | null {
  if (!CONTACT_INFO.whatsapp) return null
  return `https://wa.me/${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(getPublicContent(lang).common.whatsappMessage)}`
}
