/** Retire l'iframe d'impression au plus tard après ce délai si `afterprint` ne se déclenche jamais. */
const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Imprime un document HTML complet (celui de `buildLabelsDocument`) via le dialogue d'impression du
 * système, dans un iframe masqué : isolé des styles de l'app (`@media print`, sidebar bureau…), donc la
 * mise en page en mm du document est appliquée telle quelle. Même chemin sur web et Tauri (WebView2) que
 * les reçus/factures existants (`window.print`).
 *
 * La promesse se résout dès que le dialogue est ouvert (pas quand l'impression est terminée : le
 * navigateur ne dit pas si l'utilisateur a imprimé ou annulé). L'iframe est retiré à `afterprint`, ou par
 * sécurité après 5 minutes — jamais tout de suite, certains moteurs impriment de façon asynchrone.
 */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' })

    let removed = false
    const remove = () => {
      if (removed) return
      removed = true
      iframe.remove()
    }

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow
      if (!frameWindow) {
        remove()
        reject(new Error('Impossible d’ouvrir le document à imprimer.'))
        return
      }
      frameWindow.addEventListener('afterprint', remove)
      window.setTimeout(remove, CLEANUP_TIMEOUT_MS)
      try {
        frameWindow.focus()
        frameWindow.print()
        resolve()
      } catch (error) {
        remove()
        reject(error instanceof Error ? error : new Error('Échec de l’ouverture de l’impression.'))
      }
    }

    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}
