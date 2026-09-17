import * as THREE from 'three'
import { fabricMaterial, ribMaterial } from '../materials'
import { deg } from '../geometry'
import { artworkMesh } from '../slot'
import {
  baseGarment,
  collarMesh,
  garmentGeometry,
  garmentMesh,
  garmentPrintSurface,
  type GarmentParams,
} from './garment'
import { colorHex } from './types'
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
  const color = { hex: colorHex(cfg, COLORS) }
  const g = garmentGeometry(p)
  const group = new THREE.Group()

  const cloth = fabricMaterial(color.hex, 'jersey', { vertexColors: true, doubleSide: true })
  const body = garmentMesh(g, p, cloth)
  group.add(body)
  group.add(collarMesh(g, p, ribMaterial(color.hex, true), 0.0095))

  // aree di stampa
  const chestW = Math.min(0.32, p.bodyWidth * 0.62)
  const chestH = chestW * 1.28
  const chestY = g.points.neckBottom - 0.065 - chestH / 2
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
