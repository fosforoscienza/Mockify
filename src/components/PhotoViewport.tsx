import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PhotoMockupRenderer, loadBase, type PhotoArtwork } from '../photo/render'
import { photoVariant } from '../photo/model'
import type { PhotoConfig } from '../photo/bases'
import type { ArtTransform } from '../three/artwork'
import { imageFromDataTransfer } from '../lib/image'
/** Contratto comune fra le superfici di lavoro e l'export dell'editor. */
export interface MockupSurface {
  snapshot(pxW: number, pxH: number, background: string | null): string
  aspect(): number
}

export interface PhotoArt {
  image: HTMLImageElement
  transform: ArtTransform
}

interface Props {
  photo: PhotoConfig
  variantId: string
  /** Quale vista della variante mostrare: quella dello slot attivo. */
  viewIndex: number
  color: string | null
  background: string | null
  artworks: Record<string, PhotoArt | null>
  slotId: string | null
  onReady(surface: MockupSurface): void
  onDragTransform(slot: string, offsetX: number, offsetY: number): void
  onDropImage(file: File): void
}

/**
 * Superficie di lavoro dei mockup su foto. La foto di base viene caricata una
 * volta e tenuta in cache; il disegno è lo stesso del renderer usato per
 * l'export, così l'anteprima e il file scaricato coincidono.
 */
export default function PhotoViewport({
  photo,
  variantId,
  viewIndex,
  color,
  background,
  artworks,
  slotId,
  onReady,
  onDragTransform,
  onDropImage,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef(new PhotoMockupRenderer())
  const exportRef = useRef(new PhotoMockupRenderer())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [base, setBase] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const dragRef = useRef<{ u: number; v: number; ox: number; oy: number } | null>(null)

  const variant = useMemo(() => photoVariant(photo, variantId), [photo, variantId])
  const view = variant.views[Math.min(viewIndex, variant.views.length - 1)]
  const propsRef = useRef({ view, color, background, artworks, base })
  propsRef.current = { view, color, background, artworks, base }

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
    let alive = true
    setError(null)
    loadBase(photo.folder, view.file)
      .then((img) => {
        if (alive) setBase(img)
      })
      .catch((e: Error) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [photo.folder, view.file])

  const toArtworks = (src: Record<string, PhotoArt | null>) => {
    const out: Record<string, PhotoArtwork | null> = {}
    for (const [id, art] of Object.entries(src)) {
      out[id] = art
        ? {
            source: art.image,
            width: art.image.naturalWidth,
            height: art.image.naturalHeight,
            transform: art.transform,
          }
        : null
    }
    return out
  }

  useEffect(() => {
    onReady({
      snapshot(pxW, pxH, bg) {
        const p = propsRef.current
        const canvas = document.createElement('canvas')
        if (!p.base) return canvas.toDataURL('image/png')
        exportRef.current.render(canvas, {
          base: p.base,
          view: p.view,
          color: p.color,
          background: bg,
          width: pxW,
          height: pxH,
          artworks: toArtworks(p.artworks),
        })
        return canvas.toDataURL('image/png')
      },
      aspect: () => {
        const b = propsRef.current.base
        return b ? b.naturalWidth / b.naturalHeight : 1
      },
    })
  }, [onReady, base])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w < 2 || !base) return
    rendererRef.current.render(canvas, {
      base,
      view,
      color,
      background,
      width: size.w,
      height: size.h,
      artworks: toArtworks(artworks),
    })
  }, [base, view, color, background, artworks, size])

  /** Dal puntatore alle coordinate normalizzate dell'area attiva. */
  const pointerUv = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!slotId) return null
      const frame = rendererRef.current.areaFrames().find((f) => f.id === slotId)
      if (!frame) return null
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const dpr = canvas.width / rect.width
      const px = (event.clientX - rect.left) * dpr - frame.x
      const py = (event.clientY - rect.top) * dpr - frame.y
      const m = frame.inverse
      const w = m[6] * px + m[7] * py + m[8]
      return { u: (m[0] * px + m[1] * py + m[2]) / w, v: (m[3] * px + m[4] * py + m[5]) / w }
    },
    [slotId],
  )

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!slotId) return
    const art = artworks[slotId]
    if (!art) return
    const uv = pointerUv(event)
    if (!uv || uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      u: uv.u,
      v: uv.v,
      ox: art.transform.offsetX,
      oy: art.transform.offsetY,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) {
      const uv = pointerUv(event)
      const inside = uv && uv.u >= 0 && uv.u <= 1 && uv.v >= 0 && uv.v <= 1
      event.currentTarget.style.cursor = inside && slotId && artworks[slotId] ? 'move' : 'default'
      return
    }
    const uv = pointerUv(event)
    if (!uv || !slotId) return
    onDragTransform(
      slotId,
      clamp(drag.ox + (uv.u - drag.u) * 2),
      clamp(drag.oy - (uv.v - drag.v) * 2),
    )
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
        <span>
          {error
            ? error
            : !base
              ? 'Carico la foto di base…'
              : slotId && artworks[slotId]
                ? 'Trascina la grafica per spostarla'
                : 'Trascina qui un PNG o un JPG'}
        </span>
        <span>{variant.label}</span>
      </div>
    </div>
  )
}

const clamp = (v: number) => Math.max(-1.5, Math.min(1.5, v))
