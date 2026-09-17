import * as THREE from 'three'
import { DistanceField, deformGeometry, maxEdgeLength, subdivideGeometry } from '../geometry'
import type { SurfaceFn } from '../surface'

/**
 * Capo d'abbigliamento generato dalla sua sagoma piatta.
 *
 * Il volume non è un semplice "gonfiaggio": in ogni punto si stima la
 * semi-larghezza locale del tessuto e si costruisce una sezione ellittica, così
 * il corpo risulta pieno e le maniche restano tubi sottili. L'apertura del collo
 * è un vero foro — davanti si vede l'interno della schiena, come in un ghost
 * mannequin — e su tutto il capo corrono pieghe orientate e un'occlusione
 * ambientale scritta nei vertici: il colore si può cambiare a piacere perché
 * ombre e pieghe lo moltiplicano invece di essere dipinte sopra.
 */
export interface GarmentParams {
  length: number
  bodyWidth: number
  hemWidth: number
  shoulderWidth: number
  shoulderSlope: number
  neckWidth: number
  neckDepth: number
  /** Quanto la scollatura sale dietro rispetto alla linea delle spalle. */
  neckBack: number
  neckType: 'crew' | 'v' | 'scoop'
  sleeveLength: number
  sleeveAngle: number
  sleeveOpen: number
  armpitDrop: number
  waist: number
  hemCurve: number
  /** Semi-spessore del capo sul perimetro (le due facce quasi si toccano). */
  edge: number
  /** Semi-spessore massimo al centro del corpo. */
  bulge: number
  /** Ampiezza delle pieghe. */
  wrinkle: number
}

export const baseGarment = (): GarmentParams => ({
  length: 0.72,
  bodyWidth: 0.52,
  hemWidth: 0.5,
  shoulderWidth: 0.44,
  shoulderSlope: 0.045,
  neckWidth: 0.18,
  neckDepth: 0.055,
  neckBack: 0.026,
  neckType: 'crew',
  sleeveLength: 0.2,
  sleeveAngle: 0.5,
  sleeveOpen: 0.15,
  armpitDrop: 0.2,
  waist: 0.0,
  hemCurve: 0.015,
  edge: 0.006,
  bulge: 0.092,
  wrinkle: 0.0105,
})

const V2 = (x: number, y: number) => new THREE.Vector2(x, y)
const clamp = THREE.MathUtils.clamp

export interface GarmentGeometry {
  /** Profilo esterno del capo, senza la scollatura. */
  outline: THREE.Vector2[]
  /** Apertura del collo, come foro chiuso interno al profilo. */
  neckHole: THREE.Vector2[]
  /** Z della faccia anteriore nel punto (x, y) della sagoma. */
  frontZ(x: number, y: number): number
  /** Z della faccia posteriore: piena anche sotto la scollatura. */
  backZ(x: number, y: number): number
  /** Fattore di occlusione ambientale, da 0.5 (incavi) a 1 (pieno). */
  ao(x: number, y: number): number
  half: number
  points: {
    shoulder: THREE.Vector2
    cuffTop: THREE.Vector2
    cuffBottom: THREE.Vector2
    armpit: THREE.Vector2
    hem: THREE.Vector2
    neckLeft: THREE.Vector2
    /** Punto più basso della scollatura: da qui parte l'area di stampa. */
    neckBottom: number
  }
}

/** Curva della scollatura anteriore, da sinistra a destra. */
function necklinePoints(p: GarmentParams, count: number) {
  const yS = p.length / 2
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const x = THREE.MathUtils.lerp(-p.neckWidth / 2, p.neckWidth / 2, t)
    const k = Math.abs(x) / (p.neckWidth / 2)
    let y: number
    if (p.neckType === 'v') {
      y = yS - p.neckBack - p.neckDepth * (1 - k)
    } else if (p.neckType === 'scoop') {
      y = yS - p.neckBack - p.neckDepth * Math.cos((k * Math.PI) / 2)
    } else {
      y = yS - p.neckBack - p.neckDepth * Math.pow(Math.cos((k * Math.PI) / 2), 0.62)
    }
    pts.push(V2(x, y))
  }
  return pts
}

