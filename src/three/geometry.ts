import * as THREE from 'three'

/** Rettangolo con angoli raccordati, usato per copertine e ante. */
export function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  const rr = Math.min(r, w / 2, h / 2)
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  return s
}

/** Cucitura decorativa: piccoli segmenti lungo una curva. */
export function stitchLine(
  curve: THREE.Curve<THREE.Vector3>,
  material: THREE.Material,
  count = 40,
  size = 0.012,
) {
  const geo = new THREE.BoxGeometry(size * 2.4, size * 0.8, size * 0.8)
  const mesh = new THREE.InstancedMesh(geo, material, count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const scale = new THREE.Vector3(1, 1, 1)
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const p = curve.getPoint(t)
    const tan = curve.getTangent(t)
    q.setFromUnitVectors(up, tan.normalize())
    m.compose(p, q, scale)
    mesh.setMatrixAt(i, m)
  }
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/** Applica una deformazione per vertice a una geometria già costruita. */
export function deformGeometry(
  geo: THREE.BufferGeometry,
  fn: (p: THREE.Vector3) => void,
) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    fn(v)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
  })
}

export const deg = (d: number) => (d * Math.PI) / 180

/**
 * Suddivisione uniforme 1→4 con cache dei punti medi: la mesh resta chiusa
 * (nessuna fessura) e guadagna i vertici necessari a una deformazione morbida.
 */
export function subdivideGeometry(geo: THREE.BufferGeometry, passes: number) {
  let current = geo.index ? geo : mergeIndex(geo)
  for (let p = 0; p < passes; p++) current = subdivideOnce(current)
  return current
}

function mergeIndex(geo: THREE.BufferGeometry) {
  const count = geo.attributes.position.count
  const index = new Array(count)
  for (let i = 0; i < count; i++) index[i] = i
  const out = geo.clone()
  out.setIndex(index)
  return out
}

function subdivideOnce(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined
  const index = geo.index!
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i < pos.count; i++) {
    positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    if (uv) uvs.push(uv.getX(i), uv.getY(i))
  }
  const cache = new Map<number, number>()
  const midpoint = (a: number, b: number) => {
    const key = a < b ? a * 1e7 + b : b * 1e7 + a
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const id = positions.length / 3
    positions.push(
      (positions[a * 3] + positions[b * 3]) / 2,
      (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2,
      (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2,
    )
    if (uv) {
      uvs.push((uvs[a * 2] + uvs[b * 2]) / 2, (uvs[a * 2 + 1] + uvs[b * 2 + 1]) / 2)
    }
    cache.set(key, id)
    return id
  }

  const out: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    const ab = midpoint(a, b)
    const bc = midpoint(b, c)
    const ca = midpoint(c, a)
    out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca)
  }

  const next = new THREE.BufferGeometry()
  next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (uv) next.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  next.setIndex(out)
  return next
}

/** Lunghezza massima degli spigoli: guida il numero di suddivisioni. */
export function maxEdgeLength(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const index = geo.index
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  let max = 0
  const get = (i: number) => (index ? index.getX(i) : i)
  const count = index ? index.count : pos.count
  for (let i = 0; i < count; i += 3) {
    for (let k = 0; k < 3; k++) {
      a.fromBufferAttribute(pos, get(i + k))
      b.fromBufferAttribute(pos, get(i + ((k + 1) % 3)))
      max = Math.max(max, a.distanceTo(b))
    }
  }
  return max
}

/**
 * Campo di distanza dal bordo di una sagoma (con eventuali fori), campionato su
 * griglia e interpolato. Da qui nascono sia il volume del capo sia la sua
 * occlusione ambientale, senza pagare una query per vertice.
 */
export class DistanceField {
  private data: Float32Array
  private width?: Float32Array
  private minX: number
  private minY: number
  private stepX: number
  private stepY: number

