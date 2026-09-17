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

export function disposeTextureCache() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
