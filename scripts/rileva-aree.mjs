/**
 * Rileva le aree di stampa sulle foto di base.
 *
 * Stimare a occhio i quattro spigoli di un'area non funziona: su uno schermo
 * inclinato o su un cartellone in prospettiva bastano due punti di scarto
 * perché la grafica sbordi o lasci un bordo bianco. Qui l'area viene trovata
 * dalla foto stessa: si isola la regione chiara dentro una finestra di
 * ricerca, se ne prende il guscio convesso e lo si ruota sull'orientamento del
 * rettangolo di area minima. Nel riferimento raddrizzato i quattro spigoli
 * sono gli estremi di x+y e x-y — cosa che sul soggetto inclinato non vale, ed
 * è il motivo per cui il primo rilevatore sbagliava gli spigoli dei telefoni.
 *
 * La finestra serve a non agganciare ciò che è chiaro ma non è l'area: l'auto
 * di passaggio accanto al cartellone, il muro, l'asfalto. La soglia di
 * luminanza è per scatto, perché il cartellone di tre quarti confina con un
 * muro quasi altrettanto chiaro, mentre quello frontale ha una fascia in ombra
 * che una soglia alta taglierebbe via.
 *
 * Gli spigoli escono da un angolo qualunque del quadrilatero: l'ordine viene
 * poi raddrizzato confrontando le proporzioni misurate con quelle attese della
 * stampa, così lo spigolo 0 è sempre l'alto-sinistra e la grafica non esce
 * ruotata di 90°.
 *
 * Uso:  node scripts/rileva-aree.mjs
 * Le coordinate vanno riportate a mano in src/photo/bases.ts: sono dati
 * rivisti, non generati a ogni build.
 */
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.join(process.cwd(), 'public', 'basi')

/**
 * win: finestra di ricerca [x0, y0, x1, y1] in coordinate normalizzate.
 * ar:  proporzione attesa della stampa (larghezza / altezza).
 * lum: soglia di luminanza, se quella predefinita non separa l'area.
 */
