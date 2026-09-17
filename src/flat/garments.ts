import type { Pt } from './field'
import { line, mirrorX, pt, quad } from './shape'

/**
 * Sagoma di un capo disteso, in unità capo (metri) con la Y verso l'alto.
 * Da qui nascono sia il profilo ritagliato sia i dettagli — collo, cuciture,
 * orli — che il renderer trasforma in rilievo e quindi in ombre.
 */
export interface Seam {
  points: Pt[]
  /** Profondità del solco in mm; negativa per una cucitura incassata. */
  depth: number
  width: number
  /** Impunture affiancate al solco. */
  stitch?: boolean
}

export interface Band {
  points: Pt[]
  /** Rilievo in mm. */
  height: number
  width: number
  /** Scurimento dell'albedo (0 = nessuno). */
  shade?: number
  ribbed?: boolean
}

/** Pezzo applicato: tasca, toppa. Un'area piena in rilievo. */
export interface Patch {
  points: Pt[]
  height: number
  shade?: number
}

export interface GarmentView {
  outline: Pt[]
  neckHole: Pt[]
  seams: Seam[]
  bands: Band[]
  patches?: Patch[]
  /** Area di stampa in unità capo, centro e dimensioni. */
  print: { cx: number; cy: number; w: number; h: number }
  /** Etichetta interna, solo sul retro. */
  label?: { cx: number; cy: number; w: number; h: number }
}

export interface GarmentSpec {
  id: string
  fabric: 'jersey' | 'fleece'
  front: GarmentView
  back: GarmentView
}

export interface HoodSpec {
  halfWidth: number
  height: number
}

interface Params {
  length: number
  bodyWidth: number
  hemWidth: number
  shoulderWidth: number
  shoulderSlope: number
  neckWidth: number
  neckDropFront: number
  neckDropBack: number
  neckBack: number
  sleeveLength: number
  sleeveAngle: number
  sleeveOpen: number
  armpitDrop: number
  waist: number
  hemCurve: number
  hood?: HoodSpec
  pocket?: boolean
  ribbed?: boolean
}

const TSHIRT: Params = {
  length: 0.7,
  bodyWidth: 0.47,
  hemWidth: 0.435,
  shoulderWidth: 0.405,
  shoulderSlope: 0.042,
  neckWidth: 0.175,
  neckDropFront: 0.058,
  neckDropBack: 0.016,
  neckBack: 0.022,
  sleeveLength: 0.195,
  sleeveAngle: 0.5,
  sleeveOpen: 0.125,
  armpitDrop: 0.2,
  waist: 0.032,
  hemCurve: 0.012,
}

/** Piccola asimmetria: nessun capo vero è perfettamente speculare. */
function jitter(points: Pt[], amount: number, seed = 1) {
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  const n = points.length
  const phase = rnd() * Math.PI * 2
  return points.map((p, i) => {
    const t = (i / n) * Math.PI * 2
    const w = Math.sin(t * 3 + phase) * 0.6 + Math.sin(t * 7 + phase * 2) * 0.4
    return { x: p.x + w * amount, y: p.y + w * amount * 0.5 }
  })
}

function silhouette(p: Params) {
  const yS = p.length / 2
  const shoulder = pt(-p.shoulderWidth / 2, yS - p.shoulderSlope)
  const dirX = -Math.cos(p.sleeveAngle)
  const dirY = -Math.sin(p.sleeveAngle)
  const cuffTop = pt(shoulder.x + dirX * p.sleeveLength, shoulder.y + dirY * p.sleeveLength)
  const cuffBottom = pt(cuffTop.x - dirY * p.sleeveOpen, cuffTop.y + dirX * p.sleeveOpen)
  const armpit = pt(-p.bodyWidth / 2, yS - p.shoulderSlope - p.armpitDrop)
  const hem = pt(-p.hemWidth / 2, -p.length / 2)
  return { yS, shoulder, cuffTop, cuffBottom, armpit, hem }
}

