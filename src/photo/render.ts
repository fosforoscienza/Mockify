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

/** Verde chroma key: molto più verde che rosso e blu, a qualunque luminosità. */
function isGreen(r: number, g: number, b: number) {
  return g > 70 && g > r * 1.6 && g > b * 1.6
}

const crossZ = (o: number[], a: number[], b: number[]) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/** Guscio convesso, monotone chain. */
function convexHull(pts: number[][]) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lower: number[][] = []
  const upper: number[][] = []
  for (const p of pts) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * Spigoli di una regione. Il guscio viene ruotato sull'orientamento del
 * rettangolo di area minima: nel riferimento raddrizzato gli spigoli sono gli
 * estremi di x+y e x-y, cosa che su un soggetto inclinato non vale.
 * L'ordine finale è scelto confrontando le proporzioni misurate con quelle
 * attese della stampa, altrimenti la grafica può uscire ruotata di 90°.
 */
function cornersOf(hull: number[][], w: number, h: number, ratio: number): Quad {
  let minArea = Infinity
  let theta = 0
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const cs = Math.cos(-ang)
    const sn = Math.sin(-ang)
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity
    for (const p of hull) {
      const rx = p[0] * cs - p[1] * sn
      const ry = p[0] * sn + p[1] * cs
      if (rx < mnx) mnx = rx
      if (rx > mxx) mxx = rx
      if (ry < mny) mny = ry
      if (ry > mxy) mxy = ry
    }
    const area = (mxx - mnx) * (mxy - mny)
    if (area < minArea) { minArea = area; theta = ang }
  }
  const cs = Math.cos(-theta)
  const sn = Math.sin(-theta)
  let tl = hull[0], tr = hull[0], br = hull[0], bl = hull[0]
  let s1 = Infinity, s2 = -Infinity, s3 = Infinity, s4 = -Infinity
  for (const p of hull) {
    const rx = p[0] * cs - p[1] * sn
    const ry = p[0] * sn + p[1] * cs
    if (rx + ry < s1) { s1 = rx + ry; tl = p }
    if (rx + ry > s2) { s2 = rx + ry; br = p }
    if (rx - ry > s4) { s4 = rx - ry; tr = p }
    if (rx - ry < s3) { s3 = rx - ry; bl = p }
  }
  const corners = [tl, tr, br, bl]
  const len = (i: number, j: number) => Math.hypot(corners[i][0] - corners[j][0], corners[i][1] - corners[j][1])
  let pick = 0
  let bestErr = Infinity
  let bestCorner = Infinity
  for (let r = 0; r < 4; r++) {
    const i = (n: number) => (n + r) % 4
    const bw = (len(i(0), i(1)) + len(i(3), i(2))) / 2
    const bh = (len(i(0), i(3)) + len(i(1), i(2))) / 2
    const err = Math.abs(Math.log(bw / bh / ratio))
    const corner = corners[i(0)][0] + corners[i(0)][1]
    if (err < bestErr - 1e-6 || (Math.abs(err - bestErr) < 1e-6 && corner < bestCorner)) {
      bestErr = err
      bestCorner = corner
      pick = r
    }
  }
  const i = (n: number) => (n + pick) % 4
  return [corners[i(0)], corners[i(1)], corners[i(2)], corners[i(3)]].map(
    ([x, y]) => [x / w, y / h],
  ) as Quad
}

/**
 * Allarga il quadrilatero finché la regione ci sta dentro tutta.
 *
 * Gli spigoli presi dagli estremi del guscio sono inscritti nella regione, non
 * circoscritti: su un pannello in prospettiva l'estremo di x+y non cade
 * sull'angolo vero, e su uno schermo ad angoli arrotondati cade sull'arco,
 * dentro l'angolo ideale. In tutti e due i casi la grafica veniva tagliata
 * prima del bordo e restava un filo di pannello bianco scoperto.
 *
 * Qui il confine della regione viene riportato nello spazio del quadrilatero:
 * se qualche punto esce da [0,1] il riquadro viene esteso fino a contenerlo e
 * riproiettato nell'immagine. La maschera resta comunque a definire il bordo
 * visibile, quindi allargare non fa sbordare niente.
 */
