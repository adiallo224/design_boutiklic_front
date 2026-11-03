import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Clock, ImagePlus, Lock, MapPin, MessageCircle, Phone, Zap } from 'lucide-react'
import { CONTACT_INFO, whatsappLink } from './contactInfo'
import {
  contactApi,
  CONTACT_ATTACHMENT_ACCEPT,
  CONTACT_MAX_ATTACHMENTS,
  CONTACT_MAX_ATTACHMENT_BYTES,
  type ContactTopic,
} from '../../lib/contactApi'
import { ApiError, toErrorMessage } from '../../lib/apiClient'
import { usePublicContent } from '../publicContent/usePublicContent'
import LegalFooter from '../legal/LegalFooter'
import '../legal/LegalPage.css'
import './ContactPage.css'

const TOPIC_ORDER: ContactTopic[] = ['DEMO', 'SUPPORT', 'PRICING', 'PARTNERSHIP', 'OTHER']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Page Contact — textes dans la langue du site (cf. pages/publicContent). */
export default function ContactPage() {
  const { c } = usePublicContent()
  const t = c.contact

  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = `${t.docTitle} · Boutiklic`
    return () => {
      document.title = previous
    }
  }, [t.docTitle])

  return (
    <div className="contact-page">
      {/* En-tête des pages publiques (même rendu que les pages légales) */}
      <header className="legal-top">
        <div className="cp-container legal-top-inner">
          <Link to="/" className="legal-brand">Boutiklic</Link>
          <Link to="/" className="legal-back">{c.common.backHome}</Link>
        </div>
      </header>

      <main className="cp-main">
        <div className="cp-container">
          <div className="cp-hero">
            <div className="cp-badge">
              <span className="cp-dot cp-pulse" />
              <span>{t.badge}</span>
            </div>
            <h1>{t.h1}</h1>
            <p>
              {t.introBefore}<strong>{t.langs[0]}</strong>{t.introSep1}<strong>{t.langs[1]}</strong>{t.introSep2}
              <strong>{t.langs[2]}</strong>.
            </p>
          </div>

          <div className="cp-grid">
            <ChannelCards />
            <section className="cp-form-col" aria-labelledby="cp-form-heading">
              <div className="cp-form-card">
                <h2 className="cp-sr-only" id="cp-form-heading">{t.formAria}</h2>
                <ContactForm />
              </div>
            </section>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  )
}

/** Colonne de gauche : un bloc par canal renseigné dans contactInfo.ts (un champ vide est masqué). */
function ChannelCards() {
  const { lang, c } = usePublicContent()
  const t = c.contact
  const wa = whatsappLink(lang)
  const { address, phone, whatsappDisplay, responseTime } = CONTACT_INFO
  const city = c.common.cities
  const hours = c.common.hours

  return (
    <aside className="cp-aside" aria-label={t.asideAria}>
      {(address || city) && (
        <article className="cp-card">
          <div className="cp-card-row">
            <span className="cp-icon cp-icon-blue"><MapPin size={20} /></span>
            <div className="cp-card-body">
              <h2>{t.addressTitle}</h2>
              {address && <p className="cp-muted">{address}</p>}
              {city && <p className="cp-small">{city}</p>}
            </div>
          </div>
        </article>
      )}

      {phone && (
        <article className="cp-card">
          <div className="cp-card-row cp-between">
            <div className="cp-card-row">
              <span className="cp-icon cp-icon-amber"><Phone size={20} /></span>
              <div className="cp-card-body">
                <h2>{t.phoneTitle}</h2>
                <a className="cp-phone" href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
              </div>
            </div>
            <span className="cp-pill">{t.phoneBadge}</span>
          </div>
        </article>
      )}

      {wa && (
        <article className="cp-card">
          <div className="cp-card-row">
            <span className="cp-icon cp-icon-emerald"><MessageCircle size={20} /></span>
            <div className="cp-card-body cp-grow">
              <div className="cp-card-row cp-between">
                <h2>{t.whatsappTitle}</h2>
                <span className="cp-pill cp-pill-green"><span className="cp-dot cp-dot-green cp-pulse" />{t.whatsappBadge}</span>
              </div>
              {whatsappDisplay && <p className="cp-wa-number">{whatsappDisplay}</p>}
              <a className="cp-btn-green" href={wa} target="_blank" rel="noopener noreferrer">
                <span>{t.whatsappButton}</span>
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </article>
      )}

      {hours.length > 0 && (
        <article className="cp-card">
          <div className="cp-card-row">
            <span className="cp-icon cp-icon-orange"><Clock size={20} /></span>
            <div className="cp-card-body">
              <h2>{t.hoursTitle}</h2>
              {hours.map((h) => (
                <p key={h.label} className="cp-hours"><strong>{h.label},</strong> <span>{h.value}</span></p>
              ))}
            </div>
          </div>
        </article>
      )}

      {responseTime && (
        <div className="cp-banner">
          <Zap size={20} />
          <span>{responseTime}</span>
        </div>
      )}
    </aside>
  )
}

