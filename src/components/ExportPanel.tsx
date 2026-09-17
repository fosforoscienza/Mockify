import { useState } from 'react'
import { DownloadIcon, WarningIcon } from './Icons'

export type ExportFormat = 'png' | 'pdf'

interface Props {
  onExport(format: ExportFormat, longSide: number, withBackground: boolean): Promise<void> | void
  disabled: boolean
  /** Colore di fondo attualmente in scena; null = nessuno. */
  background: string | null
}

const SIZES = [
  { id: 1024, label: '1024 px' },
  { id: 2048, label: '2048 px' },
  { id: 4096, label: '4096 px' },
]

export default function ExportPanel({ onExport, disabled, background }: Props) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [size, setSize] = useState(2048)
  const [withBackground, setWithBackground] = useState(false)
  const [busy, setBusy] = useState(false)
  const useBackground = withBackground && background !== null

  const run = async () => {
    setBusy(true)
    try {
      await onExport(format, size, useBackground)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel-section">
      <div className="panel-title">
        <h3>Esporta</h3>
      </div>

      <div className="control">
        <div className="control-head">
          <label>Formato file</label>
        </div>
        <div className="seg">
          <button
            type="button"
            className={format === 'png' ? 'active' : ''}
            onClick={() => setFormat('png')}
          >
            PNG trasparente
          </button>
          <button
            type="button"
            className={format === 'pdf' ? 'active' : ''}
            onClick={() => setFormat('pdf')}
          >
            PDF
          </button>
        </div>
      </div>

      <div className="control">
        <div className="control-head">
          <label>Sfondo del file</label>
        </div>
        <div className="seg">
          <button
            type="button"
            className={!useBackground ? 'active' : ''}
            onClick={() => setWithBackground(false)}
          >
            Trasparente
          </button>
          <button
            type="button"
            className={useBackground ? 'active' : ''}
            onClick={() => setWithBackground(true)}
            disabled={background === null}
            title={background === null ? 'Scegli prima un colore di sfondo nella sezione Scena' : undefined}
          >
            Con sfondo
          </button>
        </div>
        {background === null && (
          <p className="hint">Per esportare con lo sfondo, scegline uno in “Scena”.</p>
        )}
      </div>

      <div className="control">
        <div className="control-head">
          <label>Risoluzione lato lungo</label>
        </div>
        <div className="seg">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={size === s.id ? 'active' : ''}
              onClick={() => setSize(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={run}
          disabled={disabled || busy}
        >
          <DownloadIcon size={17} />
          {busy ? 'Preparazione…' : `Scarica ${format.toUpperCase()}`}
        </button>
      </div>

      <p className="hint">
        Viene esportata esattamente l’inquadratura che vedi. Il PDF viene generato a 300 dpi.
      </p>

      <div className="callout" style={{ marginTop: 14, padding: '12px 14px', fontSize: 13 }}>
        <WarningIcon size={18} />
        <div>
          Il progetto vive solo in questa scheda: chiudendo o ricaricando la pagina si perde.
          Scarica il file prima di uscire.
        </div>
      </div>
    </div>
  )
}
