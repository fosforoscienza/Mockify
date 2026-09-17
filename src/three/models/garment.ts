import * as THREE from 'three'
import { DistanceField, deformGeometry, maxEdgeLength, subdivideGeometry } from '../geometry'
import type { SurfaceFn } from '../surface'

/**
 * Capo d'abbigliamento costruito da una sagoma 2D estrusa e poi "gonfiata":
 * ogni vertice viene spostato lungo Z in base a un profilo di volume, così il
 * capo ha il corpo di un indumento indossato invece dell'aspetto piatto di un
 * ritaglio. La stessa funzione di volume definisce la superficie di stampa,
 * quindi la grafica segue esattamente la curvatura del tessuto.
 */
export interface GarmentParams {
  length: number
  bodyWidth: number
  hemWidth: number
  shoulderWidth: number
  shoulderSlope: number
  neckWidth: number
  neckDepth: number
  neckType: 'crew' | 'v' | 'scoop'
  sleeveLength: number
  sleeveAngle: number
  sleeveOpen: number
  armpitDrop: number
  waist: number
  hemCurve: number
  depth: number
  bulge: number
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
  neckType: 'crew',
  sleeveLength: 0.2,
  sleeveAngle: 0.5,
  sleeveOpen: 0.15,
  armpitDrop: 0.2,
  waist: 0.0,
  hemCurve: 0.015,
  depth: 0.1,
  bulge: 0.075,
  wrinkle: 0.009,
})

const V2 = (x: number, y: number) => new THREE.Vector2(x, y)

export interface GarmentGeometry {
  shape: THREE.Shape
  /** Contorno campionato del capo, in senso antiorario. */
  outline: THREE.Vector2[]
  /** Z della superficie frontale nel punto (x, y) del piano della sagoma. */
  frontZ(x: number, y: number): number
  half: number
  points: {
    shoulder: THREE.Vector2
    cuffTop: THREE.Vector2
    cuffBottom: THREE.Vector2
    armpit: THREE.Vector2
    hem: THREE.Vector2
    neckLeft: THREE.Vector2
    neckBottom: THREE.Vector2
  }
  neckline(count: number): THREE.Vector2[]
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
  const neckLeft = V2(-p.neckWidth / 2, yS)
  const neckBottom = V2(0, yS - p.neckDepth)

