import * as THREE from 'three'
import { paperMaterial } from '../materials'
import { deg } from '../geometry'
import { artworkMesh } from '../slot'
import { buildSheetGeometry, type SurfaceFn } from '../surface'
import { SHEET_FORMATS, findFormat, mm, toScene } from './formats'
import {
colorHex,
optionString, type BuildConfig, type BuiltMockup, type MockupDefinition, type SlotDefinition } from './types'

interface SheetPose {
  x: number
  z: number
  rot: number
  lift: number
  /** true = il foglio mostra il retro. */
  flipped: boolean
  curl: number
}

const VARIANTS: Record<string, { label: string; description: string; poses: SheetPose[] }> = {
  coppia: {
    label: 'Due fogli affiancati',
    description: 'Un foglio mostra il fronte, l’altro il retro.',
    poses: [
      { x: -0.3, z: 0.02, rot: deg(-7), lift: 0, flipped: false, curl: 0.35 },
      { x: 0.3, z: -0.01, rot: deg(6), lift: 0, flipped: true, curl: 0.3 },
    ],
  },
  sovrapposti: {
    label: 'Due fogli sovrapposti',
    description: 'Un foglio appoggiato sull\u2019altro, con un angolo scoperto.',
    poses: [
      { x: -0.2, z: 0.05, rot: deg(-3), lift: 0, flipped: false, curl: 0.2 },
      { x: 0.19, z: -0.03, rot: deg(5), lift: 0.0025, flipped: true, curl: 0.24 },
    ],
  },
  sparsi: {
    label: 'Tre fogli sparsi',
    description: 'Composizione sovrapposta con fronte e retro visibili.',
    poses: [
      { x: -0.3, z: 0.14, rot: deg(-12), lift: 0, flipped: false, curl: 0.4 },
      { x: 0.3, z: 0.06, rot: deg(9), lift: 0.006, flipped: true, curl: 0.3 },
      { x: -0.04, z: -0.3, rot: deg(-3), lift: 0.012, flipped: false, curl: 0.25 },
    ],
  },
  pila: {
    label: 'Pila con foglio girato',
    description: 'Piccola risma e un foglio voltato accanto.',
    poses: [
      { x: -0.26, z: 0, rot: deg(-4), lift: 0, flipped: false, curl: 0.2 },
      { x: -0.25, z: 0.004, rot: deg(-1), lift: 0.0016, flipped: false, curl: 0.2 },
      { x: -0.245, z: 0.008, rot: deg(2), lift: 0.0032, flipped: false, curl: 0.22 },
      { x: 0.3, z: 0.02, rot: deg(8), lift: 0, flipped: true, curl: 0.34 },
    ],
  },
}

const PAPERS = [
  { id: 'white', label: 'Bianco', hex: '#ffffff' },
  { id: 'natural', label: 'Avorio', hex: '#f7f1e4' },
  { id: 'recycled', label: 'Riciclata', hex: '#ebe3d3' },
]

/** Foglio appoggiato: leggera ondulazione e un angolo sollevato. */
function sheetSurface(w: number, h: number, curl: number): SurfaceFn {
  return (u, v, out) => {
    const x = (u - 0.5) * w
    const y = (v - 0.5) * h
    let z = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.004
    const cu = Math.max(0, u - 0.62) / 0.38
    const cv = Math.max(0, v - 0.66) / 0.34
    z += Math.pow(cu * cv, 1.6) * curl * h * 0.17
    out.set(x, y, z)
  }
}

function build(cfg: BuildConfig): BuiltMockup {
  const variant = VARIANTS[cfg.variant] ?? VARIANTS.coppia
  const format = findFormat(SHEET_FORMATS, optionString(cfg, 'formato', 'a4'))
  const { width: w, height: h } = toScene(format, 0.62)
  const paperColor = { hex: colorHex(cfg, PAPERS) }
  const group = new THREE.Group()

  const thickness = 0.0011
  const paper = paperMaterial(paperColor.hex, 0.18)
  const fronts: THREE.Mesh[] = []
  const backs: THREE.Mesh[] = []

  variant.poses.forEach((pose, i) => {
    const fn = sheetSurface(w, h, pose.flipped ? -pose.curl : pose.curl)
    const sheet = new THREE.Group()
    const { front, back, rim } = buildSheetGeometry(fn, thickness, { segU: 56, segV: 56 })
    const fm = new THREE.Mesh(front, paper)
    const bm = new THREE.Mesh(back, paper)
    const rm = new THREE.Mesh(rim, paper)
    fm.castShadow = true
    fm.receiveShadow = true
    bm.receiveShadow = true
    sheet.add(fm, bm, rm)

    const artFront = artworkMesh(fn, {
      slot: 'fronte',
      segU: 56,
      segV: 56,
      offset: thickness / 2 + 0.0003,
      roughness: 0.7,
    })
    const artBack = artworkMesh(fn, {
      slot: 'retro',
      segU: 56,
      segV: 56,
      offset: -(thickness / 2 + 0.0003),
      flip: true,
      mirrorU: true,
      roughness: 0.7,
    })
    sheet.add(artFront, artBack)
    fronts.push(artFront)
    backs.push(artBack)

    // dal piano verticale al piano d'appoggio; i fogli girati mostrano il retro
    if (pose.flipped) sheet.rotation.set(Math.PI / 2, 0, Math.PI)
    else sheet.rotation.x = -Math.PI / 2
    const holder = new THREE.Group()
    holder.add(sheet)
    holder.rotation.y = pose.rot
    holder.position.set(pose.x, pose.lift + i * 0.0006, pose.z)
    group.add(holder)
  })

  const slots: SlotDefinition[] = [
    {
      id: 'fronte',
      label: 'Fronte',
      area: { width: w, height: h },
      hint: `${format.label} — ${mm(format)}`,
      meshes: fronts,
      fullBleed: true,
    },
    {
      id: 'retro',
      label: 'Retro',
      area: { width: w, height: h },
      hint: 'Seconda facciata, visibile sui fogli girati',
      meshes: backs,
      fullBleed: true,
    },
  ]

  return {
    group,
    slots,
    camera: { azimuth: deg(-12), polar: deg(38), distanceFactor: 1.0 },
    dispose() {},
  }
}

export const sheets: MockupDefinition = {
  id: 'fogli',
  name: 'Fogli sparsi',
  category: 'stampa',
  tagline: 'Fronte e retro sulla stessa composizione',
  description:
    'Volantini e fogli appoggiati con angoli arricciati: carichi due grafiche diverse per fronte e retro e le vedi entrambe nella stessa scena.',
  icon: 'sheets',
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
      label: 'Formato',
      default: 'a4',
      values: SHEET_FORMATS.map((f) => ({ id: f.id, label: f.label })),
    },
  ],
  build,
}
