import * as THREE from 'three'

/** Trasformazione della grafica all'interno della propria area di stampa. */
export interface ArtTransform {
  /** Scostamento orizzontale/verticale in frazione dell'area di stampa (-1..1). */
  offsetX: number
  offsetY: number
  /** 1 = la grafica è inscritta esattamente nell'area di stampa. */
  scale: number
  /** Rotazione in radianti. */
  rotation: number
  opacity: number
  flipX: boolean
}

export const defaultTransform = (): ArtTransform => ({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipX: false,
})

export interface PrintAreaSize {
  /** Dimensioni fisiche dell'area di stampa, in unità scena. */
  width: number
  height: number
}

/** Dimensione della grafica (unità scena) data l'area di stampa e l'aspect dell'immagine. */
export function artworkSize(area: PrintAreaSize, imageAspect: number, scale: number) {
  const areaAspect = area.width / area.height
  let w: number
  let h: number
  if (imageAspect >= areaAspect) {
    w = area.width * scale
    h = w / imageAspect
  } else {
    h = area.height * scale
    w = h * imageAspect
  }
  return { w, h }
}

/**
 * Matrice che porta le UV della superficie nelle UV dell'immagine.
 * Fuori dall'intervallo [0,1] il frammento viene scartato dallo shader,
 * così la grafica resta un'isola sul mockup senza bordi sbavati.
 */
export function computeUvMatrix(
  area: PrintAreaSize,
  imageAspect: number,
  t: ArtTransform,
  target = new THREE.Matrix3(),
) {
  const { w, h } = artworkSize(area, imageAspect, t.scale)
  const tx = t.offsetX * area.width * 0.5
  const ty = t.offsetY * area.height * 0.5
  const cos = Math.cos(-t.rotation)
  const sin = Math.sin(-t.rotation)
  const sx = (t.flipX ? -1 : 1) / w
  const sy = 1 / h

  // uv_img = T(.5) * S(1/w,1/h) * R(-θ) * T(-tx,-ty) * S(W,H) * T(-.5) * uv_surface
  const m = target
  const A = new THREE.Matrix3()

  m.identity()
  A.set(1, 0, -0.5, 0, 1, -0.5, 0, 0, 1)
  m.premultiply(A)
  A.set(area.width, 0, 0, 0, area.height, 0, 0, 0, 1)
  m.premultiply(A)
  A.set(1, 0, -tx, 0, 1, -ty, 0, 0, 1)
  m.premultiply(A)
  A.set(cos, -sin, 0, sin, cos, 0, 0, 0, 1)
  m.premultiply(A)
  A.set(sx, 0, 0, 0, sy, 0, 0, 0, 1)
  m.premultiply(A)
  A.set(1, 0, 0.5, 0, 1, 0.5, 0, 0, 1)
  m.premultiply(A)
  return m
}

/** Inversa utile per il trascinamento: da UV superficie a UV immagine. */
export function surfaceUvToImageUv(
  area: PrintAreaSize,
  imageAspect: number,
  t: ArtTransform,
  u: number,
  v: number,
) {
  const m = computeUvMatrix(area, imageAspect, t)
  const p = new THREE.Vector3(u, v, 1).applyMatrix3(m)
  return { u: p.x, v: p.y }
}

export interface ArtworkMaterialOptions {
  /** Materiale opaco: usato per poster e stampati dove la grafica copre il supporto. */
  roughness?: number
  metalness?: number
}

export interface ArtworkMaterial extends THREE.MeshStandardMaterial {
  userData: {
    uvMatrix: THREE.Matrix3
    setUvMatrix(m: THREE.Matrix3): void
  }
}

/**
 * MeshStandardMaterial con UV trasformate via matrice e scarto dei frammenti
 * esterni all'immagine: mantiene l'illuminazione PBR della scena, così la
 * grafica appare davvero stampata sul supporto.
 */
export function createArtworkMaterial(opts: ArtworkMaterialOptions = {}) {
  const mat = new THREE.MeshStandardMaterial({
    transparent: true,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
    depthWrite: true,
    toneMapped: true,
  }) as ArtworkMaterial

  const uvMatrix = new THREE.Matrix3()
  const uniforms = { uArtMatrix: { value: uvMatrix } }

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uArtMatrix = uniforms.uArtMatrix
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform mat3 uArtMatrix;\nvoid main() {',
      )
      .replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec2 artUv = ( uArtMatrix * vec3( vMapUv, 1.0 ) ).xy;
          if ( artUv.x < 0.0 || artUv.x > 1.0 || artUv.y < 0.0 || artUv.y > 1.0 ) discard;
          vec4 sampledDiffuseColor = texture2D( map, artUv );
          if ( sampledDiffuseColor.a < 0.008 ) discard;
          diffuseColor *= sampledDiffuseColor;
        #endif
        `,
      )
  }

  mat.userData = {
    uvMatrix,
    setUvMatrix(m: THREE.Matrix3) {
      uvMatrix.copy(m)
    },
  }
  mat.customProgramCacheKey = () => 'mockify-artwork'
  return mat
}

export function makeImageTexture(image: HTMLImageElement, renderer?: THREE.WebGLRenderer) {
  const tex = new THREE.Texture(image)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = renderer ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 8
  tex.needsUpdate = true
  return tex
}
