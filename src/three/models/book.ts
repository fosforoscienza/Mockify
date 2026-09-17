import * as THREE from 'three'
import { coverMaterial, paperMaterial } from '../materials'
import { deg } from '../geometry'
import { pageEdgeTexture } from '../textures'
import { artworkMesh } from '../slot'
import { buildSheetGeometry, type SurfaceFn } from '../surface'
import { BOOK_FORMATS, findFormat, mm, toScene } from './formats'
import {
  colorHex,
  optionNumber,
  optionString,
  type BuildConfig,
  type BuiltMockup,
  type MockupDefinition,
  type SlotDefinition,
} from './types'

interface BookVariant {
  label: string
  description: string
  pose: 'standing' | 'angled' | 'lying' | 'open'
  camera: { azimuth: number; polar: number }
}

const VARIANTS: Record<string, BookVariant> = {
  frontale: {
    label: 'In piedi, fronte',
    description: 'Copertina in primo piano con un accenno di dorso.',
    pose: 'standing',
    camera: { azimuth: deg(-20), polar: deg(80) },
  },
  trequarti: {
    label: 'In piedi, tre quarti',
    description: 'Vista angolata che mostra copertina e dorso.',
    pose: 'angled',
    camera: { azimuth: deg(-42), polar: deg(74) },
  },
  disteso: {
    label: 'Disteso sul piano',
    description: 'Libro chiuso appoggiato, ripreso dall’alto.',
    pose: 'lying',
    camera: { azimuth: deg(-26), polar: deg(40) },
  },
  aperto: {
    label: 'Aperto al centro',
    description: 'Pagine interne affiancate con copertina visibile ai lati.',
    pose: 'open',
    camera: { azimuth: deg(-8), polar: deg(42) },
  },
}

const COVERS = [
  { id: 'white', label: 'Bianco', hex: '#f4f2ee' },
  { id: 'navy', label: 'Blu notte', hex: '#2a3654', dark: true },
  { id: 'black', label: 'Nero', hex: '#212124', dark: true },
  { id: 'terracotta', label: 'Terracotta', hex: '#b1604a' },
  { id: 'sage', label: 'Verde salvia', hex: '#8d9c84' },
  { id: 'mustard', label: 'Senape', hex: '#cfa14a' },
]

const HEIGHT = 0.62

interface CasePath {
  fn: SurfaceFn
  backRange: [number, number]
  spineRange: [number, number]
  frontRange: [number, number]
  arc: { back: number; spine: number; total: number }
}

/** Sviluppo della copertina: piatto posteriore, dorso arrotondato, piatto anteriore. */
function casePath(w: number, t: number, h: number, round: number): CasePath {
  const raw: THREE.Vector2[] = []
  const hingeX = -w / 2 + Math.max(0.012, t * 0.55)
  const hingeW = Math.max(0.008, t * 0.32)
  const hingeDepth = Math.min(t * 0.16, 0.01)

  const groove = (x: number) => hingeDepth * Math.exp(-Math.pow((x - hingeX) / hingeW, 2))

  const N1 = 120
  for (let i = 0; i <= N1; i++) {
    const x = THREE.MathUtils.lerp(w / 2, -w / 2, i / N1)
    raw.push(new THREE.Vector2(x, -t / 2 + groove(x)))
  }
  const backCount = raw.length
  const N2 = 46
  const a = round * t * 0.42
  for (let i = 1; i < N2; i++) {
    const th = (i / N2) * Math.PI
    raw.push(new THREE.Vector2(-w / 2 - a * Math.sin(th), -(t / 2) * Math.cos(th)))
  }
  const spineCount = raw.length
  const N3 = 120
  for (let i = 0; i <= N3; i++) {
    const x = THREE.MathUtils.lerp(-w / 2, w / 2, i / N3)
    raw.push(new THREE.Vector2(x, t / 2 - groove(x)))
  }

  // lunghezze d'arco cumulate: servono a mantenere corrette le proporzioni di stampa
  const cum = [0]
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + raw[i].distanceTo(raw[i - 1]))
  const total = cum[cum.length - 1]
  const backArc = cum[backCount - 1]
  const spineArc = cum[spineCount - 1] - backArc

  const sample = (s: number, out: THREE.Vector2) => {
    const target = THREE.MathUtils.clamp(s, 0, 1) * total
    let lo = 0
    let hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= target) lo = mid
      else hi = mid
    }
    const seg = cum[hi] - cum[lo] || 1
    const k = (target - cum[lo]) / seg
    out.set(
      THREE.MathUtils.lerp(raw[lo].x, raw[hi].x, k),
      THREE.MathUtils.lerp(raw[lo].y, raw[hi].y, k),
    )
  }

  const tmp = new THREE.Vector2()
  const fn: SurfaceFn = (u, v, out) => {
    sample(u, tmp)
    out.set(tmp.x, (v - 0.5) * h, tmp.y)
  }

  return {
    fn,
    backRange: [0, backArc / total],
    spineRange: [backArc / total, (backArc + spineArc) / total],
    frontRange: [(backArc + spineArc) / total, 1],
    arc: { back: backArc, spine: spineArc, total },
  }
}

