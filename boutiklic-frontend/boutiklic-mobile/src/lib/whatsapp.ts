import { Linking } from 'react-native'

/** Ouvre WhatsApp avec un message pré-rempli via un lien wa.me — aucun compte/API Business requis
 * (écrans D1/D2 "Relancer", F3 "Aide par WhatsApp"). `phone` accepte le format E.164 déjà utilisé
 * partout dans l'app (+224...) : le "+" et les espaces sont retirés, wa.me n'en veut pas. */
export function openWhatsApp(phone: string, message: string) {
  const digits = phone.replace(/[^\d]/g, '')
  return Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`).catch(() => undefined)
}
