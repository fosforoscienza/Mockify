import { ShapeField, type Pt } from './field'
import { ValueNoise } from './noise'
import { bounds } from './shape'
import type { Band, GarmentSpec, GarmentView, Seam } from './garments'

/**
 * Renderer 2D dei capi distesi.
 *
 * Invece di modellare un capo in 3D si costruisce una mappa di rilievo — forma
 * d'insieme, pieghe, grinze, collo, cuciture e orli — e la si illumina per
 * pixel. A questa risoluzione si vede la maglia del tessuto e le ombre sono
 * scritte a mano dove servono: il risultato regge molto meglio dell'equivalente
 * poligonale. La grafica caricata viene deformata dal gradiente delle pieghe e
 * moltiplicata per la stessa luce del capo, così sembra stampata sulla stoffa.
 */

export interface ArtTransform2D {
  offsetX: number
  offsetY: number
  scale: number
  rotation: number
  opacity: number
  flipX: boolean
}

export interface FlatArtwork {
  source: CanvasImageSource
  width: number
  height: number
  transform: ArtTransform2D
}

export type FlatView = 'front' | 'back' | 'both'

export interface FlatRenderOptions {
  spec: GarmentSpec
  view: FlatView
  color: string
  width: number
  height: number
  background: string | null
  shadow: boolean
  artwork?: FlatArtwork | null
  /** Solo nella vista affiancata: la grafica del retro. */
  artworkBack?: FlatArtwork | null
}

/** Parte costosa: dipende da sagoma, vista e dimensioni, non dal colore. */
interface GeometryLayer {
  key: string
  width: number
  height: number
  light: Float32Array
  alpha: Uint8Array
  mask: Uint8Array
  /** Rettangolo dell'area di stampa in pixel. */
  print: { x: number; y: number; w: number; h: number }
  shade: Float32Array
  gradX: Float32Array
  gradY: Float32Array
}

/** Parte economica: il capo tinto del colore scelto. */
interface BaseLayer extends GeometryLayer {
  colorKey: string
  image: ImageData
  canvas: HTMLCanvasElement
}

const LIGHT = normalize(-0.42, -0.6, 0.68)
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function normalize(x: number, y: number, z: number) {
  const l = Math.hypot(x, y, z) || 1
  return { x: x / l, y: y / l, z: z / l }
}

function hexToRgb(hex: string) {
  const v = hex.replace('#', '')
  const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  }
}

/** Compressione morbida delle alte luci: il bianco non si spegne su un piatto. */
function knee(v: number) {
  if (v <= 0.78) return v
  return 0.78 + (1 - Math.exp(-(v - 0.78) * 2.6)) * 0.22
}

export class FlatGarmentRenderer {
  private geom: GeometryLayer | null = null
  private base: BaseLayer | null = null
  private layout = { scale: 1, offsetX: 0, offsetY: 0 }
  private patchCanvas = document.createElement('canvas')
  private subFront?: FlatGarmentRenderer
  private subBack?: FlatGarmentRenderer
  private content = { x: 0, y: 0, w: 0, h: 0 }

  /** Da unità capo a pixel del canvas. */
  private toPx(p: Pt) {
    return {
      x: this.layout.offsetX + p.x * this.layout.scale,
      y: this.layout.offsetY - p.y * this.layout.scale,
    }
  }

  render(target: HTMLCanvasElement, opts: FlatRenderOptions) {
    const ctx = target.getContext('2d')!
    if (target.width !== opts.width || target.height !== opts.height) {
      target.width = opts.width
      target.height = opts.height
    }
    if (opts.view === 'both') {
      this.renderBoth(ctx, opts)
      return
    }
    const base = this.ensureBase(opts)

    ctx.clearRect(0, 0, opts.width, opts.height)
    if (opts.background) {
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, opts.width, opts.height)
    }
    if (opts.shadow) this.drawShadow(ctx, base)
    ctx.drawImage(base.canvas, 0, 0)