const subSurface = (fn: SurfaceFn, [u0, u1]: [number, number]): SurfaceFn => (u, v, out) =>
  fn(THREE.MathUtils.lerp(u0, u1, u), v, out)

function pageBlock(w: number, t: number, h: number, board: number) {
  const edge = pageEdgeTexture()
  const edgeMat = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.92, color: '#fbf8f2' })
  const flat = paperMaterial('#fdfbf6', 0.1)
  const bw = w - board * 2.6
  const bt = t - board * 2.2
  const bh = h - board * 2.8
  const geo = new THREE.BoxGeometry(bw, bh, bt, 1, 1, 1)
  const mats = [edgeMat, flat, edgeMat, edgeMat, flat, flat]
  const mesh = new THREE.Mesh(geo, mats)
  mesh.position.x = board * 0.6
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Blocco pagine del libro aperto: viene estruso verso il basso a partire dalla
 * superficie della pagina, così il taglio segue la carta invece di attraversarla.
 */
function pageStackGeometry(fn: SurfaceFn, segU: number, segV: number, bottomY: number) {
  const positions: number[] = []
  const uvs: number[] = []
  const p = new THREE.Vector3()

  const wall = (
    sample: (t: number, out: THREE.Vector3) => void,
    steps: number,
    outward: THREE.Vector3,
  ) => {
    const top: THREE.Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      sample(i / steps, p)
      top.push(p.clone())
    }
    const tris: THREE.Vector3[][] = []
    const uvTris: number[][] = []
    for (let i = 0; i < steps; i++) {
      const t0 = top[i]
      const t1 = top[i + 1]
      const b0 = new THREE.Vector3(t0.x, bottomY, t0.z)
      const b1 = new THREE.Vector3(t1.x, bottomY, t1.z)
      tris.push([t0, b0, b1], [t0, b1, t1])
      const u0 = i / steps
      const u1 = (i + 1) / steps
      uvTris.push([u0, 1, u0, 0, u1, 0], [u0, 1, u1, 0, u1, 1])
    }
    const n = new THREE.Vector3()
      .subVectors(tris[0][1], tris[0][0])
      .cross(new THREE.Vector3().subVectors(tris[0][2], tris[0][0]))
    const flip = n.dot(outward) < 0
    tris.forEach((tri, i) => {
      const order = flip ? [0, 2, 1] : [0, 1, 2]
      order.forEach((k) => positions.push(tri[k].x, tri[k].y, tri[k].z))
      order.forEach((k) => uvs.push(uvTris[i][k * 2], uvTris[i][k * 2 + 1]))
    })
  }

  wall((t, out) => fn(t, 0, out), segU, new THREE.Vector3(0, 0, 1))
  wall((t, out) => fn(t, 1, out), segU, new THREE.Vector3(0, 0, -1))
  wall((t, out) => fn(0, t, out), segV, new THREE.Vector3(-1, 0, 0))
  wall((t, out) => fn(1, t, out), segV, new THREE.Vector3(1, 0, 0))

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Pagina aperta: scende verso la piega centrale e si appoggia al blocco.
 * La parametrizzazione è orientata in modo che la normale guardi in alto e la
 * grafica si legga correttamente su entrambe le pagine.
 */
