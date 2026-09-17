import { useState } from 'react'
import { useUnsavedCount } from '../state/unsaved'
import { useUpdateAvailable } from '../lib/version'
import { SparkIcon, WarningIcon } from './Icons'

/**
 * Avviso di nuova versione. Ricaricare significa perdere il progetto in corso,
 * quindi quando ci sono grafiche caricate l'avviso lo dice chiaramente e non
 * spinge sul pulsante di aggiornamento.
 */
export default function UpdateBanner() {
  const available = useUpdateAvailable()
  const unsaved = useUnsavedCount()
  const [dismissed, setDismissed] = useState(false)

  if (!available || dismissed) return null

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-icon" aria-hidden>
        <SparkIcon size={17} />
      </span>
      <div className="update-body">
        <strong>È disponibile una nuova versione di Mockify</strong>
        {unsaved > 0 ? (
          <span className="update-warn">
            <WarningIcon size={14} />
            Hai {unsaved} {unsaved === 1 ? 'grafica caricata' : 'grafiche caricate'}: scarica il
            file prima di aggiornare, la pagina si ricarica.
          </span>
        ) : (
          <span>Ricarica la pagina per passare all’ultima versione.</span>
        )}
      </div>
      <div className="update-actions">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDismissed(true)}>
          Più tardi
        </button>
        <button
          type="button"
          className={`btn btn-sm ${unsaved > 0 ? 'btn-subtle' : 'btn-primary'}`}
          onClick={() => window.location.reload()}
        >
          Aggiorna
        </button>
      </div>
    </div>
  )
}
