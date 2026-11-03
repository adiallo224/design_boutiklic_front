import DesktopShell from './DesktopShell'

/** Monté à la place de la racine authentifiée dans App.tsx. L'UI web étroite (MainLayout)
 *  a été supprimée : l'app mobile native est le seul canal téléphone (voir le plan bureau). */
export default function AuthenticatedShell() {
  return <DesktopShell />
}