function fitQuadAround(quad: Quad, border: number[][], w: number, h: number): Quad {
  let result = quad
  for (let pass = 0; pass < 4; pass++) {
    const m = squareToQuad(result, w, h)
    const inv = invert3(m)
    let umin = 0
    let umax = 1
    let vmin = 0
    let vmax = 1
    for (const [x, y] of border) {
      // il centro del pixel, che è dove il compositing campiona: usando lo
      // spigolo si perdeva mezzo pixel, e sul lato destro e in basso — dove
      // u e v arrivano a 1 — quel mezzo pixel bastava a far scartare l'ultima
      // colonna e l'ultima riga, lasciando un filo di pannello scoperto
      const px = x + 0.5
      const py = y + 0.5
      const d = inv[6] * px + inv[7] * py + inv[8]
      const u = (inv[0] * px + inv[1] * py + inv[2]) / d
      const v = (inv[3] * px + inv[4] * py + inv[5]) / d
      if (u < umin) umin = u
      if (u > umax) umax = u
      if (v < vmin) vmin = v
      if (v > vmax) vmax = v
    }
    if (umin >= 0 && vmin >= 0 && umax <= 1 && vmax <= 1) break
    const at = (u: number, v: number): [number, number] => {
      const d = m[6] * u + m[7] * v + m[8]
      return [(m[0] * u + m[1] * v + m[2]) / d / w, (m[3] * u + m[4] * v + m[5]) / d / h]
    }
    // un margine minimo perché l'ultimo pixel non cada proprio sul confine
    const pad = 0.004
    result = [
      at(umin - pad, vmin - pad),
      at(umax + pad, vmin - pad),
      at(umax + pad, vmax + pad),
      at(umin - pad, vmax + pad),
    ]
  }
  return result
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
  /** Foto ridimensionata al riquadro di lavoro, col verde già sostituito. */
  data: ImageData
  /** Luminanza normalizzata sul soggetto: è l'ombreggiatura riusata sulla stampa. */
  shade: Float32Array
  /** Aree trovate dal verde: maschera esatta e spigoli, per id di area. */
  green: Map<string, GreenArea>
  x: number
  y: number
  w: number
  h: number
}

/**
 * Area di stampa ricavata dal green screen. La maschera è esatta, quindi gli
 * angoli arrotondati di uno schermo restano arrotondati; il quadrilatero serve
 * comunque, perché è lui a portare la prospettiva nella mappatura delle UV.
 */
