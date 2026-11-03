interface FlagIconProps {
  countryId: string
  className?: string
}

/** Drapeau pays en SVG (flag-icons, cf. package.json) — pas d'emoji Unicode, dont le rendu est
 *  peu fiable selon la plateforme (ex. Segoe UI Emoji sous Windows/WebView2 ne couvre pas tous
 *  les indicateurs régionaux, drapeau invisible dans le desktop Tauri). La taille suit le
 *  font-size hérité (classes text-* Tailwind), comme le faisait l'ancien span emoji. */
export default function FlagIcon({ countryId, className }: FlagIconProps) {
  return <span className={`fi fi-${countryId.toLowerCase()} ${className ?? ''}`} />
}
