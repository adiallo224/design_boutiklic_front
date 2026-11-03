'use client'

/** Panne du core ou du réseau côté serveur: message calme et nouvel essai, sans détail technique. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap center">
      <h1>Service momentanément indisponible</h1>
      <p className="muted">Merci de réessayer dans un instant.</p>
      <button type="button" className="btn inline" onClick={reset}>Réessayer</button>
    </main>
  )
}
