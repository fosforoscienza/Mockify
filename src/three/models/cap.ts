import * as THREE from 'three'
import { fabricMaterial, metalMaterial, plasticMaterial, threadMaterial } from '../materials'
import { deg } from '../geometry'
import { meshAlphaTexture } from '../textures'
import { artworkMesh } from '../slot'
import { buildSheetGeometry, buildSurfaceGeometry, type SurfaceFn } from '../surface'
import { colorHex } from './types'
import type { BuildConfig, BuiltMockup, MockupDefinition, SlotDefinition } from './types'

interface CapShape {
  rx: number
  ry: number
  rz: number
  /** <1 = calotta più piena (strutturata), 1 = profilo sferico. */
  round: number
  /** >1 = cupola più bassa. */
  flat: number
  visorLength: number
  visorDrop: number
  visorSideDrop: number
  visorSpan: number
  visorThickness: number
  panels: number
  mesh: boolean
  closure: 'snap' | 'strap' | 'buckle'
}

const VARIANTS: Record<string, { label: string; description: string; shape: Partial<CapShape> }> = {
  baseball: {
    label: 'Baseball 6 pannelli',
    description: 'Profilo strutturato e visiera curva, chiusura a fibbia.',
    shape: {},
  },
  snapback: {
    label: 'Snapback visiera piatta',
    description: 'Fronte alto e rigido, visiera piatta, chiusura snap.',
    shape: {
      ry: 0.1,
      round: 0.66,
      flat: 1.15,
      visorDrop: 0.008,
      visorSideDrop: 0.002,
      visorLength: 0.082,
      visorSpan: deg(76),
      closure: 'snap',
    },
  },
  dad: {
    label: 'Dad hat destrutturato',
    description: 'Calotta morbida e bassa, visiera molto curva.',
    shape: {
      ry: 0.078,
      round: 1.0,
      flat: 0.92,
      visorDrop: 0.036,
      visorSideDrop: 0.02,
      visorLength: 0.066,
      closure: 'strap',
    },
  },
  trucker: {
    label: 'Trucker con rete',
    description: 'Fronte in tessuto, retro in rete traforata.',
    shape: { mesh: true, round: 0.68, ry: 0.098, closure: 'snap' },
  },
}

const COLORS = [
  { id: 'black', label: 'Nero', hex: '#1e1e22', dark: true },
  { id: 'white', label: 'Bianco', hex: '#f1f0ec' },
  { id: 'navy', label: 'Blu navy', hex: '#26334c', dark: true },
  { id: 'khaki', label: 'Khaki', hex: '#c3ae87' },
  { id: 'red', label: 'Rosso', hex: '#9e2f2c' },
  { id: 'grey', label: 'Grigio', hex: '#9fa3a8' },
]

const baseShape = (): CapShape => ({
  rx: 0.098,
  ry: 0.087,
  rz: 0.105,
  round: 0.78,
  flat: 1,
  visorLength: 0.072,
  visorDrop: 0.03,
  visorSideDrop: 0.012,
  visorSpan: deg(80),
  visorThickness: 0.007,
  panels: 6,
  mesh: false,
  closure: 'buckle',
})

const PHI_TOP = 0.08

function crownPoint(s: CapShape, theta: number, phi: number, out: THREE.Vector3) {
  const rad = Math.pow(Math.sin(phi), s.round)
  const y = s.ry * Math.pow(Math.cos(phi), s.flat)
  out.set(s.rx * rad * Math.sin(theta), y, s.rz * rad * Math.cos(theta))
}

function crownSurface(s: CapShape, thetaStart: number, thetaLength: number): SurfaceFn {
  return (u, v, out) => {
    const theta = thetaStart + u * thetaLength
    const phi = THREE.MathUtils.lerp(Math.PI / 2, PHI_TOP, v)
    crownPoint(s, theta, phi, out)
  }
}

/**
 * Superficie della visiera: parte dal bordo della calotta, si allunga in
 * avanti e si annulla ai lati, come una vera tesa cucita al cappello.
 */
function visorSurface(s: CapShape): SurfaceFn {
  return (u, v, out) => {
    const a = THREE.MathUtils.lerp(-s.visorSpan, s.visorSpan, u)
    const k = Math.abs(a) / s.visorSpan
    const taper = Math.pow(Math.cos((k * Math.PI) / 2), 2.1)
    const grow = 1 + (s.visorLength * v * taper) / s.rz
    const drop = s.visorDrop * Math.pow(v, 1.6) * taper + s.visorSideDrop * v * k * k
    out.set(
      s.rx * 1.02 * Math.sin(a) * grow,
      0.006 - drop,
      s.rz * 1.02 * Math.cos(a) * grow,
    )
  }
}

