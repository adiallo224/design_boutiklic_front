import { useEffect } from 'react'

/** Raccourcis clavier globaux bureau. Échap est géré par chaque Modal (le plus récent monté
 *  gagne) ; Entrée reste la soumission native des formulaires. F2 focus la recherche affichée
 *  dans la TopBar (ex. recherche produit en caisse) via son id stable, sans registre global —
 *  cf. spec bureau, "Comportements bureau à implémenter". */
export function useDesktopShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        const search = document.getElementById('desktop-topbar-search') as HTMLInputElement | null
        if (search) {
          e.preventDefault()
          search.focus()
          search.select()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
