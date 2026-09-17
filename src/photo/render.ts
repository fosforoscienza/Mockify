import type { ArtTransform } from '../three/artwork'
import type { PhotoArea, PhotoView, Quad } from './bases'

export interface PhotoArtwork {
  source: CanvasImageSource
  width: number
  height: number
  transform: ArtTransform
}

export interface PhotoRenderOptions {
  base: HTMLImageElement
  view: PhotoView
  /** Colore del capo: null lascia la foto com'è. */
  color: string | null
  background: string | null
  width: number
  height: number
  artworks: Record<string, PhotoArtwork | null>
}

/** Matrice 3×3 che porta il quadrato unitario sul quadrilatero, in pixel. */
function squareToQuad(q: Quad, w: number, h: number) {
  const [x0, y0] = [q[0][0] * w, q[0][1] * h]
  const [x1, y1] = [q[1][0] * w, q[1][1] * h]
  const [x2, y2] = [q[2][0] * w, q[2][1] * h]
  const [x3, y3] = [q[3][0] * w, q[3][1] * h]
  const sx = x0 - x1 + x2 - x3
  const sy = y0 - y1 + y2 - y3
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1]
  }
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const den = dx1 * dy2 - dx2 * dy1
  const g = (sx * dy2 - dx2 * sy) / den
  const hh = (dx1 * sy - sx * dy1) / den
  return [x1 - x0 + g * x1, x3 - x0 + hh * x3, x0, y1 - y0 + g * y1, y3 - y0 + hh * y3, y0, g, hh, 1]
}

function invert3(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  const s = 1 / det
  return [
    A * s,
    -(b * i - c * h) * s,
    (b * f - c * e) * s,
    B * s,
    (a * i - c * g) * s,
    -(a * f - c * d) * s,
    C * s,
    -(a * h - b * g) * s,
    (a * e - b * d) * s,
  ]
}

interface BaseLayer {
  key: string
  /** Foto ridimensionata al riquadro di lavoro. */
  data: ImageData
  /** Luminanza normalizzata sul soggetto: è l'ombreggiatura riusata sulla stampa. */
  shade: Float32Array
  x: number
  y: number
  w: number
  h: number
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/**
 * Mockup su foto: la base è un'immagine vera, la grafica viene deformata
 * dentro il quadrilatero dell'area di stampa e moltiplicata per la luce della
 * foto, così pieghe, ombre e riflessi passano sopra la stampa invece di
 * lasciarla piatta e incollata.
 */
export class PhotoMockupRenderer {
  private geom: BaseLayer | null = null
  private tinted: { key: string; data: ImageData } | null = null
  private artCanvas = document.createElement('canvas')
  /** Riquadri delle aree nell'ultimo disegno, per il trascinamento. */
  private lastAreas: { id: string; matrix: number[]; inverse: number[] }[] = []

  render(canvas: HTMLCanvasElement, opts: PhotoRenderOptions) {
    const { width, height } = opts
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, width, height)
    if (opts.background) {
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, width, height)
    }

    const base = this.ensureBase(opts)
    const layer = opts.color ? this.tint(base, opts.color) : base.data
    const out = new ImageData(new Uint8ClampedArray(layer.data), base.w, base.h)

    this.lastAreas = []
    for (const area of opts.view.areas) {
      const matrix = squareToQuad(area.quad, base.w, base.h)
      const inverse = invert3(matrix)
      this.lastAreas.push({ id: area.id, matrix, inverse })
      const art = opts.artworks[area.id]
      if (art) this.compositeArtwork(out, base, area, inverse, art)
    }

