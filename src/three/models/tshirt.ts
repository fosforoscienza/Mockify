import * as THREE from 'three'
import { fabricMaterial, ribMaterial, threadMaterial } from '../materials'
import { deg, stitchLine } from '../geometry'
import { artworkMesh } from '../slot'
import {
  baseGarment,
  collarMesh,
  garmentGeometry,
  garmentMesh,
  garmentPrintSurface,
  type GarmentParams,
} from './garment'
import type { BuildConfig, BuiltMockup, MockupDefinition, SlotDefinition } from './types'

const VARIANTS: Record<string, Partial<GarmentParams> & { label: string; description: string }> = {
  classic: {
    label: 'Classica girocollo',
    description: 'Vestibilità regular, manica corta, collo a costina.',
  },
  oversize: {
    label: 'Oversize boxy',
    description: 'Spalla scesa, corpo largo e corto.',
    length: 0.66,
    bodyWidth: 0.6,
    hemWidth: 0.6,
    shoulderWidth: 0.52,
    sleeveLength: 0.17,
    sleeveOpen: 0.19,
    sleeveAngle: 0.62,
    armpitDrop: 0.24,
    neckWidth: 0.2,
    bulge: 0.082,
  },
  slim: {
    label: 'Slim fit',
    description: 'Corpo affusolato in vita, manica aderente.',
    bodyWidth: 0.47,
    hemWidth: 0.43,
    shoulderWidth: 0.41,
    sleeveLength: 0.18,
    sleeveOpen: 0.12,
    waist: 0.035,
    bulge: 0.07,
  },
  vneck: {
    label: 'Scollo a V',
    description: 'Scollatura a V profonda, vestibilità regular.',
    neckType: 'v',
    neckWidth: 0.19,
    neckDepth: 0.13,
  },
  longsleeve: {
    label: 'Manica lunga',
    description: 'Maglia a maniche lunghe con polsino.',
    sleeveLength: 0.42,
    sleeveAngle: 0.56,
    sleeveOpen: 0.105,
  },
}

const COLORS = [
  { id: 'white', label: 'Bianco', hex: '#f5f5f3' },
  { id: 'black', label: 'Nero', hex: '#1d1d1f', dark: true },
  { id: 'heather', label: 'Grigio melange', hex: '#b9bcc0' },
  { id: 'navy', label: 'Blu navy', hex: '#26344f', dark: true },
  { id: 'sand', label: 'Sabbia', hex: '#ddceb4' },
  { id: 'forest', label: 'Verde bosco', hex: '#2f5044', dark: true },
  { id: 'red', label: 'Rosso', hex: '#a52f2b' },
]

function paramsFor(variant: string): GarmentParams {
  const base = baseGarment()
  const v = VARIANTS[variant] ?? VARIANTS.classic
  const { label: _l, description: _d, ...rest } = v
  return { ...base, ...rest }
}

function build(cfg: BuildConfig): BuiltMockup {
  const p = paramsFor(cfg.variant)
  const color = COLORS.find((c) => c.id === cfg.color) ?? COLORS[0]
  const g = garmentGeometry(p)
  const group = new THREE.Group()

  const cloth = fabricMaterial(color.hex, 'jersey')
  const body = garmentMesh(g, p, cloth)
  group.add(body)
  group.add(collarMesh(g, p, ribMaterial(color.hex)))

  // cuciture su orlo e maniche
  const thread = threadMaterial(color.hex)
  const hemY = -p.length / 2 + 0.028
  const hemCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 24 }, (_, i) => {
      const t = i / 23
      const x = THREE.MathUtils.lerp(-p.hemWidth / 2 + 0.01, p.hemWidth / 2 - 0.01, t)
      const y = hemY - p.hemCurve * Math.sin(t * Math.PI) * 0.9
      return new THREE.Vector3(x, y, g.frontZ(x, y) + 0.002)
    }),
  )
  group.add(stitchLine(hemCurve, thread, 54, 0.0028))

  const { cuffTop, cuffBottom } = g.points
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 12 }, (_, i) => {
        const t = i / 11
        const x = side * THREE.MathUtils.lerp(cuffTop.x, cuffBottom.x, t) * 0.985
        const y = THREE.MathUtils.lerp(cuffTop.y, cuffBottom.y, t) - 0.016
        return new THREE.Vector3(x, y, g.frontZ(Math.abs(x) * side, y) + 0.002)
      }),
    )
    group.add(stitchLine(curve, thread, 16, 0.0028))
  }

  // aree di stampa
  const chestW = Math.min(0.32, p.bodyWidth * 0.62)
  const chestH = chestW * 1.28
  const chestY = p.length / 2 - p.neckDepth - 0.07 - chestH / 2
  const backY = chestY + 0.02

  const front = artworkMesh(garmentPrintSurface(g, chestY, chestW, chestH), {
    slot: 'fronte',
    segU: 56,
    segV: 56,
    offset: 0.0015,
    roughness: 0.94,
  })
  const back = artworkMesh(garmentPrintSurface(g, backY, chestW, chestH, true), {
    slot: 'retro',
    segU: 56,
    segV: 56,
    offset: 0.0015,
    roughness: 0.94,
    flip: false,
  })
  group.add(front, back)

  const slots: SlotDefinition[] = [
    {
      id: 'fronte',
      label: 'Fronte',
      area: { width: chestW, height: chestH },
      hint: 'Area petto ~32 × 41 cm',
      meshes: [front],
    },
    {
      id: 'retro',
      label: 'Retro',
      area: { width: chestW, height: chestH },
      hint: 'Area schiena ~32 × 41 cm',
      meshes: [back],
    },
  ]

  return {
    group,
    slots,
    camera: { azimuth: deg(-18), polar: deg(80), distanceFactor: 1.05 },
    dispose() {},
  }
}

export const tshirt: MockupDefinition = {
  id: 'maglietta',
  name: 'T-shirt',
  category: 'abbigliamento',
  tagline: '5 modelli, stampa fronte e retro',
  description:
    'Magliette in jersey con vestibilità classica, oversize, slim, scollo a V e manica lunga. Area di stampa sul petto e sulla schiena.',
  icon: 'tshirt',
  variants: Object.entries(VARIANTS).map(([id, v]) => ({
    id,
    label: v.label,
    description: v.description,
  })),
  colors: COLORS,
  build,
}
