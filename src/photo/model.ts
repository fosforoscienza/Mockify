import {
  CAPPELLO_BASEBALL_PHOTO,
  CAPPELLO_PESCATORE_PHOTO,
  FELPA_PHOTO,
  MANIFESTO_PHOTO,
  TELEFONO_PHOTO,
  TSHIRT_PHOTO,
  type PhotoConfig,
} from './bases'
import { GARMENT_COLORS } from './colori'
import type { MockupDefinition } from '../three/models/types'

/** Slot dell'editor ricavati dalle aree della variante scelta. */
export function photoSlots(photo: PhotoConfig, variantId: string) {
  const variant = photo.variants.find((v) => v.id === variantId) ?? photo.variants[0]
  return variant.views.flatMap((view, viewIndex) =>
    view.areas.map((area) => ({
      id: area.id,
      label: area.label,
      hint: area.hint,
      viewIndex,
    })),
  )
}

export function photoVariant(photo: PhotoConfig, variantId: string) {
  return photo.variants.find((v) => v.id === variantId) ?? photo.variants[0]
}

const variantsOf = (photo: PhotoConfig) =>
  photo.variants.map((v) => ({ id: v.id, label: v.label, description: v.description }))

export const tshirtPhoto: MockupDefinition = {
  id: 'maglietta',
  name: 'T-shirt',
  category: 'abbigliamento',
  tagline: 'Quattro scatti reali, colore libero',
  description:
    'Magliette fotografate davvero: appesa alla gruccia, piegata, o fronte e retro nella stessa immagine. La stampa segue le pieghe del tessuto e il colore del capo resta libero.',
  icon: 'tshirt',
  variants: variantsOf(TSHIRT_PHOTO),
  colors: GARMENT_COLORS,
  photo: TSHIRT_PHOTO,
}

export const felpaPhoto: MockupDefinition = {
  id: 'felpa',
  name: 'Felpa',
  category: 'abbigliamento',
  tagline: 'Con cappuccio o girocollo',
  description:
    'Felpe fotografate: modello con cappuccio ripreso di tre quarti e girocollo frontale. Colore libero, pieghe e ombre della foto passano sopra la stampa.',
  icon: 'hoodie',
  variants: variantsOf(FELPA_PHOTO),
  colors: GARMENT_COLORS,
  photo: FELPA_PHOTO,
}

export const cappelloBaseballPhoto: MockupDefinition = {
  id: 'cappello-baseball',
  name: 'Cappello baseball',
  category: 'abbigliamento',
  tagline: 'Fronte e due tre quarti',
  description:
    'Cappello con visiera fotografato da tre angolazioni. La stampa va sul pannello frontale e segue la curvatura del tessuto.',
  icon: 'cap',
  variants: variantsOf(CAPPELLO_BASEBALL_PHOTO),
  colors: GARMENT_COLORS,
  photo: CAPPELLO_BASEBALL_PHOTO,
}

export const cappelloPescatorePhoto: MockupDefinition = {
  id: 'cappello-pescatore',
  name: 'Cappello da pescatore',
  category: 'abbigliamento',
  tagline: 'Bucket hat, ripresa frontale',
  description: 'Cappello da pescatore fotografato di fronte, con la stampa sulla fascia frontale.',
  icon: 'cap',
  variants: variantsOf(CAPPELLO_PESCATORE_PHOTO),
  colors: GARMENT_COLORS,
  photo: CAPPELLO_PESCATORE_PHOTO,
}

export const telefonoPhoto: MockupDefinition = {
  id: 'telefono',
  name: 'Telefono',
  category: 'digitale',
  tagline: 'Tre scatti, schermo acceso',
  description:
    'Telefono fotografato dritto o inclinato, da solo o con il retro accanto. La grafica riempie il display seguendo l’inclinazione dello scatto.',
  icon: 'phone',
  variants: variantsOf(TELEFONO_PHOTO),
  photo: TELEFONO_PHOTO,
}

export const manifestoPhoto: MockupDefinition = {
  id: 'manifesto',
  name: 'Manifesto affisso',
  category: 'affissione',
  tagline: 'Affissione 6 × 3 e doppio poster',
  description:
    'Manifesti in ambiente: il cartellone 6 × 3 sotto il cavalcavia, di fronte e di tre quarti, e due poster 70 × 100 incorniciati su un muro. Le luci e le ombre della scena cadono sulla grafica.',
  icon: 'poster',
  variants: variantsOf(MANIFESTO_PHOTO),
  photo: MANIFESTO_PHOTO,
}

export const PHOTO_MOCKUPS = [
  tshirtPhoto,
  felpaPhoto,
  cappelloBaseballPhoto,
  cappelloPescatorePhoto,
  telefonoPhoto,
  manifestoPhoto,
]
