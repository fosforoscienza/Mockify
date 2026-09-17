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
  /** Angolo che si solleva: -1 a sinistra, +1 a destra. Tiene l'arricciatura
   *  lontana dalla zona di sovrapposizione, così i fogli non si compenetrano. */
  curlSide: -1 | 1
  /** Foglio sepolto in una pila: se ne vede solo il bordo, niente grafica. */
  blank?: boolean
}

const VARIANTS: Record<string, { label: string; description: string; poses: SheetPose[] }> = {
  coppia: {
    label: 'Due fogli affiancati',
    description: 'Un foglio mostra il fronte, l’altro il retro.',
    poses: [
      { x: -0.3, z: 0.02, rot: deg(-7), lift: 0, flipped: false, curl: 0.35, curlSide: -1 },
      { x: 0.3, z: -0.01, rot: deg(6), lift: 0, flipped: true, curl: 0.3, curlSide: 1 },
    ],
  },
  sovrapposti: {
    label: 'Due fogli sovrapposti',
    description: 'Un foglio appoggiato sull\u2019altro, con un angolo scoperto.',
    poses: [
      // il retro sta sotto e a sinistra; il fronte sopra e a destra, dal lato
      // della luce, così l'ombra del foglio superiore cade nella sovrapposizione
      { x: -0.16, z: 0.03, rot: deg(-6), lift: 0, flipped: true, curl: 0.24, curlSide: -1 },
      { x: 0.145, z: -0.01, rot: deg(4), lift: 0.018, flipped: false, curl: 0.26, curlSide: 1 },
    ],
  },
  sparsi: {
    label: 'Tre fogli sparsi',
    description: 'Composizione sovrapposta con fronte e retro visibili.',
    poses: [
      { x: -0.32, z: 0.15, rot: deg(-12), lift: 0, flipped: false, curl: 0.34, curlSide: -1 },
      { x: 0.32, z: 0.06, rot: deg(9), lift: 0.008, flipped: true, curl: 0.3, curlSide: 1 },
      { x: -0.04, z: -0.32, rot: deg(-3), lift: 0.016, flipped: false, curl: 0.24, curlSide: -1 },
    ],
  },
  pila: {
    label: 'Pila con foglio girato',
    description: 'Piccola risma e un foglio voltato accanto.',
    poses: [
      { x: -0.26, z: 0, rot: deg(-4), lift: 0, flipped: false, curl: 0.16, curlSide: -1, blank: true },
      { x: -0.25, z: 0.005, rot: deg(-1), lift: 0.003, flipped: false, curl: 0.16, curlSide: -1, blank: true },
      { x: -0.245, z: 0.01, rot: deg(2), lift: 0.006, flipped: false, curl: 0.18, curlSide: -1 },
      { x: 0.3, z: 0.02, rot: deg(8), lift: 0, flipped: true, curl: 0.3, curlSide: 1 },
    ],
  },
}

const PAPERS = [
  { id: 'white', label: 'Bianco', hex: '#ffffff' },
  { id: 'natural', label: 'Avorio', hex: '#f7f1e4' },
  { id: 'recycled', label: 'Riciclata', hex: '#ebe3d3' },
]

/** Foglio appoggiato: leggera ondulazione e un angolo sollevato. */
function sheetSurface(w: number, h: number, curl: number, curlSide: -1 | 1): SurfaceFn {
  return (u, v, out) => {
    const x = (u - 0.5) * w
    const y = (v - 0.5) * h
    let z = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.0012
    const side = curlSide > 0 ? u : 1 - u
    const cu = Math.max(0, side - 0.62) / 0.38
    const cv = Math.max(0, v - 0.66) / 0.34
    z += Math.pow(cu * cv, 1.6) * curl * h * 0.17
    out.set(x, y, z)
  }
}

/** Texture di un'ombra di contatto: rettangolo pieno con bordo sfumato.
 *  Il canale verde fa da alphaMap, quindi la scriviamo su tutti i canali. */