function outlineOf(p: Params): Pt[] {
  const { yS, shoulder, cuffTop, cuffBottom, armpit, hem } = silhouette(p)
  const out: Pt[] = [mirrorX(shoulder)]
  if (p.hood) {
    // il cappuccio disteso si apre dietro le spalle come una cupola
    const hw = p.hood.halfWidth
    const hh = p.hood.height
    quad(mirrorX(shoulder), pt(hw * 1.04, yS + hh * 0.22), pt(hw, yS + hh * 0.55), 14, out)
    quad(pt(hw, yS + hh * 0.55), pt(hw * 0.86, yS + hh), pt(0, yS + hh * 1.02), 16, out)
    quad(pt(0, yS + hh * 1.02), pt(-hw * 0.86, yS + hh), pt(-hw, yS + hh * 0.55), 16, out)
    quad(pt(-hw, yS + hh * 0.55), pt(-hw * 1.04, yS + hh * 0.22), shoulder, 14, out)
  } else {
    quad(mirrorX(shoulder), pt(0, yS + 0.006), shoulder, 22, out)
  }
  quad(
    shoulder,
    pt((shoulder.x + cuffTop.x) / 2, (shoulder.y + cuffTop.y) / 2 + 0.016),
    cuffTop,
    18,
    out,
  )
  line(cuffTop, cuffBottom, 8, out)
  quad(
    cuffBottom,
    pt(
      cuffBottom.x + (armpit.x - cuffBottom.x) * 0.45,
      cuffBottom.y + (armpit.y - cuffBottom.y) * 0.85,
    ),
    armpit,
    16,
    out,
  )
  quad(armpit, pt(-p.bodyWidth / 2 + p.waist, (armpit.y + hem.y) / 2), hem, 26, out)
  quad(hem, pt(0, hem.y - p.hemCurve), mirrorX(hem), 26, out)
  quad(
    mirrorX(hem),
    pt(p.bodyWidth / 2 - p.waist, (armpit.y + hem.y) / 2),
    mirrorX(armpit),
    26,
    out,
  )
  quad(
    mirrorX(armpit),
    pt(
      -(cuffBottom.x + (armpit.x - cuffBottom.x) * 0.45),
      cuffBottom.y + (armpit.y - cuffBottom.y) * 0.85,
    ),
    mirrorX(cuffBottom),
    16,
    out,
  )
  line(mirrorX(cuffBottom), mirrorX(cuffTop), 8, out)
  quad(
    mirrorX(cuffTop),
    pt(-(shoulder.x + cuffTop.x) / 2, (shoulder.y + cuffTop.y) / 2 + 0.016),
    mirrorX(shoulder),
    18,
    out,
  )
  out.pop()
  return jitter(out, 0.0022, 7)
}

function necklineOf(p: Params, drop: number): Pt[] {
  const yS = p.length / 2
  const pts: Pt[] = []
  const half = p.neckWidth / 2
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const x = -half + p.neckWidth * t
    const k = Math.abs(x) / half
    pts.push(pt(x, yS - p.neckBack - drop * Math.pow(Math.cos((k * Math.PI) / 2), 0.62)))
  }
  return pts
}

function neckHoleOf(p: Params, drop: number): Pt[] {
  const yS = p.length / 2
  const front = necklineOf(p, drop)
  const hole = [...front]
  const half = p.neckWidth / 2
  for (let i = 1; i < 26; i++) {
    const t = i / 26
    const x = half - p.neckWidth * t
    const k = Math.abs(x) / half
    hole.push(pt(x, yS - p.neckBack * 0.3 - p.neckBack * 0.7 * Math.pow(k, 1.7)))
  }
  return hole
}

