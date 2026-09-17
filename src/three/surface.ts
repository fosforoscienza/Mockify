import * as THREE from 'three'

/**
 * Ogni superficie stampabile è descritta da una funzione parametrica
 * (u, v) -> punto nello spazio. La stessa funzione genera sia il modello
 * (carta, tessuto, cartone) sia il piano su cui viene proiettata la grafica:
 * l'artwork segue quindi esattamente la curvatura del mockup.
 */
export type SurfaceFn = (u: number, v: number, out: THREE.Vector3) => void

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _du = new THREE.Vector3()
const _dv = new THREE.Vector3()

/** Normale ottenuta per differenze finite sulla funzione parametrica. */
export function surfaceNormal(fn: SurfaceFn, u: number, v: number, out: THREE.Vector3) {
  const e = 1e-3
  const u0 = Math.max(0, u - e)
  const u1 = Math.min(1, u + e)
  const v0 = Math.max(0, v - e)
  const v1 = Math.min(1, v + e)
  fn(u1, v, _a)
  fn(u0, v, _b)
  _du.copy(_a).sub(_b)
  fn(u, v1, _a)
  fn(u, v0, _b)
  _dv.copy(_a).sub(_b)
  out.copy(_du).cross(_dv)
  if (out.lengthSq() < 1e-12) out.set(0, 0, 1)
  return out.normalize()
}

export interface SurfaceOptions {
  segU?: number
  segV?: number
  /** Scostamento lungo la normale (positivo = verso l'osservatore). */
  offset?: number
  /** Inverte normali e avvolgimento: usato per le facciate posteriori. */
  flip?: boolean
  /** Specchia la coordinata u (retro di un foglio, interno di una brochure). */
  mirrorU?: boolean
}

export function buildSurfaceGeometry(fn: SurfaceFn, opts: SurfaceOptions = {}) {
  const segU = opts.segU ?? 48
  const segV = opts.segV ?? 48
  const offset = opts.offset ?? 0
  const flip = opts.flip ?? false
  const mirrorU = opts.mirrorU ?? false

  const count = (segU + 1) * (segV + 1)
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const n = new THREE.Vector3()

  let i = 0
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU
      fn(u, v, _c)
      surfaceNormal(fn, u, v, n)
      if (flip) n.negate()
      _c.addScaledVector(n, offset)
      positions[i * 3] = _c.x
      positions[i * 3 + 1] = _c.y
      positions[i * 3 + 2] = _c.z
      normals[i * 3] = n.x
      normals[i * 3 + 1] = n.y
      normals[i * 3 + 2] = n.z
      uvs[i * 2] = mirrorU ? 1 - u : u
      uvs[i * 2 + 1] = v
      i++
    }
  }

  const indices: number[] = []
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu
      const b = a + 1
      const c = a + segU + 1
      const d = c + 1
      if (flip) {
        indices.push(a, c, b, b, c, d)
      } else {
        indices.push(a, b, c, b, d, c)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

/**
 * Solido sottile costruito attorno a una superficie: facciata, retro e bordo.
 * Usato per fogli, poster, brochure e ante di copertina.
 */
export function buildSheetGeometry(fn: SurfaceFn, thickness: number, opts: SurfaceOptions = {}) {
  const half = thickness / 2
  const front = buildSurfaceGeometry(fn, { ...opts, offset: half })
  const back = buildSurfaceGeometry(fn, { ...opts, offset: -half, flip: true, mirrorU: true })
  const rim = buildRimGeometry(fn, half, opts.segU ?? 48, opts.segV ?? 48)
  return { front, back, rim }
}

function buildRimGeometry(fn: SurfaceFn, half: number, segU: number, segV: number) {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const n = new THREE.Vector3()
  const p = new THREE.Vector3()
  const top = new THREE.Vector3()
  const bottom = new THREE.Vector3()
  const edgeDir = new THREE.Vector3()
  const outward = new THREE.Vector3()

  type Edge = { fixed: 'u' | 'v'; value: number; sign: number }
  const edges: Edge[] = [
    { fixed: 'v', value: 0, sign: -1 },
    { fixed: 'v', value: 1, sign: 1 },
    { fixed: 'u', value: 0, sign: -1 },
    { fixed: 'u', value: 1, sign: 1 },
  ]

  for (const edge of edges) {
    const steps = edge.fixed === 'v' ? segU : segV
    const prevTop = new THREE.Vector3()
    const prevBottom = new THREE.Vector3()
    const prevOut = new THREE.Vector3()
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const u = edge.fixed === 'v' ? t : edge.value
      const v = edge.fixed === 'v' ? edge.value : t
      fn(u, v, p)
      surfaceNormal(fn, u, v, n)
      top.copy(p).addScaledVector(n, half)
      bottom.copy(p).addScaledVector(n, -half)
      // direzione uscente = tangente lungo l'asse fisso, orientata verso l'esterno
      const e = 2e-3
      if (edge.fixed === 'v') {
        fn(u, THREE.MathUtils.clamp(v + edge.sign * e, 0, 1), _a)
        fn(u, THREE.MathUtils.clamp(v - edge.sign * e, 0, 1), _b)
      } else {
        fn(THREE.MathUtils.clamp(u + edge.sign * e, 0, 1), v, _a)
        fn(THREE.MathUtils.clamp(u - edge.sign * e, 0, 1), v, _b)
      }
      edgeDir.copy(_a).sub(_b)
      outward.copy(edgeDir).normalize()
      if (outward.lengthSq() < 1e-8) outward.copy(n)
      if (i > 0) {
        pushQuad(positions, normals, uvs, prevTop, top, bottom, prevBottom, prevOut, outward)
      }
      prevTop.copy(top)
      prevBottom.copy(bottom)
      prevOut.copy(outward)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.computeBoundingSphere()
  return geo
}

function pushQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  na: THREE.Vector3,
  nb: THREE.Vector3,
) {
  const tri = (p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, n1: THREE.Vector3, n2: THREE.Vector3, n3: THREE.Vector3) => {
    positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z)
    normals.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n3.x, n3.y, n3.z)
    uvs.push(0, 0, 1, 0, 1, 1)
  }
  tri(a, b, c, na, nb, nb)
  tri(a, c, d, na, nb, na)
}

/** Superficie piana con ondulazione opzionale (poster, fogli). */
export function planeSurface(
  width: number,
  height: number,
  deform?: (u: number, v: number) => number,
): SurfaceFn {
  return (u, v, out) => {
    out.set((u - 0.5) * width, (v - 0.5) * height, deform ? deform(u, v) : 0)
  }
}
