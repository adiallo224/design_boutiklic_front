import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlignLeft, CalendarDays, Mail, MessageCircle, Package, Smartphone, TriangleAlert, User, Users } from 'lucide-react'
import { usePublicContent } from '../publicContent/usePublicContent'
import LegalFooter from './LegalFooter'
import './LegalPage.css'
import './PrivacyPage.css'

const KIND_ICONS = [User, Package, Users, Smartphone, Mail]
const PURPOSE_COLORS = ['accent', 'green', 'blue']

/** Protection des données marchandes (maquette study/web/protection_donnees). Texte provisoire : les passages
 *  [À compléter] sont à renseigner avant publication. Textes dans la langue du site. */
export default function PrivacyPage({ variant = 'privacy' }: { variant?: 'privacy' | 'accountDeletion' }) {
  const { c } = usePublicContent()
  const p = c[variant]

  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = `${p.docTitle} · Boutiklic`
    return () => {
      document.title = previous
    }
  }, [p.docTitle])

  return (
    <div className="privacy-page">
      <header className="legal-top">
        <div className="pp-container legal-top-inner">
          <Link to="/" className="legal-brand">Boutiklic</Link>
          <Link to="/" className="legal-back">{c.common.backHome}</Link>
        </div>
      </header>

      <main className="pp-main">
        <div className="pp-wrap">
          <section className="pp-hero" aria-labelledby="pp-title">
            <div className="pp-eyebrow">
              <span className="pp-dot" />
              {p.eyebrow}
            </div>
            <h1 id="pp-title">{p.docTitle}<span>.</span></h1>
            <p className="pp-intro">{p.intro}</p>
            <div className="pp-updated">
              <CalendarDays size={16} />
              <span>{c.common.updatedPrefix} {p.updatedAt}</span>
            </div>
            <div className="pp-alert" role="status">
              <span><TriangleAlert size={16} /></span>
              <p>{c.common.draftBanner}</p>
            </div>
          </section>

          <section className="pp-toc" aria-label={p.tocAria}>
            <div>
              <div className="pp-toc-title">
                <AlignLeft size={16} />
                <span>{p.tocTitle}</span>
              </div>
              <nav>
                {p.sections.map((s, i) => (
                  <a key={s.title} href={`#section-${i + 1}`}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <span>{s.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </section>

          <div className="pp-sections">
            {p.sections.map((s, i) => (
              <Article key={s.title} id={`section-${i + 1}`} n={i + 1} title={s.title}>
                <p className="pp-lead">{s.lead}</p>

                {s.kind === 'kinds' && (
                  <div className="pp-kinds">
                    {s.items?.map((k, j) => {
                      const Icon = KIND_ICONS[j % KIND_ICONS.length]
                      return (
                        <div key={k.title} className="pp-kind">
                          <span className={`pp-kind-icon${j === 0 ? ' pp-kind-icon-accent' : ''}`}><Icon size={16} /></span>
                          <h3>{k.title}</h3>
                          <p>{k.text}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {s.kind === 'cards' && (
                  <div className="pp-purposes">
                    {s.items?.map((pu, j) => (
                      <div key={pu.title}>
                        <h3><span className={`pp-bullet pp-bullet-${PURPOSE_COLORS[j % PURPOSE_COLORS.length]}`} />{pu.title}</h3>
                        <p>{pu.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {s.kind === 'subs' && (
                  <div className="pp-subs">
                    {s.items?.map((sub) => (
                      <div key={sub.title} className={`pp-sub${sub.todo ? ' pp-sub-todo' : ''}`}>
                        <div className="pp-sub-main">
                          <span className={`pp-sub-badge pp-sub-badge-${sub.todo ? 'amber' : sub.badge === 'OVH' ? 'blue' : 'gray'}`}>{sub.badge}</span>
                          <div>
                            <h4>{sub.title}</h4>
                            <p>{sub.text}</p>
                          </div>
                        </div>
                        <span className={`pp-tag pp-tag-${sub.todo ? 'amber' : sub.badge === 'OVH' ? 'green' : 'gray'}`}>{sub.tag}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(s.kind === 'rights' || s.kind === 'contact') && (
                  <>
                    {s.kind === 'rights' && (
                      <div className="pp-rights">
                        {s.items?.map((r) => (
                          <div key={r.title}>
                            <strong>{r.title}</strong>
                            <span>{r.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {variant === 'privacy' && s.kind === 'rights' && (
                      <p className="pp-lead">
                        <Link to="/suppression-compte" className="pp-btn-accent">{c.privacy.deletionLinkLabel}</Link>
                      </p>
                    )}
                    <div className="pp-channel">
                      <div className="pp-channel-main">
                        <span><Mail size={16} /></span>
                        <div>
                          <p>{p.channelLabel}</p>
                          <p className="pp-channel-value">{c.common.todo}</p>
                        </div>
                      </div>
                      <Link to="/contact" className="pp-btn-accent">{p.channelButton}</Link>
                    </div>
                  </>
                )}

                {s.bullets && (
                  <div className="pp-box">
                    {s.boxTitle && <p className="pp-box-title">{s.boxTitle}</p>}
                    <ul>
                      {s.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Article>
            ))}
          </div>

          <section className="pp-cta">
            <div className="pp-glow-top" />
            <div className="pp-glow-bottom" />
            <div className="pp-cta-inner">
              <div className="pp-cta-tag">
                <MessageCircle size={14} />
                {p.ctaTag}
              </div>
              <h3>{p.ctaTitle}</h3>
              <p>{p.ctaText}</p>
              <Link to="/contact" className="pp-btn-white">{p.ctaButton}</Link>
            </div>
          </section>
        </div>
      </main>

      <LegalFooter current="privacy" />
    </div>
  )
}

function Article({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <article className="pp-card" id={id}>
      <div className="pp-card-head">
        <span>{n}</span>
        <h2>{n}. {title}</h2>
      </div>
      {children}
    </article>
  )
}

