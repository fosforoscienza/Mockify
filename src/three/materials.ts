import * as THREE from 'three'
import { clothNormalMap, fabricNormalMap, knitNormalMap, paperNormalMap } from './textures'

const disposables: THREE.Material[] = []

function track<T extends THREE.Material>(m: T): T {
  disposables.push(m)
  return m
}

/**
 * Tessuto: PBR con "sheen", il termine pensato per i filati. È quello che
 * distingue una stoffa da una plastica opaca, soprattutto sui bordi in luce.
 * I vertex color portano l'occlusione ambientale e moltiplicano il colore
 * scelto, così cambiando tinta restano pieghe e ombre.
 */
export function fabricMaterial(
  hex: string,
  kind: 'jersey' | 'fleece' = 'jersey',
  opts: { vertexColors?: boolean; doubleSide?: boolean } = {},
) {
  const color = new THREE.Color(hex)
  const sheenColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.55)
  const scale = kind === 'fleece' ? 0.42 : 0.32
  return track(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: kind === 'fleece' ? 0.96 : 0.9,
      metalness: 0,
      sheen: kind === 'fleece' ? 0.7 : 0.45,
      sheenColor,
      sheenRoughness: kind === 'fleece' ? 0.85 : 0.6,
      normalMap: kind === 'fleece' ? knitNormalMap(14) : fabricNormalMap(26),
      normalScale: new THREE.Vector2(scale, scale),
      vertexColors: opts.vertexColors ?? false,
      side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    }),
  )
}

export function paperMaterial(hex = '#ffffff', gloss = 0.25) {
  return track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 1 - gloss * 0.7,
      metalness: 0,
      normalMap: paperNormalMap(4),
      normalScale: new THREE.Vector2(0.22, 0.22),
      side: THREE.FrontSide,
    }),
  )
}

export function coverMaterial(hex: string, finish: 'tela' | 'patinata' = 'tela') {
  return track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: finish === 'tela' ? 0.93 : 0.42,
      metalness: 0,
      normalMap: finish === 'tela' ? clothNormalMap(10) : paperNormalMap(4),
      normalScale: new THREE.Vector2(finish === 'tela' ? 0.6 : 0.15, finish === 'tela' ? 0.6 : 0.15),
    }),
  )
}

export function plasticMaterial(hex: string, roughness = 0.4) {
  return track(
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness: 0.05 }),
  )
}

export function metalMaterial(hex = '#c9ccd3') {
  return track(
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.28, metalness: 0.9 }),
  )
}

export function woodMaterial(hex = '#c29a63') {
  return track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.68,
      metalness: 0,
      normalMap: paperNormalMap(2),
      normalScale: new THREE.Vector2(0.3, 0.3),
    }),
  )
}

export function threadMaterial(hex: string) {
  const c = new THREE.Color(hex)
  c.offsetHSL(0, 0, -0.16)
  return track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 }))
}

export function disposeMaterialCache() {
  disposables.forEach((m) => m.dispose())
  disposables.length = 0
}
