import { apiClient } from './apiClient'

export type ContactTopic = 'DEMO' | 'SUPPORT' | 'PRICING' | 'PARTNERSHIP' | 'OTHER'

/** Limites des pièces jointes — miroir de ContactCommandService côté core (qui revalide tout). */
export const CONTACT_MAX_ATTACHMENTS = 3
export const CONTACT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const CONTACT_ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export interface SendContactMessageRequest {
  name: string
  shopName: string
  email: string
  phone: string
  topic: ContactTopic
  message: string
  /** Honeypot : champ caché du formulaire, doit rester vide (un robot le remplit). */
  website: string
}

export const contactApi = {
  /** Endpoint public (sans authentification) — 429 si trop de messages depuis la même IP. Multipart :
   *  partie JSON "data" + fichiers "attachments" (transmis par email au support, non stockés). */
  sendMessage: (request: SendContactMessageRequest, attachments: File[] = []) => {
    const form = new FormData()
    form.append('data', new Blob([JSON.stringify(request)], { type: 'application/json' }))
    attachments.forEach((file) => form.append('attachments', file))
    return apiClient.post<void>('/contact/messages', form)
  },
}
