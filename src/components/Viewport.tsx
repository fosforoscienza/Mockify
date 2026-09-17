import { useCallback, useEffect, useRef, useState } from 'react'
import { MockupViewer } from '../three/viewer'
import type { BuildConfig, MockupDefinition } from '../three/models'
import { imageFromDataTransfer } from '../lib/image'
import { CenterIcon, GridIcon, RotateIcon, ShadowIcon } from './Icons'

export interface SlotInfo {
  id: string
  label: string
  hint?: string
}

interface Props {
  model: MockupDefinition
  cfg: BuildConfig
  onReady(viewer: MockupViewer): void
  onSlots(slots: SlotInfo[]): void
  onDragTransform(slot: string, offsetX: number, offsetY: number): void
  onDropImage(file: File): void
  hasArtwork: boolean
}

export default function Viewport({
  model,
  cfg,
  onReady,
  onSlots,
  onDragTransform,
  onDropImage,
  hasArtwork,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<MockupViewer | null>(null)
  const [checker, setChecker] = useState(true)
  const [shadow, setShadow] = useState(true)
  const [dropping, setDropping] = useState(false)

  const cbRef = useRef({ onSlots, onDragTransform })
  cbRef.current = { onSlots, onDragTransform }

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return
    const viewer = new MockupViewer(canvasRef.current, {
      onSlotsChange: (slots) => cbRef.current.onSlots(slots),
      onDragTransform: (slot, x, y) => cbRef.current.onDragTransform(slot, x, y),
      onDragStateChange: () => {},
    })
    viewerRef.current = viewer
    const wrap = wrapRef.current
    const resize = () => viewer.resize(wrap.clientWidth, wrap.clientHeight)
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    onReady(viewer)
    return () => {
      ro.disconnect()
      viewer.dispose()
      viewerRef.current = null
    }
    // il viewer vive quanto la pagina dell'editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    viewerRef.current?.setShadow(shadow)
  }, [shadow])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDropping(false)
      const file = imageFromDataTransfer(event.dataTransfer)
      if (file) onDropImage(file)
    },
    [onDropImage],
  )

  return (
    <div
      ref={wrapRef}
      className={`viewport ${checker ? 'checker' : 'plain'} ${dropping ? 'dropping' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropping(false)
      }}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} />

      <div className="viewport-tools">
        <button
          type="button"
          className={checker ? 'on' : ''}
          onClick={() => setChecker((v) => !v)}
          title="Mostra la scacchiera della trasparenza"
          aria-label="Mostra la scacchiera della trasparenza"
        >
          <GridIcon size={17} />
        </button>
        <button
          type="button"
          className={shadow ? 'on' : ''}
          onClick={() => setShadow((v) => !v)}
          title="Ombra a terra nell'esportazione"
          aria-label="Ombra a terra nell'esportazione"
        >
          <ShadowIcon size={17} />
        </button>
        <button
          type="button"
          onClick={() => viewerRef.current?.resetView(model, cfg)}
          title="Reimposta l'inquadratura"
          aria-label="Reimposta l'inquadratura"
        >
          <RotateIcon size={17} />
        </button>
        <button
          type="button"
          onClick={() => viewerRef.current?.requestRender()}
          title="Ridisegna la scena"
          aria-label="Ridisegna la scena"
        >
          <CenterIcon size={17} />
        </button>
      </div>

      <div className="viewport-hint">
        <span>Trascina per ruotare</span>
        <span>Rotella per zoom</span>
        <span>{hasArtwork ? 'Trascina la grafica per spostarla' : 'Trascina qui un PNG o un JPG'}</span>
      </div>
    </div>
  )
}
