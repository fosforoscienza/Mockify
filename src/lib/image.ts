export interface LoadedImage {
  id: string
  name: string
  url: string
  width: number
  height: number
  bytes: number
  element: HTMLImageElement
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_BYTES = 30 * 1024 * 1024

export class ImageError extends Error {}

let counter = 0

export function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED.includes(file.type.toLowerCase())) {
      reject(new ImageError('Formato non supportato: carica un file PNG, JPG o WebP.'))
      return
    }
    if (file.size > MAX_BYTES) {
      reject(new ImageError('Il file supera i 30 MB. Riduci la risoluzione e riprova.'))
      return
    }
    const url = URL.createObjectURL(file)
    const element = new Image()
    element.onload = () => {
      resolve({
        id: `img-${++counter}-${Date.now().toString(36)}`,
        name: file.name,
        url,
        width: element.naturalWidth,
        height: element.naturalHeight,
        bytes: file.size,
        element,
      })
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageError('Impossibile leggere l’immagine: il file potrebbe essere danneggiato.'))
    }
    element.src = url
  })
}

export function releaseImage(image: LoadedImage) {
  URL.revokeObjectURL(image.url)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Prima immagine utile da un evento di drop o incolla. */
export function imageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null
  if (dt.files && dt.files.length) {
    for (const file of Array.from(dt.files)) {
      if (file.type.startsWith('image/')) return file
    }
    return dt.files[0]
  }
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) return file
      }
    }
  }
  return null
}