function ContactForm() {
  const { c } = usePublicContent()
  const t = c.contact
  const [name, setName] = useState('')
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [topic, setTopic] = useState<ContactTopic>('DEMO')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const canSubmit =
    name.trim() !== '' && EMAIL_PATTERN.test(email.trim()) && phone.trim().length >= 6 && message.trim().length >= 10 && !loading

  function addFiles(picked: File[]) {
    const accepted = CONTACT_ATTACHMENT_ACCEPT.split(',')
    const wrongType = picked.find((f) => !accepted.includes(f.type))
    const tooBig = picked.find((f) => f.size > CONTACT_MAX_ATTACHMENT_BYTES)
    if (wrongType) return setFileError(t.fileType.replace('{name}', wrongType.name))
    if (tooBig) return setFileError(t.fileTooBig.replace('{name}', tooBig.name))
    if (files.length + picked.length > CONTACT_MAX_ATTACHMENTS) return setFileError(t.fileMax)
    setFileError(null)
    setFiles((current) => [...current, ...picked])
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await contactApi.sendMessage({ name, shopName, email, phone, topic, message, website }, files)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t.tooMany : toErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="cp-success" role="status">
        <strong>{t.successTitle}</strong>
        <p>{t.successText}</p>
      </div>
    )
  }

  return (
    <form className="cp-form" onSubmit={handleSubmit} noValidate>
      <div className="cp-row">
        <div className="cp-field">
          <label htmlFor="cp-name">{t.fullName} <span className="cp-req">*</span></label>
          <input id="cp-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.fullNamePh}
            maxLength={120} autoComplete="name" required />
        </div>
        <div className="cp-field">
          <label htmlFor="cp-shop">{t.shopName}</label>
          <input id="cp-shop" type="text" value={shopName} onChange={(e) => setShopName(e.target.value)}
            placeholder={t.shopNamePh} maxLength={120} autoComplete="organization" />
        </div>
      </div>

      <div className="cp-row">
        <div className="cp-field">
          <label htmlFor="cp-email">{t.email} <span className="cp-req">*</span></label>
          <input id="cp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPh} maxLength={160} autoComplete="email" required />
        </div>
        <div className="cp-field">
          <label htmlFor="cp-phone">{t.phone} <span className="cp-req">*</span></label>
          <input id="cp-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phonePh} maxLength={40} autoComplete="tel" required />
        </div>
      </div>

      <div className="cp-field">
        <label htmlFor="cp-topic">{t.subject}</label>
        <div className="cp-select">
          <select id="cp-topic" value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic)}>
            {TOPIC_ORDER.map((value) => (
              <option key={value} value={value}>{t.topics[value]}</option>
            ))}
          </select>
          <ChevronDown size={16} />
        </div>
      </div>

      <div className="cp-field">
        <label htmlFor="cp-message">{t.message} <span className="cp-req">*</span></label>
        <textarea id="cp-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          placeholder={t.messagePh} maxLength={2000} required />
        {message.length > 0 && message.trim().length < 10 && <span className="cp-hint">{t.minChars}</span>}
      </div>

      <div className="cp-field">
        <span className="cp-label">{t.attachment} <span className="cp-optional">{t.optional}</span></span>
        <input ref={fileInput} type="file" accept={CONTACT_ATTACHMENT_ACCEPT} multiple hidden
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        <div
          className={`cp-drop${dragging ? ' cp-drop-over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <ImagePlus size={32} strokeWidth={1.5} />
          <p><span className="cp-drop-link">{t.dropLink}</span> {t.dropOr}</p>
          <p className="cp-drop-hint">{t.dropHint}</p>
        </div>
        {files.length > 0 && (
          <ul className="cp-files">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span>{f.name} <em>({formatSize(f.size, t.unitKb, t.unitMb)})</em></span>
                <button type="button" aria-label={`${t.remove} ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
        {fileError && <div className="cp-error" role="alert">{fileError}</div>}
      </div>

      {/* Honeypot : invisible pour un humain, un robot le remplit et son message est ignoré côté serveur. */}
      <div className="cp-hp" aria-hidden="true">
        <label>
          {t.honeypot}
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {error && <div className="cp-error" role="alert">{error}</div>}

      <div className="cp-submit">
        <button type="submit" className="cp-btn-dark" disabled={!canSubmit}>
          <span>{loading ? t.sending : t.send}</span>
          {!loading && <ArrowRight size={16} strokeWidth={2.5} />}
        </button>
        <p className="cp-privacy">
          <Lock size={14} />
          {t.privacyNote}
        </p>
      </div>
    </form>
  )
}

function formatSize(bytes: number, kb: string, mb: string) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ${kb}` : `${(bytes / (1024 * 1024)).toFixed(1)} ${mb}`
}
