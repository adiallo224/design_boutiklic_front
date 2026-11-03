import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, FileText, Globe, Info, Receipt, ShieldCheck, Ticket, TriangleAlert } from 'lucide-react'
import { usePublicContent } from '../publicContent/usePublicContent'
import LegalFooter from './LegalFooter'
import './LegalPage.css'
import './BillingCompliancePage.css'

const TOC_IDS = ['documents-emis', 'agrement']
const DOC_ICONS = [FileText, Ticket, Receipt]

/** Conformité de facturation (maquette study/web/conformite_facturation). Texte provisoire : ne publier aucune
 *  mention d'agrément sans justificatif (cf. section 2). Textes dans la langue du site. */
export default function BillingCompliancePage() {
  const { c } = usePublicContent()
  const b = c.billing

  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = `${b.docTitle} · Boutiklic`
    return () => {
      document.title = previous
    }
  }, [b.docTitle])

  return (
    <div className="billing-page">
      <header className="legal-top">
        <div className="bp-container legal-top-inner">
          <Link to="/" className="legal-brand">Boutiklic</Link>
          <Link to="/" className="legal-back">{c.common.backHome}</Link>
        </div>
      </header>

      <main className="bp-main">
        <div className="bp-wrap">
          <section className="bp-hero" aria-labelledby="bp-title">
            <div className="bp-eyebrow">
              <span className="bp-dot" />
              {b.eyebrow}
            </div>
            <h1 id="bp-title">{b.docTitle}<span>.</span></h1>
            <p className="bp-intro">{b.intro}</p>
            <div className="bp-updated">
              <CalendarDays size={16} />
              <span>{c.common.updatedPrefix} {c.common.updatedAt}</span>
            </div>
            <div className="bp-alert" role="status">
              <span><TriangleAlert size={20} /></span>
              <p>{c.common.draftBanner}</p>
            </div>
          </section>

          <section className="bp-toc" aria-label={b.tocAria}>
            <div>
              <h2>{b.tocTitle}</h2>
              <div className="bp-toc-grid">
                {TOC_IDS.map((id, i) => (
                  <a key={id} href={`#${id}`}>
                    <div>
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <span>{b.toc[i]}</span>
                    </div>
                    <ChevronRight size={16} />
                  </a>
                ))}
              </div>
            </div>
          </section>

          <Article id="documents-emis" n={1} title={b.s1Title}>
            <p className="bp-lead">{b.s1Lead}</p>
            <div className="bp-docs">
              {b.docs.map((d, i) => {
                const Icon = DOC_ICONS[i]
                return (
                  <div key={d.title} className="bp-doc">
                    <span className="bp-doc-icon"><Icon size={20} /></span>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                )
              })}
            </div>
            <div className="bp-local">
              <span><Globe size={20} /></span>
              <div>
                <h4>{b.localTitle}</h4>
                <p>{b.localText}</p>
              </div>
            </div>
          </Article>

          <Article id="agrement" n={2} title={b.s2Title}>
            <p className="bp-lead">
              {b.s2Before} <span className="bp-todo">{c.common.todo}</span>{b.s2After}
            </p>
            <div className="bp-status">
              <span className="bp-status-icon"><ShieldCheck size={24} /></span>
              <div>
                <div className="bp-status-head">
                  <span>{b.statusLabel}</span>
                  <span className="bp-status-tag">{b.statusTag}</span>
                </div>
                <h4>{b.statusTitle}</h4>
                <p>{b.statusText}</p>
              </div>
            </div>
            <div className="bp-transparency">
              <Info size={16} />
              <span>{b.transparency}</span>
            </div>
          </Article>

          <section className="bp-cta">
            <div className="bp-glow" />
            <div className="bp-cta-inner">
              <span className="bp-cta-tag">{b.ctaTag}</span>
              <h3>{b.ctaTitle}</h3>
              <p>{b.ctaText}</p>
              <Link to="/contact" className="bp-btn-white">{b.ctaButton}</Link>
            </div>
          </section>
        </div>
      </main>

      <LegalFooter current="billing" />
    </div>
  )
}

function Article({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section className="bp-section" id={id}>
      <article className="bp-card">
        <div className="bp-card-head">
          <span>{n}</span>
          <h2>{title}</h2>
        </div>
        {children}
      </article>
    </section>
  )
}
