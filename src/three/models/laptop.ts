import * as THREE from 'three'
import { deg } from '../geometry'
import { artworkMesh } from '../slot'
import { planeSurface } from '../surface'
import { keyboardTexture, speakerGrilleTexture } from '../textures'
import {
  colorHex,
  optionString,
  type BuildConfig,
  type BuiltMockup,
  type MockupDefinition,
  type SlotDefinition,
} from './types'

/** Millimetri reali verso unità di scena: un 14" risulta largo ~0,9. */
const MM = 1 / 348
const mm = (v: number) => v * MM

interface Size {
  id: string
  label: string
  /** Scocca chiusa, in millimetri. */
  width: number
  depth: number
  baseHeight: number
  lidHeight: number
  /** Area attiva del display, in millimetri. */
  screenW: number
  screenH: number
  /** Cornice sotto al display: più alta delle altre tre. */
  chin: number
  trackpadW: number
  trackpadH: number
}

const SIZES: Size[] = [
  {
    id: '14',
    label: '14 pollici',
    width: 312.6,
    depth: 221.2,
    baseHeight: 11,
    lidHeight: 4.6,
    screenW: 302.4,
    screenH: 196.4,
    chin: 15.6,
    trackpadW: 130,
    trackpadH: 81,
  },
  {
    id: '16',
    label: '16 pollici',
    width: 355.7,
    depth: 248.1,
    baseHeight: 12.2,
    lidHeight: 4.8,
    screenW: 345.6,
    screenH: 223.4,
    chin: 17.4,
    trackpadW: 160,
    trackpadH: 99,
  },
]

interface View {
  id: string
  label: string
  description: string
  /** Apertura dello schermo misurata dal piano della tastiera. */
  lid: number
  camera: { azimuth: number; polar: number; distanceFactor?: number }
}

const VIEWS: View[] = [
  {
    id: 'fronte',
    label: 'Frontale',
    description: 'Schermo di fronte: la grafica si legge senza deformazioni.',
    lid: 100,
    camera: { azimuth: 0, polar: deg(80), distanceFactor: 0.94 },
  },
  {
    id: 'tre-quarti',
    label: 'Tre quarti',
    description: 'Ripresa da sinistra, con la scocca in prospettiva.',
    lid: 105,
    camera: { azimuth: deg(-34), polar: deg(70), distanceFactor: 1 },
  },
  {
    id: 'scrivania',
    label: 'Da scrivania',
    description: 'Punto di vista di chi è seduto davanti al computer.',
    lid: 108,
    camera: { azimuth: deg(14), polar: deg(52), distanceFactor: 1.02 },
  },
  {
    id: 'alto',
    label: 'Dall’alto',
    description: 'Schermo spalancato, tastiera e trackpad in evidenza.',
    lid: 125,
    camera: { azimuth: deg(-8), polar: deg(30), distanceFactor: 1.04 },
  },
]

const FINISHES = [
  { id: 'siderale', label: 'Grigio siderale', hex: '#6e7176', dark: true },
  { id: 'argento', label: 'Argento', hex: '#d6d8db' },
  { id: 'nero', label: 'Nero siderale', hex: '#43474d', dark: true },
]

/** Rettangolo con angoli raccordati, usato per scocca e dettagli del piano. */
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/**
 * Lastra con angoli raccordati e spigoli smussati, estrusa lungo Z e centrata
 * sull'origine. Lo smusso è quello che fa leggere l'alluminio: senza, gli
 * spigoli restano neri e la scocca sembra di cartone.
 */
function slab(w: number, h: number, thickness: number, radius: number, bevel: number) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, h, radius), {
    depth: thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 12,
  })
  geo.translate(0, 0, bevel - thickness / 2)
  geo.computeVertexNormals()
  return geo
}

