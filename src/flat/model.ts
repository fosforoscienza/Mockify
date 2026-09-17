import { HOODIE_SPEC, TSHIRT_SPEC, type GarmentSpec } from './garments'
import type { MockupDefinition } from '../three/models/types'

/** Capi disegnati in piano: due sole viste, fronte e retro. */
export interface FlatConfig {
  spec: GarmentSpec
  slots: { id: string; label: string; hint?: string; view: 'front' | 'back' }[]
}

const GARMENT_COLORS = [
  { id: 'white', label: 'Bianco', hex: '#f3f2ef' },
  { id: 'black', label: 'Nero', hex: '#1c1c1e', dark: true },
  { id: 'heather', label: 'Grigio melange', hex: '#b6b9bd' },
  { id: 'navy', label: 'Blu navy', hex: '#26334c', dark: true },
  { id: 'sand', label: 'Sabbia', hex: '#ddceb4' },
  { id: 'forest', label: 'Verde bosco', hex: '#2f5044', dark: true },
  { id: 'red', label: 'Rosso', hex: '#a52f2b' },
]

const VIEWS = [
  { id: 'front', label: 'Fronte' },
  { id: 'back', label: 'Retro' },
]

export const tshirtFlat: MockupDefinition = {
  id: 'maglietta',
  name: 'T-shirt',
  category: 'abbigliamento',
  tagline: 'Fronte e retro, colore libero',
  description:
    'Maglietta distesa, resa a piena risoluzione: trama del tessuto, pieghe e cuciture sono disegnate pixel per pixel e la stampa segue le pieghe. Colore del capo completamente libero.',
  icon: 'tshirt',
  variants: VIEWS,
  colors: GARMENT_COLORS,
  flat: {
    spec: TSHIRT_SPEC,
    slots: [
      { id: 'fronte', label: 'Fronte', view: 'front', hint: 'Area petto ~30 × 38 cm' },
      { id: 'retro', label: 'Retro', view: 'back', hint: 'Area schiena ~30 × 38 cm' },
    ],
  },
}

export const hoodieFlat: MockupDefinition = {
  id: 'felpa',
  name: 'Felpa con cappuccio',
  category: 'abbigliamento',
  tagline: 'Fronte e retro, colore libero',
  description:
    'Felpa con cappuccio distesa, con tasca a marsupio, costine e lacci. Stessa resa a piena risoluzione della t-shirt.',
  icon: 'hoodie',
  variants: VIEWS,
  colors: GARMENT_COLORS,
  flat: {
    spec: HOODIE_SPEC,
    slots: [
      { id: 'fronte', label: 'Fronte', view: 'front', hint: 'Sopra la tasca, ~30 × 32 cm' },
      { id: 'retro', label: 'Retro', view: 'back', hint: 'Area schiena ~30 × 32 cm' },
    ],
  },
}
