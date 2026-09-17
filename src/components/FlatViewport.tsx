import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatGarmentRenderer, type FlatArtwork } from '../flat/render'
import type { FlatConfig } from '../flat/model'
import type { ArtTransform } from '../three/artwork'
import { imageFromDataTransfer } from '../lib/image'

export interface MockupSurface {
  snapshot(pxW: number, pxH: number, background: string | null): string
  aspect(): number
}

interface Props {
  flat: FlatConfig
  view: 'front' | 'back'
  color: string
  background: string | null
  shadow: boolean
  artwork: { image: HTMLImageElement; transform: ArtTransform } | null
  slotId: string | null
  onReady(surface: MockupSurface): void
  onDragTransform(slot: string, offsetX: number, offsetY: number): void
  onDropImage(file: File): void
}

/**
 * Superficie di lavoro dei capi disegnati in piano. Il disegno avviene su
 * canvas 2D: il capo viene ricostruito solo quando cambiano modello, vista,
 * colore o dimensioni, mentre spostare la grafica ridisegna soltanto il
 * riquadro che la contiene.
 */
export default function FlatViewport({
  flat,
  view,
  color,
  background,
  shadow,
  artwork,
  slotId,
  onReady,
  onDragTransform,
  onDropImage,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef(new FlatGarmentRenderer())
  const exportRef = useRef(new FlatGarmentRenderer())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [dropping, setDropping] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const propsRef = useRef({ flat, view, color, background, shadow, artwork })
  propsRef.current = { flat, view, color, background, shadow, artwork }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      setSize({
        w: Math.max(2, Math.round(wrap.clientWidth * dpr)),
        h: Math.max(2, Math.round(wrap.clientHeight * dpr)),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    onReady({
      snapshot(pxW, pxH, bg) {
        const canvas = document.createElement('canvas')
        const p = propsRef.current
        exportRef.current.render(canvas, {
          spec: p.flat.spec,
          view: p.view,
          color: p.color,
          width: pxW,
          height: pxH,
          background: bg,
          shadow: p.shadow,
          artwork: toArtwork(p.artwork),
        })
        return canvas.toDataURL('image/png')
      },
      aspect: () => (size.h ? size.w / size.h : 1),
    })
  }, [onReady, size.w, size.h])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w < 2) return
    rendererRef.current.render(canvas, {
      spec: flat.spec,
      view,
      color,
      width: size.w,
      height: size.h,
      background,
      shadow,
      artwork: toArtwork(artwork),
    })
  }, [flat, view, color, background, shadow, artwork, size])

  /** Il riquadro occupato dalla grafica, per capire se il puntatore la tocca. */
  const artRect = useCallback(() => {
    const print = rendererRef.current.printRect()
    if (!print || !artwork) return null
    const aspect = artwork.image.naturalWidth / artwork.image.naturalHeight
    const areaAspect = print.w / print.h
    let dw: number
    let dh: number
    if (aspect >= areaAspect) {
      dw = print.w * artwork.transform.scale
      dh = dw / aspect
    } else {
      dh = print.h * artwork.transform.scale
      dw = dh * aspect
    }
    return {
      cx: print.x + print.w / 2 + (artwork.transform.offsetX * print.w) / 2,
      cy: print.y + print.h / 2 - (artwork.transform.offsetY * print.h) / 2,
      dw,
      dh,
      print,
    }
  }, [artwork])

  const pointerPx = (event: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const dpr = canvas.width / rect.width
    return { x: (event.clientX - rect.left) * dpr, y: (event.clientY - rect.top) * dpr }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!slotId || !artwork) return
    const r = artRect()
    if (!r) return
    const p = pointerPx(event)
    const cos = Math.cos(-artwork.transform.rotation)
    const sin = Math.sin(-artwork.transform.rotation)
    const lx = (p.x - r.cx) * cos - (p.y - r.cy) * sin
    const ly = (p.x - r.cx) * sin + (p.y - r.cy) * cos
    if (Math.abs(lx) > r.dw / 2 || Math.abs(ly) > r.dh / 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: p.x,
      startY: p.y,
      ox: artwork.transform.offsetX,
      oy: artwork.transform.offsetY,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const r = artRect()
    if (!r) {
      return
    }
    if (!drag) {
      const p = pointerPx(event)
      const inside =
        Math.abs(p.x - r.cx) < r.dw / 2 && Math.abs(p.y - r.cy) < r.dh / 2
      event.currentTarget.style.cursor = inside ? 'move' : 'default'
      return
    }
    const p = pointerPx(event)
    const nx = drag.ox + ((p.x - drag.startX) * 2) / r.print.w
    const ny = drag.oy - ((p.y - drag.startY) * 2) / r.print.h
    if (slotId) onDragTransform(slotId, clamp(nx), clamp(ny))
  }

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`viewport flat ${background ? 'plain' : 'checker'} ${dropping ? 'dropping' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropping(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDropping(false)
        const file = imageFromDataTransfer(e.dataTransfer)
        if (file) onDropImage(file)
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="viewport-hint">
        <span>{artwork ? 'Trascina la grafica per spostarla' : 'Trascina qui un PNG o un JPG'}</span>
        <span>Fronte e retro dalla barra in alto</span>
      </div>
    </div>
  )
}

const clamp = (v: number) => Math.max(-1.5, Math.min(1.5, v))

function toArtwork(
  art: { image: HTMLImageElement; transform: ArtTransform } | null | undefined,
): FlatArtwork | null {
  if (!art) return null
  return {
    source: art.image,
    width: art.image.naturalWidth,
    height: art.image.naturalHeight,
    transform: art.transform,
  }
}
