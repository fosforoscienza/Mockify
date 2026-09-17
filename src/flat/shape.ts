import type { Pt } from './field'

/** Punto e campionamento di curve: il profilo del capo nasce da qui. */
export const pt = (x: number, y: number): Pt => ({ x, y })

export function quad(a: Pt, c: Pt, b: Pt, steps: number, out: Pt[]) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    out.push({
      x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
    })
  }
}

export function line(a: Pt, b: Pt, steps: number, out: Pt[]) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
}

export function bounds(poly: Pt[], margin = 0) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  poly.forEach((p) => {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  })
  return {
    x: minX - margin,
    y: minY - margin,
    w: maxX - minX + margin * 2,
    h: maxY - minY + margin * 2,
  }
}

export function mirrorX(p: Pt): Pt {
  return { x: -p.x, y: p.y }
}
