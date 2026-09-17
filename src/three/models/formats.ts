/** Formati di stampa: dimensioni reali in millimetri. */
export interface PrintFormat {
  id: string
  label: string
  w: number
  h: number
}

export const POSTER_FORMATS: PrintFormat[] = [
  { id: 'a3', label: 'A3 — 297 × 420 mm', w: 297, h: 420 },
  { id: 'a2', label: 'A2 — 420 × 594 mm', w: 420, h: 594 },
  { id: 'a1', label: 'A1 — 594 × 841 mm', w: 594, h: 841 },
  { id: '50x70', label: '50 × 70 cm', w: 500, h: 700 },
  { id: '70x50', label: '70 × 50 cm (orizzontale)', w: 700, h: 500 },
  { id: '60x60', label: '60 × 60 cm (quadrato)', w: 600, h: 600 },
]

export const SHEET_FORMATS: PrintFormat[] = [
  { id: 'a4', label: 'A4 — 210 × 297 mm', w: 210, h: 297 },
  { id: 'a5', label: 'A5 — 148 × 210 mm', w: 148, h: 210 },
  { id: 'letter', label: 'Letter — 216 × 279 mm', w: 216, h: 279 },
  { id: 'square', label: 'Quadrato — 210 × 210 mm', w: 210, h: 210 },
  { id: 'a4l', label: 'A4 orizzontale — 297 × 210 mm', w: 297, h: 210 },
]

export const BROCHURE_FORMATS: PrintFormat[] = [
  { id: 'a4', label: 'A4 chiusa 99 × 210 mm', w: 99, h: 210 },
  { id: 'dl', label: 'DL chiusa 100 × 210 mm', w: 100, h: 210 },
  { id: 'a5', label: 'A5 chiusa 70 × 148 mm', w: 70, h: 148 },
  { id: 'square', label: 'Quadrata 148 × 148 mm', w: 148, h: 148 },
]

export const BOOK_FORMATS: PrintFormat[] = [
  { id: 'a5', label: 'A5 — 148 × 210 mm', w: 148, h: 210 },
  { id: 'a4', label: 'A4 — 210 × 297 mm', w: 210, h: 297 },
  { id: 'pocket', label: 'Tascabile — 110 × 180 mm', w: 110, h: 180 },
  { id: 'trade', label: 'US Trade — 152 × 229 mm', w: 152, h: 229 },
  { id: 'square', label: 'Quadrato — 210 × 210 mm', w: 210, h: 210 },
  { id: 'landscape', label: 'Orizzontale — 240 × 170 mm', w: 240, h: 170 },
]

export function findFormat(list: PrintFormat[], id: string) {
  return list.find((f) => f.id === id) ?? list[0]
}

/** Converte un formato in unità scena mantenendo il lato lungo costante. */
export function toScene(f: PrintFormat, longest: number) {
  const k = longest / Math.max(f.w, f.h)
  return { width: f.w * k, height: f.h * k }
}

export const mm = (f: PrintFormat) => `${f.w} × ${f.h} mm`
