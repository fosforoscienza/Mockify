import * as THREE from 'three'
import { paperMaterial } from '../materials'
import { deg } from '../geometry'
import { artworkMesh } from '../slot'
import { buildSheetGeometry, type SurfaceFn } from '../surface'
import { BROCHURE_FORMATS, findFormat, toScene } from './formats'
import {
colorHex,
optionString, type BuildConfig, type BuiltMockup, type MockupDefinition, type SlotDefinition } from './types'

interface BrochureVariant {
  label: string
  description: string
  /** Angolo di ogni anta rispetto al piano frontale. */
  angles: number[]
  /** Curvatura interna dell'anta (carta mai perfettamente piana). */
  bow: number
  camera: { azimuth: number; polar: number }
}

const VARIANTS: Record<string, BrochureVariant> = {
  zeta: {
    label: 'Piega a zeta',
    description: 'Ante a fisarmonica, brochure in piedi.',
    angles: [deg(32), deg(-30), deg(32)],
    bow: deg(2.5),
    camera: { azimuth: deg(-34), polar: deg(70) },
  },
  rotolo: {
    label: 'Piega a rotolo',
    description: 'Ante che si avvolgono una dentro l’altra.',
    angles: [deg(34), deg(4), deg(-28)],
    bow: deg(3),
    camera: { azimuth: deg(-38), polar: deg(68) },
  },
  aperta: {
    label: 'Aperta di piatto',
    description: 'Spread completo con pieghe appena accennate.',
    angles: [deg(7), deg(0), deg(-7)],
    bow: deg(1.6),
    camera: { azimuth: deg(-18), polar: deg(72) },
  },
  espositore: {
    label: 'In piedi semiaperta',
    description: 'Anta centrale frontale e laterali arretrate.',
    angles: [deg(46), deg(-4), deg(44)],
    bow: deg(2),
    camera: { azimuth: deg(-26), polar: deg(64) },
  },
}

const PAPERS = [
  { id: 'white', label: 'Patinata bianca', hex: '#ffffff' },
  { id: 'natural', label: 'Naturale avorio', hex: '#f7f1e6' },
  { id: 'recycled', label: 'Riciclata', hex: '#ece4d5' },
]

const smoothstep = (t: number) => {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/**
 * Percorso della carta piegata: le direzioni delle ante vengono fuse su una
 * piccola finestra attorno alle cordonature, così le pieghe risultano
 * arrotondate come nella carta vera invece che a spigolo vivo.
 */
function foldedPath(angles: number[], panelWidth: number, bow: number, samples = 320) {
  const n = angles.length
  const round = 0.05
  const angleAt = (s: number) => {
    const i = THREE.MathUtils.clamp(Math.floor(s), 0, n - 1)
    const f = s - i
    let a = angles[i] + bow * Math.sin(f * Math.PI) * (i % 2 === 0 ? 1 : -1)
    if (i > 0 && f < round) {
      a = THREE.MathUtils.lerp(angles[i - 1], a, smoothstep(0.5 + f / (2 * round)))
    } else if (i < n - 1 && f > 1 - round) {
      a = THREE.MathUtils.lerp(a, angles[i + 1], smoothstep((f - (1 - round)) / (2 * round)))
    }
    return a
  }

  const pts: THREE.Vector2[] = []
  let x = 0
  let z = 0
  const step = (n * panelWidth) / samples
  for (let i = 0; i <= samples; i++) {
    pts.push(new THREE.Vector2(x, z))
    const a = angleAt((i / samples) * n)
    x += Math.cos(a) * step
    z += -Math.sin(a) * step
  }
  // centratura sull'ingombro reale
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  pts.forEach((p) => {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.y)
    maxZ = Math.max(maxZ, p.y)
  })
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  pts.forEach((p) => {
    p.x -= cx
    p.y -= cz
  })
  return pts
}

function brochureSurface(pts: THREE.Vector2[], height: number): SurfaceFn {
  const last = pts.length - 1
  return (u, v, out) => {
    const s = THREE.MathUtils.clamp(u, 0, 1) * last
    const i = Math.min(last - 1, Math.floor(s))
    const t = s - i
    const a = pts[i]
    const b = pts[i + 1]
    out.set(
      THREE.MathUtils.lerp(a.x, b.x, t),
      (v - 0.5) * height,
      THREE.MathUtils.lerp(a.y, b.y, t),
    )
  }
}

function build(cfg: BuildConfig): BuiltMockup {
  const variant = VARIANTS[cfg.variant] ?? VARIANTS.zeta
  const format = findFormat(BROCHURE_FORMATS, optionString(cfg, 'formato', 'a4'))
  const { width: panelW, height } = toScene(format, 0.6)
  const spread = panelW * 3
  const paperColor = { hex: colorHex(cfg, PAPERS) }

  const group = new THREE.Group()
  const pts = foldedPath(variant.angles, panelW, variant.bow)
  const fn = brochureSurface(pts, height)
  const thickness = 0.0009

  const { front, back, rim } = buildSheetGeometry(fn, thickness, { segU: 150, segV: 26 })
  const paper = paperMaterial(paperColor.hex, 0.3)
  const fm = new THREE.Mesh(front, paper)
  const bm = new THREE.Mesh(back, paper)
  const rm = new THREE.Mesh(rim, paper)
  fm.castShadow = true
  fm.receiveShadow = true
  bm.castShadow = true
  bm.receiveShadow = true
  group.add(fm, bm, rm)

  const inside = artworkMesh(fn, {
    slot: 'interno',
    segU: 150,
    segV: 26,
    offset: thickness / 2 + 0.00025,
    roughness: 0.62,
  })
  const outside = artworkMesh(fn, {
    slot: 'esterno',
    segU: 150,
    segV: 26,
    offset: -(thickness / 2 + 0.00025),
    flip: true,
    mirrorU: true,
    roughness: 0.62,
  })
  group.add(inside, outside)

  const hint = `Spread 3 ante — ${format.w * 3} × ${format.h} mm`
  const slots: SlotDefinition[] = [
    {
      id: 'interno',
      label: 'Interno',
      area: { width: spread, height },
      hint,
      meshes: [inside],
      fullBleed: true,
    },
    {
      id: 'esterno',
      label: 'Esterno',
      area: { width: spread, height },
      hint: `${hint} (copertina + retro)`,
      meshes: [outside],
      fullBleed: true,
    },
  ]

  return {
    group,
    slots,
    camera: { ...variant.camera, distanceFactor: 1.05 },
    dispose() {},
  }
}

export const brochure: MockupDefinition = {
  id: 'brochure',
  name: 'Brochure 3 ante',
  category: 'stampa',
  tagline: '4 pieghe, spread interno ed esterno',
  description:
    'Depliant a tre ante con cordonature arrotondate: carichi lo spread interno e quello esterno e ruoti la brochure per controllare entrambi i lati.',
  icon: 'brochure',
  variants: Object.entries(VARIANTS).map(([id, v]) => ({
    id,
    label: v.label,
    description: v.description,
  })),
  colors: PAPERS,
  options: [
    {
      id: 'formato',
      kind: 'select',
      label: 'Formato (anta chiusa)',
      default: 'a4',
      values: BROCHURE_FORMATS.map((f) => ({ id: f.id, label: f.label })),
    },
  ],
  build,
}
