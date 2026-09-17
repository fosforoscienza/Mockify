import * as THREE from 'three'

/**
 * Tutte le texture dell'app sono generate a runtime su canvas:
 * l'applicazione non dipende da asset esterni ed è interamente offline.
 */

const cache = new Map<string, THREE.Texture>()

function makeCanvas(size: number) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

/** Value noise tileabile (grid periodica + interpolazione smoothstep). */
function valueNoise(size: number, grid: number, seed: number) {
  const rand = mulberry32(seed)
  const g: number[] = []
  for (let i = 0; i < grid * grid; i++) g.push(rand())
  const at = (x: number, y: number) => g[((y % grid) + grid) % grid * grid + (((x % grid) + grid) % grid)]
  const out = new Float32Array(size * size)
  const cell = size / grid
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell)
      const gy = Math.floor(y / cell)
      const tx = smooth((x / cell) - gx)
      const ty = smooth((y / cell) - gy)
      const a = lerp(at(gx, gy), at(gx + 1, gy), tx)
      const b = lerp(at(gx, gy + 1), at(gx + 1, gy + 1), tx)
      out[y * size + x] = lerp(a, b, ty)
    }
  }
  return out
}

function fbm(size: number, seed: number, octaves = 4, baseGrid = 4) {
  const out = new Float32Array(size * size)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, baseGrid * Math.pow(2, o), seed + o * 977)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Converte una heightmap in una normal map tangenziale. */
function heightToNormal(height: Float32Array, size: number, strength: number) {
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) => height[((y % size) + size) % size * size + (((x % size) + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const n = new THREE.Vector3(-dx, -dy, 1).normalize()
      const i = (y * size + x) * 4
      img.data[i] = (n.x * 0.5 + 0.5) * 255
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function finish(canvas: HTMLCanvasElement, repeat: number, colorSpace?: THREE.ColorSpace) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  if (colorSpace) tex.colorSpace = colorSpace
  tex.needsUpdate = true
  return tex
}

/** Trama di tessuto: intreccio regolare + fibre irregolari. */
export function fabricNormalMap(repeat = 22): THREE.Texture {
  const key = `fabric-n-${repeat}`
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const noise = fbm(size, 1337, 4, 8)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave = Math.sin((x / size) * Math.PI * 64) * Math.sin((y / size) * Math.PI * 64)
      h[y * size + x] = weave * 0.35 + noise[y * size + x] * 0.65
    }
  }
  const tex = finish(heightToNormal(h, size, 2.2), repeat)
  cache.set(key, tex)
  return tex
}

/** Maglia felpata: trama più grossa e morbida. */
export function knitNormalMap(repeat = 16): THREE.Texture {
  const key = `knit-n-${repeat}`
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const noise = fbm(size, 90210, 5, 6)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rib = Math.sin((x / size) * Math.PI * 36) * 0.07
      h[y * size + x] = rib + noise[y * size + x] * 0.93
    }
  }
  const tex = finish(heightToNormal(h, size, 2.6), repeat)
  cache.set(key, tex)
  return tex
}

/** Grana della carta: rumore fine, rilievo appena percettibile. */
export function paperNormalMap(repeat = 6): THREE.Texture {
  const key = `paper-n-${repeat}`
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const noise = fbm(size, 424242, 4, 32)
  const tex = finish(heightToNormal(noise, size, 0.9), repeat)
  cache.set(key, tex)
  return tex
}

/** Tela ruvida per copertine rigide. */
export function clothNormalMap(repeat = 14): THREE.Texture {
  const key = `cloth-n-${repeat}`
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const noise = fbm(size, 5150, 3, 16)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave =
        Math.sin((x / size) * Math.PI * 48) * 0.3 + Math.sin((y / size) * Math.PI * 48) * 0.3
      h[y * size + x] = weave * 0.5 + noise[y * size + x] * 0.5
    }
  }
  const tex = finish(heightToNormal(h, size, 2.0), repeat)
  cache.set(key, tex)
  return tex
}

/** Bordo del blocco pagine: righe sottili chiaro/scuro. */
export function pageEdgeTexture(): THREE.Texture {
  const key = 'page-edge'
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f7f4ee'
  ctx.fillRect(0, 0, size, size)
  const rand = mulberry32(7)
  for (let i = 0; i < size * 3; i++) {
    const x = rand() * size
    const v = 0.72 + rand() * 0.28
    ctx.strokeStyle = `rgba(${Math.round(150 * v)},${Math.round(142 * v)},${Math.round(128 * v)},0.5)`
    ctx.lineWidth = 0.6 + rand() * 0.8
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
  }
  const tex = finish(canvas, 1, THREE.SRGBColorSpace)
  tex.repeat.set(1, 1)
  cache.set(key, tex)
  return tex
}