function openPageSurface(w: number, h: number, lift: number, side: 1 | -1): SurfaceFn {
  return (u, v, out) => {
    const t = side === 1 ? u : 1 - u
    const x = side * THREE.MathUtils.lerp(0.005, w, t)
    const dip = Math.pow(1 - t, 2.4) * lift * 0.82
    const z = -(v - 0.5) * h
    out.set(x, lift - dip, z)
  }
}

function build(cfg: BuildConfig): BuiltMockup {
  const variant = VARIANTS[cfg.variant] ?? VARIANTS.frontale
  const format = findFormat(BOOK_FORMATS, optionString(cfg, 'formato', 'a5'))
  const { width: w, height: h } = toScene(format, HEIGHT)
  const spineMm = optionNumber(cfg, 'dorso', 24)
  const t = (spineMm / format.h) * h
  const round = optionString(cfg, 'dorso-forma', 'tondo') === 'tondo' ? 1 : 0
  const finish = optionString(cfg, 'finitura', 'patinata') === 'tela' ? 'tela' : 'patinata'
  const cover = { hex: colorHex(cfg, COVERS) }

  const group = new THREE.Group()
  const board = 0.005
  const slots: SlotDefinition[] = []

  if (variant.pose === 'open') {
    const lift = t / 2
    const coverMat = coverMaterial(cover.hex, finish)
    const paper = paperMaterial('#fdfbf6', 0.12)

    // piatti aperti appoggiati al piano
    for (const side of [-1, 1] as const) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w, board, h), coverMat)
      plate.position.set(side * (w / 2 + 0.006), board / 2, 0)
      plate.receiveShadow = true
      plate.castShadow = true
      group.add(plate)
      const edgeMat = new THREE.MeshStandardMaterial({
        map: pageEdgeTexture(),
        color: '#fbf8f2',
        roughness: 0.93,
      })
      const stackFn = openPageSurface(w - 0.014, h - 0.014, board + lift, side)
      const block = new THREE.Mesh(pageStackGeometry(stackFn, 48, 24, board), edgeMat)
      block.castShadow = true
      block.receiveShadow = true
      group.add(block)
    }

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, board, h),
      coverMat,
    )
    spine.position.set(0, board / 2, 0)
    group.add(spine)

    for (const side of [-1, 1] as const) {
      const fn = openPageSurface(w - 0.014, h - 0.014, board + lift, side)
      const pageGeo = buildSheetGeometry(fn, 0.0016, { segU: 60, segV: 40 })
      const top = new THREE.Mesh(pageGeo.front, paper)
      const under = new THREE.Mesh(pageGeo.back, paper)
      top.castShadow = true
      top.receiveShadow = true
      group.add(top, under, new THREE.Mesh(pageGeo.rim, paper))

      const id = side === 1 ? 'pagina-dx' : 'pagina-sx'
      const art = artworkMesh(fn, {
        slot: id,
        segU: 60,
        segV: 40,
        offset: 0.0012,
        roughness: 0.68,
      })
      group.add(art)
      slots.push({
        id,
        label: side === 1 ? 'Pagina destra' : 'Pagina sinistra',
        area: { width: w - 0.014, height: h - 0.014 },
        hint: `${format.label}`,
        meshes: [art],
        fullBleed: true,
      })
    }

    return { group, slots, camera: { ...variant.camera, distanceFactor: 1.0 }, dispose() {} }
  }

  const path = casePath(w, t, h, round)
  const { front, back, rim } = buildSheetGeometry(path.fn, board, { segU: 220, segV: 30 })
  const coverMat = coverMaterial(cover.hex, finish)
  const innerMat = paperMaterial('#f3ece0', 0.1)
  const outer = new THREE.Mesh(front, coverMat)
  const inner = new THREE.Mesh(back, innerMat)
  const edge = new THREE.Mesh(rim, coverMat)
  outer.castShadow = true
  outer.receiveShadow = true
  inner.castShadow = true
  group.add(outer, inner, edge)
  group.add(pageBlock(w, t, h, board))

  const areaH = h - 0.004
  const defs: { id: string; label: string; range: [number, number]; width: number; hint: string }[] = [
    {
      id: 'retro',
      label: 'Quarta',
      range: path.backRange,
      width: path.arc.back,
      hint: `${format.label}`,
    },
    {
      id: 'dorso',
      label: 'Dorso',
      range: path.spineRange,
      width: path.arc.spine,
      hint: `${spineMm} mm di dorso`,
    },
    {
      id: 'copertina',
      label: 'Copertina',
      range: path.frontRange,
      width: path.arc.total - path.arc.back - path.arc.spine,
      hint: `${format.label} — ${mm(format)}`,
    },
  ]

  for (const d of defs) {
    const fn = subSurface(path.fn, d.range)
    const art = artworkMesh(fn, {
      slot: d.id,
      segU: d.id === 'dorso' ? 40 : 90,
      segV: 30,
      offset: board / 2 + 0.0004,
      roughness: finish === 'tela' ? 0.9 : 0.4,
    })
    group.add(art)
    slots.push({
      id: d.id,
      label: d.label,
      area: { width: d.width, height: areaH },
      hint: d.hint,
      meshes: [art],
      fullBleed: true,
    })
  }
  slots.reverse()

  if (variant.pose === 'lying') {
    group.rotation.x = deg(-88)
    group.rotation.z = deg(0)
    group.position.y = t / 2
  }

  return {
    group,
    slots,
    camera: { ...variant.camera, distanceFactor: variant.pose === 'lying' ? 1.0 : 1.05 },
    dispose() {},
  }
}

