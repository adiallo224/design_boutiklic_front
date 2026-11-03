import type { Locale } from '@boutiklic/shared'
import { safeWebUrl } from '../lib/appearance'
import { translate } from '../lib/i18n'
import type { PublicAppearance, SocialPlatform } from '../lib/types'

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  WHATSAPP: 'WhatsApp',
  LINKEDIN: 'LinkedIn',
  YOUTUBE: 'YouTube',
}

export function SiteFooter({ name, appearance, locale }: { name: string; appearance: PublicAppearance; locale: Locale }) {
  const links = appearance.socialLinks.flatMap((l) => {
    const href = safeWebUrl(l.url)
    return href ? [{ platform: l.platform, href }] : []
  })
  return (
    <footer className="site-footer">
      <div className="wrap">
        {links.length > 0 ? (
          <nav aria-label={translate(locale, 'followUs')} className="social">
            {links.map((l) => (
              <a key={l.platform} href={l.href} rel="noopener noreferrer nofollow" target="_blank">{SOCIAL_LABELS[l.platform] ?? l.platform}</a>
            ))}
          </nav>
        ) : null}
        <p className="muted">© {new Date().getFullYear()} {name}</p>
      </div>
    </footer>
  )
}