function sampleCurve(curve: THREE.Curve<THREE.Vector2>, steps: number, out: THREE.Vector2[]) {
  for (let i = 1; i <= steps; i++) out.push(curve.getPoint(i / steps))
}

export function garmentGeometry(p: GarmentParams): GarmentGeometry {
  const yS = p.length / 2
  const shoulder = V2(-p.shoulderWidth / 2, yS - p.shoulderSlope)
  const dir = V2(-Math.cos(p.sleeveAngle), -Math.sin(p.sleeveAngle))
  const cuffTop = V2(shoulder.x + dir.x * p.sleeveLength, shoulder.y + dir.y * p.sleeveLength)
  const perp = V2(-dir.y, dir.x)
  const cuffBottom = V2(cuffTop.x + perp.x * p.sleeveOpen, cuffTop.y + perp.y * p.sleeveOpen)
  const armpit = V2(-p.bodyWidth / 2, yS - p.shoulderSlope - p.armpitDrop)
  const hem = V2(-p.hemWidth / 2, -p.length / 2)
  const neckLeft = V2(-p.neckWidth / 2, yS - p.neckBack)

  // profilo esterno in senso antiorario: spalle, manica, fianco, orlo, ritorno
  const outline: THREE.Vector2[] = [V2(-shoulder.x, shoulder.y)]
  sampleCurve(
    new THREE.QuadraticBezierCurve(V2(-shoulder.x, shoulder.y), V2(0, yS + 0.010), shoulder),
    18,
    outline,
  )
  sampleCurve(
    new THREE.QuadraticBezierCurve(
      shoulder,
      V2(
        THREE.MathUtils.lerp(shoulder.x, cuffTop.x, 0.5),
        THREE.MathUtils.lerp(shoulder.y, cuffTop.y, 0.5) + 0.014,
      ),
      cuffTop,
    ),
    16,
    outline,
  )
  sampleCurve(new THREE.LineCurve(cuffTop, cuffBottom), 6, outline)
  sampleCurve(
    new THREE.QuadraticBezierCurve(
      cuffBottom,
      V2(
        THREE.MathUtils.lerp(cuffBottom.x, armpit.x, 0.45),
        THREE.MathUtils.lerp(cuffBottom.y, armpit.y, 0.82),
      ),
      armpit,
    ),
    14,
    outline,
  )
  sampleCurve(
    new THREE.QuadraticBezierCurve(
      armpit,
      V2(-p.bodyWidth / 2 + p.waist, THREE.MathUtils.lerp(armpit.y, hem.y, 0.55)),
      hem,
    ),
    20,
    outline,
  )
  sampleCurve(
    new THREE.QuadraticBezierCurve(hem, V2(0, hem.y - p.hemCurve), V2(-hem.x, hem.y)),
    22,
    outline,
  )
  sampleCurve(
    new THREE.QuadraticBezierCurve(
      V2(-hem.x, hem.y),
      V2(p.bodyWidth / 2 - p.waist, THREE.MathUtils.lerp(armpit.y, hem.y, 0.55)),
      V2(-armpit.x, armpit.y),
    ),
    20,
    outline,
  )
  sampleCurve(
    new THREE.QuadraticBezierCurve(
      V2(-armpit.x, armpit.y),
      V2(
        -THREE.MathUtils.lerp(cuffBottom.x, armpit.x, 0.45),
        THREE.MathUtils.lerp(cuffBottom.y, armpit.y, 0.82),
      ),
      V2(-cuffBottom.x, cuffBottom.y),
    ),
    14,
    outline,
  )
  sampleCurve(new THREE.LineCurve(V2(-cuffBottom.x, cuffBottom.y), V2(-cuffTop.x, cuffTop.y)), 6, outline)
  sampleCurve(
    new THREE.QuadraticBezierCurve(
      V2(-cuffTop.x, cuffTop.y),
      V2(
        -THREE.MathUtils.lerp(shoulder.x, cuffTop.x, 0.5),
        THREE.MathUtils.lerp(shoulder.y, cuffTop.y, 0.5) + 0.014,
      ),
      V2(-shoulder.x, shoulder.y),
    ),
    16,
    outline,
  )
  outline.pop()

  // apertura del collo: scollatura davanti, arco dietro
  const front = necklinePoints(p, 34)
  const neckHole: THREE.Vector2[] = [...front]
  const backTop = yS - p.neckBack * 0.35
  for (let i = 1; i < 22; i++) {
    const t = i / 22
    const x = THREE.MathUtils.lerp(p.neckWidth / 2, -p.neckWidth / 2, t)
    const k = Math.abs(x) / (p.neckWidth / 2)
    neckHole.push(V2(x, THREE.MathUtils.lerp(backTop, yS - p.neckBack, Math.pow(k, 1.6))))
  }

  const field = new DistanceField(outline, 180, 0.02, [neckHole])
  field.localWidth(0.12)
  const solid = new DistanceField(outline, 150, 0.02)
  solid.localWidth(0.12)

  const half = p.edge
  const ref = p.bodyWidth * 0.5

  /** Sezione ellittica: piena al centro del capo, sottile dove il tessuto è stretto. */
  const section = (d: number, r: number) => {
    const R = Math.max(r, 0.018)
    const t = clamp(d / R, 0, 1)
    const profile = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))
    const widthFactor = Math.pow(clamp(R / ref, 0.2, 1.12), 0.9)
    return { profile, amp: p.bulge * widthFactor }
  }

  const armpitL = V2(armpit.x, armpit.y)
  const armpitR = V2(-armpit.x, armpit.y)

  /**
   * Pieghe orientate come quelle vere: raggiate dalle ascelle verso la vita,
   * compressione orizzontale sull'orlo, cadute verticali sul corpo.
   */
  const folds = (x: number, y: number) => {
    let f = 0
    for (const a of [armpitL, armpitR]) {
      const vx = x - a.x
      const vy = y - a.y
      const dist2 = vx * vx + vy * vy
      if (dist2 > 0.12) continue
      const s = Math.sign(a.x)
      const along = -s * vx * 0.55 - vy * 0.84
      const across = -s * vx * 0.84 + vy * 0.55
      f += Math.sin(across * 96 + 0.6) * Math.exp(-dist2 / 0.016) * (0.6 + 0.4 * Math.cos(along * 26))
    }
    const hemT = clamp((y - hem.y) / 0.2, 0, 1)
    f += Math.sin(x * 62 + 1.2) * Math.pow(1 - hemT, 2.2) * 0.9
    // cadute lunghe del tessuto sul corpo
    f += Math.sin(x * 21 - y * 13) * 0.34
    f += Math.sin(x * 37 + y * 5 + 2.1) * 0.24
    f += Math.sin(x * 13 + y * 31 - 1.4) * 0.18
    return f * p.wrinkle
  }

  /** Solchi di cucitura: orlo inferiore e fondo manica, incisi sulle due facce. */
  const cuffMid = V2((cuffTop.x + cuffBottom.x) / 2, (cuffTop.y + cuffBottom.y) / 2)
  const seam = (x: number, y: number) => {
    let s = 0
    const hemLine = hem.y - p.hemCurve * 0.5 * (1 - Math.pow(clamp(x / hem.x, -1, 1), 2))
    if (Math.abs(x) < p.bodyWidth * 0.55) {
      const t = (y - (hemLine + 0.024)) / 0.006
      s -= Math.exp(-t * t)
    }
    // giro manica: la cucitura che unisce manica e corpo
    for (const sx of [-1, 1]) {
      const ax = sx * shoulder.x
      const ay = shoulder.y
      const bx = sx * armpit.x
      const by = armpit.y
      const vx = bx - ax
      const vy = by - ay
      const len2 = vx * vx + vy * vy || 1
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / len2, 0, 1)
      const px = x - (ax + vx * t)
      const py = y - (ay + vy * t)
      const d = Math.hypot(px, py) / 0.006
      if (d < 3) s -= Math.exp(-d * d) * 1.15
    }
    if (Math.abs(x) > p.shoulderWidth * 0.42) {
      // proiezione sull'asse della manica: il fondo manica è a distanza zero
      const sx = Math.sign(x)
      const ax = sx * Math.cos(p.sleeveAngle)
      const ay = -Math.sin(p.sleeveAngle)
      const along = (x - sx * Math.abs(cuffMid.x)) * ax + (y - cuffMid.y) * ay
      const t = (along + 0.022) / 0.006
      s -= Math.exp(-t * t)
    }
    return s * 0.0045
  }

  const frontZ = (x: number, y: number) => {
    const d = field.sample(x, y)
    const { profile, amp } = section(d, field.sampleWidth(x, y))
    return half + amp * profile + folds(x, y) * profile + seam(x, y) * Math.min(1, profile * 3)
  }

  const backZ = (x: number, y: number) => {
    const d = solid.sample(x, y)
    const { profile, amp } = section(d, solid.sampleWidth(x, y))
    return (
      half + amp * profile * 0.94 + folds(x, -y) * profile * 0.8 + seam(x, y) * Math.min(1, profile * 3)
    )
  }

  const neckShadowY = yS - p.neckDepth - 0.035
  const ao = (x: number, y: number) => {
    const d = field.sample(x, y)
    const { profile } = section(d, field.sampleWidth(x, y))
    let v = 1 - 0.36 * Math.pow(1 - profile, 1.3)
    // le valli delle pieghe ricevono meno luce
    v -= 0.26 * clamp(-folds(x, y) / p.wrinkle, 0, 1)
    for (const a of [armpitL, armpitR]) {
      const dx = x - a.x
      const dy = y - a.y
      v -= 0.2 * Math.exp(-(dx * dx + dy * dy) / 0.0045)
    }
    const nx = x
    const ny = y - neckShadowY
    v -= 0.16 * Math.exp(-(nx * nx * 0.5 + ny * ny) / 0.0035)
    return clamp(v, 0.46, 1)
  }

  return {
    outline,
    neckHole,
    frontZ,
    backZ,
    ao,
    half,
    points: {
      shoulder,
      cuffTop,
      cuffBottom,
      armpit,
      hem,
      neckLeft,
      neckBottom: yS - p.neckBack - p.neckDepth,
    },
  }
}

