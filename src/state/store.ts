import { defaultTransform, type ArtTransform } from '../three/artwork'
import { defaultConfig, getMockup, MOCKUPS } from '../three/models'
import type { BuildConfig } from '../three/models/types'
import { releaseImage, type LoadedImage } from '../lib/image'

export interface SlotState {
  imageId: string | null
  transform: ArtTransform
}

export interface ModelState {
  cfg: BuildConfig
  slots: Record<string, SlotState>
}

export interface EditorState {
  activeModel: string
  activeSlot: string | null
  models: Record<string, ModelState>
  images: Record<string, LoadedImage>
}

export type Action =
  | { type: 'select-model'; model: string }
  | { type: 'set-variant'; variant: string }
  | { type: 'set-color'; color: string }
  | { type: 'set-option'; option: string; value: string | number }
  | { type: 'set-active-slot'; slot: string | null }
  | { type: 'set-image'; slot: string; image: LoadedImage }
  | { type: 'clear-image'; slot: string }
  | { type: 'patch-transform'; slot: string; patch: Partial<ArtTransform> }
  | { type: 'reset-transform'; slot: string }

export function initialState(model = MOCKUPS[0].id): EditorState {
  return {
    activeModel: model,
    activeSlot: null,
    models: { [model]: emptyModelState(model) },
    images: {},
  }
}

function emptyModelState(modelId: string): ModelState {
  const def = getMockup(modelId) ?? MOCKUPS[0]
  return { cfg: defaultConfig(def), slots: {} }
}

export function modelState(state: EditorState, modelId = state.activeModel): ModelState {
  return state.models[modelId] ?? emptyModelState(modelId)
}

export function slotState(state: EditorState, slotId: string): SlotState {
  return modelState(state).slots[slotId] ?? { imageId: null, transform: defaultTransform() }
}

function withModel(state: EditorState, update: (m: ModelState) => ModelState): EditorState {
  const current = modelState(state)
  return {
    ...state,
    models: { ...state.models, [state.activeModel]: update(current) },
  }
}

function withSlot(
  state: EditorState,
  slotId: string,
  update: (s: SlotState) => SlotState,
): EditorState {
  return withModel(state, (m) => ({
    ...m,
    slots: {
      ...m.slots,
      [slotId]: update(m.slots[slotId] ?? { imageId: null, transform: defaultTransform() }),
    },
  }))
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'select-model': {
      if (action.model === state.activeModel) return state
      return {
        ...state,
        activeModel: action.model,
        activeSlot: null,
        models: state.models[action.model]
          ? state.models
          : { ...state.models, [action.model]: emptyModelState(action.model) },
      }
    }
    case 'set-variant':
      return withModel(state, (m) => ({ ...m, cfg: { ...m.cfg, variant: action.variant } }))
    case 'set-color':
      return withModel(state, (m) => ({ ...m, cfg: { ...m.cfg, color: action.color } }))
    case 'set-option':
      return withModel(state, (m) => ({
        ...m,
        cfg: { ...m.cfg, options: { ...m.cfg.options, [action.option]: action.value } },
      }))
    case 'set-active-slot':
      return { ...state, activeSlot: action.slot }
    case 'set-image': {
      const next = withSlot(state, action.slot, (s) => ({ ...s, imageId: action.image.id }))
      return {
        ...next,
        activeSlot: action.slot,
        images: { ...next.images, [action.image.id]: action.image },
      }
    }
    case 'clear-image': {
      const current = slotState(state, action.slot)
      const next = withSlot(state, action.slot, (s) => ({
        ...s,
        imageId: null,
        transform: defaultTransform(),
      }))
      if (!current.imageId) return next
      const stillUsed = Object.values(next.models).some((m) =>
        Object.values(m.slots).some((s) => s.imageId === current.imageId),
      )
      if (stillUsed) return next
      const images = { ...next.images }
      const image = images[current.imageId]
      if (image) {
        releaseImage(image)
        delete images[current.imageId]
      }
      return { ...next, images }
    }
    case 'patch-transform':
      return withSlot(state, action.slot, (s) => ({
        ...s,
        transform: { ...s.transform, ...action.patch },
      }))
    case 'reset-transform':
      return withSlot(state, action.slot, (s) => ({ ...s, transform: defaultTransform() }))
    default:
      return state
  }
}

/** Numero di grafiche caricate: guida l'avviso di lavoro non salvato. */
export function artworkCount(state: EditorState) {
  return Object.values(state.models).reduce(
    (total, m) => total + Object.values(m.slots).filter((s) => s.imageId).length,
    0,
  )
}
