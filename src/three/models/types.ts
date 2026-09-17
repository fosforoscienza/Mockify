import type * as THREE from 'three'
import type { PrintAreaSize } from '../artwork'

export type OptionKind = 'select' | 'range'

export interface SelectOption {
  id: string
  kind: 'select'
  label: string
  values: { id: string; label: string; hint?: string }[]
  default: string
}

export interface RangeOption {
  id: string
  kind: 'range'
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string
}

export type MockupOption = SelectOption | RangeOption

export interface MaterialColor {
  id: string
  label: string
  hex: string
  /** Colore molto scuro: la UI mostra l'anteprima con bordo chiaro. */
  dark?: boolean
}

export interface SlotDefinition {
  id: string
  label: string
  /** Area di stampa in unità scena, usata per preservare le proporzioni. */
  area: PrintAreaSize
  /** Suggerimento mostrato nella UI (es. "300 × 400 mm"). */
  hint?: string
  /** Mesh su cui la stessa grafica viene proiettata (es. due fogli uguali). */
  meshes: THREE.Mesh[]
  /** Se true la grafica copre l'intero supporto (poster, copertine). */
  fullBleed?: boolean
}

export interface BuiltMockup {
  group: THREE.Group
  slots: SlotDefinition[]
  /** Posizione iniziale della camera in coordinate sferiche. */
  camera: { azimuth: number; polar: number; distanceFactor?: number; targetY?: number }
  dispose(): void
}

export interface BuildConfig {
  variant: string
  color: string
  options: Record<string, string | number>
}

export interface MockupDefinition {
  id: string
  name: string
  category: 'abbigliamento' | 'stampa' | 'editoria' | 'digitale'
  tagline: string
  description: string
  icon: string
  variants: { id: string; label: string; description?: string }[]
  colors?: MaterialColor[]
  options?: MockupOption[]
  /** Modelli 3D: costruisce la scena. */
  build?(cfg: BuildConfig): BuiltMockup
  /** Capi disegnati in piano: niente scena 3D, solo fronte e retro. */
  flat?: import('../../flat/model').FlatConfig
  /** Mockup costruiti su una foto reale. */
  photo?: import('../../photo/bases').PhotoConfig
}

/**
 * Colore effettivo del materiale: la configurazione porta direttamente un hex
 * scelto dall'utente; i preset restano come scorciatoie e fanno da fallback.
 */
export function colorHex(cfg: BuildConfig, presets: MaterialColor[] = []) {
  if (cfg.color && cfg.color.startsWith('#')) return cfg.color
  return presets.find((c) => c.id === cfg.color)?.hex ?? presets[0]?.hex ?? '#ffffff'
}

export function optionString(cfg: BuildConfig, id: string, fallback: string): string {
  const v = cfg.options[id]
  return typeof v === 'string' ? v : fallback
}

export function optionNumber(cfg: BuildConfig, id: string, fallback: number): number {
  const v = cfg.options[id]
  return typeof v === 'number' ? v : fallback
}
