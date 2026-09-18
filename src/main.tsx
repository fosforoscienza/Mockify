import React, { Component, Suspense, lazy, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import HomePage from './pages/HomePage'
import { markUpdateAvailable } from './lib/version'
import './styles/global.css'

const RELOAD_KEY = 'sagoma-chunk-reload'

const store = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      /* modalità privata: si prosegue senza memoria */
    }
  },
  clear(key: string) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* niente da pulire */
    }
  },
}

/**
 * L'editor porta con sé il motore di rendering: si carica solo quando serve.
 * Dopo un deploy il chunk della versione precedente non esiste più, quindi un
 * caricamento fallito significa quasi sempre "è uscita una versione nuova".
 */
const EditorPage = lazy(() =>
  import('./pages/EditorPage')
    .then((mod) => {
      store.clear(RELOAD_KEY)
      return mod
    })
    .catch((error) => {
      markUpdateAvailable()
      if (!store.get(RELOAD_KEY)) {
        store.set(RELOAD_KEY, '1')
        window.location.reload()
      }
      throw error
    }),
)

function Loading() {
  return (
    <div className="empty-state" style={{ padding: '120px 24px' }}>
      <h3>Caricamento dell’area di lavoro…</h3>
      <p>Stiamo preparando gli strumenti di disegno.</p>
    </div>
  )
}

class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="empty-state" style={{ padding: '120px 24px' }}>
        <h3>Non è stato possibile aprire l’area di lavoro</h3>
        <p>
          Di solito succede quando è appena uscita una versione nuova. Ricarica la pagina per
          riprendere.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => window.location.reload()}
        >
          Ricarica
        </button>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/crea"
            element={
              <LoadBoundary>
                <Suspense fallback={<Loading />}>
                  <EditorPage />
                </Suspense>
              </LoadBoundary>
            }
          />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