export const book: MockupDefinition = {
  id: 'libro',
  name: 'Libro copertina rigida',
  category: 'editoria',
  tagline: 'Formato e dorso personalizzabili',
  description:
    'Libro cartonato con dorso tondo o quadro: scegli il formato, lo spessore del dorso e la finitura, poi stampa copertina, dorso e quarta.',
  icon: 'book',
  variants: Object.entries(VARIANTS).map(([id, v]) => ({
    id,
    label: v.label,
    description: v.description,
  })),
  colors: COVERS,
  options: [
    {
      id: 'formato',
      kind: 'select',
      label: 'Formato del libro',
      default: 'a5',
      values: BOOK_FORMATS.map((f) => ({ id: f.id, label: f.label })),
    },
    {
      id: 'dorso',
      kind: 'range',
      label: 'Spessore dorso',
      min: 8,
      max: 60,
      step: 1,
      default: 24,
      unit: 'mm',
    },
    {
      id: 'dorso-forma',
      kind: 'select',
      label: 'Profilo dorso',
      default: 'tondo',
      values: [
        { id: 'tondo', label: 'Tondo (arrotondato)' },
        { id: 'quadro', label: 'Quadro (piatto)' },
      ],
    },
    {
      id: 'finitura',
      kind: 'select',
      label: 'Finitura copertina',
      default: 'patinata',
      values: [
        { id: 'patinata', label: 'Patinata lucida' },
        { id: 'tela', label: 'Tela ruvida' },
      ],
    },
  ],
  build,
}
