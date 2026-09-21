import * as THREE from 'three'
import { deg } from '../geometry'
import { metalMaterial, tableclothMaterial, woodMaterial } from '../materials'
import { artworkMesh } from '../slot'
import { buildSheetGeometry, type SurfaceFn } from '../surface'
import {
  colorHex,
  optionString,
  type BuildConfig,
  type BuiltMockup,
  type MockupDefinition,
  type SlotDefinition,
} from './types'

/** Millimetri reali verso unità di scena: il telo risulta largo 1,25. */
const S = 1 / 2000
const mm = (v: number) => v * S

/** Telo da fiera 2500 × 1450 mm, misurato disteso. */
const CLOTH = { w: 2500, d: 1450 }
/** Tavolo 2000 × 800 mm, altezza da banchetto. */
const TABLE = { w: 2000, d: 800, h: 750, thickness: 30 }
/**
 * Quanto il telo sborda oltre il piano, misurato sul tessuto:
 * 2500 = 2000 + 2 × 250 in larghezza, 1450 = 800 + 600 + 50 in profondità.
 */
const OVER = { front: 600, side: 250, back: 50 }

const HALF_W = TABLE.w / 2
/** Spigoli del piano nelle coordinate del telo (z positivo verso chi guarda). */
const Z_FRONT = CLOTH.d / 2 - OVER.front
const Z_BACK = -CLOTH.d / 2 + OVER.back
const Z_TABLE = (Z_FRONT + Z_BACK) / 2
/** Raggio con cui il tessuto gira sullo spigolo invece di piegarsi a squadra. */
const ROLL = 26
const ROLL_ARC = (ROLL * Math.PI) / 2
/** Frazione del telo occupata dalla falda che scende davanti. */
const FRONT_BAND = OVER.front / CLOTH.d

const clamp = THREE.MathUtils.clamp

const FABRICS = [
  { id: 'poliestere', label: 'Poliestere opaco' },
  { id: 'cotone', label: 'Cotone' },
  { id: 'raso', label: 'Raso' },
] as const

const COLORS = [
  { id: 'bianco', label: 'Bianco', hex: '#f2f2f0' },
  { id: 'nero', label: 'Nero', hex: '#1c1c1e', dark: true },
  { id: 'navy', label: 'Blu navy', hex: '#1e3272', dark: true },
  { id: 'royal', label: 'Blu royal', hex: '#29528e', dark: true },
  { id: 'rosso', label: 'Rosso', hex: '#c4262e' },
  { id: 'verde', label: 'Verde bosco', hex: '#26402a', dark: true },
  { id: 'grigio', label: 'Grigio chiaro', hex: '#c9ccd0' },
  { id: 'sabbia', label: 'Sabbia', hex: '#d8c9ae' },
]

/**
 * Telo appoggiato sul tavolo. La coordinata (u, v) resta quella del tessuto
 * disteso — è su quella che viene stampata la grafica — e la funzione la porta
 * dove finisce una volta drappeggiata: piatta sul piano, arrotondata sullo
 * spigolo, verticale sulle falde. La quota di discesa è la distanza percorsa
 * *sul tessuto* oltre lo spigolo, quindi agli angoli, dove il telo sborda da
 * due lati insieme, il tessuto scende di più e si raccoglie a cono.
 */
function drapedSurface(): SurfaceFn {
  return (u, v, out) => {
    const x = (u - 0.5) * CLOTH.w
    const z = (0.5 - v) * CLOTH.d
    const ox = x > HALF_W ? x - HALF_W : x < -HALF_W ? x + HALF_W : 0
    const oz = z > Z_FRONT ? z - Z_FRONT : z < Z_BACK ? z - Z_BACK : 0
    const d = Math.hypot(ox, oz)

    // increspatura minima del telo appoggiato: si spegne prima dello spigolo,
    // così non interferisce con il raccordo
    const ripple = (Math.sin(x / 120) * Math.sin(z / 150 + 1.1) + 1) * 0.7
    if (d === 0) {
      out.set(mm(x), mm(TABLE.h + ripple), mm(z))
      return
    }

    const nx = ox / d
    const nz = oz / d
    let horiz: number
    let drop: number
    if (d < ROLL_ARC) {
      const a = d / ROLL
      horiz = ROLL * Math.sin(a)
      drop = ROLL * (1 - Math.cos(a))
    } else {
      horiz = ROLL
      drop = ROLL + (d - ROLL_ARC)
    }

    // agli angoli il tessuto in eccesso non può stendersi: si allarga scendendo
    // e si raccoglie in una piega diagonale
    const corner = (2 * Math.abs(ox) * Math.abs(oz)) / (d * d)
    const phi = Math.atan2(Math.abs(oz), Math.abs(ox))
    horiz += corner * drop * (0.14 + 0.09 * Math.sin(phi * 4))

    // le falde libere ondeggiano, e l'onda cresce scendendo verso l'orlo
    const along = Math.abs(nx) > Math.abs(nz) ? z : x
    horiz += (1 - corner) * (drop / OVER.front) * 11 * Math.sin(along / 170 + 0.7)

    const fade = 1 - THREE.MathUtils.smoothstep(d, 0, 90)
    out.set(
      mm(clamp(x, -HALF_W, HALF_W) + nx * horiz),
      mm(TABLE.h - drop + ripple * fade),
      mm(clamp(z, Z_BACK, Z_FRONT) + nz * horiz),
    )
  }
}

/**
 * Telo steso: due ondulazioni incrociate, perché un tessuto appoggiato non è
 * mai piano come un foglio, e i due angoli davanti che si sollevano appena.
 */