// ----------------------------------------------------------------- geometrie

interface CapBuild {
  positions: number[]
  uvs: number[]
  colors: number[]
  indices: number[]
}

function flatGeometry(points: THREE.Vector2[], faces: number[][]) {
  const geo = new THREE.BufferGeometry()
  const pos: number[] = []
  const uv: number[] = []
  points.forEach((q) => {
    pos.push(q.x, q.y, 0)
    uv.push(q.x + 0.5, q.y + 0.5)
  })
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  // orientamento coerente: la faccia guarda verso +Z
  let area = 0
  faces.forEach(([a, b, c]) => {
    const pa = points[a]
    const pb = points[b]
    const pc = points[c]
    area += (pb.x - pa.x) * (pc.y - pa.y) - (pc.x - pa.x) * (pb.y - pa.y)
  })
  const index: number[] = []
  faces.forEach(([a, b, c]) => (area >= 0 ? index.push(a, b, c) : index.push(a, c, b)))
  geo.setIndex(index)
  return geo
}

function refine(geo: THREE.BufferGeometry, maxEdge = 0.026, passes = 4) {
  let out = geo
  for (let i = 0; i < passes && maxEdgeLength(out) > maxEdge; i++) out = subdivideGeometry(out, 1)
  return out
}

function pushCap(
  build: CapBuild,
  cap: THREE.BufferGeometry,
  zFn: (x: number, y: number) => number,
  aoFn: (x: number, y: number) => number,
  sign: 1 | -1,
) {
  const pos = cap.attributes.position as THREE.BufferAttribute
  const uv = cap.attributes.uv as THREE.BufferAttribute
  const index = cap.index!
  const base = build.positions.length / 3
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    build.positions.push(x, y, sign * zFn(x, y))
    build.uvs.push(uv.getX(i), uv.getY(i))
    const a = aoFn(x, y)
    build.colors.push(a, a, a)
  }
  for (let i = 0; i < index.count; i += 3) {
    const a = base + index.getX(i)
    const b = base + index.getX(i + 1)
    const c = base + index.getX(i + 2)
    if (sign > 0) build.indices.push(a, b, c)
    else build.indices.push(c, b, a)
  }
}

