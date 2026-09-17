/**
 * Rumore di valore 2D con interpolazione bicubica, campionato per pixel.
 * Serve a dare al tessuto le sue irregolarità: nessun capo vero ha pieghe
 * perfettamente regolari.
 */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class ValueNoise {
  private grid: Float32Array
  private size: number

  constructor(size = 256, seed = 1) {
    const rand = mulberry32(seed)
    this.size = size
    this.grid = new Float32Array(size * size)
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rand() * 2 - 1
  }

  /** Campiona con coordinate in celle; il dominio si ripete. */
  at(x: number, y: number) {
    const n = this.size
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const tx = x - xi
    const ty = y - yi
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const g = (i: number, j: number) => this.grid[(((j % n) + n) % n) * n + (((i % n) + n) % n)]
    const a = g(xi, yi) * (1 - sx) + g(xi + 1, yi) * sx
    const b = g(xi, yi + 1) * (1 - sx) + g(xi + 1, yi + 1) * sx
    return a * (1 - sy) + b * sy
  }

  /** Somma di ottave: dettaglio grosso e fine insieme. */
  fbm(x: number, y: number, octaves = 4, gain = 0.5) {
    let amp = 1
    let total = 0
    let norm = 0
    let fx = x
    let fy = y
    for (let o = 0; o < octaves; o++) {
      total += this.at(fx, fy) * amp
      norm += amp
      amp *= gain
      fx *= 2.03
      fy *= 1.97
    }
    return total / norm
  }
}
