import * as THREE from 'three'
import { fabricMaterial, metalMaterial, plasticMaterial, ribMaterial } from '../materials'
import { DistanceField, deg, roundedRectShape } from '../geometry'
import { artworkMesh } from '../slot'
import {
  appliedShape,
  baseGarment,
  buildPillow,
  collarMesh,
  outlineBand,
  garmentGeometry,
  garmentMesh,
  garmentPrintSurface,
  type GarmentGeometry,
  type GarmentParams,
} from './garment'
import { colorHex } from './types'
import type { BuildConfig, BuiltMockup, MockupDefinition, SlotDefinition } from './types'

interface HoodieVariant {
  label: string
  description: string
  hood: boolean
  zip: boolean
  pocket: 'kangaroo' | 'split' | 'none'
  params: Partial<GarmentParams>
}

const VARIANTS: Record<string, HoodieVariant> = {
  pullover: {
    label: 'Felpa con cappuccio',
    description: 'Pullover classico con cappuccio e tasca a marsupio.',
    hood: true,
    zip: false,
    pocket: 'kangaroo',
    params: {},
  },
  zip: {
    label: 'Felpa full zip',
    description: 'Zip intera, cappuccio e tasche laterali.',
    hood: true,
    zip: true,
    pocket: 'split',
    params: {},
  },
  oversize: {
    label: 'Hoodie oversize',
    description: 'Volume ampio, spalla scesa, orlo corto.',
    hood: true,
    zip: false,
    pocket: 'kangaroo',
    params: {
      length: 0.7,
      bodyWidth: 0.64,
      hemWidth: 0.63,
      shoulderWidth: 0.56,
      sleeveLength: 0.44,
      sleeveAngle: 0.68,
      sleeveOpen: 0.15,
      armpitDrop: 0.26,
      bulge: 0.1,
    },
  },
  crewneck: {
    label: 'Felpa girocollo',
    description: 'Crewneck senza cappuccio, costine a contrasto.',
    hood: false,
    zip: false,
    pocket: 'none',
    params: { neckWidth: 0.21, neckDepth: 0.06 },
  },
}

const COLORS = [
  { id: 'heather', label: 'Grigio melange', hex: '#b7bac0' },
  { id: 'black', label: 'Nero', hex: '#202024', dark: true },
  { id: 'white', label: 'Bianco', hex: '#f2f1ee' },
  { id: 'navy', label: 'Blu navy', hex: '#28354e', dark: true },
  { id: 'burgundy', label: 'Bordeaux', hex: '#5d2731', dark: true },
  { id: 'sage', label: 'Verde salvia', hex: '#93a189' },
  { id: 'cream', label: 'Crema', hex: '#e8ddc8' },
]

function hoodieParams(v: HoodieVariant): GarmentParams {
  return {
    ...baseGarment(),
    length: 0.7,
    bodyWidth: 0.58,
    hemWidth: 0.56,
    shoulderWidth: 0.5,
    shoulderSlope: 0.05,
    neckWidth: 0.22,
    neckDepth: 0.075,
    sleeveLength: 0.42,
    sleeveAngle: 0.62,
    sleeveOpen: 0.14,
    armpitDrop: 0.24,
    neckBack: 0.03,
    edge: 0.008,
    bulge: 0.115,
    wrinkle: 0.009,
    hemCurve: 0.008,
    ...v.params,
  }
}

/**
 * Cappuccio: stesso volume "a cuscino" del corpo, inclinato dietro le spalle,
 * con il bordo arrotolato dell'apertura in primo piano.
 */
function hoodMesh(p: GarmentParams, material: THREE.Material) {
  const group = new THREE.Group()
  const halfW = p.neckWidth * 0.5 + 0.125
  const height = 0.185

  const outline: THREE.Vector2[] = []
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = Math.PI * (1 - t)
    outline.push(new THREE.Vector2(halfW * Math.cos(a), height * Math.sin(a) * (0.82 + 0.18 * Math.sin(a))))
  }
  outline.pop()
  outline.push(new THREE.Vector2(halfW * 0.96, -0.035), new THREE.Vector2(-halfW * 0.96, -0.035))

  const field = new DistanceField(outline, 110, 0.01)
  const zFn = (x: number, y: number) => {
    const d = THREE.MathUtils.clamp(field.sample(x, y) / 0.1, 0, 1)
    return 0.008 + 0.075 * Math.pow(Math.sin((d * Math.PI) / 2), 0.7)
  }

  const hood = new THREE.Mesh(buildPillow(outline, zFn, 0.012, (x, y) => {
    const d = THREE.MathUtils.clamp(field.sample(x, y) / 0.1, 0, 1)
    return 0.72 + 0.28 * d
  }), material)
  hood.castShadow = true
  hood.receiveShadow = true
  group.add(hood)

  group.rotation.x = deg(-34)
  group.position.set(0, p.length / 2 - p.neckDepth * 1.1, -0.09)
  return group
}

