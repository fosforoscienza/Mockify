/**
 * Campo di distanza dal bordo della sagoma, su griglia grossa e interpolato:
 * dà la forma d'insieme del capo (il corpo pieno, le maniche sottili) senza
 * pagare una query per pixel.
 */
export interface Pt {
  x: number
  y: number
}

export class ShapeField {
  readonly res: number
  private dist: Float32Array
  private width: Float32Array
  private minX: number
  private minY: number
  private stepX: number
  private stepY: number

  constructor(poly: Pt[], bounds: { x: number; y: number; w: number; h: number }, res = 200, widthRadius = 0.16) {
    this.res = res
    this.minX = bounds.x
    this.minY = bounds.y
    this.stepX = bounds.w / (res - 1)
    this.stepY = bounds.h / (res - 1)
    this.dist = new Float32Array(res * res)

    for (let j = 0; j < res; j++) {
      const y = this.minY + j * this.stepY
      for (let i = 0; i < res; i++) {
        const x = this.minX + i * this.stepX
        this.dist[j * res + i] = inside(poly, x, y) ? distanceTo(poly, x, y) : 0
      }
    }
    blur(this.dist, res, 2)

    const k = Math.max(1, Math.round(widthRadius / this.stepX))
    this.width = slidingMax(slidingMax(this.dist, res, k, true), res, k, false)
    blur(this.width, res, 2)
  }

  sample(x: number, y: number) {
    return lookup(this.dist, this.res, this.minX, this.minY, this.stepX, this.stepY, x, y)
  }

  sampleWidth(x: number, y: number) {
    return lookup(this.width, this.res, this.minX, this.minY, this.stepX, this.stepY, x, y)
  }
}

function lookup(
  grid: Float32Array,
  res: number,
  minX: number,
  minY: number,
  stepX: number,
  stepY: number,
  x: number,
  y: number,
) {
  const fx = (x - minX) / stepX
  const fy = (y - minY) / stepY
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  if (i < 0 || j < 0 || i >= res - 1 || j >= res - 1) return 0
  const tx = fx - i
  const ty = fy - j
  const a = grid[j * res + i] * (1 - tx) + grid[j * res + i + 1] * tx
  const b = grid[(j + 1) * res + i] * (1 - tx) + grid[(j + 1) * res + i + 1] * tx
  return a * (1 - ty) + b * ty
}

function inside(poly: Pt[], x: number, y: number) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

function distanceTo(poly: Pt[], x: number, y: number) {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j].x
    const ay = poly[j].y
    const dx = poly[i].x - ax
    const dy = poly[i].y - ay
    const len = dx * dx + dy * dy
    let t = len > 0 ? ((x - ax) * dx + (y - ay) * dy) / len : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = ax + t * dx - x
    const py = ay + t * dy - y
    const d = px * px + py * py
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

function blur(src: Float32Array, res: number, passes: number) {
  const out = new Float32Array(src.length)
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        let sum = 0
        let n = 0
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const jj = j + dj
            const ii = i + di
            if (jj < 0 || ii < 0 || jj >= res || ii >= res) continue
            sum += src[jj * res + ii]
            n++
          }
        }
        out[j * res + i] = sum / n
      }
    }
    src.set(out)
  }
}

function slidingMax(src: Float32Array, res: number, k: number, horizontal: boolean) {
  const out = new Float32Array(src.length)
  const deque = new Int32Array(res)
  const at = (line: number, i: number) => (horizontal ? line * res + i : i * res + line)
  for (let line = 0; line < res; line++) {
    let head = 0
    let tail = 0
    for (let i = 0; i < res + k; i++) {
      if (i < res) {
        const v = src[at(line, i)]
        while (tail > head && src[at(line, deque[tail - 1])] <= v) tail--
        deque[tail++] = i
      }
      const center = i - k
      if (center >= 0) {
        while (tail > head && deque[head] < center - k) head++
        out[at(line, center)] = src[at(line, deque[head])]
      }
    }
  }
  return out
}
