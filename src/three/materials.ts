import * as THREE from 'three'
import { clothNormalMap, fabricNormalMap, knitNormalMap, paperNormalMap } from './textures'

const disposables: THREE.Material[] = []

function track<T extends THREE.Material>(m: T): T {
  disposables.push(m)
  return m
}

export function fabricMaterial(hex: string, kind: 'jersey' | 'fleece' = 'jersey') {
  const normalMap = kind === 'fleece' ? knitNormalMap(14) : fabricNormalMap(26)
  return track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: kind === 'fleece' ? 0.97 : 0.92,
      metalness: 0,
      normalMap,
      normalScale: new THREE.Vector2(kind === 'fleece' ? 0.38 : 0.3, kind === 'fleece' ? 0.38 : 0.3),
      side: THREE.FrontSide,
    }),
  )
}

export function ribMaterial(hex: string) {
  const c = new THREE.Color(hex)
  c.offsetHSL(0, 0, -0.055)
  return track(
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.98,
      metalness: 0,
      normalMap: knitNormalMap(30),
      normalScale: new THREE.Vector2(0.7, 0.7),
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
