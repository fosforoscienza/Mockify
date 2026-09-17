import { book } from './book'
import { brochure } from './brochure'
import { cap } from './cap'
import { laptop } from './laptop'
import { poster } from './poster'
import { sheets } from './sheets'
import { hoodieFlat, tshirtFlat } from '../../flat/model'
import type { BuildConfig, MockupDefinition } from './types'

export const MOCKUPS: MockupDefinition[] = [
  tshirtFlat,
  hoodieFlat,
  cap,
  sheets,
  poster,
  brochure,
  book,
  laptop,
]

export const CATEGORIES: { id: MockupDefinition['category']; label: string }[] = [
  { id: 'abbigliamento', label: 'Abbigliamento' },
  { id: 'stampa', label: 'Stampati' },
  { id: 'editoria', label: 'Editoria' },
  { id: 'digitale', label: 'Digitale' },
]

export function getMockup(id: string) {
  return MOCKUPS.find((m) => m.id === id)
}

/** Configurazione iniziale coerente con i valori di default del modello. */
export function defaultConfig(model: MockupDefinition): BuildConfig {
  const options: Record<string, string | number> = {}
  model.options?.forEach((o) => {
    options[o.id] = o.default
  })
  return {
    variant: model.variants[0].id,
    color: model.colors?.[0]?.hex ?? '#ffffff',
    options,
  }
}

export type { MockupDefinition, BuildConfig }