/**
 * Bordo arrotolato del cappuccio: segue la scollatura del capo allargata, così
 * poggia sulle spalle come l'apertura di un cappuccio vero.
 */
function hoodOpening(g: GarmentGeometry, material: THREE.Material) {
  let top = -Infinity
  g.neckHole.forEach((q) => (top = Math.max(top, q.y)))
  const pts = g.neckHole.map((q) => {
    const x = q.x * 1.16
    const y = top + 0.006 - (top - q.y) * 1.18
    return new THREE.Vector3(x, y, g.frontZ(x, y) + 0.004)
  })
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)
  const geo = new THREE.TubeGeometry(curve, 110, 0.0155, 14, true)
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

function drawstrings(g: GarmentGeometry, p: GarmentParams, cord: THREE.Material, tip: THREE.Material) {
  const group = new THREE.Group()
  for (const side of [-1, 1]) {
    const x = side * 0.042
    const y0 = p.length / 2 - p.neckDepth - 0.01
    const len = 0.13
    const pts = Array.from({ length: 14 }, (_, i) => {
      const t = i / 13
      const yy = y0 - len * t
      return new THREE.Vector3(x + side * 0.012 * t * t, yy, g.frontZ(x, yy) + 0.012 + 0.004 * t)
    })
    const curve = new THREE.CatmullRomCurve3(pts)
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0048, 8, false), cord)
    tube.castShadow = true
    group.add(tube)
    const end = pts[pts.length - 1]
    const aglet = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.02, 12), tip)
    aglet.position.copy(end).add(new THREE.Vector3(0, -0.012, 0))
    group.add(aglet)
  }
  return group
}

/** Tasca a marsupio con apertura laterale inclinata. */
function kangarooShape(p: GarmentParams) {
  const w = p.bodyWidth * 0.66
  const top = -p.length / 2 + 0.3
  const bottom = -p.length / 2 + 0.08
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + 0.03, top)
  s.lineTo(w / 2 - 0.03, top)
  s.quadraticCurveTo(w / 2 + 0.005, top - 0.02, w / 2 + 0.01, top - 0.075)
  s.lineTo(w / 2 + 0.01, bottom + 0.02)
  s.quadraticCurveTo(w / 2 + 0.01, bottom, w / 2 - 0.02, bottom)
  s.lineTo(-w / 2 + 0.02, bottom)
  s.quadraticCurveTo(-w / 2 - 0.01, bottom, -w / 2 - 0.01, bottom + 0.02)
  s.lineTo(-w / 2 - 0.01, top - 0.075)
  s.quadraticCurveTo(-w / 2 - 0.005, top - 0.02, -w / 2 + 0.03, top)
  return s
}

/** Orlo e polsini in costina, ritagliati dal profilo reale del capo. */
function ribBands(g: GarmentGeometry, p: GarmentParams, material: THREE.Material) {
  const meshes: THREE.Mesh[] = []
  const hemTop = -p.length / 2 + 0.055
  const hem = outlineBand(g.outline, (q) => q.y <= hemTop)
  if (hem) meshes.push(appliedShape(g, hem, material, 0.013, -0.006, 3))

  const { cuffTop, cuffBottom } = g.points
  const line = new THREE.Vector2(cuffTop.x, cuffTop.y).sub(cuffBottom).normalize()
  // perpendicolare alla linea del polsino = asse della manica, verso l'esterno
  const perp = new THREE.Vector2(-line.y, line.x)
  const cuffWidth = 0.05
  for (const side of [-1, 1] as const) {
    const anchor = new THREE.Vector2(
      (side * (cuffTop.x + cuffBottom.x)) / 2,
      (cuffTop.y + cuffBottom.y) / 2,
    )
    const axis = new THREE.Vector2(side === 1 ? perp.x : -perp.x, perp.y)
    const band = outlineBand(g.outline, (q) => {
      const dx = q.x - anchor.x
      const dy = q.y - anchor.y
      return dx * axis.x + dy * axis.y > -cuffWidth && Math.sign(q.x) === -side
    })
    if (band) meshes.push(appliedShape(g, band, material, 0.013, -0.006, 3))
  }
  return meshes
}