/** Bordo arrotondato che raccorda faccia anteriore e posteriore. */
function pushRim(
  build: CapBuild,
  ring: THREE.Vector2[],
  zTop: (x: number, y: number) => number,
  zBottom: (x: number, y: number) => number,
  aoFn: (x: number, y: number) => number,
  radius: number,
  steps = 5,
) {
  const n = ring.length
  const base = build.positions.length / 3
  for (let i = 0; i < n; i++) {
    const cur = ring[i]
    const prev = ring[(i - 1 + n) % n]
    const next = ring[(i + 1) % n]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const nx = dy / len
    const ny = -dx / len
    const zt = zTop(cur.x, cur.y)
    const zb = zBottom(cur.x, cur.y)
    const a = aoFn(cur.x, cur.y) * 0.9
    for (let j = 0; j <= steps; j++) {
      const t = (j / steps) * Math.PI
      const lateral = radius * Math.sin(t)
      const c = Math.cos(t)
      const z = c >= 0 ? zt * c : zb * c
      build.positions.push(cur.x + nx * lateral, cur.y + ny * lateral, z)
      build.uvs.push(cur.x + nx * lateral + 0.5, cur.y + ny * lateral + 0.5)
      build.colors.push(a, a, a)
    }
  }
  for (let i = 0; i < n; i++) {
    const i0 = base + i * (steps + 1)
    const i1 = base + ((i + 1) % n) * (steps + 1)
    for (let j = 0; j < steps; j++) {
      build.indices.push(i0 + j, i0 + j + 1, i1 + j + 1)
      build.indices.push(i0 + j, i1 + j + 1, i1 + j)
    }
  }
}

