import { useEffect, useRef, useState } from 'react'
import { PipetteIcon } from './Icons'

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
  }
}

interface Preset {
  label: string
  hex: string
}

interface Props {
  value: string
  onChange(hex: string): void
  presets?: Preset[]
  /** Mostra la scacchiera al posto del colore (sfondo trasparente). */
  transparent?: boolean
  title?: string
  /** Etichetta del pulsante che apre la tavolozza a comparsa. */
  paletteLabel?: string
}

const normalize = (hex: string) => (hex.startsWith('#') ? hex.toLowerCase() : `#${hex}`)

/** Oltre questa soglia i campioni non stanno più in barra: passano in tavolozza. */
const INLINE_LIMIT = 8

/**
 * Colore libero: campioni rapidi, selettore di sistema e contagocce.
 * Il contagocce usa l'API EyeDropper, disponibile sui browser Chromium; dove
 * manca, il pulsante semplicemente non compare.
 */
export default function ColorField({
  value,
  onChange,
  presets,
  transparent,
  title,
  paletteLabel = 'Tavolozza',
}: Props) {
  const [hasPicker, setHasPicker] = useState(false)
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHasPicker(typeof window !== 'undefined' && typeof window.EyeDropper === 'function')
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!paletteRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = async () => {
    if (!window.EyeDropper) return
    setPicking(true)
    try {
      const result = await new window.EyeDropper().open()
      onChange(normalize(result.sRGBHex))
    } catch {
      // l'utente ha annullato il prelievo
    } finally {
      setPicking(false)
    }
  }

  const list = presets ?? []
  const current = list.find((c) => normalize(c.hex) === normalize(value))
  const swatch = (c: Preset) => (
    <button
      key={c.hex}
      type="button"
      className={`swatch ${normalize(value) === normalize(c.hex) ? 'active' : ''}`}
      style={{ background: c.hex }}
      onClick={() => onChange(normalize(c.hex))}
      title={c.label}
      aria-label={`Colore ${c.label}`}
    />
  )

  return (
    <div className="color-field">
      {list.length <= INLINE_LIMIT ? (
        list.map(swatch)
      ) : (
        <div className="palette" ref={paletteRef}>
          <button
            type="button"
            className={`palette-btn ${open ? 'on' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span className="palette-dot" style={{ background: normalize(value) }} />
            <span className="palette-name">{current?.label ?? paletteLabel}</span>
          </button>
          {open && (
            <div className="palette-pop" role="dialog" aria-label={paletteLabel}>
              <p className="palette-head">
                {paletteLabel} <span>{list.length} colori</span>
              </p>
              <div className="palette-grid">{list.map(swatch)}</div>
            </div>
          )}
        </div>
      )}
      <span className={`color-well ${transparent ? 'checker' : ''}`} title={title ?? 'Scegli un colore'}>
        <input
          type="color"
          value={normalize(value)}
          onChange={(e) => onChange(normalize(e.target.value))}
          aria-label={title ?? 'Scegli un colore'}
        />
      </span>
      <span className="color-hex">{transparent ? '—' : normalize(value)}</span>
      {hasPicker && (
        <button
          type="button"
          className={`pick-btn ${picking ? 'on' : ''}`}
          onClick={pick}
          title="Preleva un colore dallo schermo"
          aria-label="Preleva un colore dallo schermo"
        >
          <PipetteIcon size={16} />
        </button>
      )}
    </div>
  )
}
