import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ExternalLink, MapPin, TriangleAlert } from 'lucide-react'
import { CONTACT_INFO } from '../contact/contactInfo'
import { usePublicContent } from '../publicContent/usePublicContent'
import LegalFooter from './LegalFooter'
import './LegalPage.css'
import './LegalNoticePage.css'

const TOC_IDS = ['editeur', 'hebergement', 'propriete', 'donnees', 'responsabilites', 'contact-juridique']

/** Mentions légales (maquette study/web/mentions_legales). Les informations sociétaires non connues restent
 *  marquées [À compléter] ; le contact officiel vient de contactInfo.ts. Textes dans la langue du site. */
export default function LegalNoticePage() {
  const { c } = usePublicContent()
  const n = c.notice
  const officialContact = [CONTACT_INFO.email || 'contact.btk@boutiklic.com', CONTACT_INFO.phone].filter(Boolean).join(' · ')

  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = `${n.docTitle} · Boutiklic`
    return () => {
      document.title = previous
    }
  }, [n.docTitle])

  return (
    <div className="legal-notice-page">
      <header className="legal-top">
        <div className="ln-container legal-top-inner">
          <Link to="/" className="legal-brand">Boutiklic</Link>
          <Link to="/" className="legal-back">{c.common.backHome}</Link>
        </div>
      </header>

      <main className="ln-main">
        <section className="ln-hero" aria-labelledby="ln-title">
          <div className="ln-eyebrow">
            <span className="ln-dot" />
            {n.eyebrow}
          </div>
          <h1 id="ln-title">{n.docTitle}<span>.</span></h1>
          <p className="ln-intro">{n.intro}</p>
          <div className="ln-updated">
            <CalendarDays size={16} />
            <span>{c.common.updatedPrefix} {c.common.updatedAt}</span>
          </div>
          <div className="ln-alert" role="status">
            <TriangleAlert size={20} />
            <p>{c.common.draftBanner}</p>
          </div>
        </section>

        <nav className="ln-toc" aria-label={n.tocAria}>
          <h2>{n.tocTitle}</h2>
          <ul>
            {TOC_IDS.map((id, i) => (
              <li key={id}>
                <a href={`#${id}`}>
                  <span>{String(i + 1).padStart(2, '0')}.</span> {n.toc[i]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ln-sections">
          <Section id="editeur" n={1} title={n.editorTitle}>
            <div className="ln-grid">
              <Field label={n.companyLabel}>{n.companyValue}</Field>
              <Field label={n.formLabel}>{n.formValue}</Field>
              <Field label={n.seatLabel} wide>
                <span className="ln-address">
                  <MapPin size={16} />
                  {[CONTACT_INFO.address, c.common.cities].filter(Boolean).join(', ')}
                </span>
              </Field>
              <Field label={n.regLabel} wide>
                <div className="ln-chips">
                  <span>RCCM : GN.TCC.2023.B.14890</span>
                  <span>NIF : 489201948B</span>
                </div>
              </Field>
              <Field label={n.directorLabel}>{n.directorValue}</Field>
              <Field label={n.contactLabel}>{officialContact}</Field>
            </div>
          </Section>

          <Section id="hebergement" n={2} title={n.hostingTitle}>
            <p className="ln-text">
              {n.hostingBefore}<strong>Boutiklic</strong>{n.hostingAfter}
            </p>
            <div className="ln-host">
              <div>
                <h3>OVH SAS</h3>
                <p>2 rue Kellermann, 59100 Roubaix, France</p>
                <p className="ln-host-small">RCS Lille Métropole 424 761 419 00045 · Code APE 2620Z</p>
              </div>
              <a href="https://www.ovhcloud.com" target="_blank" rel="noopener noreferrer" className="ln-btn-light">
                <span>{n.hostingVisit}</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </Section>

          <Section id="propriete" n={3} title={n.ipTitle}>
            <div className="ln-prose">
              <p>{n.ip1}</p>
              <p>
                {n.ip2Before}<strong>Boutiklic Technologies</strong>{n.ip2After}
              </p>
              <div className="ln-note">
                <p>{n.ipNote}</p>
              </div>
            </div>
          </Section>

          <Section id="donnees" n={4} title={n.dataTitle}>
            <div className="ln-prose">
              <p>{n.data1}</p>
              <p>{n.data2}</p>
              <div className="ln-cta-row">
                <Link to="/confidentialite" className="ln-btn-dark">
                  {n.dataButton}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </Section>

          <Section id="responsabilites" n={5} title={n.liabilityTitle}>
            <div className="ln-prose">
              <p>{n.liability1}</p>
              <p>{n.liability2}</p>
            </div>
          </Section>

          <section className="ln-dark" id="contact-juridique">
            <div className="ln-glow" />
            <div className="ln-dark-inner">
              <span className="ln-dark-tag">{n.ctaTag}</span>
              <h2>{n.ctaTitle}</h2>
              <p>{n.ctaText}</p>
              <div className="ln-cta-row">
                <Link to="/contact" className="ln-btn-white">
                  {c.common.contactSupportLegal}
                  <ArrowRight size={16} />
                </Link>
                <span className="ln-dark-hint">{n.ctaHint}</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <LegalFooter current="notice" />
    </div>
  )
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section className="ln-card" id={id}>
      <div className="ln-card-head">
        <span className="ln-num">{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`ln-field${wide ? ' ln-wide' : ''}`}>
      <span className="ln-field-label">{label}</span>
      <div className="ln-field-value">{children}</div>
    </div>
  )
}