function build(cfg: BuildConfig): BuiltMockup {
  const variant = VARIANTS[cfg.variant] ?? VARIANTS.pullover
  const p = hoodieParams(variant)
  const color = { hex: colorHex(cfg, COLORS) }
  const g = garmentGeometry(p)
  const group = new THREE.Group()

  const cloth = fabricMaterial(color.hex, 'fleece', { vertexColors: true, doubleSide: true })
  const rib = ribMaterial(color.hex, true)
  group.add(garmentMesh(g, p, cloth))
  ribBands(g, p, rib).forEach((m) => group.add(m))

  if (variant.hood) {
    group.add(hoodMesh(p, cloth))
    group.add(hoodOpening(g, rib))
    group.add(drawstrings(g, p, plasticMaterial('#f6f3ec', 0.75), metalMaterial('#b9bec6')))
  } else {
    group.add(collarMesh(g, p, rib, 0.028))
  }

  if (variant.pocket === 'kangaroo') {
    const pocket = appliedShape(g, kangarooShape(p), cloth, 0.008, 0.002)
    group.add(pocket)
  } else if (variant.pocket === 'split') {
    for (const side of [-1, 1]) {
      const w = p.bodyWidth * 0.28
      const s = roundedRectShape(w, 0.15, 0.02)
      const shape = new THREE.Shape(s.getPoints(24).map((q) => new THREE.Vector2(q.x + side * (p.bodyWidth * 0.24), q.y - p.length / 2 + 0.16)))
      group.add(appliedShape(g, shape, cloth, 0.008, 0.002))
    }
  }

  if (variant.zip) {
    const zipShape = new THREE.Shape()
    const top = p.length / 2 - p.neckDepth * 0.2
    const bottom = -p.length / 2 + 0.03
    zipShape.moveTo(-0.012, bottom)
    zipShape.lineTo(0.012, bottom)
    zipShape.lineTo(0.012, top)
    zipShape.lineTo(-0.012, top)
    zipShape.closePath()
    group.add(appliedShape(g, zipShape, plasticMaterial('#d7d7d9', 0.5), 0.008, 0.006))
    const slider = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.016), metalMaterial('#b6bbc2'))
    const sy = -p.length / 2 + 0.14
    slider.position.set(0, sy, g.frontZ(0, sy) + 0.016)
    slider.castShadow = true
    group.add(slider)
  }

  const chestW = Math.min(0.33, p.bodyWidth * 0.58)
  const chestH = chestW * 1.05
  const chestY = g.points.neckBottom - 0.07 - chestH / 2
  const backW = Math.min(0.34, p.bodyWidth * 0.6)
  const backH = backW * 1.25
  const backY = g.points.neckBottom - 0.06 - backH / 2

  const front = artworkMesh(garmentPrintSurface(g, chestY, chestW, chestH), {
    slot: 'fronte',
    segU: 56,
    segV: 56,
    offset: 0.0018,
    roughness: 0.96,
  })
  const back = artworkMesh(garmentPrintSurface(g, backY, backW, backH, true), {
    slot: 'retro',
    segU: 56,
    segV: 56,
    offset: 0.0018,
    roughness: 0.96,
  })
  group.add(front, back)

  const slots: SlotDefinition[] = [
    {
      id: 'fronte',
      label: 'Fronte',
      area: { width: chestW, height: chestH },
      hint: 'Sopra la tasca, ~33 × 35 cm',
      meshes: [front],
    },
    {
      id: 'retro',
      label: 'Retro',
      area: { width: backW, height: backH },
      hint: 'Schiena, ~34 × 42 cm',
      meshes: [back],
    },
  ]

  return {
    group,
    slots,
    camera: { azimuth: deg(-20), polar: deg(80), distanceFactor: 1.08 },
    dispose() {},
  }
}

export const hoodie: MockupDefinition = {
  id: 'felpa',
  name: 'Felpa',
  category: 'abbigliamento',
  tagline: '4 modelli con cappuccio e girocollo',
  description:
    'Felpe in tessuto garzato: pullover con cappuccio, full zip, oversize e girocollo. Stampa su petto e schiena, costine e polsini a coordinato.',
  icon: 'hoodie',
  variants: Object.entries(VARIANTS).map(([id, v]) => ({
    id,
    label: v.label,
    description: v.description,
  })),
  colors: COLORS,
  build,
}
