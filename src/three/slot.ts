import * as THREE from 'three'
import { createArtworkMaterial, type ArtworkMaterial } from './artwork'
import { buildSurfaceGeometry, type SurfaceFn, type SurfaceOptions } from './surface'

export interface ArtworkMeshOptions extends SurfaceOptions {
  roughness?: number
  metalness?: number
  /** Identificativo dello slot a cui la mesh appartiene. */
  slot: string
}

/**
 * Mesh che ospita la grafica dell'utente: condivide la parametrizzazione
 * della superficie sottostante, quindi resta incollata al mockup.
 */
export function artworkMesh(fn: SurfaceFn, opts: ArtworkMeshOptions) {
  const geo = buildSurfaceGeometry(fn, {
    segU: opts.segU ?? 64,
    segV: opts.segV ?? 64,
    offset: opts.offset ?? 0.0012,
    flip: opts.flip,
    mirrorU: opts.mirrorU,
  })
  const mat = createArtworkMaterial({ roughness: opts.roughness, metalness: opts.metalness })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.visible = false
  mesh.renderOrder = 2
  mesh.userData.slot = opts.slot
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

export function artworkMaterialOf(mesh: THREE.Mesh) {
  return mesh.material as ArtworkMaterial
}
