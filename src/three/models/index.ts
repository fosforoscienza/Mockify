import { book } from './book'
import { brochure } from './brochure'
import { cap } from './cap'
import { hoodie } from './hoodie'
import { poster } from './poster'
import { sheets } from './sheets'
import { tshirt } from './tshirt'
import type { BuildConfig, MockupDefinition } from './types'

export const MOCKUPS: MockupDefinition[] = [tshirt, hoodie, cap, sheets, poster, brochure, book]

export const CATEGORIES: { id: MockupDefinition['category']; label: string }[] = [
  { id: 'abbigliamento', label: 'Abbigliamento' },
  { id: 'stampa', label: 'Stampati' },
  { id: 'editoria', label: 'Editoria' },
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
    color: model.colors?.[0]?.id ?? 'white',
    options,
  }
}

export type { MockupDefinition, BuildConfig }