function build(cfg: BuildConfig): BuiltMockup {
  const variant = VARIANTS[cfg.variant] ?? VARIANTS.baseball
  const s: CapShape = { ...baseShape(), ...variant.shape }
  const color = { hex: colorHex(cfg, COLORS) }
  const group = new THREE.Group()

  const cloth = fabricMaterial(color.hex, 'jersey')

  if (s.mesh) {
    const frontGeo = buildSurfaceGeometry(crownSurface(s, -Math.PI / 2, Math.PI), { segU: 48, segV: 28 })
    const front = new THREE.Mesh(frontGeo, cloth)
    front.castShadow = true
    group.add(front)
    const meshMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color.hex).lerp(new THREE.Color('#ffffff'), 0.08),
      roughness: 0.9,
      metalness: 0,
      alphaMap: meshAlphaTexture(),
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    })
    const backGeo = buildSurfaceGeometry(crownSurface(s, Math.PI / 2, Math.PI), { segU: 48, segV: 28 })
    const back = new THREE.Mesh(backGeo, meshMat)
    group.add(back)
  } else {
    const geo = buildSurfaceGeometry(crownSurface(s, 0, Math.PI * 2), { segU: 96, segV: 32 })
    const crown = new THREE.Mesh(geo, cloth)
    crown.castShadow = true
    crown.receiveShadow = true
    group.add(crown)
  }

  // calotta interna per non vedere attraverso il fondo aperto
  const liningGeo = buildSurfaceGeometry(crownSurface(s, 0, Math.PI * 2), { segU: 64, segV: 24, offset: -0.004, flip: true })
  const lining = new THREE.Mesh(
    liningGeo,
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color.hex).multiplyScalar(0.55), roughness: 1 }),
  )
  group.add(lining)

  // bottone in cima
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.013, 20, 14), cloth)
  button.position.y = s.ry * Math.pow(Math.cos(PHI_TOP * 0.5), s.flat)
  button.castShadow = true
  group.add(button)

  // cuciture tra i pannelli
  const thread = threadMaterial(color.hex)
  const p = new THREE.Vector3()
  for (let i = 0; i < s.panels; i++) {
    const theta = (i / s.panels) * Math.PI * 2 + Math.PI / s.panels
    const pts: THREE.Vector3[] = []
    for (let j = 0; j <= 16; j++) {
      const phi = THREE.MathUtils.lerp(PHI_TOP, Math.PI / 2, j / 16)
      crownPoint(s, theta, phi, p)
      pts.push(p.clone().multiplyScalar(1.004))
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.0022, 6, false),
      thread,
    )
    group.add(tube)
  }

  // visiera
  const visor = buildSheetGeometry(visorSurface(s), s.visorThickness, { segU: 56, segV: 20 })
  const visorMat = fabricMaterial(color.hex, 'jersey')
  const underMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color.hex).multiplyScalar(0.6),
    roughness: 0.95,
  })
  const visorTop = new THREE.Mesh(visor.front, visorMat)
  const visorBottom = new THREE.Mesh(visor.back, underMat)
  const visorRim = new THREE.Mesh(visor.rim, visorMat)
  visorTop.castShadow = true
  visorBottom.castShadow = true
  group.add(visorTop, visorBottom, visorRim)

  // chiusura posteriore
  if (s.closure === 'snap') {
    const strapMat = plasticMaterial(color.hex, 0.55)
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.022, 0.006), strapMat)
      strap.position.set(side * 0.03, 0.012, -s.rz * 0.99)
      strap.rotation.y = side * deg(12)
      group.add(strap)
    }
  } else if (s.closure === 'strap') {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(s.rz * 0.72, 0.008, 8, 24, Math.PI * 0.8), cloth)
    strap.rotation.set(deg(90), 0, deg(90))
    strap.position.set(0, 0.014, -s.rz * 0.45)
    strap.scale.set(1, 1, 0.55)
    group.add(strap)
  } else {
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.005), metalMaterial())
    buckle.position.set(0, 0.016, -s.rz * 1.0)
    group.add(buckle)
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.004), cloth)
      strap.position.set(side * 0.035, 0.014, -s.rz * 0.98)
      strap.rotation.y = side * deg(16)
      group.add(strap)
    }
  }

  // aree di stampa: fronte e retro della calotta
  const frontW = Math.min(0.115, s.rx * 1.2)
  const frontH = 0.058
  const thetaHalf = frontW / 2 / s.rx
  const phiMid = deg(58)
  const phiHalf = frontH / 2 / s.ry

  const frontFn: SurfaceFn = (u, v, out) => {
    const theta = THREE.MathUtils.lerp(-thetaHalf, thetaHalf, u)
    const phi = THREE.MathUtils.lerp(phiMid + phiHalf, phiMid - phiHalf, v)
    crownPoint(s, theta, phi, out)
  }
  const backFn: SurfaceFn = (u, v, out) => {
    const theta = Math.PI + THREE.MathUtils.lerp(thetaHalf, -thetaHalf, u)
    const phi = THREE.MathUtils.lerp(phiMid + phiHalf * 0.85, phiMid - phiHalf * 0.85, v)
    crownPoint(s, theta, phi, out)
  }

  const front = artworkMesh(frontFn, { slot: 'fronte', segU: 60, segV: 40, offset: 0.0012, roughness: 0.9 })
  const back = artworkMesh(backFn, { slot: 'retro', segU: 60, segV: 40, offset: 0.0012, roughness: 0.9 })
  group.add(front, back)

  const slots: SlotDefinition[] = [
    {
      id: 'fronte',
      label: 'Fronte',
      area: { width: frontW, height: frontH },
      hint: 'Fronte calotta ~11 × 6 cm',
      meshes: [front],
    },
    {
      id: 'retro',
      label: 'Retro',
      area: { width: frontW * 0.6, height: frontH * 0.6 },
      hint: 'Retro ~7 × 3,5 cm',
      meshes: [back],
    },
  ]

  group.position.y = 0.04

  return {
    group,
    slots,
    camera: { azimuth: deg(-24), polar: deg(74), distanceFactor: 1.0 },
    dispose() {},
  }
}

export const cap: MockupDefinition = {
  id: 'cappello',
  name: 'Cappello con visiera',
  category: 'abbigliamento',
  tagline: 'Baseball, snapback, dad hat, trucker',
  description:
    'Cappelli a sei pannelli con visiera curva o piatta. Area ricamo sul fronte e logo sul retro, chiusure snap, fibbia o strap.',
  icon: 'cap',
  variants: Object.entries(VARIANTS).map(([id, v]) => ({
    id,
    label: v.label,
    description: v.description,
  })),
  colors: COLORS,
  build,
}
