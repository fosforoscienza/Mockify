import { jsPDF } from 'jspdf'

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * PDF con pagina della stessa proporzione dell'inquadratura.
 * Il PNG conserva la trasparenza: la pagina resta pulita attorno al mockup.
 */
export function downloadPdf(dataUrl: string, pxW: number, pxH: number, filename: string, dpi = 300) {
  const mmW = (pxW / dpi) * 25.4
  const mmH = (pxH / dpi) * 25.4
  const pdf = new jsPDF({
    unit: 'mm',
    format: [mmW, mmH],
    orientation: mmW >= mmH ? 'landscape' : 'portrait',
    compress: true,
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, mmW, mmH, undefined, 'FAST')
  pdf.save(filename)
}

export function safeFilename(parts: (string | undefined)[]) {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