    if (opts.artwork) {
      const patch = this.compositeArtwork(base, opts.artwork)
      if (patch) {
        this.patchCanvas.width = patch.data.width
        this.patchCanvas.height = patch.data.height
        this.patchCanvas.getContext('2d')!.putImageData(patch.data, 0, 0)
        ctx.drawImage(this.patchCanvas, patch.x, patch.y)
      }
    }
  }

  /** Riquadro occupato dal capo dentro il canvas, in pixel. */
  contentRect() {
    return this.content
  }

  /** Coordinate dell'area di stampa, per il trascinamento della grafica. */
  printRect() {
    return this.base?.print ?? null
  }

  /**
   * Vista affiancata: fronte e retro leggermente sovrapposti, con l'ombra del
   * capo davanti proiettata su quello dietro. Esce in un file solo.
   */
  private renderBoth(ctx: CanvasRenderingContext2D, opts: FlatRenderOptions) {
    const { width, height } = opts
    ctx.clearRect(0, 0, width, height)
    if (opts.background) {
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, width, height)
    }

    const w = Math.round(width * 0.56)
    const h = Math.round(height * 0.94)
    const y = Math.round((height - h) / 2)

    this.subBack ??= new FlatGarmentRenderer()
    this.subFront ??= new FlatGarmentRenderer()
    const sub = { ...opts, width: w, height: h, background: null, shadow: false }
    const backCanvas = document.createElement('canvas')
    this.subBack.render(backCanvas, { ...sub, view: 'back', artwork: opts.artworkBack ?? null })
    const frontCanvas = document.createElement('canvas')
    this.subFront.render(frontCanvas, { ...sub, view: 'front', artwork: opts.artwork ?? null })

    // posizione calcolata sul riquadro reale del capo: la sovrapposizione è
    // un'ottava parte della sua larghezza, e la coppia resta centrata
    const c = this.subFront.contentRect()
    const step = c.w * 0.62
    const totalW = c.w + step
    const frontX = Math.round((width - totalW) / 2 - c.x)
    const backX = Math.round(frontX + step)

    if (opts.shadow) this.drawSilhouetteShadow(ctx, backCanvas, backX, y, width * 0.01, 0.4)
    ctx.drawImage(backCanvas, backX, y)
    // ombra del capo davanti su quello dietro
    this.drawSilhouetteShadow(ctx, frontCanvas, frontX, y, width * 0.012, 0.42)
    ctx.drawImage(frontCanvas, frontX, y)
  }

  /** Proietta la sagoma di un canvas come ombra sfocata. */
  private drawSilhouetteShadow(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    x: number,
    y: number,
    offset: number,
    alpha: number,
  ) {
    const shadow = document.createElement('canvas')
    shadow.width = source.width
    shadow.height = source.height
    const sctx = shadow.getContext('2d')!
    sctx.drawImage(source, 0, 0)
    sctx.globalCompositeOperation = 'source-in'
    sctx.fillStyle = '#000'
    sctx.fillRect(0, 0, shadow.width, shadow.height)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.filter = `blur(${Math.max(2, Math.round(offset * 1.6))}px)`
    ctx.drawImage(shadow, x + offset, y + offset * 0.8)
    ctx.restore()
  }

  private ensureBase(opts: FlatRenderOptions) {
    const key = [opts.spec.id, opts.view, opts.width, opts.height].join('|')
    if (!this.geom || this.geom.key !== key) {
      this.geom = this.buildGeometry(opts, key)
      this.base = null
    }
    if (!this.base || this.base.colorKey !== opts.color) {
      this.base = this.colorize(this.geom, opts.color)
    }
    return this.base
  }

  /** Ricolorazione: moltiplica la luce già calcolata, niente da ricostruire. */
  private colorize(geom: GeometryLayer, color: string): BaseLayer {
    const rgb = hexToRgb(color)
    const image = new ImageData(geom.width, geom.height)
    const data = image.data
    for (let i = 0; i < geom.light.length; i++) {
      const a = geom.alpha[i]
      if (!a) continue
      const light = geom.light[i]
      const i4 = i * 4
      data[i4] = 255 * knee(rgb.r * light)
      data[i4 + 1] = 255 * knee(rgb.g * light)
      data[i4 + 2] = 255 * knee(rgb.b * light)
      data[i4 + 3] = a
    }
    const canvas = document.createElement('canvas')
    canvas.width = geom.width
    canvas.height = geom.height
    canvas.getContext('2d')!.putImageData(image, 0, 0)
    return { ...geom, colorKey: color, image, canvas }
  }

  // ------------------------------------------------------------- costruzione

  private buildGeometry(opts: FlatRenderOptions, key: string): GeometryLayer {
    const view = opts.view === 'front' ? opts.spec.front : opts.spec.back
    const { width, height } = opts
    const box = bounds(view.outline)
    const margin = 0.075
    const scale = Math.min(width / (box.w + margin * 2), height / (box.h + margin * 2))
    this.layout = {
      scale,
      offsetX: width / 2 - ((box.x + box.w / 2) * scale),
      offsetY: height / 2 + ((box.y + box.h / 2) * scale),
    }

    const topLeft = this.toPx({ x: box.x, y: box.y + box.h })
    this.content = {
      x: topLeft.x,
      y: topLeft.y,
      w: box.w * scale,
      h: box.h * scale,
    }

    const mask = this.rasterizeMask(view, width, height)
    const field = new ShapeField(view.outline, bounds(view.outline, 0.05), 200, 0.15)
    const detail = this.rasterizeDetails(view, width, height)
    const heights = this.buildHeights(view, field, mask, detail, width, height, scale)
    const alpha = this.computeLight(opts, view, mask, heights, width, height, scale)

    // dati dell'area di stampa, usati per integrare la grafica
    const c = this.toPx({ x: view.print.cx, y: view.print.cy })
    const pw = view.print.w * scale
    const ph = view.print.h * scale
    const print = {
      x: Math.max(0, Math.round(c.x - pw / 2)),
      y: Math.max(0, Math.round(c.y - ph / 2)),
      w: Math.min(width, Math.round(pw)),
      h: Math.min(height, Math.round(ph)),
    }
    const shade = new Float32Array(print.w * print.h)
    const gradX = new Float32Array(print.w * print.h)
    const gradY = new Float32Array(print.w * print.h)
    for (let j = 0; j < print.h; j++) {
      for (let i = 0; i < print.w; i++) {
        const px = print.x + i
        const py = print.y + j
        const idx = py * width + px
        shade[j * print.w + i] = heights.light[idx]
        gradX[j * print.w + i] = heights.gx[idx]
        gradY[j * print.w + i] = heights.gy[idx]
      }
    }

    return { key, width, height, light: heights.light, alpha, mask, print, shade, gradX, gradY }
  }

  /** 255 = tessuto, 120 = interno visibile dalla scollatura, 0 = fuori. */
  private rasterizeMask(view: GarmentView, width: number, height: number) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    this.tracePath(ctx, view.outline)
    ctx.fill()
    ctx.fillStyle = '#787878'
    ctx.beginPath()
    this.tracePath(ctx, view.neckHole)
    ctx.fill()
    const data = ctx.getImageData(0, 0, width, height).data
    const mask = new Uint8Array(width * height)
    for (let i = 0; i < mask.length; i++) {
      const a = data[i * 4 + 3]
      mask[i] = a < 8 ? 0 : data[i * 4]
    }
    return mask
  }

  private tracePath(ctx: CanvasRenderingContext2D, poly: Pt[]) {
    poly.forEach((p, i) => {
      const q = this.toPx(p)
      if (i === 0) ctx.moveTo(q.x, q.y)
      else ctx.lineTo(q.x, q.y)
    })
    ctx.closePath()
  }

  /**
   * Dettagli disegnati come mappa: il rosso porta il rilievo (128 = neutro),
   * il verde lo scurimento dell'albedo. Da qui collo, orli e cuciture.
   */
  private rasterizeDetails(view: GarmentView, width: number, height: number) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgb(128,128,0)'
    ctx.fillRect(0, 0, width, height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const stroke = (points: Pt[], widthUnits: number, red: number, green: number) => {
      ctx.strokeStyle = `rgb(${Math.round(red)},${Math.round(green)},0)`
      ctx.lineWidth = Math.max(1, widthUnits * this.layout.scale)
      ctx.beginPath()
      points.forEach((p, i) => {
        const q = this.toPx(p)
        if (i === 0) ctx.moveTo(q.x, q.y)
        else ctx.lineTo(q.x, q.y)
      })
      ctx.stroke()
    }

    const toRed = (mm: number) => 128 + Math.max(-127, Math.min(127, mm * 28))
    const toGreen = (shade: number) => 128 - Math.max(-127, Math.min(127, shade * 255))

    view.patches?.forEach((patch) => {
      ctx.fillStyle = `rgb(${Math.round(toRed(patch.height))},${Math.round(toGreen(patch.shade ?? 0))},0)`
      ctx.beginPath()
      this.tracePath(ctx, patch.points)
      ctx.fill()
    })

    view.bands.forEach((band: Band) => {
      stroke(band.points, band.width, toRed(band.height), toGreen(band.shade ?? 0))
      if (band.ribbed) this.strokeRibs(ctx, band, toRed)
    })
    view.seams.forEach((seam: Seam) => {
      stroke(seam.points, seam.width, toRed(seam.depth), toGreen(0.04))
    })
    // impunture: due fili chiari affiancati al solco
    view.seams
      .filter((s) => s.stitch)
      .forEach((seam) => {
        const off = seam.width * 1.6
        for (const dir of [-1, 1]) {
          const shifted = offsetPolyline(seam.points, off * dir)
          stroke(shifted, seam.width * 0.5, toRed(0.35), toGreen(-0.02))
        }
      })

    // l'interno della scollatura: più scuro in alto, dove è più profondo
    const holeBox = bounds(view.neckHole)
    const top = this.toPx({ x: holeBox.x, y: holeBox.y + holeBox.h })
    const bottom = this.toPx({ x: holeBox.x, y: holeBox.y })
    const grad = ctx.createLinearGradient(0, top.y, 0, bottom.y)
    grad.addColorStop(0, 'rgb(128,196,0)')
    grad.addColorStop(1, 'rgb(128,150,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    this.tracePath(ctx, view.neckHole)
    ctx.fill()

    if (view.label) {
      const c = this.toPx({ x: view.label.cx, y: view.label.cy })
      const w = view.label.w * this.layout.scale
      const h = view.label.h * this.layout.scale
      ctx.fillStyle = 'rgb(140,60,0)'
      ctx.fillRect(c.x - w / 2, c.y - h / 2, w, h)
    }

    const data = ctx.getImageData(0, 0, width, height).data
    const relief = new Float32Array(width * height)
    const albedo = new Float32Array(width * height)
    for (let i = 0; i < relief.length; i++) {
      relief[i] = (data[i * 4] - 128) / 28
      albedo[i] = (128 - data[i * 4 + 1]) / 255
    }
    blurFloat(relief, width, height, Math.max(1, Math.round(this.layout.scale * 0.004)))
    blurFloat(albedo, width, height, Math.max(1, Math.round(this.layout.scale * 0.003)))
    return { relief, albedo }
  }

  /**
   * Costine: trattini perpendicolari alla fascia, come i solchi di una maglia
   * a coste. Sono il dettaglio che fa leggere collo, polsini e orlo.
   */
  private strokeRibs(
    ctx: CanvasRenderingContext2D,
    band: Band,
    toRed: (mm: number) => number,
  ) {
    const step = 0.0032
    const half = (band.width / 2) * 0.92
    ctx.lineWidth = Math.max(1, step * 0.42 * this.layout.scale)
    let carry = 0
    let up = true
    for (let i = 1; i < band.points.length; i++) {
      const a = band.points[i - 1]
      const b = band.points[i]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy)
      if (len < 1e-6) continue
      const nx = dy / len
      const ny = -dx / len
      for (let t = carry; t < len; t += step) {
        const cx = a.x + (dx / len) * t
        const cy = a.y + (dy / len) * t
        const p1 = this.toPx({ x: cx + nx * half, y: cy + ny * half })
        const p2 = this.toPx({ x: cx - nx * half, y: cy - ny * half })
        ctx.strokeStyle = `rgb(${Math.round(toRed(up ? band.height * 0.45 : -band.height * 0.3))},128,0)`
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        up = !up
        carry = t + step - len
      }
    }
  }

  /** Mappa di rilievo completa e relativo gradiente. */
  private buildHeights(
    view: GarmentView,
    field: ShapeField,
    mask: Uint8Array,
    detail: { relief: Float32Array; albedo: Float32Array },
    width: number,
    height: number,
    scale: number,
  ) {
    const noise = new ValueNoise(256, 9)
    const h = new Float32Array(width * height)
    const prof = new Float32Array(width * height)
    const ref = 0.235

    const box = bounds(view.outline)
    const armpitY = box.y + box.h * 0.66
    const hemY = box.y

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px
        if (!mask[idx]) continue
        const gx = (px - this.layout.offsetX) / scale
        const gy = (this.layout.offsetY - py) / scale

        const d = field.sample(gx, gy)
        const R = Math.max(field.sampleWidth(gx, gy), 0.02)
        const t = clamp01(d / R)
        const profile = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))
        prof[idx] = profile
        const amp = 46 * Math.pow(Math.min(1.12, Math.max(0.2, R / ref)), 0.9)

        // pieghe: drappeggi verticali, raggi dalle ascelle, compressione all'orlo
        const n1 = noise.fbm(gx * 7, gy * 7, 3)
        // drappeggi verticali, mai simmetrici: la fase segue il rumore
        let folds = 3.4 * Math.sin(gx * 88 + n1 * 3.4 + gy * 11 + 1.3)
        folds += 1.6 * Math.sin(gx * 47 - gy * 7 + n1 * 2.1)
        const hemT = clamp01((gy - hemY) / 0.22)
        folds += 2.8 * Math.sin(gx * 132 + n1 * 1.6 + 1.2) * Math.pow(1 - hemT, 2.1)
        for (const s of [-1, 1]) {
          const ax = s * 0.235
          const ay = armpitY
          const vx = gx - ax
          const vy = gy - ay
          const dist2 = vx * vx + vy * vy
          if (dist2 < 0.1) {
            const across = -s * vx * 0.84 + vy * 0.55
            folds += 3.4 * Math.sin(across * 118) * Math.exp(-dist2 / 0.014)
          }
        }
        folds += 0.45 * noise.fbm(gx * 40, gy * 40, 3)
        folds += 0.22 * noise.fbm(gx * 170, gy * 170, 2)

        h[idx] = amp * profile + folds * (0.25 + 0.75 * profile) + detail.relief[idx]
      }
    }

    const gxArr = new Float32Array(width * height)
    const gyArr = new Float32Array(width * height)
    for (let py = 1; py < height - 1; py++) {
      for (let px = 1; px < width - 1; px++) {
        const idx = py * width + px
        if (!mask[idx]) continue
        gxArr[idx] = (h[idx + 1] - h[idx - 1]) * 0.5
        gyArr[idx] = (h[idx + width] - h[idx - width]) * 0.5
      }
    }

    const low = new Float32Array(h)
    blurFloat(low, width, height, Math.max(2, Math.round(scale * 0.022)))

    return { h, gx: gxArr, gy: gyArr, low, prof, light: new Float32Array(width * height), detail }
  }

  private computeLight(
    opts: FlatRenderOptions,
    view: GarmentView,
    mask: Uint8Array,
    heights: ReturnType<FlatGarmentRenderer['buildHeights']>,
    width: number,
    height: number,
    scale: number,
  ) {
    const alpha = new Uint8Array(width * height)
    const mmPerPx = 1000 / scale
    const noise = new ValueNoise(128, 31)
    const ribPx = Math.max(2.1, scale * 0.0011)
    const rowPx = Math.max(2.4, scale * 0.0014)
    const knitScale = opts.spec.fabric === 'fleece' ? 1.6 : 1

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = py * width + px
        const m = mask[idx]
        if (!m) continue

        const nx = -heights.gx[idx] / mmPerPx
        const ny = -heights.gy[idx] / mmPerPx
        const inv = 1 / Math.hypot(nx, ny, 1)
        const Nx = nx * inv
        const Ny = ny * inv
        const Nz = inv

        const diffuse = Math.max(0, Nx * LIGHT.x + Ny * LIGHT.y + Nz * LIGHT.z)
        const cavity = heights.h[idx] - heights.low[idx]
        const ao =
          (1 - 0.34 * clamp01(-cavity / 3.2)) * (1 - 0.32 * Math.pow(1 - heights.prof[idx], 1.4))
        const sheen = 0.24 * Math.pow(clamp01(1 - Nz), 1.5)

        // maglia del tessuto, visibile a questa risoluzione
        const rib = Math.sin((px / (ribPx * knitScale)) * Math.PI * 2)
        const row = Math.sin((py / (rowPx * knitScale)) * Math.PI * 2 + rib * 0.9)
        const fuzz = noise.at(px * 0.7, py * 0.7)
        const grain = 1 + (rib * 0.4 + row * 0.4) * 0.062 + fuzz * 0.022

        let light = (0.47 + 0.86 * diffuse) * ao + sheen
        light *= grain
        light *= 1 - heights.detail.albedo[idx]
        if (m < 200) light *= 0.62

        heights.light[idx] = light
        alpha[idx] = 255
      }
    }

    // bordo morbido: la stoffa non ha un contorno vettoriale
    this.featherEdges(alpha, mask, width, height)
    void view
    return alpha
  }

  private featherEdges(alpha: Uint8Array, mask: Uint8Array, width: number, height: number) {
    for (let py = 1; py < height - 1; py++) {
      for (let px = 1; px < width - 1; px++) {
        const idx = py * width + px
        if (!mask[idx]) continue
        let open = 0
        if (!mask[idx - 1]) open++
        if (!mask[idx + 1]) open++
        if (!mask[idx - width]) open++
        if (!mask[idx + width]) open++
        if (open) alpha[idx] = 235 - open * 24
      }
    }
  }

  private drawShadow(ctx: CanvasRenderingContext2D, base: BaseLayer) {
    const shadow = document.createElement('canvas')
    shadow.width = base.width
    shadow.height = base.height
    const sctx = shadow.getContext('2d')!
    const img = new ImageData(base.width, base.height)
    for (let i = 0; i < base.mask.length; i++) {
      if (!base.mask[i]) continue
      img.data[i * 4 + 3] = 150
    }
    sctx.putImageData(img, 0, 0)
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.filter = `blur(${Math.round(base.width * 0.012)}px)`
    ctx.drawImage(shadow, base.width * 0.012, base.height * 0.02)
    ctx.restore()
  }

  // --------------------------------------------------------------- artwork

  private compositeArtwork(base: BaseLayer, art: FlatArtwork) {
    const { print } = base
    if (print.w < 2 || print.h < 2) return null

    const source = document.createElement('canvas')
    const aspect = art.width / art.height
    const areaAspect = print.w / print.h
    let dw: number
    let dh: number
    if (aspect >= areaAspect) {
      dw = print.w * art.transform.scale
      dh = dw / aspect
    } else {
      dh = print.h * art.transform.scale
      dw = dh * aspect
    }
    const sw = Math.max(2, Math.round(Math.min(dw, 2600)))
    const sh = Math.max(2, Math.round(sw / aspect))
    source.width = sw
    source.height = sh
    const sctx = source.getContext('2d')!
    sctx.drawImage(art.source, 0, 0, sw, sh)
    const src = sctx.getImageData(0, 0, sw, sh).data

    const cx = print.x + print.w / 2 + (art.transform.offsetX * print.w) / 2
    const cy = print.y + print.h / 2 - (art.transform.offsetY * print.h) / 2
    const cos = Math.cos(-art.transform.rotation)
    const sin = Math.sin(-art.transform.rotation)
    const disp = base.width * 0.0016

    const reach = Math.hypot(dw, dh) / 2 + 2
    const x0 = Math.max(0, Math.floor(cx - reach))
    const x1 = Math.min(base.width, Math.ceil(cx + reach))
    const y0 = Math.max(0, Math.floor(cy - reach))
    const y1 = Math.min(base.height, Math.ceil(cy + reach))
    const pw = x1 - x0
    const ph = y1 - y0
    if (pw < 1 || ph < 1) return null

    // si parte dai pixel del capo già illuminati, poi si fonde la grafica
    const out = new ImageData(pw, ph)
    for (let py = y0; py < y1; py++) {
      const srcRow = py * base.width
      const dstRow = (py - y0) * pw
      for (let px = x0; px < x1; px++) {
        const s4 = (srcRow + px) * 4
        const d4 = (dstRow + (px - x0)) * 4
        out.data[d4] = base.image.data[s4]
        out.data[d4 + 1] = base.image.data[s4 + 1]
        out.data[d4 + 2] = base.image.data[s4 + 2]
        out.data[d4 + 3] = base.image.data[s4 + 3]
      }
    }

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const idx = py * base.width + px
        if (base.mask[idx] < 200) continue
        const pi = (py - print.y) * print.w + (px - print.x)
        const inPrint = px >= print.x && px < print.x + print.w && py >= print.y && py < print.y + print.h
        const gx = inPrint ? base.gradX[pi] : 0
        const gy = inPrint ? base.gradY[pi] : 0

        // la stampa segue le pieghe: il campione si sposta col gradiente
        const sxp = px + gx * disp
        const syp = py + gy * disp
        const lx = sxp - cx
        const ly = syp - cy
        let u = (lx * cos - ly * sin) / dw + 0.5
        const v = (lx * sin + ly * cos) / dh + 0.5
        if (art.transform.flipX) u = 1 - u
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue

        const sxi = Math.min(sw - 1, Math.max(0, Math.floor(u * sw)))
        const syi = Math.min(sh - 1, Math.max(0, Math.floor(v * sh)))
        const s4 = (syi * sw + sxi) * 4
        const alpha = (src[s4 + 3] / 255) * art.transform.opacity
        if (alpha < 0.004) continue

        const light = inPrint ? base.shade[pi] : 1
        const o4 = ((py - y0) * pw + (px - x0)) * 4
        // la grafica riceve la stessa luce del tessuto
        const r = knee((src[s4] / 255) * light) * 255
        const g = knee((src[s4 + 1] / 255) * light) * 255
        const b = knee((src[s4 + 2] / 255) * light) * 255
        out.data[o4] = out.data[o4] * (1 - alpha) + r * alpha
        out.data[o4 + 1] = out.data[o4 + 1] * (1 - alpha) + g * alpha
        out.data[o4 + 2] = out.data[o4 + 2] * (1 - alpha) + b * alpha
      }
    }
    return { data: out, x: x0, y: y0 }
  }
}

function offsetPolyline(points: Pt[], amount: number): Pt[] {
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dy / len) * amount, y: p.y - (dx / len) * amount }
  })
}

/** Box blur separabile con somma scorrevole. */
function blurFloat(src: Float32Array, width: number, height: number, radius: number) {
  if (radius < 1) return
  const tmp = new Float32Array(src.length)
  const win = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    let sum = 0
    const row = y * width
    for (let i = -radius; i <= radius; i++) sum += src[row + Math.min(width - 1, Math.max(0, i))]
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / win
      const add = Math.min(width - 1, x + radius + 1)
      const rem = Math.max(0, x - radius)
      sum += src[row + add] - src[row + rem]
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let i = -radius; i <= radius; i++) sum += tmp[Math.min(height - 1, Math.max(0, i)) * width + x]
    for (let y = 0; y < height; y++) {
      src[y * width + x] = sum / win
      const add = Math.min(height - 1, y + radius + 1)
      const rem = Math.max(0, y - radius)
      sum += tmp[add * width + x] - tmp[rem * width + x]
    }
  }
}