function flatSurface(): SurfaceFn {
  return (u, v, out) => {
    const x = (u - 0.5) * CLOTH.w
    const z = (0.5 - v) * CLOTH.d
    let y = 5
    y += 3.4 * Math.sin(u * Math.PI * 4.3 + 0.6) * Math.sin(v * Math.PI * 2.6 + 0.4)
    y += 2.2 * Math.sin(u * Math.PI * 2.1 - 0.9) * Math.sin(v * Math.PI * 5.4 + 1.3)
    const cu = Math.max(0, Math.abs(u - 0.5) * 2 - 0.72) / 0.28
    const cv = Math.max(0, 0.26 - v) / 0.26
    y += Math.pow(cu * cv, 1.5) * 28
    out.set(mm(x), mm(y), mm(z))
  }
}

/** Sottosuperficie: la fascia che scende davanti, riparametrizzata su [0,1]. */
function frontBand(fn: SurfaceFn): SurfaceFn {
  return (u, v, out) => fn(u, v * FRONT_BAND, out)
}

/** Tavolo: piano in legno e gambe a sezione quadrata. */
function buildTable(group: THREE.Group) {
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(mm(TABLE.w), mm(TABLE.thickness), mm(TABLE.d)),
    woodMaterial('#c19a6b'),
  )
  top.position.set(0, mm(TABLE.h - TABLE.thickness / 2), mm(Z_TABLE))
  top.castShadow = true
  top.receiveShadow = true
  group.add(top)

  const legHeight = TABLE.h - TABLE.thickness
  const legGeometry = new THREE.BoxGeometry(mm(55), mm(legHeight), mm(55))
  const legMaterial = metalMaterial('#b6bac0')
  const inset = 110
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeometry, legMaterial)
      leg.position.set(
        sx * mm(HALF_W - inset),
        mm(legHeight / 2),
        mm(Z_TABLE + sz * (TABLE.d / 2 - inset)),
      )
      leg.castShadow = true
      group.add(leg)
    }
  }
}

function build(cfg: BuildConfig): BuiltMockup {
  const draped = cfg.variant !== 'stesa'
  const fabric = optionString(cfg, 'tessuto', 'poliestere') as 'poliestere' | 'cotone' | 'raso'
  const group = new THREE.Group()

  if (draped) buildTable(group)

  const fn = draped ? drapedSurface() : flatSurface()
  const segU = 200
  const segV = draped ? 140 : 96
  const thickness = mm(0.7)
  const { front, back, rim } = buildSheetGeometry(fn, thickness, { segU, segV })
  const cloth = tableclothMaterial(colorHex(cfg, COLORS), fabric)
  const fm = new THREE.Mesh(front, cloth)
  const bm = new THREE.Mesh(back, cloth)
  const rm = new THREE.Mesh(rim, cloth)
  fm.castShadow = true
  fm.receiveShadow = true
  bm.castShadow = true
  bm.receiveShadow = true
  group.add(fm, bm, rm)

  const artAll = artworkMesh(fn, {
    slot: 'telo',
    segU,
    segV,
    offset: thickness / 2 + mm(0.35),
    roughness: fabric === 'raso' ? 0.5 : 0.82,
  })
  // la fascia frontale sta un millimetro e mezzo più in alto del telo intero:
  // le due grafiche possono convivere sulla stessa porzione di tessuto, e la
  // distanza regge anche di taglio, dove lo z-buffer perde precisione
  const artBand = artworkMesh(frontBand(fn), {
    slot: 'fronte',
    segU,
    segV: Math.round(segV * FRONT_BAND) + 8,
    offset: thickness / 2 + mm(1.4),
    roughness: fabric === 'raso' ? 0.5 : 0.82,
  })
  group.add(artAll, artBand)

  const slots: SlotDefinition[] = [
    {
      id: 'telo',
      label: 'Telo intero',
      area: { width: mm(CLOTH.w), height: mm(CLOTH.d) },
      hint: `${CLOTH.w} × ${CLOTH.d} mm — tessuto disteso`,
      meshes: [artAll],
      fullBleed: true,
    },
    {
      id: 'fronte',
      label: 'Fascia frontale',
      area: { width: mm(CLOTH.w), height: mm(OVER.front) },
      hint: `${CLOTH.w} × ${OVER.front} mm — la parte che scende davanti`,
      meshes: [artBand],
    },
  ]

  return {
    group,
    slots,
    camera: draped
      ? { azimuth: deg(-18), polar: deg(72), distanceFactor: 1.04 }
      : { azimuth: deg(-14), polar: deg(34), distanceFactor: 1.0 },
    dispose() {},
  }
}

export const tablecloth: MockupDefinition = {
  id: 'tovaglia',
  name: 'Tovaglia da tavolo',
  category: 'stampa',
  tagline: 'Telo 2500 × 1450 su tavolo 2000 × 800',
  description:
    'Telo da fiera stampato, steso o appoggiato sul tavolo: sborda di 600 mm davanti, 250 mm per lato e 50 mm dietro, e agli angoli il tessuto in eccesso scende a cono come succede davvero.',
  icon: 'tablecloth',
  variants: [
    {
      id: 'stesa',
      label: 'Stesa',
      description: 'Telo disteso: si legge tutta la stampa, 2500 × 1450 mm.',
    },
    {
      id: 'tavolo',
      label: 'Sul tavolo',
      description: 'Appoggiata su un tavolo 2000 × 800, con il debordo reale.',
    },
  ],
  colors: COLORS,
  options: [
    {
      id: 'tessuto',
      kind: 'select',
      label: 'Tessuto',
      default: 'poliestere',
      values: FABRICS.map((f) => ({ id: f.id, label: f.label })),
    },
  ],
  build,
}