function viewOf(p: Params, side: 'front' | 'back'): GarmentView {
  const { yS, shoulder, cuffTop, cuffBottom, armpit, hem } = silhouette(p)
  const drop = side === 'front' ? p.neckDropFront : p.neckDropBack
  const neckBottom = yS - p.neckBack - drop

  const seams: Seam[] = []
  const bands: Band[] = []
  const patches: Patch[] = []

  // spalle: dalla scollatura al punto spalla
  for (const s of [-1, 1]) {
    seams.push({
      points: [
        pt((s * p.neckWidth) / 2, yS - p.neckBack),
        pt(s * Math.abs(shoulder.x), shoulder.y),
      ],
      depth: -1.5,
      width: 0.0035,
      stitch: true,
    })
    // giro manica
    const arm: Pt[] = []
    quad(
      pt(s * Math.abs(shoulder.x), shoulder.y),
      pt(s * Math.abs(shoulder.x) * 0.94, (shoulder.y + armpit.y) / 2),
      pt(s * Math.abs(armpit.x), armpit.y),
      16,
      arm,
    )
    seams.push({ points: [pt(s * Math.abs(shoulder.x), shoulder.y), ...arm], depth: -1.7, width: 0.004, stitch: true })
    // fianco
    const side: Pt[] = []
    quad(
      pt(s * Math.abs(armpit.x), armpit.y),
      pt(s * (p.bodyWidth / 2 - p.waist), (armpit.y + hem.y) / 2),
      pt(s * Math.abs(hem.x), hem.y),
      20,
      side,
    )
    seams.push({ points: [pt(s * Math.abs(armpit.x), armpit.y), ...side], depth: -1.2, width: 0.003 })
  }

  // orlo inferiore
  const hemLine: Pt[] = [pt(hem.x + 0.004, hem.y + 0.024)]
  quad(
    pt(hem.x + 0.004, hem.y + 0.024),
    pt(0, hem.y + 0.024 - p.hemCurve * 0.6),
    pt(-hem.x - 0.004, hem.y + 0.024),
    26,
    hemLine,
  )
  bands.push({
    points: hemLine,
    height: 0.9,
    width: 0.024,
    shade: 0.02,
    ribbed: p.ribbed,
  })
  seams.push({ points: hemLine, depth: -1.3, width: 0.003, stitch: true })

  // fondo manica
  for (const s of [-1, 1]) {
    const a = pt(s * Math.abs(cuffTop.x), cuffTop.y)
    const b = pt(s * Math.abs(cuffBottom.x), cuffBottom.y)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = (-dy / len) * s * -1
    const ny = (dx / len) * s * -1
    const inset = 0.022
    const cuff = [
      pt(a.x + nx * inset, a.y + ny * inset),
      pt(b.x + nx * inset, b.y + ny * inset),
    ]
    bands.push({ points: cuff, height: 0.8, width: 0.02, shade: 0.02, ribbed: p.ribbed })
    seams.push({ points: cuff, depth: -1.2, width: 0.003, stitch: true })
  }

  // collo a costina, oppure bordo del cappuccio: avvolge tutta l'apertura
  const hole = neckHoleOf(p, drop)
  let cxSum = 0
  let cySum = 0
  hole.forEach((q) => {
    cxSum += q.x
    cySum += q.y
  })
  const hc = { x: cxSum / hole.length, y: cySum / hole.length }
  // l'anello del collo poggia sul tessuto, appena fuori dall'apertura
  const collarRing = hole.map((q) => {
    const dx = q.x - hc.x
    const dy = q.y - hc.y
    const len = Math.hypot(dx, dy) || 1
    return pt(q.x + (dx / len) * 0.011, q.y + (dy / len) * 0.011)
  })
  collarRing.push(collarRing[0])
  bands.push({
    points: collarRing,
    height: p.hood ? 3.4 : 2.6,
    width: p.hood ? 0.034 : 0.023,
    shade: 0.04,
    ribbed: true,
  })

  if (p.pocket && side === 'front') {
    // tasca a marsupio: profilo cucito, apertura inclinata ai lati
    const w = p.bodyWidth * 0.66
    const top = hem.y + 0.3
    const bottom = hem.y + 0.085
    const pocketPath: Pt[] = [pt(-w / 2 + 0.03, top)]
    quad(pt(-w / 2 + 0.03, top), pt(-w / 2 - 0.01, top - 0.03), pt(-w / 2 - 0.012, top - 0.085), 10, pocketPath)
    line(pt(-w / 2 - 0.012, top - 0.085), pt(-w / 2 - 0.012, bottom + 0.02), 8, pocketPath)
    quad(
      pt(-w / 2 - 0.012, bottom + 0.02),
      pt(-w / 2 - 0.012, bottom),
      pt(-w / 2 + 0.02, bottom),
      6,
      pocketPath,
    )
    line(pt(-w / 2 + 0.02, bottom), pt(w / 2 - 0.02, bottom), 20, pocketPath)
    quad(
      pt(w / 2 - 0.02, bottom),
      pt(w / 2 + 0.012, bottom),
      pt(w / 2 + 0.012, bottom + 0.02),
      6,
      pocketPath,
    )
    line(pt(w / 2 + 0.012, bottom + 0.02), pt(w / 2 + 0.012, top - 0.085), 8, pocketPath)
    quad(pt(w / 2 + 0.012, top - 0.085), pt(w / 2 + 0.01, top - 0.03), pt(w / 2 - 0.03, top), 10, pocketPath)
    patches.push({ points: pocketPath, height: 1.9, shade: 0.015 })
    seams.push({ points: pocketPath, depth: -1.4, width: 0.0035, stitch: true })
  }

  if (p.hood) {
    const hw = p.hood.halfWidth
    const base: Pt[] = [pt(-hw * 0.97, yS - 0.004)]
    quad(pt(-hw * 0.97, yS - 0.004), pt(0, yS + 0.014), pt(hw * 0.97, yS - 0.004), 18, base)
    seams.push({ points: base, depth: -1.8, width: 0.005, stitch: true })
  }

  if (p.hood && side === 'front') {
    // lacci del cappuccio
    for (const s of [-1, 1]) {
      const x = s * 0.042
      const y0 = yS - p.neckBack - drop - 0.004
      const cord: Pt[] = [pt(x, y0)]
      quad(pt(x, y0), pt(x + s * 0.012, y0 - 0.07), pt(x + s * 0.02, y0 - 0.15), 12, cord)
      bands.push({ points: cord, height: 3.2, width: 0.011, shade: -0.05 })
      const tip = cord[cord.length - 1]
      patches.push({
        points: [
          pt(tip.x - 0.006, tip.y + 0.004),
          pt(tip.x + 0.006, tip.y + 0.004),
          pt(tip.x + 0.006, tip.y - 0.018),
          pt(tip.x - 0.006, tip.y - 0.018),
        ],
        height: 3.6,
        shade: 0.1,
      })
    }
  }

  const printW = 0.3
  const printH = p.hood ? 0.26 : 0.38
  // sulla felpa la stampa sta sopra la tasca
  const printCy = p.pocket && side === 'front'
    ? hem.y + 0.3 + 0.03 + printH / 2
    : neckBottom - (p.hood ? 0.07 : 0.055) - printH / 2
  return {
    outline: outlineOf(p),
    neckHole: neckHoleOf(p, drop),
    seams,
    bands,
    patches,
    print: { cx: 0, cy: printCy, w: printW, h: printH },
    label:
      side === 'back'
        ? { cx: 0, cy: yS - p.neckBack - drop - 0.028, w: 0.05, h: 0.03 }
        : undefined,
  }
}

const HOODIE: Params = {
  length: 0.72,
  bodyWidth: 0.56,
  hemWidth: 0.54,
  shoulderWidth: 0.5,
  shoulderSlope: 0.05,
  neckWidth: 0.25,
  neckDropFront: 0.085,
  neckDropBack: 0.022,
  neckBack: 0.03,
  sleeveLength: 0.44,
  sleeveAngle: 0.62,
  sleeveOpen: 0.135,
  armpitDrop: 0.24,
  waist: 0.0,
  hemCurve: 0.006,
  hood: { halfWidth: 0.215, height: 0.15 },
  pocket: true,
  ribbed: true,
}

export const TSHIRT_SPEC: GarmentSpec = {
  id: 'tshirt',
  fabric: 'jersey',
  front: viewOf(TSHIRT, 'front'),
  back: viewOf(TSHIRT, 'back'),
}

export const HOODIE_SPEC: GarmentSpec = {
  id: 'hoodie',
  fabric: 'fleece',
  front: viewOf(HOODIE, 'front'),
  back: viewOf(HOODIE, 'back'),
}