  constructor(
    outline: THREE.Vector2[],
    private res = 150,
    margin = 0.02,
    holes: THREE.Vector2[][] = [],
  ) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    outline.forEach((p) => {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    })
    this.minX = minX - margin
    this.minY = minY - margin
    this.stepX = (maxX - minX + margin * 2) / (res - 1)
    this.stepY = (maxY - minY + margin * 2) / (res - 1)
    this.data = new Float32Array(res * res)

    for (let j = 0; j < res; j++) {
      const y = this.minY + j * this.stepY
      for (let i = 0; i < res; i++) {
        const x = this.minX + i * this.stepX
        let inside = insidePolygon(outline, x, y)
        if (inside) {
          for (const hole of holes) {
            if (insidePolygon(hole, x, y)) {
              inside = false
              break
            }
          }
        }
        if (!inside) {
          this.data[j * res + i] = 0
          continue
        }
        let d = distanceToPolygon(outline, x, y)
        for (const hole of holes) d = Math.min(d, distanceToPolygon(hole, x, y))
        this.data[j * res + i] = d
      }
    }
    // la distanza ha una cresta netta sull'asse mediano: due passate di
    // sfocatura la addolciscono ed evitano pieghe innaturali sul capo
    this.blur(this.data, 2)
  }

  /**
   * Semi-larghezza locale del capo: massimo della distanza in una finestra.
   * Serve a dare alle maniche una sezione sottile e al corpo una piena, invece
   * di gonfiare tutto allo stesso modo.
   */
  localWidth(radius: number) {
    if (this.width) return
    const k = Math.max(1, Math.round(radius / this.stepX))
    const tmp = slidingMax(this.data, this.res, k, true)
    const out = slidingMax(tmp, this.res, k, false)
    this.blur(out, 2)
    this.width = out
  }

  sample(x: number, y: number) {
    return this.lookup(this.data, x, y)
  }

  sampleWidth(x: number, y: number) {
    return this.width ? this.lookup(this.width, x, y) : this.lookup(this.data, x, y)
  }

  private lookup(grid: Float32Array, x: number, y: number) {
    const fx = (x - this.minX) / this.stepX
    const fy = (y - this.minY) / this.stepY
    const i = Math.floor(fx)
    const j = Math.floor(fy)
    if (i < 0 || j < 0 || i >= this.res - 1 || j >= this.res - 1) return 0
    const tx = fx - i
    const ty = fy - j
    const r = this.res
    const a = grid[j * r + i] * (1 - tx) + grid[j * r + i + 1] * tx
    const b = grid[(j + 1) * r + i] * (1 - tx) + grid[(j + 1) * r + i + 1] * tx
    return a * (1 - ty) + b * ty
  }

  private blur(src: Float32Array, passes: number) {
    const r = this.res
    for (let p = 0; p < passes; p++) {
      const out = new Float32Array(src.length)
      for (let j = 0; j < r; j++) {
        for (let i = 0; i < r; i++) {
          let sum = 0
          let n = 0
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const jj = j + dj
              const ii = i + di
              if (jj < 0 || ii < 0 || jj >= r || ii >= r) continue
              sum += src[jj * r + ii]
              n++
            }
          }
          out[j * r + i] = sum / n
        }
      }
      src.set(out)
    }
  }
}

/** Massimo scorrevole su righe o colonne, in tempo lineare (deque monotona). */
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

function insidePolygon(poly: THREE.Vector2[], x: number, y: number) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function distanceToPolygon(poly: THREE.Vector2[], x: number, y: number) {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j].x
    const ay = poly[j].y
    const bx = poly[i].x
    const by = poly[i].y
    const dx = bx - ax
    const dy = by - ay
    const len = dx * dx + dy * dy
    let t = len > 0 ? ((x - ax) * dx + (y - ay) * dy) / len : 0
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * dx - x
    const py = ay + t * dy - y
    best = Math.min(best, Math.sqrt(px * px + py * py))
  }
  return best
}
