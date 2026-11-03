/**
 * Génération PDF 100% côté client (hors ligne) — repli quand le backend (OpenPDF, texte vectoriel,
 * cf. billingApi.downloadPdf/downloadInvoicePdf) est inaccessible. Capture le DOM déjà utilisé pour
 * l'impression (#quote-print-root / #invoice-print-root, déjà à jour avec les données affichées) en
 * image, puis l'intègre dans un PDF A4 — pas de duplication du template OpenPDF en JS (un seul
 * template HTML à maintenir, déjà là pour @media print), au prix d'un texte non sélectionnable
 * (image) plutôt que vectoriel.
 *
 * `jspdf`/`html2canvas` sont importés dynamiquement (jamais dans le bundle principal) : ce chemin
 * n'est utilisé qu'en repli hors ligne, et le bundle principal doit rester sous la limite de
 * précache Workbox (2 Mio/fichier, cf. vite.config.ts) — un import dynamique produit un chunk
 * séparé, plus petit, que Workbox précache quand même (globPatterns couvre tous les .js), donc
 * toujours disponible hors ligne dès le premier chargement en ligne de l'app.
 */
export async function renderElementToPdfBlob(elementId: string): Promise<Blob> {
  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Élément #${elementId} introuvable pour la génération PDF hors ligne`)
  }

  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2, // netteté suffisante à l'impression sans PDF démesuré
    backgroundColor: '#ffffff',
    useCORS: true,
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageHeight = (canvas.height * pageWidth) / canvas.width
  const imageData = canvas.toDataURL('image/png')

  if (imageHeight <= pageHeight) {
    pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, imageHeight)
  } else {
    // Contenu plus long qu'une page A4 (devis avec beaucoup d'articles) : découpe en plusieurs
    // pages plutôt que d'écraser l'image — même image redécoupée verticalement page par page.
    let remainingHeight = imageHeight
    let offset = 0
    while (remainingHeight > 0) {
      pdf.addImage(imageData, 'PNG', 0, offset, pageWidth, imageHeight)
      remainingHeight -= pageHeight
      offset -= pageHeight
      if (remainingHeight > 0) pdf.addPage()
    }
  }

  return pdf.output('blob')
}
