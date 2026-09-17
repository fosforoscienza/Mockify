import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MockupList from '../components/MockupList'
import Toolbar from '../components/Toolbar'
import Viewport, { type SlotInfo } from '../components/Viewport'
import FlatViewport, { type MockupSurface } from '../components/FlatViewport'
import ArtworkPanel from '../components/ArtworkPanel'
import ExportPanel, { type ExportFormat } from '../components/ExportPanel'
import ScenePanel from '../components/ScenePanel'
import { CheckIcon, WarningIcon } from '../components/Icons'
import { getMockup, MOCKUPS } from '../three/models'
import type { MockupViewer } from '../three/viewer'
import { artworkCount, initialState, modelState, reducer, slotState } from '../state/store'
import { ImageError, loadImageFile } from '../lib/image'
import { downloadDataUrl, downloadPdf, safeFilename } from '../lib/download'

export default function EditorPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const requested = params.get('m')
  const startModel = MOCKUPS.some((m) => m.id === requested) ? requested! : MOCKUPS[0].id

  const [state, dispatch] = useReducer(reducer, startModel, initialState)
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const [background, setBackground] = useState<string | null>(null)
  const [shadow, setShadow] = useState(true)
  const viewerRef = useRef<MockupViewer | null>(null)
  const surfaceRef = useRef<MockupSurface | null>(null)
  const [ready, setReady] = useState(false)

  const model = getMockup(state.activeModel) ?? MOCKUPS[0]
  const flat = model.flat
  const ms = modelState(state)
  const cfg = ms.cfg
  const cfgKey = useMemo(() => JSON.stringify(cfg), [cfg])
  const pending = artworkCount(state)

  const notify = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  // un link con ?m=... cambia modello anche senza ricaricare la pagina
  useEffect(() => {
    const wanted = params.get('m')
    if (wanted && wanted !== state.activeModel && MOCKUPS.some((m) => m.id === wanted)) {
      dispatch({ type: 'select-model', model: wanted })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // il modello scelto resta nell'URL: il link è condivisibile
  useEffect(() => {
    if (params.get('m') !== state.activeModel) {
      setParams({ m: state.activeModel }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeModel])

  const view: 'front' | 'back' = cfg.variant === 'back' ? 'back' : 'front'

  // i capi in piano dichiarano i propri slot: uno per vista
  useEffect(() => {
    if (!flat) return
    setSlots(flat.slots.map((s) => ({ id: s.id, label: s.label, hint: s.hint })))
  }, [flat])

  // vista e area di stampa restano allineate: cambiando l'una cambia l'altra
  useEffect(() => {
    if (!flat || !state.activeSlot) return
    const slot = flat.slots.find((s) => s.id === state.activeSlot)
    if (slot && slot.view !== view) {
      dispatch({ type: 'set-variant', variant: slot.view })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeSlot, flat])

  useEffect(() => {
    if (!flat) return
    const slot = flat.slots.find((s) => s.view === view)
    if (slot && slot.id !== state.activeSlot) {
      dispatch({ type: 'set-active-slot', slot: slot.id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, flat])

  // ricostruzione del mockup 3D a ogni cambio di modello, variante, colore o opzione
  useEffect(() => {
    if (!ready || !viewerRef.current || flat) return
    viewerRef.current.setMockup(model, cfg, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, model.id, cfgKey, flat])

  // la prima area di stampa diventa attiva quando il modello cambia
  useEffect(() => {
    if (!slots.length) return
    if (!state.activeSlot || !slots.some((s) => s.id === state.activeSlot)) {
      dispatch({ type: 'set-active-slot', slot: slots[0].id })
    }
  }, [slots, state.activeSlot])

  // sincronizza grafiche e trasformazioni con la scena
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    slots.forEach((slot) => {
      const s = slotState(state, slot.id)
      const image = s.imageId ? state.images[s.imageId] : null
      viewer.setSlotImage(slot.id, image?.element ?? null, s.imageId)
      viewer.setSlotTransform(slot.id, s.transform)
    })
    viewer.setActiveSlot(state.activeSlot)
  }, [slots, state])

  // avviso del browser alla chiusura: il lavoro non è salvato da nessuna parte
  useEffect(() => {
    if (!pending) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue =
        'Il mockup non è salvato: scarica il PNG o il PDF prima di chiudere la pagina.'
      return event.returnValue
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [pending])

  // stesso promemoria quando si esce dall'editor restando nell'app
  useEffect(() => {
    if (!pending) return
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return
      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor || anchor.target === '_blank') return
      const href = anchor.getAttribute('href')
      // solo i link interni dell'app, e solo se portano davvero fuori dall'editor
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      if (href.split('?')[0] === window.location.pathname) return
      event.preventDefault()
      setLeaveTo(href)
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [pending])

  const activeSlot = state.activeSlot
  const current = activeSlot ? slotState(state, activeSlot) : null
  const currentImage = current?.imageId ? state.images[current.imageId] ?? null : null
  const filledSlots = useMemo(
    () => new Set(slots.filter((s) => slotState(state, s.id).imageId).map((s) => s.id)),
    [slots, state],
  )

  const handleFile = useCallback(
    async (file: File, slot = activeSlot ?? slots[0]?.id) => {
      if (!slot) return
      try {
        const image = await loadImageFile(file)
        dispatch({ type: 'set-image', slot, image })
        notify(`${image.name} applicata su "${slots.find((s) => s.id === slot)?.label ?? slot}"`)
      } catch (error) {
        notify(
          error instanceof ImageError ? error.message : 'Non è stato possibile caricare il file.',
          'error',
        )
      }
    },
    [activeSlot, slots, notify],
  )

  const handleExport = useCallback(
    async (format: ExportFormat, longSide: number, withBackground: boolean) => {
      const surface = surfaceRef.current
      if (!surface) return
      // i capi in piano ridisegnano tutto alla risoluzione richiesta: lasciamo
      // che il pulsante mostri lo stato di attesa prima di bloccare il thread
      await new Promise((resolve) => window.setTimeout(resolve, 40))
      const aspect = surface.aspect()
      const pxW = aspect >= 1 ? longSide : Math.round(longSide * aspect)
      const pxH = aspect >= 1 ? Math.round(longSide / aspect) : longSide
      const url = surface.snapshot(pxW, pxH, withBackground ? background : null)
      const name = safeFilename(['mockify', model.name, cfg.variant])
      if (format === 'png') {
        downloadDataUrl(url, `${name}.png`)
      } else {
        downloadPdf(url, pxW, pxH, `${name}.pdf`)
      }
      notify(`File ${format.toUpperCase()} scaricato (${pxW} × ${pxH} px)`)
    },
    [model.name, cfg.variant, notify, background],
  )

  return (
    <main className="editor">
      <MockupList
        active={state.activeModel}
        onSelect={(id) => dispatch({ type: 'select-model', model: id })}
      />

      <section className="workspace">
        <Toolbar
          model={model}
          cfg={cfg}
          onVariant={(variant) => dispatch({ type: 'set-variant', variant })}
          onColor={(color) => dispatch({ type: 'set-color', color })}
          onOption={(option, value) => dispatch({ type: 'set-option', option, value })}
        />
        {flat ? (
          <FlatViewport
            flat={flat}
            view={view}
            color={cfg.color}
            background={background}
            shadow={shadow}
            slotId={state.activeSlot}
            artwork={
              currentImage && current
                ? { image: currentImage.element, transform: current.transform }
                : null
            }
            onReady={(surface) => {
              surfaceRef.current = surface
              setReady(true)
            }}
            onDragTransform={(slot, offsetX, offsetY) =>
              dispatch({ type: 'patch-transform', slot, patch: { offsetX, offsetY } })
            }
            onDropImage={(file) => void handleFile(file)}
          />
        ) : (
          <Viewport
            model={model}
            cfg={cfg}
            hasArtwork={Boolean(currentImage)}
            onReady={(viewer) => {
              viewerRef.current = viewer
              surfaceRef.current = {
                snapshot: (w, h, bg) => viewer.snapshot(w, h, bg),
                aspect: () => {
                  const el = viewer.renderer.domElement
                  return el.clientWidth / Math.max(1, el.clientHeight)
                },
              }
              setReady(true)
            }}
            onSlots={setSlots}
            onDragTransform={(slot, offsetX, offsetY) =>
              dispatch({ type: 'patch-transform', slot, patch: { offsetX, offsetY } })
            }
            onDropImage={(file) => void handleFile(file)}
            background={background}
            shadow={shadow}
          />
        )}
      </section>

      <aside className="panel">
        <div className="panel-section">
          <div className="panel-title">
            <h3>{model.name}</h3>
            {pending > 0 ? (
              <span className="unsaved">
                <span className="pulse" aria-hidden /> Non salvato
              </span>
            ) : null}
          </div>
          <p className="hint">{model.description}</p>
        </div>

        <ArtworkPanel
          slots={slots}
          activeSlot={activeSlot}
          onActiveSlot={(slot) => dispatch({ type: 'set-active-slot', slot })}
          image={currentImage}
          transform={current?.transform ?? slotState(state, 'none').transform}
          filledSlots={filledSlots}
          onFile={(file) => void handleFile(file)}
          onClear={() => activeSlot && dispatch({ type: 'clear-image', slot: activeSlot })}
          onPatch={(patch) =>
            activeSlot && dispatch({ type: 'patch-transform', slot: activeSlot, patch })
          }
          onReset={() => activeSlot && dispatch({ type: 'reset-transform', slot: activeSlot })}
        />

        <ScenePanel
          background={background}
          onBackground={setBackground}
          shadow={shadow}
          onShadow={setShadow}
        />

        <ExportPanel onExport={handleExport} disabled={!ready} background={background} />
      </aside>

      {toast && (
        <div className="toast" role="status">
          {toast.kind === 'ok' ? <CheckIcon size={16} /> : <WarningIcon size={16} />}
          {toast.text}
        </div>
      )}

      {leaveTo && (
        <div className="modal-backdrop" onClick={() => setLeaveTo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Il mockup non è salvato</h3>
            <p>
              Hai {pending} {pending === 1 ? 'grafica caricata' : 'grafiche caricate'}. Uscendo da
              questa pagina il progetto viene perso: scarica prima il PNG o il PDF.
            </p>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setLeaveTo(null)}>
                Resta qui
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const target = leaveTo
                  setLeaveTo(null)
                  void handleExport('png', 2048, false)
                  window.setTimeout(() => navigate(target), 400)
                }}
              >
                Scarica ed esci
              </button>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-subtle btn-block"
              style={{ marginTop: 10 }}
              onClick={() => {
                const target = leaveTo
                setLeaveTo(null)
                navigate(target)
              }}
            >
              Esci senza salvare
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
