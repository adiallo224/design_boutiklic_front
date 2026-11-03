import { whatsappLink } from '../pages/contact/contactInfo'
import { usePublicContent } from '../pages/publicContent/usePublicContent'
import './WhatsAppFloatingButton.css'

/** Bouton WhatsApp flottant (landing). Invisible tant que le numéro n'est pas renseigné dans contactInfo.ts. */
export default function WhatsAppFloatingButton({ label = 'Discuter sur WhatsApp' }: { label?: string }) {
  const { lang } = usePublicContent()
  const href = whatsappLink(lang)
  if (!href) return null

  return (
    <a className="wa-float" href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>
      <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">
        <path d="M16.002 3C8.82 3 3 8.82 3 16c0 2.29.6 4.52 1.74 6.49L3 29l6.7-1.71A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16.002 3Zm0 23.7c-1.95 0-3.86-.53-5.53-1.52l-.4-.23-3.98 1.02 1.06-3.88-.26-.4A10.7 10.7 0 0 1 5.3 16c0-5.9 4.8-10.7 10.7-10.7S26.7 10.1 26.7 16 21.9 26.7 16 26.7Zm5.87-8c-.32-.16-1.9-.94-2.2-1.04-.3-.11-.51-.16-.73.16-.21.32-.83 1.04-1.02 1.26-.19.21-.37.24-.7.08-.32-.16-1.36-.5-2.59-1.6-.96-.86-1.6-1.91-1.79-2.23-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.67 0 1.57 1.15 3.09 1.31 3.3.16.21 2.26 3.45 5.47 4.84.76.33 1.36.52 1.82.67.77.24 1.46.21 2.01.13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
      </svg>
    </a>
  )
}
