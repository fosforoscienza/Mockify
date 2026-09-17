import { HOODIE_SPEC, TSHIRT_SPEC, type GarmentSpec } from './garments'
import type { MockupDefinition } from '../three/models/types'

/** Capi disegnati in piano: due sole viste, fronte e retro. */
export interface FlatConfig {
  spec: GarmentSpec
  slots: { id: string; label: string; hint?: string; view: 'front' | 'back' }[]
}

/**
 * Gamma ispirata alla B&C E150, il riferimento chiesto per le t-shirt.
 * I valori sono una resa ravvicinata, non i codici ufficiali del produttore:
 * la scheda colore va confrontata con il campionario prima della stampa.
 */
const GARMENT_COLORS = [
  { id: 'white', label: 'White', hex: '#f6f5f2' },
  { id: 'black', label: 'Black', hex: '#1b1b1d', dark: true },
  { id: 'navy', label: 'Navy', hex: '#1f2a44', dark: true },
  { id: 'red', label: 'Red', hex: '#c0211d' },
  { id: 'royal', label: 'Royal Blue', hex: '#1f4fa0', dark: true },
  { id: 'sky', label: 'Sky Blue', hex: '#8cc6e6' },
  { id: 'kelly', label: 'Kelly Green', hex: '#1f8c4a' },
  { id: 'bottle', label: 'Bottle Green', hex: '#14443a', dark: true },
  { id: 'sport-grey', label: 'Sport Grey', hex: '#b0aeaa' },
  { id: 'ash', label: 'Ash', hex: '#d8d7d2' },
  { id: 'anthracite', label: 'Anthracite', hex: '#3b3d3f', dark: true },
  { id: 'orange', label: 'Orange', hex: '#e2610f' },
  { id: 'gold', label: 'Gold', hex: '#e4ae22' },
  { id: 'burgundy', label: 'Burgundy', hex: '#6a2333', dark: true },
  { id: 'sand', label: 'Sand', hex: '#d9c8a8' },
  { id: 'khaki', label: 'Khaki', hex: '#7d7a5c' },
  { id: 'purple', label: 'Purple', hex: '#4b2a70', dark: true },
  { id: 'pink', label: 'Millennial Pink', hex: '#e6b3b7' },
]

const VIEWS = [
  { id: 'front', label: 'Fronte' },
  { id: 'back', label: 'Retro' },
  { id: 'both', label: 'Fronte + retro' },
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
