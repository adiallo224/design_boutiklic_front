/** Ex-bascule bureau/mobile réactive au redimensionnement (matchMedia sur 1280px) — retirée par
 *  décision produit : un visiteur qui réduit la fenêtre (web ou desktop Tauri) ne doit plus jamais
 *  retomber sur l'UI tactile, y compris tout près du minWidth Tauri (dont la mesure inclut la
 *  fenêtre OS, pas juste le contenu, ce qui faisait basculer l'UI en permanence). L'app mobile
 *  native reste le canal prévu pour un usage téléphone. Signature conservée (5 appelants) même si
 *  `breakpointPx` n'est plus utilisé. */
export function useIsDesktop(_breakpointPx?: number): boolean {
  return true
}
