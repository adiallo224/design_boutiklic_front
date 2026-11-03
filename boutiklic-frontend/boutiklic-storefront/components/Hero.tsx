import type { PublicAppearance } from '../lib/types'

/** Bandeau d'accueil: bannière (si le commerçant en a envoyé une), nom et présentation de la boutique. */
export function Hero({ name, appearance }: { name: string; appearance: PublicAppearance }) {
  return (
    <section className={appearance.bannerUrl ? 'hero has-banner' : 'hero'} style={appearance.bannerUrl ? { backgroundImage: `url("${encodeURI(appearance.bannerUrl)}")` } : undefined}>
      <div className="wrap hero-inner">
        <h1>{name}</h1>
        {appearance.description ? <p className="hero-text">{appearance.description}</p> : null}
      </div>
    </section>
  )
}