    const tmp = document.createElement('canvas')
    tmp.width = base.w
    tmp.height = base.h
    tmp.getContext('2d')!.putImageData(out, 0, 0)
    ctx.drawImage(tmp, base.x, base.y)
  }

  /** Posizione dell'area nel canvas, per capire dove si sta trascinando. */
  areaFrames() {
    const b = this.geom
    if (!b) return []
    return this.lastAreas.map((a) => ({ id: a.id, inverse: a.inverse, x: b.x, y: b.y }))
  }

  private ensureBase(opts: PhotoRenderOptions): BaseLayer {
    const key = [opts.view.file, opts.width, opts.height, opts.base.src].join('|')
    if (this.geom?.key === key) return this.geom
    const iw = opts.base.naturalWidth
    const ih = opts.base.naturalHeight
    const s = Math.min(opts.width / iw, opts.height / ih)
    const w = Math.max(1, Math.round(iw * s))
    const h = Math.max(1, Math.round(ih * s))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d', { willReadFrequently: true })!
    cx.clearRect(0, 0, w, h)
    cx.drawImage(opts.base, 0, 0, w, h)
    const data = cx.getImageData(0, 0, w, h)
    const px = data.data

    // Luminanza normalizzata sul 92° percentile: il punto più chiaro del
    // soggetto diventa 1, così il colore scelto si vede pieno e le pieghe
    // restano come scostamenti sotto l'uno.
    const lum = new Float32Array(w * h)
    const hist = new Uint32Array(256)
    let opaque = 0
    for (let i = 0; i < w * h; i++) {
      const l = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255
      lum[i] = l
      if (px[i * 4 + 3] > 140) {
        hist[Math.min(255, (l * 255) | 0)]++
        opaque++
      }
    }
    let acc = 0
    let ref = 255
    const target = opaque * 0.92
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= target) {
        ref = v
        break
      }
    }
    const refL = Math.max(0.25, ref / 255)
    const shade = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) shade[i] = lum[i] / refL

    this.geom = {
      key,
      data,
      shade,
      w,
      h,
      x: Math.round((opts.width - w) / 2),
      y: Math.round((opts.height - h) / 2),
    }
    this.tinted = null
    return this.geom
  }

  /**
   * Ricolorazione del capo: il colore scelto moltiplicato per l'ombreggiatura.
   * Tocca solo il tessuto — chiaro e quasi grigio — e lascia stare grucce,
   * cordoncini e ombre riportate, che sono scuri o colorati: senza questo
   * filtro anche la gruccia di legno cambiava colore insieme alla maglietta.
   */
  private tint(base: BaseLayer, color: string): ImageData {
    if (this.tinted?.key === base.key + '|' + color) return this.tinted.data
    const rgb = hexToRgb(color)
    const src = base.data.data
    const out = new Uint8ClampedArray(src)
    for (let i = 0; i < base.w * base.h; i++) {
      if (src[i * 4 + 3] < 4) continue
      const r = src[i * 4]
      const g = src[i * 4 + 1]
      const b = src[i * 4 + 2]
      const mx = Math.max(r, g, b)
      const sat = mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx
      const s = base.shade[i]
      const mask = smoothstep(0.18, 0.4, s) * (1 - smoothstep(0.16, 0.32, sat))
      if (mask <= 0.002) continue
      out[i * 4] = clamp255(r + (rgb[0] * s - r) * mask)
      out[i * 4 + 1] = clamp255(g + (rgb[1] * s - g) * mask)
      out[i * 4 + 2] = clamp255(b + (rgb[2] * s - b) * mask)
    }
    const data = new ImageData(out, base.w, base.h)
    this.tinted = { key: base.key + '|' + color, data }
    return data
  }

  private compositeArtwork(
    out: ImageData,
    base: BaseLayer,
    area: PhotoArea,
    inverse: number[],
    art: PhotoArtwork,
  ) {
    // la grafica viene rasterizzata una volta alla risoluzione dell'area
    const xs = area.quad.map((p) => p[0] * base.w)
    const ys = area.quad.map((p) => p[1] * base.h)
    const minX = Math.max(0, Math.floor(Math.min(...xs)))
    const maxX = Math.min(base.w - 1, Math.ceil(Math.max(...xs)))
    const minY = Math.max(0, Math.floor(Math.min(...ys)))
    const maxY = Math.min(base.h - 1, Math.ceil(Math.max(...ys)))
    if (maxX <= minX || maxY <= minY) return

    const aw = Math.max(2, maxX - minX)
    const ah = Math.max(2, maxY - minY)
    this.artCanvas.width = aw
    this.artCanvas.height = ah
    const ac = this.artCanvas.getContext('2d', { willReadFrequently: true })!
    ac.clearRect(0, 0, aw, ah)
    ac.drawImage(art.source, 0, 0, aw, ah)
    const src = ac.getImageData(0, 0, aw, ah).data

    const t = art.transform
    const imageAspect = art.width / art.height
    // l'area è trattata come un quadrato unitario: la grafica ci sta dentro
    // conservando le proporzioni, poi scala, rotazione e scostamento
    const areaAspect = aw / ah
    let fw: number
    let fh: number
    if (imageAspect >= areaAspect) {
      fw = t.scale
      fh = (t.scale * areaAspect) / imageAspect
    } else {
      fh = t.scale
      fw = (t.scale * imageAspect) / areaAspect
    }
    const cos = Math.cos(-t.rotation)
    const sin = Math.sin(-t.rotation)
    const shadeAmount = area.shade ?? 1
    const dst = out.data

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * base.w + x
        if (dst[i * 4 + 3] < 8) continue
        // dal pixel al quadrato unitario dell'area
        const px = x + 0.5
        const py = y + 0.5
        const wq = inverse[6] * px + inverse[7] * py + inverse[8]
        const u = (inverse[0] * px + inverse[1] * py + inverse[2]) / wq
        const v = (inverse[3] * px + inverse[4] * py + inverse[5]) / wq
        if (u < 0 || u > 1 || v < 0 || v > 1) continue
        // dal quadrato unitario alle UV dell'immagine
        let cu = u - 0.5 - t.offsetX * 0.5
        let cv = v - 0.5 + t.offsetY * 0.5
        const ru = cu * cos - cv * sin
        const rv = cu * sin + cv * cos
        let iu = ru / fw + 0.5
        const iv = rv / fh + 0.5
        if (t.flipX) iu = 1 - iu
        if (iu < 0 || iu > 1 || iv < 0 || iv > 1) continue
        const sx = Math.min(aw - 1, (iu * aw) | 0)
        const sy = Math.min(ah - 1, (iv * ah) | 0)
        const si = (sy * aw + sx) * 4
        const sa = (src[si + 3] / 255) * t.opacity
        if (sa < 0.004) continue
        const lit = 1 - shadeAmount + shadeAmount * base.shade[i]
        const di = i * 4
        dst[di] = clamp255(dst[di] * (1 - sa) + src[si] * lit * sa)
        dst[di + 1] = clamp255(dst[di + 1] * (1 - sa) + src[si + 1] * lit * sa)
        dst[di + 2] = clamp255(dst[di + 2] * (1 - sa) + src[si + 2] * lit * sa)
      }
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const cache = new Map<string, Promise<HTMLImageElement>>()

/** Le foto di base stanno in public/basi e vengono caricate una volta sola. */
export function loadBase(folder: string, file: string): Promise<HTMLImageElement> {
  // i nomi dei file arrivano da chi li carica e contengono spazi e accenti
  const url = ['basi', folder, ...file.split('/')].map(encodeURIComponent).join('/')
  const key = folder + '/' + file
  const hit = cache.get(key)
  if (hit) return hit
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Base non trovata: ${key}`))
    img.src = '/' + url
  })
  cache.set(key, p)
  return p
}
