import { useEffect, useState } from 'react'
import { PipetteIcon } from './Icons'

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
  }
}

interface Props {
  value: string
  onChange(hex: string): void
  presets?: { label: string; hex: string }[]
  /** Mostra la scacchiera al posto del colore (sfondo trasparente). */
  transparent?: boolean
  title?: string
}

const normalize = (hex: string) => (hex.startsWith('#') ? hex.toLowerCase() : `#${hex}`)

/**
 * Colore libero: campioni rapidi, selettore di sistema e contagocce.
 * Il contagocce usa l'API EyeDropper, disponibile sui browser Chromium; dove
 * manca, il pulsante semplicemente non compare.
 */
export default function ColorField({ value, onChange, presets, transparent, title }: Props) {
  const [hasPicker, setHasPicker] = useState(false)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    setHasPicker(typeof window !== 'undefined' && typeof window.EyeDropper === 'function')
  }, [])

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

  return (
    <div className="color-field">
      {presets?.map((c) => (
        <button
          key={c.hex}
          type="button"
          className={`swatch ${normalize(value) === normalize(c.hex) ? 'active' : ''}`}
          style={{ background: c.hex }}
          onClick={() => onChange(normalize(c.hex))}
          title={c.label}
          aria-label={`Colore ${c.label}`}
        />
      ))}
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