const AREE = [
  { key: 'telefono/01/fronte-retro', file: 'telefono/01/fronte-retro.webp', win: [0.42, 0.14, 0.75, 0.92], ar: 0.46 },
  { key: 'telefono/01/inclinato-fronte-retro', file: 'telefono/01/inclinato-fronte-retro.webp', win: [0.38, 0.2, 0.8, 0.85], ar: 0.46 },
  { key: 'telefono/01/inclinato', file: 'telefono/01/inclinato.webp', win: [0.22, 0.15, 0.78, 0.88], ar: 0.46 },
  { key: 'manifesto/600x300-01/fronte', file: 'manifesto/600x300-01/fronte.webp', win: [0.08, 0.3, 0.92, 0.8], ar: 2 },
  { key: 'manifesto/600x300-01/tre-quarti', file: 'manifesto/600x300-01/tre-quarti.webp', win: [0.15, 0.25, 0.86, 0.8], ar: 2, lum: 0.62 },
  { key: 'manifesto/70x100-01/fronte · sinistra', file: 'manifesto/70x100-01/fronte.webp', win: [0.17, 0.18, 0.44, 0.7], ar: 0.7 },
  { key: 'manifesto/70x100-01/fronte · destra', file: 'manifesto/70x100-01/fronte.webp', win: [0.59, 0.18, 0.87, 0.7], ar: 0.7 },
]

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/** Guscio convesso, monotone chain. */
function hullOf(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lower = []
  const upper = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

async function rileva(job) {
  const file = path.join(ROOT, job.file)
  const meta = await sharp(file).metadata()
  const N = 1200
  const scale = N / Math.max(meta.width, meta.height)
  const W = Math.round(meta.width * scale)
  const H = Math.round(meta.height * scale)
  const { data } = await sharp(file).resize(W, H).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  const [wx0, wy0, wx1, wy1] = job.win
  const x0 = Math.round(wx0 * W)
  const y0 = Math.round(wy0 * H)
  const w = Math.round(wx1 * W) - x0
  const h = Math.round(wy1 * H) - y0
  const lumMin = job.lum ?? 0.55

  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * W + x + x0) * 4
      const mx = Math.max(data[i], data[i + 1], data[i + 2])
      const mn = Math.min(data[i], data[i + 1], data[i + 2])
      const sat = mx === 0 ? 0 : (mx - mn) / mx
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
      mask[y * w + x] = data[i + 3] > 150 && lum > lumMin && sat < 0.22 ? 1 : 0
    }
  }

  // componente connessa più grande
  const seen = new Uint8Array(w * h)
  let best = null
  const stack = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue
    const px = []
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const p = stack.pop()
      px.push(p)
      const col = p % w
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || !mask[q]) continue
        if (Math.abs((q % w) - col) > 1) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    if (!best || px.length > best.length) best = px
  }
  if (!best) throw new Error(`nessuna area chiara in ${job.key}`)

  const inside = new Uint8Array(w * h)
  for (const p of best) inside[p] = 1
  const border = []
  for (const p of best) {
    const col = p % w
    const row = (p / w) | 0
    if (col === 0 || col === w - 1 || row === 0 || row === h - 1 ||
        !inside[p - 1] || !inside[p + 1] || !inside[p - w] || !inside[p + w]) border.push([col, row])
  }
  const hull = hullOf(border)

  // orientamento del rettangolo di area minima
  let minArea = Infinity
  let theta = 0
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const cs = Math.cos(-ang)
    const sn = Math.sin(-ang)
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity
    for (const p of hull) {
      const rx = p[0] * cs - p[1] * sn
      const ry = p[0] * sn + p[1] * cs
      if (rx < mnx) mnx = rx
      if (rx > mxx) mxx = rx
      if (ry < mny) mny = ry
      if (ry > mxy) mxy = ry
    }
    const area = (mxx - mnx) * (mxy - mny)
    if (area < minArea) { minArea = area; theta = ang }
  }

  const cs = Math.cos(-theta)
  const sn = Math.sin(-theta)
  let tl = null, tr = null, br = null, bl = null
  let s1 = Infinity, s2 = -Infinity, s3 = Infinity, s4 = -Infinity
  for (const p of hull) {
    const rx = p[0] * cs - p[1] * sn
    const ry = p[0] * sn + p[1] * cs
    if (rx + ry < s1) { s1 = rx + ry; tl = p }
    if (rx + ry > s2) { s2 = rx + ry; br = p }
    if (rx - ry > s4) { s4 = rx - ry; tr = p }
    if (rx - ry < s3) { s3 = rx - ry; bl = p }
  }
  const quad = [tl, tr, br, bl].map((p) => [(p[0] + x0) / W, (p[1] + y0) / H])

  // Raddrizza l'ordine: fra le quattro rotazioni si sceglie quella le cui
  // proporzioni somigliano alla stampa attesa, e a parità quella che parte
  // dall'angolo in alto a sinistra.
  const px = quad.map(([a, b]) => [a * meta.width, b * meta.height])
  const len = (a, b) => Math.hypot(px[a][0] - px[b][0], px[a][1] - px[b][1])
  let pick = null
  for (let r = 0; r < 4; r++) {
    const i = (n) => (n + r) % 4
    const bw = (len(i(0), i(1)) + len(i(3), i(2))) / 2
    const bh = (len(i(0), i(3)) + len(i(1), i(2))) / 2
    const err = Math.abs(Math.log(bw / bh / job.ar))
    const corner = quad[i(0)][0] + quad[i(0)][1]
    if (!pick || err < pick.err - 1e-6 || (Math.abs(err - pick.err) < 1e-6 && corner < pick.corner))
      pick = { r, err, corner, ar: bw / bh }
  }
  const i = (n) => (n + pick.r) % 4
  return { quad: [quad[i(0)], quad[i(1)], quad[i(2)], quad[i(3)]], ar: pick.ar }
}

for (const job of AREE) {
  const { quad, ar } = await rileva(job)
  const txt = quad.map(([a, b]) => `[${a.toFixed(3)}, ${b.toFixed(3)}]`).join(', ')
  console.log(`${job.key}\n    proporzione ${ar.toFixed(2)} (attesa ${job.ar})\n    [${txt}]`)
}