/** Rete traforata per cappellini trucker. */
export function meshAlphaTexture(): THREE.Texture {
  const key = 'trucker-mesh'
  if (cache.has(key)) return cache.get(key)!
  const size = 128
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 3
  for (let i = 0; i <= 8; i++) {
    const p = (i / 8) * size
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, size)
    ctx.moveTo(0, p)
    ctx.lineTo(size, p)
    ctx.stroke()
  }
  const tex = finish(canvas, 10)
  cache.set(key, tex)
  return tex
}

/** Macchia morbida usata come ombra a terra (radiale, alpha puro). */
export function softShadowTexture(): THREE.Texture {
  const key = 'soft-shadow'
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.25)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(key, tex)
  return tex
}

/**
 * Ombra rettangolare sfumata: segue la forma di un foglio invece di essere
 * una macchia tonda. La parte piena occupa il 60% della texture, così il piano
 * si dimensiona al foglio e la sfumatura resta tutt'attorno.
 */
export function sheetShadowTexture(): THREE.Texture {
  const key = 'sheet-shadow'
  if (cache.has(key)) return cache.get(key)!
  const size = 256
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')!
  const inset = size * 0.07
  ctx.filter = 'blur(7px)'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2)
  ctx.filter = 'none'
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(key, tex)
  return tex
}

/**
 * Tastiera di un portatile: file di tasti con le larghezze reali della
 * disposizione Mac, disegnate una volta sola. A dimensione di mockup i tasti
 * sono pochi pixel, quindi una texture rende quanto una geometria vera e
 * costa un millesimo.
 */
export const KEYBOARD_ASPECT = 5.62 / 14.5

export function keyboardTexture(): THREE.Texture {
  const key = 'keyboard'
  if (cache.has(key)) return cache.get(key)!
  // larghezze in "unità tasto"; ogni fila somma a 14.5
  const rows: { h: number; keys: number[] }[] = [
    { h: 0.62, keys: [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { h: 1, keys: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5] },
    { h: 1, keys: [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { h: 1, keys: [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75] },
    { h: 1, keys: [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25] },
    { h: 1, keys: [1, 1, 1, 1.25, 5, 1.25, 1] },
  ]
  const UNITS = 14.5
  const GAP = 0.075
  const width = 1536
  const unit = width / UNITS
  const height = Math.round(unit * rows.reduce((t, r) => t + r.h, 0))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0e1013'
  ctx.fillRect(0, 0, width, height)

  const pad = (GAP / 2) * unit
  const drawKey = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(w, h) * 0.16
    ctx.beginPath()
    ctx.roundRect(x + pad, y + pad, w - pad * 2, h - pad * 2, r)
    ctx.fillStyle = '#2d3037'
    ctx.fill()
    // luce radente sul bordo alto del tasto
    ctx.beginPath()
    ctx.roundRect(x + pad, y + pad, w - pad * 2, (h - pad * 2) * 0.45, r)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fill()
  }

  let y = 0
  rows.forEach((row, i) => {
    const h = row.h * unit
    let x = 0
    row.keys.forEach((kw) => {
      drawKey(x, y, kw * unit, h)
      x += kw * unit
    })
    // ultima fila: il blocco frecce occupa le 3 unità rimaste, con su e giù
    // affiancate a mezza altezza
    if (i === rows.length - 1) {
      drawKey(x, y, unit, h)
      drawKey(x + unit, y, unit, h / 2)
      drawKey(x + unit, y + h / 2, unit, h / 2)
      drawKey(x + unit * 2, y, unit, h)
    }
    y += h
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}

/**
 * Griglia degli altoparlanti: fori scuri su fondo trasparente, così sotto
 * resta il colore della scocca qualunque finitura sia stata scelta.
 */
export function speakerGrilleTexture(): THREE.Texture {
  const key = 'speaker-grille'
  if (cache.has(key)) return cache.get(key)!
  const size = 64
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(12,14,17,0.82)'
  const step = size / 8
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.beginPath()
      ctx.arc((x + 0.5) * step, (y + 0.5) * step, step * 0.24, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}

export function disposeTextureCache() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
