import * as THREE from 'three'

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
  })
}

export const deg = (d: number) => (d * Math.PI) / 180
