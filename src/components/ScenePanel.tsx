import ColorField from './ColorField'
import { ShadowIcon } from './Icons'

interface Props {
  background: string | null
  onBackground(color: string | null): void
  shadow: boolean
  onShadow(value: boolean): void
}

const BG_PRESETS = [
  { label: 'Grigio scuro', hex: '#1e2125' },
  { label: 'Nero', hex: '#000000' },
  { label: 'Bianco', hex: '#ffffff' },
  { label: 'Blu petrolio', hex: '#1c7f92' },
  { label: 'Sabbia', hex: '#e7ddcc' },
]

export default function ScenePanel({ background, onBackground, shadow, onShadow }: Props) {
  return (
    <div className="panel-section">
      <div className="panel-title">
        <h3>Scena</h3>
      </div>

      <div className="control">
        <div className="control-head">
          <label>Sfondo</label>
        </div>
        <div className="seg">
          <button
            type="button"
            className={background === null ? 'active' : ''}
            onClick={() => onBackground(null)}
          >
            Trasparente
          </button>
          <button
            type="button"
            className={background !== null ? 'active' : ''}
            onClick={() => onBackground(background ?? '#1e2125')}
          >
            Colore
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <ColorField
            value={background ?? '#1e2125'}
            transparent={background === null}
            presets={BG_PRESETS}
            onChange={(hex) => onBackground(hex)}
            title="Colore dello sfondo"
          />
        </div>
      </div>

      <div className="control">
        <label className="field-row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={shadow}
            onChange={(e) => onShadow(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <ShadowIcon size={16} />
          Ombra a terra
        </label>
      </div>
    </div>
  )
}
