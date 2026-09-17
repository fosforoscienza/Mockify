import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import HomePage from './pages/HomePage'
import './styles/global.css'

// l'editor porta con sé three.js: si carica solo quando serve davvero
const EditorPage = lazy(() => import('./pages/EditorPage'))

function Loading() {
  return (
    <div className="empty-state" style={{ padding: '120px 24px' }}>
      <h3>Caricamento dell’area di lavoro…</h3>
      <p>Stiamo preparando il motore 3D.</p>
    </div>
  )
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
              <Suspense fallback={<Loading />}>
                <EditorPage />
              </Suspense>
            }
          />
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
