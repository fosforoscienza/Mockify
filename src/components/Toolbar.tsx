import ColorField from './ColorField'
import type { BuildConfig, MockupDefinition } from '../three/models'

interface Props {
  model: MockupDefinition
  cfg: BuildConfig
  onVariant(id: string): void
  onColor(id: string): void
  onOption(id: string, value: string | number): void
}

export default function Toolbar({ model, cfg, onVariant, onColor, onOption }: Props) {
  return (
    <div className="toolbar">
      <div className="chip-group">
        {model.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`chip ${v.id === cfg.variant ? 'active' : ''}`}
            onClick={() => onVariant(v.id)}
            title={v.description}
          >
            {v.label}
          </button>
        ))}
      </div>

      {model.colors && model.colors.length > 0 && (
        <>
          <span className="toolbar-sep" />
          <ColorField
            value={cfg.color}
            presets={model.colors}
            onChange={onColor}
            title="Colore del materiale"
          />
        </>
      )}

      {model.options?.map((o) => (
        <span key={o.id} style={{ display: 'contents' }}>
          <span className="toolbar-sep" />
          <label className="field">
            {o.label}
            {o.kind === 'select' ? (
              <select
                value={String(cfg.options[o.id] ?? o.default)}
                onChange={(e) => onOption(o.id, e.target.value)}
              >
                {o.values.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="range"
                  style={{ width: 96 }}
                  min={o.min}
                  max={o.max}
                  step={o.step}
                  value={Number(cfg.options[o.id] ?? o.default)}
                  onChange={(e) => onOption(o.id, Number(e.target.value))}
                />
                <span style={{ minWidth: 46, fontVariantNumeric: 'tabular-nums' }}>
                  {Number(cfg.options[o.id] ?? o.default)} {o.unit}
                </span>
              </>
            )}
          </label>
        </span>
      ))}
    </div>
  )
}