interface GreenArea {
  mask: Uint8Array
  quad: Quad
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Tetto al buffer della grafica: oltre non si guadagna nitidezza, si perde tempo. */
const MAX_ART_BUFFER = 4096

/**
 * Debordo dell'area di stampa. Gli spigoli sono rilevati sul confine della
 * regione chiara, che la soglia erode sempre di un pixel o due: senza questo
 * margine resta un filo di pannello scoperto lungo i bordi. Su una stampa vera
 * è anche il comportamento giusto, il manifesto va sotto la cornice.
 */
const OVERFILL = 1.015

/** Allarga il quadrilatero attorno al proprio centro. */
function expandQuad(quad: Quad, k: number): Quad {
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  return quad.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]) as Quad
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
      const detected = base.green.get(area.id)
      const quad = detected?.quad ?? area.quad
      if (!quad) continue
      // il verde dà già il confine esatto: allargarlo sconfinerebbe sulla cornice
      const matrix = squareToQuad(detected ? quad : expandQuad(quad, OVERFILL), base.w, base.h)
      const inverse = invert3(matrix)
      this.lastAreas.push({ id: area.id, matrix, inverse })
      const art = opts.artworks[area.id]
      if (art) this.compositeArtwork(out, base, area, quad, inverse, art, detected?.mask)
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

    const green = this.findGreenAreas(opts.view, data, lum, shade, w, h)

    this.geom = {
      key,
      data,
      shade,
      green,
      w,
      h,
      x: Math.round((opts.width - w) / 2),
      y: Math.round((opts.height - h) / 2),
    }
    this.tinted = null
    return this.geom
  }

  /**
   * Trova le aree dipinte di verde e le neutralizza.
   *
   * Il verde serve a due cose insieme: dice dove sta l'area di stampa, con gli
   * spigoli esatti e una maschera che segue anche gli angoli arrotondati di uno
   * schermo; e porta la luce della scena, perché è stato dipinto sotto ombre e
   * riflessi. Una volta misurato viene sostituito da carta bianca che conserva
   * quella stessa luce, così a grafica assente resta un pannello credibile
   * invece di una macchia verde.
   *
   * Con più aree verdi nella stessa foto contano da sinistra a destra,
   * nell'ordine in cui sono dichiarate.
   */
  private findGreenAreas(
    view: PhotoView,
    data: ImageData,
    lum: Float32Array,
    shade: Float32Array,
    w: number,
    h: number,
  ) {
    const found = new Map<string, GreenArea>()
    const areas = view.areas.filter((a) => a.green)
    if (!areas.length) return found

    const px = data.data
    const seen = new Uint8Array(w * h)
    const comps: number[][] = []
    const stack: number[] = []
    for (let start = 0; start < w * h; start++) {
      if (seen[start]) continue
      seen[start] = 1
      if (!isGreen(px[start * 4], px[start * 4 + 1], px[start * 4 + 2])) continue
      const pixels: number[] = []
      stack.push(start)
      while (stack.length) {
        const p = stack.pop()!
        pixels.push(p)
        const col = p % w
        for (const q of [p - 1, p + 1, p - w, p + w]) {
          if (q < 0 || q >= w * h || seen[q]) continue
          if (Math.abs((q % w) - col) > 1) continue
          seen[q] = 1
          if (isGreen(px[q * 4], px[q * 4 + 1], px[q * 4 + 2])) stack.push(q)
        }
      }
      if (pixels.length > w * h * 0.002) comps.push(pixels)
    }
    comps.sort((a, b) => b.length - a.length)
    const chosen = comps.slice(0, areas.length)
    const leftOf = (c: number[]) => c.reduce((m, p) => Math.min(m, p % w), w)
    chosen.sort((a, b) => leftOf(a) - leftOf(b))

    chosen.forEach((pixels, index) => {
      const area = areas[index]
      if (!area) return
      const mask = new Uint8Array(w * h)
      for (const p of pixels) mask[p] = 1

      // La luce si normalizza sul verde stesso: il suo punto più chiaro è la
      // carta in piena luce, il resto scende con le ombre della scena.
      const sorted = pixels.map((p) => lum[p]).sort((a, b) => a - b)
      const refGreen = Math.max(0.15, sorted[Math.floor(sorted.length * 0.97)])
      for (const p of pixels) {
        const k = Math.min(1.15, lum[p] / refGreen)
        shade[p] = k
        const v = clamp255(k * 255)
        px[p * 4] = v
        px[p * 4 + 1] = v
        px[p * 4 + 2] = v
      }

      // Sbavatura del verde: dove qualcosa passa davanti all'area — l'auto
      // sfocata davanti al cartellone — i pixel restano misti e tengono una
      // dominante verde che il key non ha preso. Nell'intorno dell'area il
      // canale verde viene riportato alla media di rosso e blu, che è quello
      // che fa una spill suppression da chroma key. Solo nell'intorno: più in
      // là c'è dell'edera vera che non va toccata.
      const near = new Uint8Array(mask)
      const spread = Math.max(3, Math.round(Math.max(w, h) * 0.016))
      const prev = new Uint8Array(w * h)
      for (let pass = 0; pass < spread; pass++) {
        prev.set(near)
        for (let p = 0; p < w * h; p++) {
          if (prev[p]) continue
          const col = p % w
          if ((col > 0 && prev[p - 1]) || (col < w - 1 && prev[p + 1]) ||
              (p >= w && prev[p - w]) || (p < w * (h - 1) && prev[p + w])) near[p] = 1
        }
      }
      for (let p = 0; p < w * h; p++) {
        if (!near[p] || mask[p]) continue
        const r = px[p * 4]
        const g = px[p * 4 + 1]
        const b = px[p * 4 + 2]
        const neutral = (r + b) / 2
        if (g > neutral) px[p * 4 + 1] = neutral
      }

      const border: number[][] = []
      for (const p of pixels) {
        const col = p % w
        const row = (p / w) | 0
        if (col === 0 || col === w - 1 || row === 0 || row === h - 1 ||
            !mask[p - 1] || !mask[p + 1] || !mask[p - w] || !mask[p + w]) border.push([col, row])
      }
      const corners = cornersOf(convexHull(border), w, h, area.ratio ?? 1)
      found.set(area.id, { mask, quad: fitQuadAround(corners, border, w, h) })
    })
    return found
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
    quad: Quad,
    inverse: number[],
    art: PhotoArtwork,
    mask?: Uint8Array,
  ) {
    const xs = quad.map((p) => p[0] * base.w)
    const ys = quad.map((p) => p[1] * base.h)
    const minX = Math.max(0, Math.floor(Math.min(...xs)))
    const maxX = Math.min(base.w - 1, Math.ceil(Math.max(...xs)))
    const minY = Math.max(0, Math.floor(Math.min(...ys)))
    const maxY = Math.min(base.h - 1, Math.ceil(Math.max(...ys)))
    if (maxX <= minX || maxY <= minY) return

    const t = art.transform
    const imageAspect = art.width / art.height
    // Le proporzioni dell'area si misurano sui lati del quadrilatero, non sul
    // riquadro che lo contiene: su una foto in prospettiva quel riquadro è più
    // grande del quadrilatero, e la grafica finirebbe schiacciata.
    const q = quad
    const side = (a: number[], b: number[]) =>
      Math.hypot((a[0] - b[0]) * base.w, (a[1] - b[1]) * base.h)
    const quadW = (side(q[0], q[1]) + side(q[3], q[2])) / 2
    const quadH = (side(q[0], q[3]) + side(q[1], q[2])) / 2
    const areaAspect = quadW / quadH
    // 'cover' riempie l'area e deborda sul lato lungo: è quello che serve dove
    // la stampa copre tutto il supporto — schermi, manifesti, poster. Su un
    // capo la stampa resta invece inscritta nell'area petto.
    const cover = area.fill === 'cover'
    let fw: number
    let fh: number
    if ((imageAspect >= areaAspect) !== cover) {
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

    // Risoluzione del buffer della grafica: quella che serve alla porzione
    // davvero visibile, non quella del riquadro che contiene il quadrilatero.
    // L'area copre 1/fw della larghezza dell'immagine su quadW pixel, quindi
    // l'immagine intera a quell'ingrandimento vuole quadW * fw pixel. Con una
    // foto orizzontale su uno schermo verticale la differenza è di tre volte,
    // ed è il motivo per cui la grafica usciva sgranata.
    const bufW = Math.max(2, Math.min(art.width, MAX_ART_BUFFER, Math.ceil(quadW * fw)))
    const bufH = Math.max(2, Math.min(art.height, MAX_ART_BUFFER, Math.ceil(quadH * fh)))
    this.artCanvas.width = bufW
    this.artCanvas.height = bufH
    const ac = this.artCanvas.getContext('2d', { willReadFrequently: true })!
    ac.clearRect(0, 0, bufW, bufH)
    ac.imageSmoothingEnabled = true
    ac.imageSmoothingQuality = 'high'
    ac.drawImage(art.source, 0, 0, bufW, bufH)
    const src = ac.getImageData(0, 0, bufW, bufH).data

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * base.w + x
        if (dst[i * 4 + 3] < 8) continue
        // con il green screen il confine è la maschera, non il quadrilatero:
        // così gli angoli arrotondati di uno schermo restano arrotondati
        if (mask && !mask[i]) continue
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
        // bilineare: col campionamento al pixel più vicino la grafica si
        // sgranava, perché un pixel dell'area quasi mai cade su uno dell'immagine
        const fx = iu * (bufW - 1)
        const fy = iv * (bufH - 1)
        const sx = fx | 0
        const sy = fy | 0
        const sx1 = sx + 1 < bufW ? sx + 1 : sx
        const sy1 = sy + 1 < bufH ? sy + 1 : sy
        const tx = fx - sx
        const ty = fy - sy
        const i00 = (sy * bufW + sx) * 4
        const i10 = (sy * bufW + sx1) * 4
        const i01 = (sy1 * bufW + sx) * 4
        const i11 = (sy1 * bufW + sx1) * 4
        const w00 = (1 - tx) * (1 - ty)
        const w10 = tx * (1 - ty)
        const w01 = (1 - tx) * ty
        const w11 = tx * ty
        const mix = (o: number) =>
          src[i00 + o] * w00 + src[i10 + o] * w10 + src[i01 + o] * w01 + src[i11 + o] * w11
        const sa = (mix(3) / 255) * t.opacity
        if (sa < 0.004) continue
        const lit = 1 - shadeAmount + shadeAmount * base.shade[i]
        const di = i * 4
        dst[di] = clamp255(dst[di] * (1 - sa) + mix(0) * lit * sa)
        dst[di + 1] = clamp255(dst[di + 1] * (1 - sa) + mix(1) * lit * sa)
        dst[di + 2] = clamp255(dst[di + 2] * (1 - sa) + mix(2) * lit * sa)
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
