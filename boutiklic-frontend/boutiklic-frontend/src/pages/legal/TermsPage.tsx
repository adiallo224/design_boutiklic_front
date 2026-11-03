import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlignLeft, ArrowRight, Calculator, CalendarDays, FileText, Info, Package } from 'lucide-react'
import { usePublicContent } from '../publicContent/usePublicContent'
import LegalFooter from './LegalFooter'
import './LegalPage.css'
import './TermsPage.css'

const TOC_IDS = ['section-1', 'section-2', 'section-3', 'section-4', 'section-5']
const MODULE_ICONS = [Calculator, Package, FileText]

/** Conditions Générales de Vente (maquette study/web/condition_de_vente). Texte provisoire : les passages
 *  [À compléter] et les modalités "prévues" sont à valider avant publication. Textes dans la langue du site. */
export default function TermsPage() {
  const { c } = usePublicContent()
  const t = c.terms

  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = `${t.docTitle} · Boutiklic`
    return () => {
      document.title = previous
    }
  }, [t.docTitle])

  return (
    <div className="terms-page">
      <header className="legal-top">
        <div className="tp-container legal-top-inner">
          <Link to="/" className="legal-brand">Boutiklic</Link>
          <Link to="/" className="legal-back">{c.common.backHome}</Link>
        </div>
      </header>

      <main className="tp-main">
        <section className="tp-hero" aria-labelledby="tp-title">
          <div className="tp-eyebrow">
            <span className="tp-dot" />
            {t.eyebrow}
          </div>
          <div className="tp-title-block">
            <h1 id="tp-title">{t.docTitle}<span>.</span></h1>
            <p>{t.intro}</p>
          </div>
          <div className="tp-updated">
            <CalendarDays size={16} />
            <span>{c.common.updatedPrefix} <strong>{c.common.updatedAt}</strong></span>
          </div>
          <div className="tp-alert" role="status">
            <span className="tp-alert-icon"><Info size={20} /></span>
            <div>
              <h4>{t.draftTitle}</h4>
              <p>{t.draftText}</p>
            </div>
          </div>
        </section>

        <section className="tp-toc" aria-label={t.tocAria}>
          <div className="tp-toc-box">
            <div className="tp-toc-title">
              <AlignLeft size={16} />
              <span>{t.tocTitle}</span>
            </div>
            <nav>
              {TOC_IDS.map((id, i) => (
                <a key={id} href={`#${id}`}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span>{t.toc[i]}</span>
                </a>
              ))}
            </nav>
          </div>
        </section>

        <div className="tp-sections">
          <Article id="section-1" n={1} title={t.s1Title}>
            <p className="tp-lead">{t.s1Lead}</p>
            <div className="tp-modules">
              {t.modules.map((m, i) => {
                const Icon = MODULE_ICONS[i]
                return (
                  <div key={m.title} className="tp-module">
                    <span className="tp-module-icon"><Icon size={20} /></span>
                    <div>
                      <h3>{m.title}</h3>
                      <p>{m.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Article>

          <Article id="section-2" n={2} title={t.s2Title}>
            <p className="tp-line">{t.s2Lead} <Todo label={c.common.todo} />.</p>
            <div className="tp-recap">
              <h4>{t.recapTitle}</h4>
              <div>
                {t.recap.map((r) => (
                  <div key={r.label} className="tp-recap-item">
                    <span>{r.label}</span>
                    <strong>{r.value}</strong>
                    <p>{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Article>

          <Article id="section-3" n={3} title={t.s3Title}>
            <p className="tp-line">{t.s3Lead} <Todo label={c.common.todo} />.</p>
            <div className="tp-box tp-box-sand">
              {t.s3Bullets.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          </Article>

          <Article id="section-4" n={4} title={t.s4Title}>
            <p className="tp-line">{t.s4Lead} <Todo label={c.common.todo} />.</p>
            <div className="tp-duties">
              <div>
                <h4><span className="tp-bullet tp-bullet-green" /> {t.dutyEditorTitle}</h4>
                <p>{t.dutyEditorText}</p>
              </div>
              <div>
                <h4><span className="tp-bullet tp-bullet-blue" /> {t.dutyUserTitle}</h4>
                <p>{t.dutyUserText}</p>
              </div>
            </div>
          </Article>

          <Article id="section-5" n={5} title={t.s5Title}>
            <p className="tp-line">{t.s5Lead} <Todo label={c.common.todo} />.</p>
            <div className="tp-box tp-box-slate">
              <p>{t.s5P1}</p>
              <p>{t.s5P2}</p>
            </div>
          </Article>
        </div>

        <section className="tp-cta">
          <div className="tp-glow" />
          <div className="tp-cta-inner">
            <span className="tp-cta-tag">{t.ctaTag}</span>
            <h3>{t.ctaTitle}</h3>
            <p>{t.ctaText}</p>
            <Link to="/contact" className="tp-btn-white">
              {t.ctaButton}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <LegalFooter current="terms" />
    </div>
  )
}

function Article({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <article className="tp-card" id={id}>
      <div className="tp-card-head">
        <span>{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  )
}

function Todo({ label }: { label: string }) {
  return <span className="tp-todo">{label}</span>
}