/** Piano sottile con angoli raccordati, per i dettagli appoggiati sul piano. */
function panel(w: number, h: number, radius: number) {
  const geo = new THREE.ShapeGeometry(roundedRect(w, h, radius), 10)
  geo.rotateX(-Math.PI / 2)
  return geo
}

function aluminium(hex: string) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.42,
    metalness: 0.62,
  })
}

function build(cfg: BuildConfig): BuiltMockup {
  const view = VIEWS.find((v) => v.id === cfg.variant) ?? VIEWS[0]
  const size = SIZES.find((s) => s.id === optionString(cfg, 'formato', '14')) ?? SIZES[0]
  const body = colorHex(cfg, FINISHES)

  const group = new THREE.Group()
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(v: T) => {
    disposables.push(v)
    return v
  }

  const w = mm(size.width)
  const d = mm(size.depth)
  const baseH = mm(size.baseHeight)
  const lidH = mm(size.lidHeight)
  const corner = mm(10)

  const shell = track(aluminium(body))
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6, metalness: 0.2 }))

  // ------------------------------------------------------------------ scocca
  const baseGeo = track(slab(w, d, baseH, corner, mm(0.8)))
  const base = new THREE.Mesh(baseGeo, shell)
  base.rotation.x = -Math.PI / 2
  base.position.y = baseH / 2
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  // piedini in gomma: si vedono solo dalle inquadrature basse, ma senza il
  // portatile sembra incollato al piano
  const footGeo = track(new THREE.CylinderGeometry(mm(3), mm(3), mm(1.1), 16))
  const foot = track(new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.9 }))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new THREE.Mesh(footGeo, foot)
      f.position.set(sx * (w / 2 - mm(20)), mm(0.55), sz * (d / 2 - mm(16)))
      group.add(f)
    }
  }

  // --------------------------------------------------- tastiera e trackpad
  const deckY = baseH + mm(0.05)
  const kbW = w - mm(size.id === '14' ? 32 : 46)
  const kbH = kbW * 0.405
  const kbTop = -d / 2 + mm(14)

  const well = new THREE.Mesh(
    track(panel(kbW + mm(4), kbH + mm(4), mm(3))),
    track(new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.78 })),
  )
  well.position.set(0, deckY, kbTop + kbH / 2)
  group.add(well)

  const keys = new THREE.Mesh(
    track(panel(kbW, kbH, mm(2))),
    track(
      new THREE.MeshStandardMaterial({
        map: keyboardTexture(),
        roughness: 0.72,
        metalness: 0.05,
      }),
    ),
  )
  keys.position.set(0, deckY + mm(0.1), kbTop + kbH / 2)
  group.add(keys)

  const grilleTex = speakerGrilleTexture().clone()
  grilleTex.needsUpdate = true
  grilleTex.repeat.set(3, 26)
  const grille = track(
    new THREE.MeshStandardMaterial({
      map: grilleTex,
      transparent: true,
      roughness: 0.6,
      metalness: 0.4,
      color: new THREE.Color(body),
    }),
  )
  disposables.push(grilleTex)
  const grilleW = (w - kbW) / 2 - mm(9)
  const grilleGeo = track(panel(grilleW, kbH, mm(2)))
  for (const sx of [-1, 1]) {
    const g = new THREE.Mesh(grilleGeo, grille)
    g.position.set(sx * (kbW / 2 + mm(4) + grilleW / 2), deckY + mm(0.05), kbTop + kbH / 2)
    group.add(g)
  }

  const tpW = mm(size.trackpadW)
  const tpH = mm(size.trackpadH)
  const trackpad = new THREE.Mesh(
    track(panel(tpW, tpH, mm(6))),
    track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(body).multiplyScalar(0.94),
        roughness: 0.3,
        metalness: 0.45,
      }),
    ),
  )
  const tpZ = kbTop + kbH + mm(10) + tpH / 2
  trackpad.position.set(0, deckY + mm(0.05), tpZ)
  group.add(trackpad)
  // solco attorno al trackpad: un piano scuro appena più grande
  const tpSeam = new THREE.Mesh(track(panel(tpW + mm(1.2), tpH + mm(1.2), mm(6.4))), dark)
  tpSeam.position.set(0, deckY, tpZ)
  group.add(tpSeam)

  // ------------------------------------------------------------------ cerniera
  const hingeGeo = track(new THREE.CylinderGeometry(lidH / 2, lidH / 2, w - mm(24), 20))
  const hinge = new THREE.Mesh(hingeGeo, dark)
  hinge.rotation.z = Math.PI / 2
  hinge.position.set(0, baseH + lidH / 2, -d / 2 + lidH / 2)
  group.add(hinge)

  // -------------------------------------------------------------------- schermo
  const pivot = new THREE.Group()
  pivot.position.set(0, baseH + mm(0.4), -d / 2 + lidH / 2)
  pivot.rotation.x = -deg(view.lid - 90)
  group.add(pivot)

  const lidGeo = track(slab(w, d, lidH, corner, mm(0.7)))
  const lid = new THREE.Mesh(lidGeo, shell)
  lid.position.y = d / 2
  lid.castShadow = true
  pivot.add(lid)

  // vetro nero a filo scocca: è lui che si vede a schermo spento
  const glass = new THREE.Mesh(
    track(new THREE.ShapeGeometry(roundedRect(w - mm(2), d - mm(2), corner - mm(1)), 10)),
    track(new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.14, metalness: 0.1 })),
  )
  glass.position.set(0, d / 2, lidH / 2 + mm(0.05))
  pivot.add(glass)

  // l'area attiva non è centrata: sotto la cornice è più alta
  const screenW = mm(size.screenW)
  const screenH = mm(size.screenH)
  const bezel = (d - screenH) / 2
  const screenY = d / 2 + (mm(size.chin) - bezel)

  const art = artworkMesh(planeSurface(screenW, screenH), {
    slot: 'schermo',
    segU: 8,
    segV: 8,
    offset: mm(0.12),
    roughness: 0.34,
    metalness: 0,
    glow: 0.55,
  })
  art.position.set(0, screenY, lidH / 2 + mm(0.05))
  pivot.add(art)

  // tacca della fotocamera: va sopra alla grafica, non sotto
  const notch = new THREE.Mesh(
    track(new THREE.ShapeGeometry(roundedRect(mm(32), mm(8.5), mm(3)), 6)),
    track(new THREE.MeshStandardMaterial({ color: 0x060709, roughness: 0.3 })),
  )
  notch.position.set(0, screenY + screenH / 2 - mm(4.2), lidH / 2 + mm(0.35))
  notch.renderOrder = 3
  pivot.add(notch)

  const slots: SlotDefinition[] = [
    {
      id: 'schermo',
      label: 'Schermo',
      area: { width: screenW, height: screenH },
      hint: `Display ${size.label} — ${size.screenW.toFixed(0)} × ${size.screenH.toFixed(0)} mm`,
      meshes: [art],
      fullBleed: true,
    },
  ]

  return {
    group,
    slots,
    camera: view.camera,
    dispose() {
      disposables.forEach((v) => v.dispose())
    },
  }
}

export const laptop: MockupDefinition = {
  id: 'laptop',
  name: 'Laptop',
  category: 'digitale',
  tagline: 'Schermo acceso, quattro inquadrature',
  description:
    'Portatile in alluminio da 14 o 16 pollici, con scocca, tastiera e trackpad modellati. La grafica va sul display e lo illumina davvero, così uno screenshot di sito o di app sembra acceso sullo schermo.',
  icon: 'laptop',
  variants: VIEWS.map((v) => ({ id: v.id, label: v.label, description: v.description })),
  colors: FINISHES,
  options: [
    {
      id: 'formato',
      kind: 'select',
      label: 'Formato',
      default: '14',
      values: SIZES.map((s) => ({ id: s.id, label: s.label })),
    },
  ],
  build,
}
