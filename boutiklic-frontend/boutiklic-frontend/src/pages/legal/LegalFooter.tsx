import { Link } from 'react-router-dom'
import { usePublicContent } from '../publicContent/usePublicContent'
import './LegalFooter.css'

type FooterPage = 'billing' | 'privacy' | 'terms' | 'notice'

/** Pied de page commun à la page Contact et aux quatre pages légales (mentions légales, CGV, confidentialité,
 *  conformité de facturation) ; la page courante est mise en gras. Textes dans la langue du site. */
export default function LegalFooter({ current }: { current?: FooterPage }) {
  const { c } = usePublicContent()
  const links: { id: FooterPage; to: string; label: string }[] = [
    { id: 'billing', to: '/conformite-facturation', label: c.common.footerBilling },
    { id: 'privacy', to: '/confidentialite', label: c.common.footerPrivacy },
    { id: 'terms', to: '/cgv', label: c.common.footerTerms },
    { id: 'notice', to: '/mentions-legales', label: c.common.footerNotice },
  ]

  return (
    <footer className="legal-footer">
      <div className="legal-footer-inner">
        <div className="legal-footer-brand">
          <span>B</span>
          <span>{c.common.footerRights}</span>
        </div>
        <nav aria-label={c.common.footerNavAria}>
          {links.map((l) => (
            <Link key={l.id} to={l.to} className={l.id === current ? 'legal-footer-current' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
