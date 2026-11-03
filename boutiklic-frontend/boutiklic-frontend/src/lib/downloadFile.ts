import { isTauri } from '@tauri-apps/api/core'

/** Sauvegarde un blob (PDF/Excel/ZIP/…) sur disque. Le pattern navigateur classique
 *  (`URL.createObjectURL` + `<a download>`) écrit un fichier de 0 octet dans l'app desktop : le
 *  gestionnaire de téléchargement natif de WebView2 (utilisé par Tauri) ne peut pas résoudre une
 *  URL `blob:`, qui n'existe que dans le contexte JS de la page qui l'a créée — d'où l'écriture
 *  directe via plugin-fs/plugin-dialog quand on tourne dans Tauri, et le téléchargement navigateur
 *  classique sinon (web, mobile web). */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename })
    if (!path) return
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