function finishGeometry(build: CapBuild) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(build.positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(build.uvs, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(build.colors, 3))
  geo.setIndex(build.indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/** Corpo del capo: faccia anteriore forata al collo, posteriore piena, bordo. */
export function garmentMesh(g: GarmentGeometry, _p: GarmentParams, material: THREE.Material) {
  const all = [...g.outline, ...g.neckHole]
  const facesFront = THREE.ShapeUtils.triangulateShape(g.outline, [g.neckHole])
  const facesBack = THREE.ShapeUtils.triangulateShape(g.outline, [])

  const frontFlat = refine(flatGeometry(all, facesFront))
  const backFlat = refine(flatGeometry(g.outline, facesBack))

  const build: CapBuild = { positions: [], uvs: [], colors: [], indices: [] }
  pushCap(build, frontFlat, g.frontZ, g.ao, 1)
  pushCap(build, backFlat, g.backZ, (x, y) => g.ao(x, y) * 0.94, -1)
  pushRim(build, g.outline, g.frontZ, g.backZ, g.ao, 0.007)
  // bordo arrotolato dell'apertura del collo
  pushRim(
    build,
    g.neckHole,
    g.frontZ,
    (x, y) => -g.frontZ(x, y) + 0.05,
    (x, y) => g.ao(x, y) * 0.7,
    0.009,
    3,
  )

  frontFlat.dispose()
  backFlat.dispose()

  const mesh = new THREE.Mesh(finishGeometry(build), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Volume "a cuscino" da un contorno chiuso: due facce speculari raccordate da
 * un bordo arrotondato. Usato per cappucci e pezzi applicati.
 */
export function buildPillow(
  outline: THREE.Vector2[],
  zFn: (x: number, y: number) => number,
  rimRadius = 0.007,
  aoFn: (x: number, y: number) => number = () => 1,
) {
  const faces = THREE.ShapeUtils.triangulateShape(outline, [])
  const cap = refine(flatGeometry(outline, faces))
  const build: CapBuild = { positions: [], uvs: [], colors: [], indices: [] }
  pushCap(build, cap, zFn, aoFn, 1)
  pushCap(build, cap, zFn, aoFn, -1)
  pushRim(build, outline, zFn, zFn, aoFn, rimRadius)
  cap.dispose()
  return finishGeometry(build)
}

/** Collo a costina: anello di tessuto che avvolge il bordo dell'apertura. */
export function collarMesh(
  g: GarmentGeometry,
  p: GarmentParams,
  material: THREE.Material,
  band = 0.014,
) {
  const pts = g.neckHole.map((q) => {
    const z = g.frontZ(q.x, q.y)
    return new THREE.Vector3(q.x, q.y, z - band * 0.75)
  })
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)
  const geo = new THREE.TubeGeometry(curve, Math.max(64, pts.length), band, 12, true)
  const colors: number[] = []
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const a = g.ao(pos.getX(i), pos.getY(i))
    colors.push(a, a, a)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.userData.neckType = p.neckType
  return mesh
}

/**
 * Fascia ricavata dal contorno reale del capo: prende i punti del profilo che
 * cadono nella zona indicata e li chiude con un taglio dritto.
 */
export function outlineBand(outline: THREE.Vector2[], inside: (p: THREE.Vector2) => boolean) {
  const n = outline.length
  const flags = outline.map(inside)
  if (!flags.some(Boolean) || flags.every(Boolean)) return null
  let start = 0
  for (let i = 0; i < n; i++) {
    if (flags[i] && !flags[(i - 1 + n) % n]) {
      start = i
      break
    }
  }
  const run: THREE.Vector2[] = []
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    if (!flags[i]) break
    run.push(outline[i])
  }
  if (run.length < 3) return null
  const shape = new THREE.Shape()
  shape.moveTo(run[0].x, run[0].y)
  run.forEach((q, i) => i && shape.lineTo(q.x, q.y))
  shape.closePath()
  return shape
}

/** Superficie di stampa aderente al capo. */
export function garmentPrintSurface(
  g: GarmentGeometry,
  centerY: number,
  width: number,
  height: number,
  back = false,
): SurfaceFn {
  return (u, v, out) => {
    const x = (u - 0.5) * width
    const y = centerY + (v - 0.5) * height
    const z = back ? g.backZ(back ? -x : x, y) : g.frontZ(x, y)
    out.set(back ? -x : x, y, back ? -z : z)
  }
}

/** Pezzo applicato sul capo (tasche, bande, zip) che ne segue il volume. */
export function appliedShape(
  g: GarmentGeometry,
  shape: THREE.Shape,
  material: THREE.Material,
  thickness = 0.012,
  lift = 0.004,
  passes = 3,
) {
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 18,
    steps: 1,
  })
  const geo = subdivideGeometry(extruded, passes)
  extruded.dispose()
  deformGeometry(geo, (v) => {
    const t = clamp(v.z / thickness, 0, 1)
    v.z = g.frontZ(v.x, v.y) + lift + t * thickness
  })
  const colors: number[] = []
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const a = g.ao(pos.getX(i), pos.getY(i))
    colors.push(a, a, a)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
