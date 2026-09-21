import { useRef, useState } from 'react'
import type { ArtTransform } from '../three/artwork'
import { formatBytes, type LoadedImage } from '../lib/image'
import type { SlotInfo } from './Viewport'
import { CenterIcon, FitIcon, RotateIcon, TrashIcon, UploadIcon } from './Icons'

interface Props {
  slots: SlotInfo[]
  activeSlot: string | null
  onActiveSlot(id: string): void
  image: LoadedImage | null
  transform: ArtTransform
  filledSlots: Set<string>
  onFile(file: File): void
  onClear(): void
  onPatch(patch: Partial<ArtTransform>): void
  onReset(): void
}

const round = (n: number, d = 0) => {
  const k = Math.pow(10, d)
  return Math.round(n * k) / k
}

export default function ArtworkPanel({
  slots,
  activeSlot,
  onActiveSlot,
  image,
  transform,
  filledSlots,
  onFile,
  onClear,
  onPatch,
  onReset,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <>
      <div className="panel-section">
        <div className="panel-title">
          <h3>Aree di stampa</h3>
        </div>
        <div className="slot-tabs" style={{ marginTop: 10 }}>
          {slots.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === activeSlot ? 'active' : ''}
              onClick={() => onActiveSlot(s.id)}
            >
              {filledSlots.has(s.id) && <span className="dot" aria-hidden />}
              {s.label}
            </button>
          ))}
        </div>

        {!image ? (
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) onFile(file)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <UploadIcon size={26} />
            <strong>Trascina qui la grafica</strong>
            <span>PNG, JPG o WebP — oppure fai clic per sceglierla</span>
          </div>
        ) : (
          <div className="thumb-row">
            <div className="thumb">
              <img src={image.url} alt="" />
            </div>
            <div className="thumb-meta">
              <strong title={image.name}>{image.name}</strong>
              <span>
                {image.width} × {image.height} px · {formatBytes(image.bytes)}
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClear}
              title="Rimuovi la grafica"
              aria-label="Rimuovi la grafica"
            >
              <TrashIcon size={17} />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />

        {slots.find((s) => s.id === activeSlot)?.hint && (
          <p className="hint">{slots.find((s) => s.id === activeSlot)?.hint}</p>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-title">
          <h3>Adatta la grafica</h3>
          <button type="button" className="btn btn-sm btn-subtle" onClick={onReset}>
            Ripristina
          </button>
        </div>

        <fieldset
          disabled={!image}
          style={{ border: 'none', padding: 0, margin: 0, opacity: image ? 1 : 0.5 }}
        >
          <div className="control">
            <div className="control-head">
              <label htmlFor="ctl-scale">Dimensione</label>
              <output>{round(transform.scale * 100)}%</output>
            </div>
            <input
              id="ctl-scale"
              type="range"
              min={0.08}
              max={2}
              step={0.01}
              value={transform.scale}
              onChange={(e) => onPatch({ scale: Number(e.target.value) })}
            />
          </div>

          <div className="control">
            <div className="control-head">
              <label htmlFor="ctl-rot">Rotazione</label>
              <output>{round((transform.rotation * 180) / Math.PI)}°</output>
            </div>
            <input
              id="ctl-rot"
              type="range"
              min={-180}
              max={180}
              step={1}
              value={round((transform.rotation * 180) / Math.PI)}
              onChange={(e) => onPatch({ rotation: (Number(e.target.value) * Math.PI) / 180 })}
            />
          </div>

          <div className="control">
            <div className="control-head">
              <label htmlFor="ctl-x">Posizione orizzontale</label>
              <output>{round(transform.offsetX * 100)}</output>
            </div>
            <input
              id="ctl-x"
              type="range"
              min={-1}
              max={1}
              step={0.005}
              value={transform.offsetX}
              onChange={(e) => onPatch({ offsetX: Number(e.target.value) })}
            />
          </div>

          <div className="control">
            <div className="control-head">
              <label htmlFor="ctl-y">Posizione verticale</label>
              <output>{round(transform.offsetY * 100)}</output>
            </div>
            <input
              id="ctl-y"
              type="range"
              min={-1}
              max={1}
              step={0.005}
              value={transform.offsetY}
              onChange={(e) => onPatch({ offsetY: Number(e.target.value) })}
            />
          </div>

          <div className="control">
            <div className="control-head">
              <label htmlFor="ctl-op">Opacità</label>
              <output>{round(transform.opacity * 100)}%</output>
            </div>
            <input
              id="ctl-op"
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={transform.opacity}
              onChange={(e) => onPatch({ opacity: Number(e.target.value) })}
            />
          </div>

          <div className="row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onPatch({ offsetX: 0, offsetY: 0 })}
            >
              <CenterIcon size={15} /> Centra
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${transform.stretch ? 'active' : ''}`}
              onClick={() =>
                onPatch(
                  transform.stretch
                    ? { scale: 1, rotation: 0, stretch: false }
                    : { scale: 1, rotation: 0, offsetX: 0, offsetY: 0, stretch: true },
                )
              }
              title={
                transform.stretch
                  ? 'Torna alle proporzioni della grafica'
                  : 'Deforma la grafica per riempire esattamente l’area'
              }
              aria-pressed={transform.stretch}
            >
              <FitIcon size={15} /> Adatta
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onPatch({ flipX: !transform.flipX })}
              title="Specchia la grafica in orizzontale"
            >
              <RotateIcon size={15} /> Specchia
            </button>
          </div>
        </fieldset>

        <p className="hint">
          {transform.stretch
            ? 'La grafica è deformata per riempire esattamente l’area: premi di nuovo Adatta per tornare alle sue proporzioni.'
            : 'Puoi anche trascinare la grafica direttamente sul mockup per posizionarla.'}
        </p>
      </div>
    </>
  )
}