  const neckline = (count: number) => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= count; i++) {
      const t = i / count
      const x = THREE.MathUtils.lerp(neckLeft.x, -neckLeft.x, t)
      const k = Math.abs(x) / (p.neckWidth / 2)
      let y: number
      if (p.neckType === 'v') {
        y = yS - p.neckDepth * (1 - k)
      } else if (p.neckType === 'scoop') {
        y = yS - p.neckDepth * Math.cos((k * Math.PI) / 2)
      } else {
        y = yS - p.neckDepth * Math.pow(Math.cos((k * Math.PI) / 2), 0.62)
      }
      pts.push(V2(x, y))
    }
    return pts
  }

  const shape = new THREE.Shape()
  const nl = neckline(48)
  shape.moveTo(nl[nl.length - 1].x, nl[nl.length - 1].y)
  // collo: da destra verso sinistra passando per il punto più basso
  for (let i = nl.length - 2; i >= 0; i--) shape.lineTo(nl[i].x, nl[i].y)
  // spalla sinistra
  shape.quadraticCurveTo(
    THREE.MathUtils.lerp(neckLeft.x, shoulder.x, 0.5),
    THREE.MathUtils.lerp(neckLeft.y, shoulder.y, 0.35),
    shoulder.x,
    shoulder.y,
  )
  // manica sinistra
  shape.quadraticCurveTo(
    THREE.MathUtils.lerp(shoulder.x, cuffTop.x, 0.5),
    THREE.MathUtils.lerp(shoulder.y, cuffTop.y, 0.5) + 0.012,
    cuffTop.x,
    cuffTop.y,
  )
  shape.lineTo(cuffBottom.x, cuffBottom.y)
  // giro manica
  shape.quadraticCurveTo(
    THREE.MathUtils.lerp(cuffBottom.x, armpit.x, 0.45),
    THREE.MathUtils.lerp(cuffBottom.y, armpit.y, 0.82),
    armpit.x,
    armpit.y,
  )
  // fianco sinistro
  shape.quadraticCurveTo(
    -p.bodyWidth / 2 + p.waist,
    THREE.MathUtils.lerp(armpit.y, hem.y, 0.55),
    hem.x,
    hem.y,
  )
  // orlo
  shape.quadraticCurveTo(0, hem.y - p.hemCurve, -hem.x, hem.y)
  // lato destro, speculare
  shape.quadraticCurveTo(
    p.bodyWidth / 2 - p.waist,
    THREE.MathUtils.lerp(armpit.y, hem.y, 0.55),
    -armpit.x,
    armpit.y,
  )
  shape.quadraticCurveTo(
    -THREE.MathUtils.lerp(cuffBottom.x, armpit.x, 0.45),
    THREE.MathUtils.lerp(cuffBottom.y, armpit.y, 0.82),
    -cuffBottom.x,
    cuffBottom.y,
  )
  shape.lineTo(-cuffTop.x, cuffTop.y)
  shape.quadraticCurveTo(
    -THREE.MathUtils.lerp(shoulder.x, cuffTop.x, 0.5),
    THREE.MathUtils.lerp(shoulder.y, cuffTop.y, 0.5) + 0.012,
    -shoulder.x,
    shoulder.y,
  )
  shape.quadraticCurveTo(
    -THREE.MathUtils.lerp(neckLeft.x, shoulder.x, 0.5),
    THREE.MathUtils.lerp(neckLeft.y, shoulder.y, 0.35),
    -neckLeft.x,
    neckLeft.y,
  )
  shape.closePath()

  const outline = shape.extractPoints(26).shape as THREE.Vector2[]
  if (outline.length > 1 && outline[0].distanceTo(outline[outline.length - 1]) < 1e-6) outline.pop()
  const field = new DistanceField(outline, 170)

  // spessore del bordo: davanti e retro quasi combaciano sul perimetro
  const half = 0.007
  const fullAt = Math.min(p.bodyWidth * 0.3, 0.16)

  const frontZ = (x: number, y: number) => {
    const d = field.sample(x, y)
    const t = THREE.MathUtils.clamp(d / fullAt, 0, 1)
    // profilo "a cuscino": zero sul bordo, pieno al centro del capo
    const puff = Math.pow(Math.sin((t * Math.PI) / 2), 0.72)
    const vt = THREE.MathUtils.clamp((y - hem.y) / (yS - hem.y), 0, 1)
    let amp = p.bulge * (0.84 + 0.26 * Math.sin(vt * Math.PI))
    if (Math.abs(x) > p.shoulderWidth / 2) amp *= 0.82
    const folds =
      p.wrinkle *
      (Math.sin(x * 23 + y * 8) * 0.5 + Math.sin(y * 17 - x * 9.5) * 0.5) *
      (0.3 + 0.7 * (1 - vt))
    return half + amp * puff + folds * puff
  }

  return {
    shape,
    outline,
    frontZ,
    half,
    points: { shoulder, cuffTop, cuffBottom, armpit, hem, neckLeft, neckBottom },
    neckline,
  }
}

/**
 * Corpo del capo: due facce ricavate dal contorno, unite da un bordo
 * arrotondato. La faccia viene suddivisa finché i triangoli non sono
 * abbastanza piccoli da rendere morbido il volume.
 */