let shadowTexture: THREE.Texture | null = null
const SHADOW_INSET = 0.08
const SHADOW_FEATHER = 0.06
function contactShadowTexture(): THREE.Texture {
  if (shadowTexture) return shadowTexture
  const size = 128
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const dx = Math.max(SHADOW_INSET - u, u - (1 - SHADOW_INSET), 0)
      const dy = Math.max(SHADOW_INSET - v, v - (1 - SHADOW_INSET), 0)
      const d = Math.min(1, Math.hypot(dx, dy) / SHADOW_FEATHER)
      const a = 1 - d * d * (3 - 2 * d)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = Math.round(a * 255)
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  shadowTexture = tex
  return tex
}

/** Direzione della luce chiave del viewer, normalizzata sull'asse verticale:
 *  moltiplicata per l'altezza da terra dà lo scostamento dell'ombra. */
const SHADOW_SLOPE_X = -1.5 / 2.2
const SHADOW_SLOPE_Z = -1.9 / 2.2
/** Il rettangolo pieno occupa questa frazione della texture. */
const SHADOW_SCALE = 1 / (1 - 2 * SHADOW_INSET)

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

  // La shadow map non riesce a rendere il contatto fra due fogli: il normalBias
  // necessario altrove è più grande dello spessore in gioco. L'ombra di contatto
  // è quindi un decal esplicito, appoggiato sul piano sotto al foglio e spostato
  // lungo la direzione della luce in proporzione all'altezza.
  const shadowGeometry = new THREE.PlaneGeometry(w * SHADOW_SCALE, h * SHADOW_SCALE)
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x05070a,
    alphaMap: contactShadowTexture(),
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false,
  })
  const disposables: { dispose(): void }[] = [shadowGeometry, shadowMaterial]

  variant.poses.forEach((pose, i) => {
    const fn = sheetSurface(w, h, pose.flipped ? -pose.curl : pose.curl, pose.curlSide)
    const sheet = new THREE.Group()
    const { front, back, rim } = buildSheetGeometry(fn, thickness, { segU: 56, segV: 56 })
    const fm = new THREE.Mesh(front, paper)
    const bm = new THREE.Mesh(back, paper)
    const rm = new THREE.Mesh(rim, paper)
    fm.castShadow = true
    fm.receiveShadow = true
    bm.receiveShadow = true
    sheet.add(fm, bm, rm)

    if (!pose.blank) {
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
    }

    // dal piano verticale al piano d'appoggio; i fogli girati mostrano il retro
    if (pose.flipped) sheet.rotation.set(Math.PI / 2, 0, Math.PI)
    else sheet.rotation.x = -Math.PI / 2
    const holder = new THREE.Group()
    holder.add(sheet)
    holder.rotation.y = pose.rot
    holder.position.set(pose.x, pose.lift + i * 0.0006, pose.z)

    // Il foglio appoggia sul tavolo, oppure su quello precedente se è sollevato
    // abbastanza da staccarsene. Il decal sta appena sopra quel piano e sempre
    // sotto al proprio foglio, che lo nasconde con lo z-buffer lasciando fuori
    // solo l'alone e la fascia che sborda dal lato opposto alla luce.
    const y = pose.lift + i * 0.0006
    const prev = variant.poses[i - 1]
    const base = prev ? prev.lift + (i - 1) * 0.0006 : 0
    const stacked = y - base > 0.003
    const drop = Math.max(0.004, y - (stacked ? base : 0))
    const decalY = stacked
      ? base + Math.min(0.006, Math.max(0.0019, (y - base) * 0.5))
      : -0.0022
    const decal = new THREE.Mesh(shadowGeometry, shadowMaterial)
    decal.rotation.x = -Math.PI / 2
    decal.renderOrder = 4 + i
    const decalHolder = new THREE.Group()
    decalHolder.add(decal)
    decalHolder.rotation.y = pose.rot
    decalHolder.position.set(
      pose.x + SHADOW_SLOPE_X * drop,
      decalY,
      pose.z + SHADOW_SLOPE_Z * drop,
    )

    group.add(decalHolder, holder)
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
    dispose() {
      disposables.forEach((d) => d.dispose())
    },
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
