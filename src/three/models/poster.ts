import * as THREE from 'three'
import { metalMaterial, paperMaterial, plasticMaterial, woodMaterial } from '../materials'
import { deg } from '../geometry'
import { artworkMesh } from '../slot'
import { buildSheetGeometry, type SurfaceFn } from '../surface'
import { POSTER_FORMATS, findFormat, mm, toScene } from './formats'
import { optionString, type BuildConfig, type BuiltMockup, type MockupDefinition, type SlotDefinition } from './types'

type PosterVariant = 'hanger' | 'clips' | 'pins' | 'free'

const VARIANTS: { id: PosterVariant; label: string; description: string }[] = [
  { id: 'hanger', label: 'Cornice a bastone', description: 'Listelli in legno sopra e sotto con cordino.' },
  { id: 'clips', label: 'Mollette su filo', description: 'Poster sospeso a un filo con due mollette.' },
  { id: 'pins', label: 'Puntine da parete', description: 'Quattro puntine, angoli leggermente arricciati.' },
  { id: 'free', label: 'Foglio sospeso', description: 'Carta libera con ondulazione naturale.' },
]

const PAPERS = [
  { id: 'white', label: 'Bianco opaco', hex: '#ffffff' },
  { id: 'natural', label: 'Avorio naturale', hex: '#f6efe2' },
  { id: 'recycled', label: 'Riciclata', hex: '#ece5d6' },
]

function posterSurface(w: number, h: number, variant: PosterVariant): SurfaceFn {
  return (u, v, out) => {
    const x = (u - 0.5) * w
    const y = (v - 0.5) * h
    let z = 0
    const down = 1 - v
    if (variant === 'free' || variant === 'clips') {
      z += Math.sin(u * Math.PI * 2.1 + 0.4) * 0.012 * Math.pow(down, 1.35) * (w / 0.6)
      z += Math.sin(u * Math.PI * 1.1) * 0.006 * Math.pow(down, 2)
    } else if (variant === 'hanger') {
      z += Math.sin(u * Math.PI) * 0.008 * Math.sin(v * Math.PI)
    } else {
      // puntine: la carta si stacca dalla parete verso il centro e agli angoli bassi
      const cx = (u - 0.5) * 2
      const cy = (v - 0.5) * 2
      z += (1 - cx * cx) * (1 - cy * cy) * 0.01
      z += Math.pow(Math.max(0, 1 - v * 2.6), 2) * Math.pow(Math.abs(cx), 2.4) * 0.05
    }
    out.set(x, y, z)
  }
}

function build(cfg: BuildConfig): BuiltMockup {
  const variant = (cfg.variant as PosterVariant) ?? 'hanger'
  const format = findFormat(POSTER_FORMATS, optionString(cfg, 'formato', '50x70'))
  const { width: w, height: h } = toScene(format, 0.95)
  const paperColor = PAPERS.find((pp) => pp.id === cfg.color) ?? PAPERS[0]
  const group = new THREE.Group()

  const fn = posterSurface(w, h, variant)
  const thickness = 0.0016
  const { front, back, rim } = buildSheetGeometry(fn, thickness, { segU: 72, segV: 72 })
  const paper = paperMaterial(paperColor.hex, 0.22)
  const paperBack = paperMaterial(paperColor.hex, 0.1)
  const fm = new THREE.Mesh(front, paper)
  const bm = new THREE.Mesh(back, paperBack)
  const rm = new THREE.Mesh(rim, paperBack)
  fm.castShadow = true
  fm.receiveShadow = true
  bm.castShadow = true
  group.add(fm, bm, rm)

  const art = artworkMesh(fn, {
    slot: 'fronte',
    segU: 72,
    segV: 72,
    offset: thickness / 2 + 0.0004,
    roughness: 0.68,
  })
  group.add(art)

  if (variant === 'hanger') {
    const wood = woodMaterial('#c69a63')
    const barW = w + 0.05
    for (const sign of [1, -1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.026, 0.012), wood)
      bar.position.set(0, sign * (h / 2 - 0.006), 0)
      bar.castShadow = true
      group.add(bar)
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.026, 0.012), wood)
      bar2.position.set(0, sign * (h / 2 - 0.006), -0.016)
      group.add(bar2)
    }
    const cordMat = plasticMaterial('#6b6255', 0.9)
    const arc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-barW / 2 + 0.01, h / 2, -0.008),
      new THREE.Vector3(0, h / 2 + 0.085, -0.02),
      new THREE.Vector3(barW / 2 - 0.01, h / 2, -0.008),
    ])
    group.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 32, 0.0025, 6, false), cordMat))
  } else if (variant === 'clips') {
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0022, 0.0022, w + 0.36, 8),
      plasticMaterial('#7a7368', 0.9),
    )
    wire.rotation.z = Math.PI / 2
    wire.position.set(0, h / 2 + 0.028, -0.012)
    group.add(wire)
    for (const side of [-1, 1]) {
      const clip = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.016), woodMaterial('#d7b27a'))
      body.castShadow = true
      clip.add(body)
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0022, 8, 20), metalMaterial('#b8bcc2'))
      spring.rotation.y = Math.PI / 2
      spring.position.y = 0.004
      clip.add(spring)
      clip.position.set(side * w * 0.33, h / 2 + 0.012, -0.004)
      group.add(clip)
    }
  } else if (variant === 'pins') {
    const pinHead = plasticMaterial('#e0483f', 0.35)
    const pinNeedle = metalMaterial('#cfd3d8')
    const p = new THREE.Vector3()
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const u = sx < 0 ? 0.055 : 0.945
        const v = sy < 0 ? 0.055 : 0.945
        fn(u, v, p)
        const pin = new THREE.Group()
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), pinHead)
        head.position.z = 0.014
        head.castShadow = true
        pin.add(head)
        const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.028, 8), pinNeedle)
        needle.rotation.x = Math.PI / 2
        needle.position.z = 0.004
        pin.add(needle)
        pin.position.copy(p)
        group.add(pin)
      }
    }
  }

  const slots: SlotDefinition[] = [
    {
      id: 'fronte',
      label: 'Grafica del poster',
      area: { width: w, height: h },
      hint: `${format.label} — ${mm(format)}`,
      meshes: [art],
      fullBleed: true,
    },
  ]

  return {
    group,
    slots,
    camera: { azimuth: deg(-14), polar: deg(82), distanceFactor: 1.12 },
    dispose() {},
  }
}

export const poster: MockupDefinition = {
  id: 'poster',
  name: 'Poster appeso',
  category: 'stampa',
  tagline: '4 allestimenti, formati da A3 ad A1',
  description:
    'Poster sospeso con cornice a bastone, mollette, puntine o libero. La carta ha un’ondulazione realistica e la grafica la segue.',
  icon: 'poster',
  variants: VARIANTS.map((v) => ({ id: v.id, label: v.label, description: v.description })),
  colors: PAPERS,
  options: [
    {
      id: 'formato',
      kind: 'select',
      label: 'Formato',
      default: '50x70',
      values: POSTER_FORMATS.map((f) => ({ id: f.id, label: f.label })),
    },
  ],
  build,
}