export function garmentMesh(g: GarmentGeometry, _p: GarmentParams, material: THREE.Material) {
  const mesh = new THREE.Mesh(buildPillow(g.outline, g.frontZ), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Volume "a cuscino" da un contorno chiuso: due facce speculari raccordate da
 * un bordo arrotondato. È la base di capi, cappucci e tasche.
 */
export function buildPillow(
  outline: THREE.Vector2[],
  zFn: (x: number, y: number) => number,
  rimRadius = 0.007,
) {
  const n = outline.length
  const faces = THREE.ShapeUtils.triangulateShape(outline, [])
  const flat = new THREE.BufferGeometry()
  const flatPos: number[] = []
  const flatUv: number[] = []
  outline.forEach((q) => {
    flatPos.push(q.x, q.y, 0)
    flatUv.push(q.x + 0.5, q.y + 0.5)
  })
  flat.setAttribute('position', new THREE.Float32BufferAttribute(flatPos, 3))
  flat.setAttribute('uv', new THREE.Float32BufferAttribute(flatUv, 2))
  flat.setIndex(faces.flat())

  let cap: THREE.BufferGeometry = flat
  for (let i = 0; i < 4 && maxEdgeLength(cap) > 0.028; i++) cap = subdivideGeometry(cap, 1)

  const capPos = cap.attributes.position as THREE.BufferAttribute
  const capUv = cap.attributes.uv as THREE.BufferAttribute
  const capIndex = cap.index!
  const vertexCount = capPos.count

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? 1 : -1
    const base = side * vertexCount
    for (let i = 0; i < vertexCount; i++) {
      const x = capPos.getX(i)
      const y = capPos.getY(i)
      positions.push(x, y, sign * zFn(x, y))
      uvs.push(capUv.getX(i), capUv.getY(i))
    }
    for (let i = 0; i < capIndex.count; i += 3) {
      const a = base + capIndex.getX(i)
      const b = base + capIndex.getX(i + 1)
      const c = base + capIndex.getX(i + 2)
      if (sign > 0) indices.push(a, b, c)
      else indices.push(c, b, a)
    }
  }

  const rimSteps = 5
  const rimBase = positions.length / 3
  for (let i = 0; i < n; i++) {
    const cur = outline[i]
    const prev = outline[(i - 1 + n) % n]
    const next = outline[(i + 1) % n]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const nx = dy / len
    const ny = -dx / len
    const z = zFn(cur.x, cur.y)
    for (let j = 0; j <= rimSteps; j++) {
      const t = (j / rimSteps) * Math.PI
      const lateral = rimRadius * Math.sin(t)
      positions.push(cur.x + nx * lateral, cur.y + ny * lateral, z * Math.cos(t))
      uvs.push(cur.x + nx * lateral + 0.5, cur.y + ny * lateral + 0.5)
    }
  }
  for (let i = 0; i < n; i++) {
    const i0 = rimBase + i * (rimSteps + 1)
    const i1 = rimBase + ((i + 1) % n) * (rimSteps + 1)
    for (let j = 0; j < rimSteps; j++) {
      indices.push(i0 + j, i0 + j + 1, i1 + j + 1)
      indices.push(i0 + j, i1 + j + 1, i1 + j)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  cap.dispose()
  if (cap !== flat) flat.dispose()
  return geo
}

/** Appoggia una geometria estrusa sulla superficie del capo. */
export function inflate(geo: THREE.BufferGeometry, g: GarmentGeometry, lift = 0) {
  deformGeometry(geo, (v) => {
    const k = THREE.MathUtils.clamp(v.z / g.half, -1, 1)
    v.z = k * (g.frontZ(v.x, v.y) + lift)
  })
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
    const z = g.frontZ(x, y)
    out.set(back ? -x : x, y, back ? -z : z)
  }
}

/**
 * Fascia ricavata dal contorno reale del capo: prende i punti del profilo che
 * cadono nella zona indicata e li chiude con un taglio dritto. Orli e polsini
 * combaciano così esattamente con la sagoma, senza sbordare.
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

/** Collo a costina: banda che segue la scollatura e si assottiglia ai lati. */
export function collarMesh(
  g: GarmentGeometry,
  _p: GarmentParams,
  material: THREE.Material,
  band = 0.03,
) {
  const inner = g.neckline(60)
  const outer = inner.map((pt, i, arr) => {
    const prev = arr[Math.max(0, i - 1)]
    const next = arr[Math.min(arr.length - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    // normale esterna alla scollatura, larghezza che va a zero sulle spalle
    const t = i / (arr.length - 1)
    const taper = Math.pow(Math.sin(Math.PI * t), 0.45)
    return new THREE.Vector2(pt.x + (dy / len) * band * taper, pt.y - (dx / len) * band * taper)
  })

  const shape = new THREE.Shape()
  shape.moveTo(inner[0].x, inner[0].y)
  inner.forEach((pt, i) => i && shape.lineTo(pt.x, pt.y))
  for (let i = outer.length - 1; i >= 0; i--) shape.lineTo(outer[i].x, outer[i].y)
  shape.closePath()

  return appliedShape(g, shape, material, 0.013, -0.002, 2)
}

/** Pezzo applicato sul capo (tasche, bande, collo) che ne segue il volume. */
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
    const t = THREE.MathUtils.clamp(v.z / thickness, 0, 1)
    v.z = g.frontZ(v.x, v.y) + lift + t * thickness
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  return mesh
}
